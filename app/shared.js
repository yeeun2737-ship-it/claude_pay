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
