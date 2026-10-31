'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { CURRENCIES, currencyOf, formatDate, perPerson, toDateStr, won } from './shared';
import ExpenseRow from './expense-row';
import TripPlan from './trip-plan';
import Icon from './icons';
import { askConfirm } from './confirm';

const newTrip = () => ({
  name: '',
  start_date: toDateStr(new Date()),
  end_date: toDateStr(new Date()),
  currency: 'KRW',
  people: 1,
});

const shortDate = (s) => s.slice(5).replace('-', '/');
const periodText = (t) => `${shortDate(t.start_date)} ~ ${shortDate(t.end_date)}`;

function statusText(t) {
  const today = toDateStr(new Date());
  if (today > t.end_date) return '다녀옴';
  if (today >= t.start_date) return '여행 중';
  return `D-${Math.round((new Date(t.start_date) - new Date(today)) / 86400000)}`;
}

export default function TripsView({ trips, setTrips, expenses, setExpenses, setError, userId, onEditExpense }) {
  const [openId, setOpenId] = useState(null);
  const [sheet, setSheet] = useState(null); // { id: 수정 중인 여행 id 또는 null, form }
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState([]); // 내가 접근할 수 있는 모든 여행의 지출(같이 쓰는 사람 것 포함)
  const [members, setMembers] = useState([]);
  const [code, setCode] = useState('');
  const [join, setJoin] = useState(null); // { code, busy, error }

  // 내 지출이 바뀌거나 여행이 바뀌면 공유 지출을 다시 불러온다
  useEffect(() => {
    supabase.rpc('get_shared_trip_expenses').then(({ data, error }) => {
      if (error) setError('여행 지출을 불러오지 못했어요: ' + error.message);
      else setShared(data);
    });
  }, [expenses, trips.length]);

  // 여행을 열면 같이 쓰는 사람을 불러온다
  useEffect(() => {
    setMembers([]);
    setCode('');
    if (openId === null) return;
    supabase.rpc('get_trip_members', { p_trip_id: openId }).then(({ data }) => data && setMembers(data));
  }, [openId, trips.length]);

  const sorted = [...trips].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const trip = trips.find((t) => t.id === openId);
  const isOwner = trip?.user_id === userId;
  const spent = (id) => shared.filter((e) => e.trip_id === id);
  const total = (id) => spent(id).reduce((s, e) => s + e.amount, 0);
  // 이 여행에 연결된 지출만 날짜별(최신 날짜 먼저)로 묶는다
  const spentByDay = (id) =>
    Object.entries(
      spent(id).reduce((acc, e) => {
        (acc[e.date] ??= []).push(e);
        return acc;
      }, {}),
    ).sort(([a], [b]) => (a < b ? 1 : -1));

  async function save(e) {
    e.preventDefault();
    const { form, id } = sheet;
    setBusy(true);
    const row = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      currency: form.currency,
      people: form.people,
    };
    const query = id === null ? supabase.from('trips').insert(row) : supabase.from('trips').update(row).eq('id', id);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      setError('여행을 저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setTrips(id === null ? [data, ...trips] : trips.map((t) => (t.id === id ? data : t)));
    setSheet(null);
  }

  async function remove() {
    if (!isOwner) {
      if (!(await askConfirm(`'${trip.name}' 여행에서 나갈까요?\n내 지출은 남고, 이 여행과의 연결은 풀려요. 다시 들어오려면 초대 코드가 필요해요.`))) return;
      const { error } = await supabase.from('trip_members').delete().eq('trip_id', trip.id).eq('user_id', userId);
      if (error) {
        setError('여행에서 나가지 못했어요: ' + error.message);
        return;
      }
      await supabase.from('trip_mode').delete().eq('trip_id', trip.id);
      await supabase.from('expenses').update({ trip_id: null }).eq('trip_id', trip.id);
      setError('');
      setExpenses(expenses.map((x) => (x.trip_id === trip.id ? { ...x, trip_id: null } : x)));
      setTrips(trips.filter((t) => t.id !== trip.id));
      setOpenId(null);
      return;
    }
    if (!(await askConfirm(`'${trip.name}' 여행을 삭제할까요?\n같이 쓰는 사람들도 이 여행을 볼 수 없게 돼요. 여행에 묶인 지출은 남고, 여행과의 연결만 풀려요.`))) return;
    const { error } = await supabase.from('trips').delete().eq('id', trip.id);
    if (error) {
      setError('여행을 삭제하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setExpenses(expenses.map((x) => (x.trip_id === trip.id ? { ...x, trip_id: null } : x)));
    setTrips(trips.filter((t) => t.id !== trip.id));
    setOpenId(null);
  }

  // 여행 모드는 사람마다 하나만 켤 수 있다(trip_mode 표에 내 것만 저장)
  async function toggleMode() {
    const { error } = trip.is_active
      ? await supabase.from('trip_mode').delete().eq('trip_id', trip.id)
      : await supabase.from('trip_mode').upsert({ trip_id: trip.id }, { onConflict: 'user_id' });
    if (error) {
      setError('여행 모드를 바꾸지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setTrips(trips.map((t) => ({ ...t, is_active: t.id === trip.id ? !trip.is_active : false })));
  }

  // 초대 코드(없으면 만들어진다)
  async function showCode() {
    const { data, error } = await supabase.rpc('get_trip_invite_code', { p_trip_id: trip.id });
    if (error) return setError('초대 코드를 가져오지 못했어요: ' + error.message);
    setError('');
    setCode(data);
  }
  const prettyCode = code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(prettyCode);
      setError('');
    } catch {
      setError('복사하지 못했어요. 코드를 직접 적어서 알려 주세요');
    }
  }

  async function removeMember(m) {
    if (!(await askConfirm(`'${m.name}' 님을 이 여행에서 내보낼까요?`))) return;
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', trip.id).eq('user_id', m.user_id);
    if (error) return setError('내보내지 못했어요: ' + error.message);
    setError('');
    setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
  }

  // 초대 코드로 다른 사람의 여행에 참여
  async function joinTrip(e) {
    e.preventDefault();
    setJoin((j) => ({ ...j, busy: true, error: '' }));
    const { data, error } = await supabase.rpc('join_trip_by_code', { p_code: join.code });
    if (error) {
      setJoin((j) => ({ ...j, busy: false, error: error.message.includes('invalid_code') ? '코드가 맞지 않아요. 다시 확인해 주세요' : '참여하지 못했어요: ' + error.message }));
      return;
    }
    const { data: list, error: listError } = await supabase.from('trips').select('*');
    if (listError) return setError('여행을 불러오지 못했어요: ' + listError.message);
    setTrips(list.map((x) => ({ ...x, is_active: trips.find((o) => o.id === x.id)?.is_active ?? false })));
    setError('');
    setJoin(null);
    setOpenId(data);
  }

  const setField = (key) => (e) => setSheet({ ...sheet, form: { ...sheet.form, [key]: e.target.value } });
  const setPeople = (n) => setSheet({ ...sheet, form: { ...sheet.form, people: Math.min(99, Math.max(1, n)) } });

  return (
    <section className="trips">
      {!trip && (
        <>
          <button className="new-trip" onClick={() => setSheet({ id: null, form: newTrip() })}>
            + 새 여행 만들기
          </button>
          <button className="join-trip" onClick={() => setJoin({ code: '', busy: false, error: '' })}>
            초대 코드로 여행에 참여하기
          </button>
          {sorted.length === 0 && (
            <div className="empty">
              <p><Icon name="suitcase" size={44} /></p>
              <p>아직 여행이 없어요!</p>
              <p className="sub">여행을 만들고 일정과 지출을 모아 보세요</p>
            </div>
          )}
          <ul className="trip-list">
            {sorted.map((t) => (
              <li key={t.id} className="trip-card" onClick={() => setOpenId(t.id)}>
                <div className="trip-top">
                  <strong>{t.name}</strong>
                  <span>
                    {t.user_id !== userId && <span className="badge shared">같이 쓰는 여행</span>}
                    {t.is_active && <span className="badge">여행 모드 ON</span>}
                  </span>
                </div>
                <small>
                  {periodText(t)} · {currencyOf(t.currency).symbol} {currencyOf(t.currency).label} · <Icon name="people" size={14} /> {t.people}명 ·{' '}
                  {statusText(t)}
                </small>
                <span className="trip-total">
                  {won(total(t.id))} <small>{spent(t.id).length}건</small>
                </span>
                {t.people > 1 && <span className="pp">1인 {won(perPerson(total(t.id), t.people))}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {trip && (
        <>
          <button className="back" onClick={() => setOpenId(null)}>
            ← 여행 목록
          </button>
          <div className="trip-head">
            <div className="trip-top">
              <h2>{trip.name}</h2>
              {trip.is_active && <span className="badge">여행 모드 ON</span>}
            </div>
            <small>
              {trip.start_date} ~ {trip.end_date} · {currencyOf(trip.currency).symbol} {currencyOf(trip.currency).label} · 👥{' '}
              {trip.people}명 · {statusText(trip)}
            </small>
            <p className="trip-sum">
              {won(total(trip.id))} <small>지출 {spent(trip.id).length}건</small>
            </p>
            {trip.people > 1 && (
              <p className="pp">
                1인 {won(perPerson(total(trip.id), trip.people))} <small>({trip.people}명으로 나눈 금액)</small>
              </p>
            )}
            <button className={trip.is_active ? 'mode on' : 'mode'} onClick={toggleMode}>
              {trip.is_active ? '여행 모드 끄기' : '여행 모드 켜기 (지출이 이 여행에 자동 연결돼요)'}
            </button>
            <div className="trip-actions">
              <button onClick={() => setSheet({ id: trip.id, form: { ...trip } })}>수정</button>
              <button className="danger-text" onClick={remove}>
                {isOwner ? '삭제' : '여행 나가기'}
              </button>
            </div>
          </div>
          <div className="trip-members">
            <h3><Icon name="people" size={20} /> 같이 쓰는 사람</h3>
            <ul>
              {members.map((m) => (
                <li key={m.user_id}>
                  <span>
                    {m.name}
                    {m.user_id === userId && ' (나)'}
                    {m.is_owner && <small> · 방장</small>}
                  </span>
                  {isOwner && !m.is_owner && (
                    <button type="button" aria-label={`${m.name} 내보내기`} onClick={() => removeMember(m)}>
                      <Icon name="close" size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {code ? (
              <div className="invite">
                <strong>{prettyCode}</strong>
                <button type="button" className="mini" onClick={copyCode}>
                  복사
                </button>
                <small>상대가 여행 탭의 "초대 코드로 여행에 참여하기"에 입력하면 들어와요. 코드를 아는 사람은 누구나 참여할 수 있으니 믿는 사람에게만 알려 주세요</small>
              </div>
            ) : (
              <button type="button" className="mini invite-btn" onClick={showCode}>
                초대 코드 보기
              </button>
            )}
          </div>
          <TripPlan trip={trip} setError={setError} />
          <div className="trip-spent">
            <h3><Icon name="list" size={20} /> 지출 내역</h3>
            {spent(trip.id).length === 0 && (
              <p className="plan-empty">이 여행에 연결된 지출이 없어요. 여행 모드를 켜고 지출을 입력하면 자동으로 연결돼요</p>
            )}
            {spentByDay(trip.id).map(([date, items]) => (
              <div className="day" key={date}>
                <div className="day-head">
                  <span>{formatDate(date)}</span>
                  <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
                </div>
                <ul>
                  {items.map((e) => (
                    <ExpenseRow key={e.id} expense={e} tripLabel={e.mine ? null : `${e.who} 님`} people={trip.people} onOpen={(x) => x.mine && onEditExpense(x)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {join && (
        <div className="overlay" onClick={() => setJoin(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={joinTrip}>
            <h2><Icon name="people" /> 초대 코드로 참여</h2>
            <label>
              초대 코드
              <input
                type="text"
                autoFocus
                required
                maxLength={12}
                autoCapitalize="characters"
                placeholder="예: AB3D-EF7H"
                value={join.code}
                onChange={(e) => setJoin({ ...join, code: e.target.value.toUpperCase() })}
              />
            </label>
            {join.error && <p className="time-warn">{join.error}</p>}
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setJoin(null)}>
                취소
              </button>
              <button type="submit" className="primary" disabled={join.busy}>
                {join.busy ? '확인 중...' : '참여하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{sheet.id === null ? <><Icon name="suitcase" /> 새 여행</> : <><Icon name="pencil" /> 여행 고치기</>}</h2>
            <label>
              여행 이름
              <input
                type="text"
                placeholder="예: 오사카 3박 4일"
                maxLength={40}
                required
                value={sheet.form.name}
                onChange={setField('name')}
              />
            </label>
            <label>
              시작일
              <input type="date" required value={sheet.form.start_date} onChange={setField('start_date')} />
            </label>
            <label>
              종료일
              <input
                type="date"
                required
                min={sheet.form.start_date}
                value={sheet.form.end_date}
                onChange={setField('end_date')}
              />
            </label>
            <div className="field">
              인원
              <div className="stepper">
                <button type="button" disabled={sheet.form.people <= 1} onClick={() => setPeople(sheet.form.people - 1)}>
                  −
                </button>
                <strong>{sheet.form.people}명</strong>
                <button type="button" disabled={sheet.form.people >= 99} onClick={() => setPeople(sheet.form.people + 1)}>
                  +
                </button>
              </div>
            </div>
            <div className="field">
              기본 통화
              <div className="curs">
                {CURRENCIES.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    className={sheet.form.currency === c.code ? 'cat on' : 'cat'}
                    style={{ '--c': '#f3deaa' }}
                    onClick={() => setSheet({ ...sheet, form: { ...sheet.form, currency: c.code } })}
                  >
                    {c.symbol} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setSheet(null)}>
                취소
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
