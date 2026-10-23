export const CURRENCIES = [
  { code: 'KRW', label: '원', symbol: '₩' },
  { code: 'USD', label: '달러', symbol: '$' },
  { code: 'JPY', label: '엔', symbol: '¥' },
  { code: 'CNY', label: '위안', symbol: 'CN¥' },
  { code: 'EUR', label: '유로', symbol: '€' },
  { code: 'GBP', label: '파운드', symbol: '£' },
  { code: 'THB', label: '바트', symbol: '฿' },
];

export const currencyOf = (code) => CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

export const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const won = (n) => n.toLocaleString('ko-KR') + '원';
// 1인 금액: 금액 ÷ 인원 수를 원 단위로 반올림
export const perPerson = (amount, people) => Math.round(amount / people);

export const CATEGORIES = [
  { name: '식비', icon: 'rice', color: '#f3deaa' },
  { name: '카페', icon: 'coffee', color: '#f0cfc9' },
  { name: '교통', icon: 'bus', color: '#cfdde3' },
  { name: '쇼핑', icon: 'bag', color: '#ddd3e6' },
  { name: '구독', icon: 'tv', color: '#cbdcc3' },
  { name: '기타', icon: 'sparkle', color: '#f4d9c3' },
];

export const catOf = (name) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[5];

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return `${m}월 ${d}일 (${DAYS[new Date(y, m - 1, d).getDay()]})`;
}

// 일정·할 일에 붙이는 파스텔 색 라벨
export const LABEL_COLORS = [
  { id: 'pink', hex: '#efb9b1', name: '빨강', note: '기념일' },
  { id: 'blue', hex: '#bcd0e0', name: '파랑', note: '건강' },
  { id: 'yellow', hex: '#f3deaa', name: '노랑', note: '돈' },
  { id: 'purple', hex: '#d6c8e4', name: '보라', note: '기타' },
  { id: 'green', hex: '#c2d9b8', name: '초록', note: '여행' },
  { id: 'sky', hex: '#b9dcd4', name: '민트', note: '회사' },
];

export const labelHex = (id) => (LABEL_COLORS.find((c) => c.id === id) ?? LABEL_COLORS[0]).hex;

export const DEFAULT_CATEGORIES = ['공부', '약속', '운동', '집안일', '기타'];

export const REPEATS = [
  { id: 'none', label: '반복 안 함' },
  { id: 'daily', label: '매일' },
  { id: 'weekly', label: '매주' },
  { id: 'monthly', label: '매월' },
  { id: 'yearly', label: '매년' },
];

export const repeatLabel = (id) => REPEATS.find((r) => r.id === id)?.label ?? '';
