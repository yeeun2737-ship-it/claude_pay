'use client';

import { useState } from 'react';
import { supabase } from './supabase';
import { CURRENCIES, currencyOf, formatDate, perPerson, toDateStr, won } from './shared';
import ExpenseRow from './expense-row';
import TripPlan from './trip-plan';
import Icon from './icons';
import { askConfirm } from './confirm';

const newTrip = () => ({
  name: '',
  start_date: toDateStr(new Date()),
  end_date: toDateStr(new Date()),
  currency: 'KRW',
  people: 1,
});

const shortDate = (s) => s.slice(5).replace('-', '/');
const periodText = (t) => `${shortDate(t.start_date)} ~ ${shortDate(t.end_date)}`;

function statusText(t) {
  const today = toDateStr(new Date());
  if (today > t.end_date) return '다녀옴';
  if (today >= t.start_date) return '여행 중';
  return `D-${Math.round((new Date(t.start_date) - new Date(today)) / 86400000)}`;
}

export default function TripsView({ trips, setTrips, expenses, setExpenses, setError, onEditExpense }) {
  const [openId, setOpenId] = useState(null);
  const [sheet, setSheet] = useState(null); // { id: 수정 중인 여행 id 또는 null, form }
  const [busy, setBusy] = useState(false);

  const sorted = [...trips].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const trip = trips.find((t) => t.id === openId);
  const spent = (id) => expenses.filter((e) => e.trip_id === id);
  const total = (id) => spent(id).reduce((s, e) => s + e.amount, 0);
  // 이 여행에 연결된 지출만 날짜별(최신 날짜 먼저)로 묶는다
  const spentByDay = (id) =>
    Object.entries(
      spent(id).reduce((acc, e) => {
        (acc[e.date] ??= []).push(e);
        return acc;
      }, {}),
    ).sort(([a], [b]) => (a < b ? 1 : -1));

  async function save(e) {
    e.preventDefault();
    const { form, id } = sheet;
    setBusy(true);
    const row = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      currency: form.currency,
      people: form.people,
    };
    const query = id === null ? supabase.from('trips').insert(row) : supabase.from('trips').update(row).eq('id', id);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      setError('여행을 저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setTrips(id === null ? [data, ...trips] : trips.map((t) => (t.id === id ? data : t)));
    setSheet(null);
  }

  async function remove() {
    if (!(await askConfirm(`'${trip.name}' 여행을 삭제할까요?\n여행에 묶인 지출은 남고, 여행과의 연결만 풀려요.`))) return;
    const { error } = await supabase.from('trips').delete().eq('id', trip.id);
    if (error) {
      setError('여행을 삭제하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setExpenses(expenses.map((x) => (x.trip_id === trip.id ? { ...x, trip_id: null } : x)));
    setTrips(trips.filter((t) => t.id !== trip.id));
    setOpenId(null);
  }

  // 여행 모드는 한 번에 하나만 켤 수 있어서, 켜져 있던 여행을 먼저 끈다
  async function toggleMode() {
    const current = trips.find((t) => t.is_active);
    if (!trip.is_active && current) {
      const { error } = await supabase.from('trips').update({ is_active: false }).eq('id', current.id);
      if (error) {
        setError('여행 모드를 바꾸지 못했어요: ' + error.message);
        return;
      }
    }
    const { error } = await supabase.from('trips').update({ is_active: !trip.is_active }).eq('id', trip.id);
    if (error) {
      setError('여행 모드를 바꾸지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setTrips(trips.map((t) => ({ ...t, is_active: t.id === trip.id ? !trip.is_active : false })));
  }

  const setField = (key) => (e) => setSheet({ ...sheet, form: { ...sheet.form, [key]: e.target.value } });
  const setPeople = (n) => setSheet({ ...sheet, form: { ...sheet.form, people: Math.min(99, Math.max(1, n)) } });

  return (
    <section className="trips">
      {!trip && (
        <>
          <button className="new-trip" onClick={() => setSheet({ id: null, form: newTrip() })}>
            + 새 여행 만들기
          </button>
          {sorted.length === 0 && (
            <div className="empty">
              <p><Icon name="suitcase" size={44} /></p>
              <p>아직 여행이 없어요!</p>
              <p className="sub">여행을 만들고 일정과 지출을 모아 보세요</p>
            </div>
          )}
          <ul className="trip-list">
            {sorted.map((t) => (
              <li key={t.id} className="trip-card" onClick={() => setOpenId(t.id)}>
                <div className="trip-top">
                  <strong>{t.name}</strong>
                  {t.is_active && <span className="badge">여행 모드 ON</span>}
                </div>
                <small>
                  {periodText(t)} · {currencyOf(t.currency).symbol} {currencyOf(t.currency).label} · <Icon name="people" size={14} /> {t.people}명 ·{' '}
                  {statusText(t)}
                </small>
                <span className="trip-total">
                  {won(total(t.id))} <small>{spent(t.id).length}건</small>
                </span>
                {t.people > 1 && <span className="pp">1인 {won(perPerson(total(t.id), t.people))}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {trip && (
        <>
          <button className="back" onClick={() => setOpenId(null)}>
            ← 여행 목록
          </button>
          <div className="trip-head">
            <div className="trip-top">
              <h2>{trip.name}</h2>
              {trip.is_active && <span className="badge">여행 모드 ON</span>}
            </div>
            <small>
              {trip.start_date} ~ {trip.end_date} · {currencyOf(trip.currency).symbol} {currencyOf(trip.currency).label} · 👥{' '}
              {trip.people}명 · {statusText(trip)}
            </small>
            <p className="trip-sum">
              {won(total(trip.id))} <small>지출 {spent(trip.id).length}건</small>
            </p>
            {trip.people > 1 && (
              <p className="pp">
                1인 {won(perPerson(total(trip.id), trip.people))} <small>({trip.people}명으로 나눈 금액)</small>
              </p>
            )}
            <button className={trip.is_active ? 'mode on' : 'mode'} onClick={toggleMode}>
              {trip.is_active ? '여행 모드 끄기' : '여행 모드 켜기 (지출이 이 여행에 자동 연결돼요)'}
            </button>
            <div className="trip-actions">
              <button onClick={() => setSheet({ id: trip.id, form: { ...trip } })}>수정</button>
              <button className="danger-text" onClick={remove}>
                삭제
              </button>
            </div>
          </div>
          <TripPlan trip={trip} setError={setError} />
          <div className="trip-spent">
            <h3><Icon name="list" size={20} /> 지출 내역</h3>
            {spent(trip.id).length === 0 && (
              <p className="plan-empty">이 여행에 연결된 지출이 없어요. 여행 모드를 켜고 지출을 입력하면 자동으로 연결돼요</p>
            )}
            {spentByDay(trip.id).map(([date, items]) => (
              <div className="day" key={date}>
                <div className="day-head">
                  <span>{formatDate(date)}</span>
                  <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
                </div>
                <ul>
                  {items.map((e) => (
                    <ExpenseRow key={e.id} expense={e} tripLabel={null} people={trip.people} onOpen={onEditExpense} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {sheet && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{sheet.id === null ? <><Icon name="suitcase" /> 새 여행</> : <><Icon name="pencil" /> 여행 고치기</>}</h2>
            <label>
              여행 이름
              <input
                type="text"
                placeholder="예: 오사카 3박 4일"
                maxLength={40}
                required
                value={sheet.form.name}
                onChange={setField('name')}
              />
            </label>
            <label>
              시작일
              <input type="date" required value={sheet.form.start_date} onChange={setField('start_date')} />
            </label>
            <label>
              종료일
              <input
                type="date"
                required
                min={sheet.form.start_date}
                value={sheet.form.end_date}
                onChange={setField('end_date')}
              />
            </label>
            <div className="field">
              인원
              <div className="stepper">
                <button type="button" disabled={sheet.form.people <= 1} onClick={() => setPeople(sheet.form.people - 1)}>
                  −
                </button>
                <strong>{sheet.form.people}명</strong>
                <button type="button" disabled={sheet.form.people >= 99} onClick={() => setPeople(sheet.form.people + 1)}>
                  +
                </button>
              </div>
            </div>
            <div className="field">
              기본 통화
              <div className="curs">
                {CURRENCIES.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    className={sheet.form.currency === c.code ? 'cat on' : 'cat'}
                    style={{ '--c': '#f3deaa' }}
                    onClick={() => setSheet({ ...sheet, form: { ...sheet.form, currency: c.code } })}
                  >
                    {c.symbol} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setSheet(null)}>
                취소
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
