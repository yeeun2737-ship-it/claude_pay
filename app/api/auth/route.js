import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'unlocked';

const sha = (text) => createHash('sha256').update(text).digest('hex');

function matches(a, b) {
  const x = Buffer.from(sha(a));
  const y = Buffer.from(sha(b));
  return timingSafeEqual(x, y);
}

export async function GET() {
  const password = process.env.APP_PASSWORD;
  const token = (await cookies()).get(COOKIE)?.value;
  return Response.json({ unlocked: Boolean(password && token && matches(token, sha(password))) });
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
