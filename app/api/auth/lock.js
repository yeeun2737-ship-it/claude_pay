import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'unlocked';

export const sha = (text) => createHash('sha256').update(text).digest('hex');

export function matches(a, b) {
  return timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));
}

export async function isUnlocked() {
  const password = process.env.APP_PASSWORD;
  const token = (await cookies()).get(COOKIE)?.value;
  return Boolean(password && token && matches(token, sha(password)));
}
