-- 여행 공유(초대 코드) 마이그레이션. 2026-10-31에 DB에 적용했다(적용 후 trips 정책을 "주인 또는 can_access_trip"으로 보완함).
-- 하는 일: 초대 코드·멤버 테이블 추가, 사용자별 여행 모드 테이블 추가,
--         trips/trip_items의 RLS를 "주인 또는 멤버" 기준으로 교체, 공유용 함수 5개 추가.

alter table public.trips add column if not exists invite_code text unique;

create table public.trip_members (
  trip_id bigint not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members (user_id);

-- 여행 모드는 사람마다 따로(여행 하나에 여러 명이 있어도 서로 영향이 없게)
create table public.trip_mode (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  trip_id bigint not null references public.trips(id) on delete cascade
);
insert into public.trip_mode (user_id, trip_id) select user_id, id from public.trips where is_active on conflict do nothing;

-- 여행에 접근할 수 있는지(주인 또는 멤버). RLS 재귀를 피하려고 security definer
create function public.can_access_trip(p_trip_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid())
      or exists (select 1 from public.trip_members m where m.trip_id = p_trip_id and m.user_id = auth.uid());
$$;
create function public.is_trip_owner(p_trip_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid());
$$;

-- trips: 보기·수정은 주인과 멤버, 만들기·삭제는 주인만(기존 insert/delete 정책 유지)
drop policy "own trips select" on public.trips;
drop policy "own trips update" on public.trips;
create policy "members trips select" on public.trips for select to authenticated using (public.can_access_trip(id));
create policy "members trips update" on public.trips for update to authenticated using (public.can_access_trip(id)) with check (public.can_access_trip(id));
-- 주인 변경·초대 코드 직접 수정은 막는다
revoke update on public.trips from authenticated, anon;
grant update (name, start_date, end_date, currency, people, is_active) on public.trips to authenticated;

-- trip_items: 주인과 멤버 모두 보고 고칠 수 있다
drop policy "own items select" on public.trip_items;
drop policy "own items insert" on public.trip_items;
drop policy "own items update" on public.trip_items;
drop policy "own items delete" on public.trip_items;
create policy "members items select" on public.trip_items for select to authenticated using (public.can_access_trip(trip_id));
create policy "members items insert" on public.trip_items for insert to authenticated with check (user_id = (select auth.uid()) and public.can_access_trip(trip_id));
create policy "members items update" on public.trip_items for update to authenticated using (public.can_access_trip(trip_id)) with check (public.can_access_trip(trip_id));
create policy "members items delete" on public.trip_items for delete to authenticated using (public.can_access_trip(trip_id));

alter table public.trip_members enable row level security;
create policy "members select" on public.trip_members for select to authenticated using (public.can_access_trip(trip_id));
create policy "members leave or owner removes" on public.trip_members for delete to authenticated using (user_id = (select auth.uid()) or public.is_trip_owner(trip_id));

alter table public.trip_mode enable row level security;
create policy "own mode select" on public.trip_mode for select to authenticated using (user_id = (select auth.uid()));
create policy "own mode insert" on public.trip_mode for insert to authenticated with check (user_id = (select auth.uid()) and public.can_access_trip(trip_id));
create policy "own mode update" on public.trip_mode for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_access_trip(trip_id));
create policy "own mode delete" on public.trip_mode for delete to authenticated using (user_id = (select auth.uid()));

-- 초대 코드 만들기/조회(주인·멤버). 8자리, 헷갈리는 글자(0,O,1,I) 제외
create function public.get_trip_invite_code(p_trip_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare code text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if not public.can_access_trip(p_trip_id) then raise exception 'no_access'; end if;
  select invite_code into code from public.trips where id = p_trip_id;
  if code is not null then return code; end if;
  loop
    code := '';
    for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    begin
      update public.trips set invite_code = code where id = p_trip_id;
      return code;
    exception when unique_violation then null;
    end;
  end loop;
end $$;

-- 초대 코드로 참여
create function public.join_trip_by_code(p_code text) returns bigint
language plpgsql security definer set search_path = public as $$
declare tid bigint; owner uuid; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'no_login'; end if;
  select id, user_id into tid, owner from public.trips where invite_code = c;
  if tid is null then raise exception 'invalid_code'; end if;
  if owner <> auth.uid() then
    insert into public.trip_members (trip_id, user_id) values (tid, auth.uid()) on conflict do nothing;
  end if;
  return tid;
end $$;

-- 같이 쓰는 사람(이메일 앞부분만 보여 준다)
create function public.get_trip_members(p_trip_id bigint) returns table (user_id uuid, name text, is_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_access_trip(p_trip_id) then raise exception 'no_access'; end if;
  return query
    select t.user_id, split_part(u.email, '@', 1), true from public.trips t join auth.users u on u.id = t.user_id where t.id = p_trip_id
    union all
    select m.user_id, split_part(u.email, '@', 1), false from public.trip_members m join auth.users u on u.id = m.user_id where m.trip_id = p_trip_id;
end $$;

-- 내가 접근할 수 있는 모든 여행에 묶인 지출(다른 멤버 것 포함). 가계부 본문에는 섞이지 않는다
create function public.get_shared_trip_expenses() returns table (
  id bigint, date date, amount integer, place text, category text, memo text, currency text,
  original_amount numeric, exchange_rate numeric, trip_id bigint, user_id uuid, mine boolean, who text)
language sql stable security definer set search_path = public as $$
  select e.id, e.date, e.amount, e.place, e.category, e.memo, e.currency, e.original_amount, e.exchange_rate, e.trip_id, e.user_id,
         e.user_id = auth.uid(), split_part(u.email, '@', 1)
  from public.expenses e
  left join auth.users u on u.id = e.user_id
  where e.trip_id is not null and public.can_access_trip(e.trip_id)
  order by e.date desc, e.id desc;
$$;

revoke execute on function public.can_access_trip(bigint), public.is_trip_owner(bigint), public.get_trip_invite_code(bigint), public.join_trip_by_code(text), public.get_trip_members(bigint), public.get_shared_trip_expenses() from public, anon;
grant execute on function public.can_access_trip(bigint), public.is_trip_owner(bigint), public.get_trip_invite_code(bigint), public.join_trip_by_code(text), public.get_trip_members(bigint), public.get_shared_trip_expenses() to authenticated;
