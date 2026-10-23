'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { WEEKDAY_NAMES, daysInMonth, isHoliday, todayStr, weekday } from './dates';
import { pad } from './shared';
import Icon from './icons';
import Records from './records';
import { askConfirm } from './confirm';

const KINDS = ['러닝', '걷기', '요가', '헬스', '수영', '자전거', '필라테스', '홈트', '등산', '댄스'];

// 75분 → '1시간 15분'
export const minutesText = (min) => (min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`);

function WorkoutSheet({ workout, defaultDay, kinds, onClose, onSaved, onDeleted, setError }) {
  const [form, setForm] = useState(
    workout ? { day: workout.day, kind: workout.kind, minutes: String(workout.minutes) } : { day: defaultDay, kind: '', minutes: '30' },
  );
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const row = { day: form.day, kind: form.kind.trim(), minutes: Number(form.minutes) };
    const query = workout ? supabase.from('workouts').update(row).eq('id', workout.id) : supabase.from('workouts').insert(row);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) return setError('운동 기록을 저장하지 못했어요: ' + error.message);
    setError('');
    onSaved(data, !workout || workout.day !== row.day);
  }

  async function remove() {
    if (!(await askConfirm('이 운동 기록을 삭제할까요?'))) return;
    const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
    if (error) return setError('운동 기록을 삭제하지 못했어요: ' + error.message);
    setError('');
    onDeleted(workout.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{workout ? <><Icon name="pencil" /> 운동 고치기</> : <><Icon name="workout" /> 운동 기록</>}</h2>
        <label>
          날짜
          <input type="date" required value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} />
        </label>
        <div className="field">
          운동 종류
          <div className="kinds">
            {kinds.map((k) => (
              <button type="button" key={k} className={form.kind === k ? 'kind on' : 'kind'} onClick={() => setForm((f) => ({ ...f, kind: k }))}>
                {k}
              </button>
            ))}
          </div>
          <input
            type="text"
            required
            maxLength={20}
            placeholder="직접 입력 (다음부터 목록에 남아요)"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          />
        </div>
        <label>
          시간 (분)
          <input
            type="number"
            inputMode="numeric"
            required
            min="1"
            max="1440"
            value={form.minutes}
            onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
          />
        </label>
        <div className={workout ? 'actions edit' : 'actions'}>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {workout && (
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

// 습관 탭: 습관 트래커(날짜×습관 체크표), 이번 달 운동 통계와 운동 기록(종류+시간)
export default function Workout({ setError }) {
  const today = todayStr();
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [workouts, setWorkouts] = useState([]);
  const [habits, setHabits] = useState([]);
  const [checks, setChecks] = useState([]);
  const [sheet, setSheet] = useState(null); // { item }
  const [newHabit, setNewHabit] = useState('');
  const [confirmHabit, setConfirmHabit] = useState(null); // 삭제 확인 중인 습관
  const [usedKinds, setUsedKinds] = useState([]); // 예전에 직접 입력해서 쓴 운동 종류

  const total = daysInMonth(ym.y, ym.m);
  const first = `${ym.y}-${pad(ym.m)}-01`;
  const last = `${ym.y}-${pad(ym.m)}-${pad(total)}`;
  const days = Array.from({ length: total }, (_, i) => `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`);
  const inMonth = (day) => day >= first && day <= last;

  // 습관 목록은 한 번만 불러온다. "운동" 습관이 있어야 운동 기록 카드가 보인다.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('habits').select('*').order('position').order('id');
      if (error) return setError('습관을 불러오지 못했어요: ' + error.message);
      setHabits(data.filter((h, i, arr) => arr.findIndex((x) => x.name === h.name) === i));
    })();
  }, []);

  useEffect(() => {
    supabase
      .from('workouts')
      .select('kind')
      .order('id', { ascending: false })
      .limit(300)
      .then(({ data }) => data && setUsedKinds([...new Set(data.map((w) => w.kind))]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('workouts').select('*').gte('day', first).lte('day', last).order('day', { ascending: false }).order('id', { ascending: false }),
      supabase.from('habit_checks').select('*').gte('day', first).lte('day', last),
    ]).then(([w, c]) => {
      if (cancelled) return;
      const err = w.error ?? c.error;
      if (err) return setError('운동 기록을 불러오지 못했어요: ' + err.message);
      setWorkouts(w.data);
      setChecks(c.data);
    });
    return () => {
      cancelled = true;
    };
  }, [first, last]);

  const move = (delta) => {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
    setTrackStart(null);
  };

  // 습관 표는 7일씩 보여준다. 이번 달이면 오늘이 들어가도록 시작 위치를 잡는다.
  const maxStart = Math.max(0, total - 7);
  const [trackStart, setTrackStart] = useState(null);
  const isThisMonth = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7));
  const start = Math.min(maxStart, Math.max(0, trackStart ?? (isThisMonth ? Number(today.slice(8)) - 4 : 0)));
  const shownDays = days.slice(start, start + 7);

  const thisMonth = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7));

  const totalMinutes = workouts.reduce((s, w) => s + w.minutes, 0);
  const workoutDays = new Set(workouts.map((w) => w.day)).size;
  const byDay = Object.entries(
    workouts.reduce((acc, w) => {
      (acc[w.day] ??= []).push(w);
      return acc;
    }, {}),
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  const checked = (habit, day) => checks.some((c) => c.habit_id === habit.id && c.day === day);

  async function toggle(habit, day) {
    if (checked(habit, day)) {
      const { error } = await supabase.from('habit_checks').delete().eq('habit_id', habit.id).eq('day', day);
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks((cs) => cs.filter((c) => !(c.habit_id === habit.id && c.day === day)));
    } else {
      const { data, error } = await supabase.from('habit_checks').insert({ habit_id: habit.id, day }).select().single();
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks((cs) => [...cs, data]);
    }
    setError('');
  }

  async function addHabit(e) {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    const { data, error } = await supabase.from('habits').insert({ name, position: habits.length }).select().single();
    if (error) return setError(error.code === '23505' ? '이미 있는 습관이에요' : '습관을 추가하지 못했어요: ' + error.message);
    setError('');
    setHabits((hs) => [...hs, data]);
    setNewHabit('');
  }

  // 확인은 브라우저 confirm 대신 앱 안의 창으로 받는다(일부 화면에서는 confirm 창이 뜨지 않는다)
  async function removeHabit(habit) {
    setConfirmHabit(null);
    const { error } = await supabase.from('habits').delete().eq('id', habit.id);
    if (error) return setError('습관을 삭제하지 못했어요: ' + error.message);
    await supabase.from('record_types').delete().eq('name', habit.name);
    if (habit.name === '운동') {
      await supabase.from('workouts').delete().gt('id', 0);
      setWorkouts([]);
    }
    setError('');
    setHabits((hs) => hs.filter((h) => h.id !== habit.id));
    setChecks((cs) => cs.filter((c) => c.habit_id !== habit.id));
  }

  // 운동 기록을 새로 넣거나 날짜를 바꾸면 그날의 "운동" 습관을 자동으로 체크한다
  async function onSaved(saved, dayChanged) {
    setWorkouts((ws) => {
      const rest = ws.filter((w) => w.id !== saved.id);
      return inMonth(saved.day) ? [...rest, saved].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.id - a.id)) : rest;
    });
    setSheet(null);
    const habit = habits.find((h) => h.name === '운동');
    if (habit && dayChanged) checkHabit(habit, saved.day);
  }

  // 기록을 적은 날은 그 습관을 자동으로 체크한다
  async function checkHabit(habit, day) {
    const { data, error } = await supabase.from('habit_checks').upsert({ habit_id: habit.id, day }, { onConflict: 'habit_id,day' }).select().single();
    if (!error && inMonth(day)) setChecks((cs) => (cs.some((c) => c.habit_id === habit.id && c.day === day) ? cs : [...cs, data]));
  }

  return (
    <section className="workout">
      <div className="card workout-head">
        <div className="week-nav">
          <button type="button" onClick={() => move(-1)} aria-label="지난달">
            ◀
          </button>
          <div>
            <h2>습관 기록</h2>
            <span className="range-pill">
              {ym.y}년 {ym.m}월
            </span>
          </div>
          <button type="button" onClick={() => move(1)} aria-label="다음달">
            ▶
          </button>
        </div>
        {!thisMonth && (
          <button type="button" className="mini" onClick={() => setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })}>
            이번 달로
          </button>
        )}
      </div>

      <div className="card">
        <h3><Icon name="today" size={20} /> 습관 트래커</h3>
        <div className="tr-nav">
          <button type="button" onClick={() => setTrackStart(Math.max(0, start - 7))} disabled={start === 0} aria-label="이전 7일">
            ◀
          </button>
          <span>
            {Number(shownDays[0].slice(5, 7))}/{Number(shownDays[0].slice(8))} ~ {Number(shownDays.at(-1).slice(5, 7))}/{Number(shownDays.at(-1).slice(8))}
          </span>
          <button type="button" onClick={() => setTrackStart(Math.min(maxStart, start + 7))} disabled={start >= maxStart} aria-label="다음 7일">
            ▶
          </button>
        </div>
        <div className="tracker-wrap">
          <table className="tracker">
            <thead>
              <tr>
                <th className="hname" />
                {shownDays.map((d) => (
                  <th key={d} className={['tday', d === today && 'is-today', weekday(d) === 6 && !isHoliday(d) && 'sat', (weekday(d) === 0 || isHoliday(d)) && 'red'].filter(Boolean).join(' ')}>
                    <small>{WEEKDAY_NAMES[weekday(d)]}</small>
                    <span className="dn">{Number(d.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
                <tr key={h.id}>
                  <th className="hname">
                    <span>
                      {h.name}
                      <small>{days.filter((d) => checked(h, d)).length}</small>
                    </span>
                    <button type="button" aria-label={`${h.name} 삭제`} onClick={() => setConfirmHabit(h)}>
                      <Icon name="close" size={13} />
                    </button>
                  </th>
                  {shownDays.map((d) => (
                    <td key={d}>
                      <button type="button" className={checked(h, d) ? 'tcell on' : 'tcell'} onClick={() => toggle(h, d)} aria-label={`${h.name} ${d}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="quick" onSubmit={addHabit}>
          <input type="text" maxLength={20} placeholder="새 습관 (예: 물 2L, 독서)" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} aria-label="새 습관" />
          <button type="submit">추가</button>
        </form>
      </div>

      {habits.some((h) => h.name === '운동') && (
      <div className="card">
        <div className="card-title">
          <h3><Icon name="workout" size={20} /> 운동 기록</h3>
          <button type="button" className="mini" onClick={() => setSheet({ item: null })}>
            + 운동
          </button>
        </div>
        <div className="stat-pills">
          <span><Icon name="workout" size={14} /> {workouts.length}회</span>
          <span>⏱️ {minutesText(totalMinutes)}</span>
          <span><Icon name="week" size={14} /> {workoutDays}일</span>
        </div>
        {workouts.length === 0 && <p className="plan-empty">이 달에는 운동 기록이 없어요. 오늘부터 시작해 볼까요?</p>}
        {byDay.map(([day, list]) => (
          <div className="wo-day" key={day}>
            <span className="wo-date">
              {Number(day.slice(5, 7))}/{Number(day.slice(8))} ({WEEKDAY_NAMES[weekday(day)]})
            </span>
            <div className="wo-list">
              {list.map((w) => (
                <button type="button" className="wo-item" key={w.id} onClick={() => setSheet({ item: w })}>
                  <strong>{w.kind}</strong>
                  <span>{minutesText(w.minutes)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="habit-del" onClick={() => setConfirmHabit(habits.find((h) => h.name === '운동'))}>
          <Icon name="close" size={12} /> 습관 삭제
        </button>
      </div>
      )}

      <Records habits={habits} first={first} last={last} setError={setError} onRecorded={checkHabit} onRemoveHabit={setConfirmHabit} />

      {confirmHabit && (
        <div className="overlay" onClick={() => setConfirmHabit(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2><Icon name="close" /> 습관 삭제</h2>
            <p>
              '{confirmHabit.name}' 습관을 삭제할까요?
              <br />
              지금까지의 체크와 {confirmHabit.name} 기록 카드도 함께 사라져요.
            </p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setConfirmHabit(null)}>
                취소
              </button>
              <button type="button" className="danger" onClick={() => removeHabit(confirmHabit)}>
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <WorkoutSheet
          workout={sheet.item}
          kinds={[...new Set([...KINDS, ...usedKinds, ...workouts.map((w) => w.kind)])]}
          defaultDay={inMonth(today) ? today : first}
          onClose={() => setSheet(null)}
          onSaved={onSaved}
          onDeleted={(id) => {
            setWorkouts((ws) => ws.filter((w) => w.id !== id));
            setSheet(null);
          }}
          setError={setError}
        />
      )}
    </section>
  );
}
