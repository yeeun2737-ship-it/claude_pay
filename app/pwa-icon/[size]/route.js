import { ImageResponse } from 'next/og';

const SIZES = [180, 192, 512];

export async function GET(_request, { params }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response('Not found', { status: 404 });

  // 마스커블 아이콘은 가장자리가 잘려도 되도록 그림을 중앙 안전 영역 안에 둔다
  const coin = size * 0.56;
  const border = Math.max(2, Math.round(size * 0.03));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ff8fb1',
        }}
      >
        <div
          style={{
            width: coin,
            height: coin,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#ffd23f',
            border: `${border}px solid #2b2250`,
            boxShadow: `${border * 2}px ${border * 2}px 0 #2b2250`,
            color: '#2b2250',
            fontSize: coin * 0.62,
            fontWeight: 900,
          }}
        >
          T
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
