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
  { name: '식비', emoji: '🍙', color: '#ffd23f' },
  { name: '카페', emoji: '☕', color: '#ff8fb1' },
  { name: '교통', emoji: '🚌', color: '#7fd6ff' },
  { name: '쇼핑', emoji: '🛍️', color: '#b9a3ff' },
  { name: '구독', emoji: '📺', color: '#8fe3a3' },
  { name: '기타', emoji: '✨', color: '#ffb36b' },
];

export const catOf = (name) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[5];

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return `${m}월 ${d}일 (${DAYS[new Date(y, m - 1, d).getDay()]})`;
}
