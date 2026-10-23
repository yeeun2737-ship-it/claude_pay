'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { addDays, dayTitle, occursOn, todayStr } from './dates';
import TaskRow from './task-row';
import TaskSheet from './task-sheet';

// 오늘 탭: 오늘 할 일 체크리스트만 보여준다. 안 한 지난 할 일은 한 번에 오늘로 넘길 수 있다.
export default function Today({ setError }) {
  const today = todayStr();
  const [tasks, setTasks] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState(null); // { task: 수정 중인 할 일 또는 null }
  const [quick, setQuick] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('task_checks').select('*').gte('day', addDays(today, -60)),
    ]).then(([t, c]) => {
      if (t.error || c.error) setError('할 일을 불러오지 못했어요: ' + (t.error ?? c.error).message);
      else {
        setTasks(t.data);
        setChecks(c.data);
      }
      setLoaded(true);
    });
  }, []);

  const doneSet = new Set(checks.map((c) => `${c.task_id}|${c.day}`));
  const isDone = (t, day) => doneSet.has(`${t.id}|${day}`);

  const todays = tasks.filter((t) => occursOn(t, today));
  const doneCount = todays.filter((t) => isDone(t, today)).length;
  // 반복하지 않는 할 일 중 날짜가 지났는데 아직 체크 안 한 것
  const overdue = tasks.filter((t) => t.repeat === 'none' && t.day < today && !isDone(t, t.day)).sort((a, b) => (a.day < b.day ? -1 : 1));
  const categories = [...new Set(tasks.map((t) => t.category).filter(Boolean))];

  async function toggle(task, day) {
    if (isDone(task, day)) {
      const { error } = await supabase.from('task_checks').delete().eq('task_id', task.id).eq('day', day);
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks(checks.filter((c) => !(c.task_id === task.id && c.day === day)));
    } else {
      const { data, error } = await supabase.from('task_checks').insert({ task_id: task.id, day }).select().single();
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks([...checks, data]);
    }
    setError('');
  }

  async function moveAllToToday() {
    const ids = overdue.map((t) => t.id);
    const { error } = await supabase.from('tasks').update({ day: today }).in('id', ids);
    if (error) return setError('할 일을 넘기지 못했어요: ' + error.message);
    setError('');
    setTasks(tasks.map((t) => (ids.includes(t.id) ? { ...t, day: today } : t)));
  }

  async function quickAdd(e) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    const { data, error } = await supabase.from('tasks').insert({ title, day: today }).select().single();
    if (error) return setError('할 일을 저장하지 못했어요: ' + error.message);
    setError('');
    setTasks([...tasks, data]);
    setQuick('');
  }

  const onSaved = (saved) => {
    setTasks(tasks.some((t) => t.id === saved.id) ? tasks.map((t) => (t.id === saved.id ? saved : t)) : [...tasks, saved]);
    setSheet(null);
  };
  const onDeleted = (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
    setChecks(checks.filter((c) => c.task_id !== id));
    setSheet(null);
  };

  return (
    <section className="today">
      <div className="card today-head">
        <h2>오늘 · {dayTitle(today)}</h2>
        <div className="progress" aria-label="오늘 진행률">
          <div style={{ width: todays.length ? `${(doneCount / todays.length) * 100}%` : '0%' }} />
        </div>
        <small>
          {todays.length === 0 ? '오늘 할 일이 아직 없어요' : `${doneCount} / ${todays.length} 완료${doneCount === todays.length ? ' 🎉' : ''}`}
        </small>
      </div>

      {overdue.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>⏰ 안 한 일</h3>
            <button type="button" className="mini" onClick={moveAllToToday}>
              모두 오늘로 넘기기
            </button>
          </div>
          <ul className="checklist">
            {overdue.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                done={false}
                note={dayTitle(t.day)}
                onToggle={() => toggle(t, t.day)}
                onOpen={() => setSheet({ task: t })}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>📝 오늘 할 일</h3>
        {loaded && todays.length === 0 && <p className="plan-empty">오늘 할 일이 없어요. 아래에 적어 보세요</p>}
        <ul className="checklist">
          {todays.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              done={isDone(t, today)}
              onToggle={() => toggle(t, today)}
              onOpen={() => setSheet({ task: t })}
            />
          ))}
        </ul>
        <form className="quick" onSubmit={quickAdd}>
          <input
            type="text"
            maxLength={80}
            placeholder="할 일을 적고 Enter"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            aria-label="할 일 빠르게 추가"
          />
          <button type="submit">추가</button>
        </form>
        <button type="button" className="more-add" onClick={() => setSheet({ task: null })}>
          + 색·반복·날짜를 정해서 추가
        </button>
      </div>

      {sheet && (
        <TaskSheet
          task={sheet.task}
          defaultDay={today}
          categories={categories}
          onClose={() => setSheet(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
          setError={setError}
        />
      )}
    </section>
  );
}
