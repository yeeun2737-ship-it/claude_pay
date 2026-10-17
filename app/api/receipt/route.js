import { isUnlocked } from '../auth/lock';

const MODEL = 'gemini-3.5-flash-lite';

const PROMPT = `이 영수증 사진에서 아래 세 가지를 읽어 JSON으로 답하세요.
- amount: 손님이 실제로 결제한 "최종 결제 합계" 금액(원, 정수). 부가세, 공급가액, 과세물품가액, 받은 돈(현금 수령액), 거스름돈, 할인 전 금액이 아니라 "합계/결제금액/승인금액"에 해당하는 값입니다.
- date: 결제 날짜를 YYYY-MM-DD 형식으로. 연도가 보이지 않으면 null.
- place: 가게(사용처) 이름.
글씨가 안 보이거나 확실하지 않은 항목은 추측하지 말고 null로 두세요.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    amount: { type: 'INTEGER', nullable: true },
    date: { type: 'STRING', nullable: true },
    place: { type: 'STRING', nullable: true },
  },
  required: ['amount', 'date', 'place'],
};

const fail = (message, status) => Response.json({ error: message }, { status });

export async function POST(request) {
  if (!(await isUnlocked())) return fail('잠겨 있어요', 401);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail('GEMINI_API_KEY가 설정되지 않았어요', 500);

  const { image, mimeType } = await request.json().catch(() => ({}));
  if (typeof image !== 'string' || !image || typeof mimeType !== 'string') {
    return fail('이미지가 없어요', 400);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image } }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) return fail(`Gemini 호출에 실패했어요 (${res.status})`, 502);

  let parsed;
  try {
    const data = await res.json();
    parsed = JSON.parse(data.candidates[0].content.parts[0].text);
  } catch {
    return fail('영수증을 읽지 못했어요', 502);
  }

  const amount = Number.isInteger(parsed.amount) && parsed.amount > 0 ? parsed.amount : null;
  const date =
    typeof parsed.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) &&
    !Number.isNaN(Date.parse(parsed.date))
      ? parsed.date
      : null;
  const place = typeof parsed.place === 'string' && parsed.place.trim() ? parsed.place.trim() : null;

  return Response.json({ amount, date, place });
}
