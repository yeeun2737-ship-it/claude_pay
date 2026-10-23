import { toDateStr } from './shared';

// 날짜는 모두 'YYYY-MM-DD' 글자로 다루고, 시간대 때문에 하루가 밀리지 않게 UTC로 계산한다.
export const todayStr = () => toDateStr(new Date());

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0=일 ~ 6=토
export const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

// 그 날짜가 속한 주의 월요일
export const mondayOf = (day) => addDays(day, -((weekday(day) + 6) % 7));

export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// 반복 규칙에 따라 그 날짜에 나타나는지. 매월 31일처럼 그 달에 없는 날짜는 그 달의 마지막 날에 나타난다.
export function occursOn(item, day) {
  if (item.repeat === 'none') return item.day === day;
  if (day < item.day) return false;
  if (item.repeat_until && day > item.repeat_until) return false;
  if (item.repeat === 'daily') return true;
  if (item.repeat === 'weekly') return weekday(day) === weekday(item.day);
  const [y, m, d] = day.split('-').map(Number);
  return d === Math.min(Number(item.day.slice(8)), daysInMonth(y, m));
}

export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function dayTitle(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_NAMES[weekday(day)]})`;
}

// 요일별 파스텔 색(참고 이미지의 요일 라벨). 인덱스는 0=일 ~ 6=토
export const WEEKDAY_COLORS = ['#f0cfc9', '#f0cfc9', '#cfdde3', '#cbdcc3', '#f3deaa', '#ddd3e6', '#cfdde3'];
export const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// '15:30:00' → '오후 3시 30분'
export function timeText(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ''}`;
}

export const monthDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;

// 공휴일(대체공휴일 포함). 음력 명절은 해마다 달라서 2025~2027년만 넣어 두었다.
const FIXED_HOLIDAYS = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
const LUNAR_HOLIDAYS = [
  // 2025
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06', '2025-06-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
  // 2026
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-24', '2026-05-25', '2026-06-03', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05',
  // 2027
  '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-05-13', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11',
];
export const isHoliday = (day) => FIXED_HOLIDAYS.includes(day.slice(5)) || LUNAR_HOLIDAYS.includes(day);
