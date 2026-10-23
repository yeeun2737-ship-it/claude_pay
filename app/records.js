'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { WEEKDAY_NAMES, todayStr, weekday } from './dates';
import Icon from './icons';
import { askConfirm } from './confirm';

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmt = (n) => String(Math.round(n * 10) / 10);

// 습관 하나에 붙는 기록 단위(kg, 잔 등)를 정하는 창. 기록 종류 행은 처음 기록할 때 습관 이름으로 만들어진다.
function UnitSheet({ name, type, onClose, onSaved, setError }) {
  const [unit, setUnit] = useState(type?.unit ?? '');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const query = type ? supabase.from('record_types').update({ unit: unit.trim() }).eq('id', type.id) : supabase.from('record_types').insert({ name, unit: unit.trim() });
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) return setError('단위를 저장하지 못했어요: ' + error.message);
    setError('');
    onSaved(data);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2><Icon name="pencil" /> {name} 기록 단위</h2>
        <label>
          단위 (선택)
          <input type="text" autoFocus maxLength={8} placeholder="예: kg, 시간, 잔" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EntrySheet({ name, unit, entry, defaultDay, ensureType, onClose, onSaved, onDeleted, setError }) {
  const [form, setForm] = useState(entry ? { day: entry.day, value: entry.value ?? '', memo: entry.memo } : { day: defaultDay, value: '', memo: '' });
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const type = await ensureType();
    if (!type) return setBusy(false);
    const row = { type_id: type.id, day: form.day, value: form.value === '' ? null : Number(form.value), memo: form.memo.trim() };
    const query = entry ? supabase.from('records').update(row).eq('id', entry.id) : supabase.from('records').insert(row);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) return setError('기록을 저장하지 못했어요: ' + error.message);
    setError('');
    onSaved(data);
  }

  async function remove() {
    if (!(await askConfirm('이 기록을 삭제할까요?'))) return;
    const { error } = await supabase.from('records').delete().eq('id', entry.id);
    if (error) return setError('기록을 삭제하지 못했어요: ' + error.message);
    setError('');
    onDeleted(entry.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{entry ? <><Icon name="pencil" /> {name} 기록 고치기</> : <><Icon name="list" /> {name} 기록</>}</h2>
        <label>
          날짜
          <input type="date" required value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} />
        </label>
        <label>
          값{unit ? ` (${unit})` : ' (선택)'}
          <input type="number" inputMode="decimal" step="any" autoFocus value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        </label>
        <label>
          메모 (선택)
          <input type="text" maxLength={80} value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
        </label>
        <div className={entry ? 'actions edit' : 'actions'}>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {entry && (
            <button type="button" className="danger" onClick={remove}>
              삭제
            </button>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 습관마다 "○○ 기록" 카드를 만든다(운동은 따로 있어서 제외). 기록을 적으면 그날 그 습관이 자동으로 체크된다.
// 기록 종류는 습관 이름으로 이어지고, 첫 기록이나 단위를 정할 때 DB에 만들어진다. first~last는 보고 있는 달의 범위.
export default function Records({ habits, first, last, setError, onRecorded, onRemoveHabit }) {
  const today = todayStr();
  const [types, setTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [sheet, setSheet] = useState(null); // { kind: 'unit' | 'entry', habit, entry }

  useEffect(() => {
    supabase
      .from('record_types')
      .select('*')
      .order('id')
      .then(({ data, error }) => {
        if (error) setError('기록 종류를 불러오지 못했어요: ' + error.message);
        else setTypes(data);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('records')
      .select('*')
      .gte('day', first)
      .lte('day', last)
      .order('day', { ascending: false })
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError('기록을 불러오지 못했어요: ' + error.message);
        else setEntries(data);
      });
    return () => {
      cancelled = true;
    };
  }, [first, last]);

  const inMonth = (day) => day >= first && day <= last;
  const sortEntries = (list) => [...list].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.id - a.id));
  const typeOf = (habit) => types.find((t) => t.name === habit.name);
  const close = () => setSheet(null);
  const shown = habits.filter((h) => h.name !== '운동');

  const upsertType = (t) => setTypes((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t]));

  // 기록 종류 행이 아직 없으면 습관 이름으로 만든다
  async function ensureType(habit) {
    const found = typeOf(habit);
    if (found) return found;
    const { data, error } = await supabase.from('record_types').insert({ name: habit.name }).select().single();
    if (error) {
      setError('기록 종류를 만들지 못했어요: ' + error.message);
      return null;
    }
    upsertType(data);
    return data;
  }

  return (
    <>
      {shown.map((h) => {
        const t = typeOf(h);
        const list = t ? entries.filter((e) => e.type_id === t.id) : [];
        const values = list.map((e) => num(e.value)).filter((v) => v !== null);
        const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
        const latest = list.find((e) => e.value !== null);
        const u = t?.unit ? ` ${t.unit}` : '';
        return (
          <div className="card" key={h.id}>
            <div className="card-title">
              <h3><Icon name="list" size={20} /> {h.name} 기록</h3>
              <button type="button" className="mini" onClick={() => setSheet({ kind: 'entry', habit: h, entry: null })}>
                + 기록
              </button>
            </div>
            <div className="stat-pills">
              <span>{list.length}회</span>
              {avg !== null && <span>평균 {fmt(avg)}{u}</span>}
              {latest && <span>최근 {fmt(num(latest.value))}{u}</span>}
              <button type="button" className="unit-btn" onClick={() => setSheet({ kind: 'unit', habit: h })}>
                {t?.unit ? `단위 ${t.unit}` : '단위 정하기'}
              </button>
            </div>
            {list.length === 0 && <p className="plan-empty">이 달 {h.name} 기록이 없어요</p>}
            {list.map((e) => (
              <button type="button" className="rec-row" key={e.id} onClick={() => setSheet({ kind: 'entry', habit: h, entry: e })}>
                <span className="wo-date">
                  {Number(e.day.slice(5, 7))}/{Number(e.day.slice(8))} ({WEEKDAY_NAMES[weekday(e.day)]})
                </span>
                <span className="rec-memo">{e.memo}</span>
                <strong>{e.value !== null ? `${fmt(num(e.value))}${u}` : ''}</strong>
              </button>
            ))}
            <button type="button" className="habit-del" onClick={() => onRemoveHabit(h)}>
              <Icon name="close" size={12} /> 습관 삭제
            </button>
          </div>
        );
      })}

      {sheet?.kind === 'unit' && (
        <UnitSheet
          name={sheet.habit.name}
          type={typeOf(sheet.habit)}
          onClose={close}
          onSaved={(t) => {
            upsertType(t);
            close();
          }}
          setError={setError}
        />
      )}
      {sheet?.kind === 'entry' && (
        <EntrySheet
          name={sheet.habit.name}
          unit={typeOf(sheet.habit)?.unit}
          entry={sheet.entry}
          defaultDay={inMonth(today) ? today : first}
          ensureType={() => ensureType(sheet.habit)}
          onClose={close}
          onSaved={(e) => {
            setEntries((es) => sortEntries(inMonth(e.day) ? [...es.filter((x) => x.id !== e.id), e] : es.filter((x) => x.id !== e.id)));
            const habit = sheet.habit;
            close();
            onRecorded(habit, e.day);
          }}
          onDeleted={(id) => {
            setEntries((es) => es.filter((e) => e.id !== id));
            close();
          }}
          setError={setError}
        />
      )}
    </>
  );
}
