import { ImageResponse } from 'next/og';

const SIZES = [180, 192, 512];
const INK = '#2b2250';

export async function GET(_request, { params }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response('Not found', { status: 404 });

  // 모든 치수는 아이콘 한 변(size) 대비 비율. 마스커블 아이콘이 잘려도 되도록 중앙 80% 안에 그린다.
  const u = (r) => Math.round(size * r);
  const border = Math.max(2, u(0.02));
  const shadow = Math.max(2, u(0.025));
  const abs = { position: 'absolute', display: 'flex' };

  const dots = [0.08, 0.2, 0.32, 0.44];
  const lines = [
    [0.19, 0.34],
    [0.29, 0.26],
    [0.39, 0.34],
    [0.49, 0.2],
  ];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#ff8fb1' }}>
        {/* 가계부 노트 */}
        <div
          style={{
            ...abs,
            left: u(0.2),
            top: u(0.17),
            width: u(0.5),
            height: u(0.62),
            background: '#fff',
            border: `${border}px solid ${INK}`,
            borderRadius: u(0.05),
            boxShadow: `${shadow}px ${shadow}px 0 ${INK}`,
          }}
        >
          {dots.map((t) => (
            <div
              key={t}
              style={{ ...abs, left: u(0.03), top: u(t), width: u(0.04), height: u(0.04), borderRadius: '50%', background: INK }}
            />
          ))}
          <div
            style={{
              ...abs,
              left: u(0.105),
              top: u(0.07),
              width: u(0.34),
              height: u(0.07),
              background: '#ffd23f',
              border: `${Math.max(1, Math.round(border / 2))}px solid ${INK}`,
              borderRadius: u(0.02),
            }}
          />
          {lines.map(([t, w]) => (
            <div
              key={t}
              style={{ ...abs, left: u(0.105), top: u(t), width: u(w), height: u(0.022), borderRadius: u(0.011), background: INK }}
            />
          ))}
        </div>

        {/* 원화 동전 */}
        <div
          style={{
            ...abs,
            left: u(0.5),
            top: u(0.55),
            width: u(0.3),
            height: u(0.3),
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#ffd23f',
            border: `${border}px solid ${INK}`,
            boxShadow: `${shadow}px ${shadow}px 0 ${INK}`,
          }}
        >
          <div style={{ display: 'flex', color: INK, fontSize: u(0.19), fontWeight: 900 }}>W</div>
          <div style={{ ...abs, left: u(0.035), top: u(0.105), width: u(0.2), height: u(0.018), background: INK }} />
          <div style={{ ...abs, left: u(0.035), top: u(0.145), width: u(0.2), height: u(0.018), background: INK }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
