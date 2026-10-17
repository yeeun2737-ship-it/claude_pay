import { createClient } from '@supabase/supabase-js';

// 브라우저용 클라이언트. 공개 키만 쓰고, 어떤 데이터를 볼 수 있는지는 로그인한 사용자 기준으로 DB(RLS)가 정한다.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
