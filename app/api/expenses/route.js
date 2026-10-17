import { isUnlocked } from '../auth/lock';
import { db, fail, parseExpense } from './db';

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

  const expense = parseExpense(await request.json().catch(() => null));
  if (!expense) return fail('입력값이 올바르지 않아요', 400);

  const { data, error } = await db().from('expenses').insert(expense).select().single();
  if (error) return fail(error.message, 500);
  return Response.json(data);
}
