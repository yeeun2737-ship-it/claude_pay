import { cookies } from 'next/headers';
import { COOKIE, isUnlocked, matches, sha } from './lock';

export async function GET() {
  return Response.json({ unlocked: await isUnlocked() });
}

export async function POST(request) {
  const password = process.env.APP_PASSWORD;
  const body = await request.json().catch(() => ({}));
  if (!password || typeof body.password !== 'string' || !matches(body.password, password)) {
    return Response.json({ unlocked: false }, { status: 401 });
  }
  (await cookies()).set(COOKIE, sha(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ unlocked: true });
}

export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return Response.json({ unlocked: false });
}
