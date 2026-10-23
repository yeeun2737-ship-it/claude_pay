const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

// 24시간제 시각 입력. 기기 설정과 상관없이 00~23시로 보이고, 값은 'HH:MM' 문자열(비우면 '')이다.
// 분은 5분 단위로 고르되, 이미 저장된 값이 5분 단위가 아니면 그 값도 목록에 넣는다.
export default function TimeInput({ value, onChange, disabled, label }) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  if (m && !minutes.includes(m)) minutes.push(m);
  minutes.sort();

  return (
    <div className="time-input" role="group" aria-label={label}>
      <select
        disabled={disabled}
        value={h}
        aria-label={`${label} 시`}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}
      >
        <option value="">--</option>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span>:</span>
      <select disabled={disabled || !h} value={m} aria-label={`${label} 분`} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {!h && <option value="">--</option>}
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
