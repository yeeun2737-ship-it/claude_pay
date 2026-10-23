import { catOf, currencyOf, perPerson, won } from './shared';
import Icon from './icons';

// 지출 한 줄. 내역 탭과 여행 상세에서 같이 쓴다.
// tripLabel: 이름 옆에 보여줄 여행 표시(없으면 null), people: 연결된 여행의 인원 수
export default function ExpenseRow({ expense: e, tripLabel, people, onOpen }) {
  const c = catOf(e.category);
  return (
    <li className="row" onClick={() => onOpen(e)}>
      <span className="chip" style={{ '--c': c.color }}>
        <Icon name={c.icon} size={14} /> {c.name}
      </span>
      <div className="info">
        <strong>{e.place}</strong>
        {(tripLabel || e.memo) && (
          <small>
            {tripLabel}
            {tripLabel && e.memo && ' · '}
            {e.memo}
          </small>
        )}
      </div>
      <div className="amt">
        <span className="amount">{won(e.amount)}</span>
        {e.currency !== 'KRW' && (
          <small>
            {currencyOf(e.currency).symbol}
            {Number(e.original_amount).toLocaleString('ko-KR')} · 환율 {Number(e.exchange_rate).toLocaleString('ko-KR')}
          </small>
        )}
        {people > 1 && <small className="pp-line">👥 1인 {won(perPerson(e.amount, people))}</small>}
      </div>
    </li>
  );
}
