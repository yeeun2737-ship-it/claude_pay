import { createClient } from '@supabase/supabase-js';
import { isUnlocked } from '../auth/lock';

const CATEGORIES = ['식비', '카페', '교통', '쇼핑', '구독', '기타'];

// DB의 RLS 정책은 이 시크릿 헤더가 있는 요청만 허용한다. 시크릿은 서버에만 있다.
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { 'x-app-secret': process.env.DB_SECRET } },
  });

const fail = (message, status) => Response.json({ error: message }, { status });

export async function GET() {
  if (!(await isUnlocked())) return fail('잠겨 있어요', 401);

  const { data, error } = await db()
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return fail(error.message, 500);
  return Response.json(data);
}

export async function POST(request) {
  if (!(await isUnlocked())) return fail('잠겨 있어요', 401);

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const place = typeof body.place === 'string' ? body.place.trim() : '';
  const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
  if (
    !Number.isInteger(amount) ||
    amount <= 0 ||
    !place ||
    !CATEGORIES.includes(body.category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
  ) {
    return fail('입력값이 올바르지 않아요', 400);
  }

  const { data, error } = await db()
    .from('expenses')
    .insert({ amount, place, category: body.category, date: body.date, memo })
    .select()
    .single();
  if (error) return fail(error.message, 500);
  return Response.json(data);
}
