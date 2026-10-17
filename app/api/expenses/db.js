import { createClient } from '@supabase/supabase-js';

export const CATEGORIES = ['식비', '카페', '교통', '쇼핑', '구독', '기타'];

// 서버 전용 secret 키로 접근한다. 이 키는 브라우저로 나가지 않는다.
export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

export const fail = (message, status) => Response.json({ error: message }, { status });

// 요청 본문을 검증해 DB에 넣을 값으로 바꾼다. 올바르지 않으면 null.
export function parseExpense(body) {
  const amount = Number(body?.amount);
  const place = typeof body?.place === 'string' ? body.place.trim() : '';
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : '';
  if (
    !Number.isInteger(amount) ||
    amount <= 0 ||
    !place ||
    !CATEGORIES.includes(body?.category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body?.date)
  ) {
    return null;
  }
  return { amount, place, category: body.category, date: body.date, memo };
}
