import { ImageResponse } from 'next/og';

const SIZES = [180, 192, 512];
const INK = '#4a4039';

export async function GET(_request, { params }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response('Not found', { status: 404 });

  // 모든 치수는 아이콘 한 변(size) 대비 비율. 마스커블 아이콘이 잘려도 되도록 중앙 80% 안에 그린다.
  const u = (r) => Math.round(size * r);
  const border = Math.max(2, u(0.02));
  const shadow = Math.max(2, u(0.022));
  const abs = { position: 'absolute', display: 'flex' };
  // 책등 점: 표지 안쪽 높이(0.68)에서 위아래 여백이 같도록 균등 배치
  const stitches = [0.1075, 0.2175, 0.3275, 0.4375, 0.5475];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#f0cfc9' }}>
        {/* 표지 그림자 */}
        <div style={{ ...abs, left: u(0.22) + shadow, top: u(0.13) + shadow, width: u(0.56), height: u(0.72), background: INK, borderRadius: u(0.05) }} />

        {/* 책갈피 리본: 책 아래 모서리 안쪽(표지 뒤)에서 나와 아래로 늘어진다 */}
        <svg style={{ position: 'absolute', left: u(0.6), top: u(0.8) }} width={u(0.08)} height={u(0.17)} viewBox="0 0 8 17">
          <path d="M0 0h8v17l-4-3.6L0 17z" fill="#e8c0b9" stroke={INK} strokeWidth="0.6" strokeLinejoin="round" />
        </svg>

        {/* 다이어리 표지 */}
        <div
          style={{
            ...abs,
            left: u(0.22),
            top: u(0.13),
            width: u(0.56),
            height: u(0.72),
            background: '#cbdcc3',
            border: `${border}px solid ${INK}`,
            borderRadius: u(0.05),
          }}
        >
          {/* 책등 */}
          <div style={{ ...abs, left: 0, top: 0, width: u(0.1), height: u(0.72) - border * 2, background: '#9db894', borderRight: `${border}px solid ${INK}` }} />
          {stitches.map((t) => (
            <div key={t} style={{ ...abs, left: u(0.0275), top: u(t), width: u(0.025), height: u(0.025), borderRadius: '50%', background: '#fbf7ec' }} />
          ))}
          {/* 고무 밴드 */}
          <div style={{ ...abs, right: u(0.06), top: 0, width: u(0.025), height: u(0.72) - border * 2, background: '#dcbc6c', borderLeft: `${Math.max(1, border / 2)}px solid ${INK}`, borderRight: `${Math.max(1, border / 2)}px solid ${INK}` }} />
          {/* 이름표 */}
          <div
            style={{
              ...abs,
              left: u(0.145),
              top: u(0.14),
              width: u(0.28),
              height: u(0.34),
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fbf7ec',
              border: `${border}px solid ${INK}`,
              borderRadius: u(0.03),
            }}
          >
            {/* 새싹 */}
            <svg width={u(0.2)} height={u(0.24)} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20v-8" />
              <path d="M12 13c0-3.6-2.4-5.8-6-6 0 3.6 2.4 6 6 6z" fill="#cbdcc3" />
              <path d="M12 15c0-3 2-5 5.5-5.2 0 3-2 5.2-5.5 5.2z" fill="#f0cfc9" />
            </svg>
          </div>
          {/* 줄 몇 개 */}
          <div style={{ ...abs, left: u(0.145), top: u(0.53), width: u(0.2), height: u(0.02), borderRadius: u(0.01), background: INK, opacity: 0.55 }} />
          <div style={{ ...abs, left: u(0.145), top: u(0.6), width: u(0.14), height: u(0.02), borderRadius: u(0.01), background: INK, opacity: 0.55 }} />
        </div>

      </div>
    ),
    { width: size, height: size },
  );
}
