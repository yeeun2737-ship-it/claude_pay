import { isUnlocked } from '../../auth/lock';
import { db, fail, parseExpense } from '../db';

const parseId = async (params) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function PATCH(request, { params }) {
  if (!(await isUnlocked())) return fail('잠겨 있어요', 401);

  const id = await parseId(params);
  const expense = parseExpense(await request.json().catch(() => null));
  if (!id || !expense) return fail('입력값이 올바르지 않아요', 400);

  const { data, error } = await db()
    .from('expenses')
    .update(expense)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail('없는 지출이에요', 404);
  return Response.json(data);
}

export async function DELETE(_request, { params }) {
  if (!(await isUnlocked())) return fail('잠겨 있어요', 401);

  const id = await parseId(params);
  if (!id) return fail('잘못된 요청이에요', 400);

  const { data, error } = await db().from('expenses').delete().eq('id', id).select('id');
  if (error) return fail(error.message, 500);
  if (!data.length) return fail('없는 지출이에요', 404);
  return Response.json({ deleted: id });
}
