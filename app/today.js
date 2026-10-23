'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { addDays, dayTitle, isHoliday, occursOn, todayStr, weekday } from './dates';
import TaskRow from './task-row';
import TaskSheet from './task-sheet';
import EventSheet from './event-sheet';
import { labelHex } from './shared';
import Icon from './icons';

const ROW = 44; // 시간표 한 시간 높이(px)
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// 겹치는 일정은 옆으로 나눠 놓는다. 마감 시각이 없으면 1시간짜리로 그린다.
function layoutBlocks(list) {
  const items = list.map((ev) => {
    const start = minutes(ev.start_time);
    const end = ev.end_time && minutes(ev.end_time) > start ? minutes(ev.end_time) : start + 60;
    return { ev, start, end, lane: 0, lanes: 1 };
  });
  let cluster = [];
  let clusterEnd = -1;
  const lanesEnd = [];
  const close = () => cluster.forEach((x) => (x.lanes = lanesEnd.length));
  for (const it of items) {
    if (it.start >= clusterEnd) {
      close();
      cluster = [];
      lanesEnd.length = 0;
    }
    let lane = lanesEnd.findIndex((end) => end <= it.start);
    if (lane === -1) lane = lanesEnd.length;
    lanesEnd[lane] = it.end;
    it.lane = lane;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  close();
  return items;
}

// 오늘 탭: 오늘 할 일 체크리스트만 보여준다. 안 한 지난 할 일은 한 번에 오늘로 넘길 수 있다.
export default function Today({ setError }) {
  const today = todayStr();
  const [day, setDay] = useState(today);
  const isToday = day === today;
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState(null); // { task: 수정 중인 할 일 또는 null }
  const [evSheet, setEvSheet] = useState(null); // { event, time }
  const [quick, setQuick] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('task_checks').select('*').gte('day', addDays(today, -180)),
      supabase.from('events').select('*').order('created_at'),
    ]).then(([t, c, e]) => {
      const err = t.error ?? c.error ?? e.error;
      if (err) setError('할 일을 불러오지 못했어요: ' + err.message);
      else {
        setTasks(t.data);
        setChecks(c.data);
        setEvents(e.data);
      }
      setLoaded(true);
    });
  }, []);

  const doneSet = new Set(checks.map((c) => `${c.task_id}|${c.day}`));
  const isDone = (t, day) => doneSet.has(`${t.id}|${day}`);

  const todays = tasks.filter((t) => occursOn(t, day));
  const doneCount = todays.filter((t) => isDone(t, day)).length;
  // 반복하지 않는 할 일 중 날짜가 지났는데 아직 체크 안 한 것
  const overdue = tasks.filter((t) => t.repeat === 'none' && t.day < today && !isDone(t, t.day)).sort((a, b) => (a.day < b.day ? -1 : 1));
  const categories = [...new Set([...tasks, ...events].map((t) => t.category).filter(Boolean))];

  // 시간표: 기본 6~23시, 그 밖 시간의 일정이 있으면 범위를 넓힌다
  const dayEvents = events.filter((ev) => occursOn(ev, day));
  const allDay = dayEvents.filter((ev) => !ev.start_time);
  const timed = dayEvents.filter((ev) => ev.start_time).sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  const hourOf = (ev) => Number(ev.start_time.slice(0, 2));
  const hours = Array.from({ length: Math.max(23, ...timed.map(hourOf)) - Math.min(6, ...timed.map(hourOf)) + 1 }, (_, i) => Math.min(6, ...timed.map(hourOf)) + i);

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
    const { data, error } = await supabase.from('tasks').insert({ title, day }).select().single();
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
        <div className="week-nav">
          <button type="button" onClick={() => setDay(addDays(day, -1))} aria-label="전날">
            ◀
          </button>
          <h2>
            {isToday && '오늘 · '}
            <span className={isHoliday(day) || weekday(day) === 0 ? 'red' : weekday(day) === 6 ? 'sat' : undefined}>{dayTitle(day)}</span>
          </h2>
          <button type="button" onClick={() => setDay(addDays(day, 1))} aria-label="다음날">
            ▶
          </button>
        </div>
        {!isToday && (
          <button type="button" className="mini" onClick={() => setDay(today)}>
            오늘로
          </button>
        )}
        <div className="progress" aria-label="진행률">
          <div style={{ width: todays.length ? `${(doneCount / todays.length) * 100}%` : '0%' }} />
        </div>
        <small>
          {todays.length === 0 ? `${isToday ? '오늘 ' : ''}할 일이 아직 없어요` : `${doneCount} / ${todays.length} 완료`}
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
        <h3><Icon name="memo" size={20} /> {isToday ? '오늘 할 일' : '할 일'}</h3>
        {loaded && todays.length === 0 && <p className="plan-empty">{isToday ? '오늘 ' : ''}할 일이 없어요. 아래에 적어 보세요</p>}
        <ul className="checklist">
          {todays.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              done={isDone(t, day)}
              onToggle={() => toggle(t, day)}
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

      <div className="card timetable">
        <div className="card-title">
          <h3><Icon name="month" size={20} /> 일정</h3>
          <button type="button" className="mini" onClick={() => setEvSheet({ event: null, time: '' })}>
            + 일정
          </button>
        </div>
        {allDay.length > 0 && (
          <div className="tt-allday">
            {allDay.map((ev) => (
              <button type="button" className="ev-line" key={ev.id} style={{ '--c': labelHex(ev.color) }} onClick={() => setEvSheet({ event: ev, time: '' })}>
                <span className="ev-time">하루 종일</span>
                <strong>{ev.title}</strong>
              </button>
            ))}
          </div>
        )}
        <div className="tt">
          {hours.map((h) => (
            <div className="tt-row" key={h} style={{ height: ROW }}>
              <span className="tt-h">{String(h).padStart(2, '0')}</span>
              <div className="tt-slot" onClick={() => setEvSheet({ event: null, time: `${String(h).padStart(2, '0')}:00` })} />
            </div>
          ))}
          <div className="tt-events">
            {layoutBlocks(timed).map(({ ev, start, end, lane, lanes }) => (
              <button
                type="button"
                className="ev-line tt-block"
                key={ev.id}
                style={{
                  '--c': labelHex(ev.color),
                  top: ((start - hours[0] * 60) * ROW) / 60 + 1,
                  height: Math.max(26, ((end - start) * ROW) / 60 - 2),
                  left: `${(lane / lanes) * 100}%`,
                  width: `calc(${100 / lanes}% - 3px)`,
                }}
                onClick={() => setEvSheet({ event: ev, time: '' })}
              >
                <span className="ev-time">
                  {ev.start_time.slice(0, 5)}
                  {ev.end_time && `~${ev.end_time.slice(0, 5)}`}
                </span>
                <strong>{ev.title}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {evSheet && (
        <EventSheet
          event={evSheet.event}
          defaultDay={day}
          defaultTime={evSheet.time}
          categories={categories}
          onClose={() => setEvSheet(null)}
          onSaved={(ev) => {
            setEvents((es) => (es.some((x) => x.id === ev.id) ? es.map((x) => (x.id === ev.id ? ev : x)) : [...es, ev]));
            setEvSheet(null);
          }}
          onDeleted={(id) => {
            setEvents((es) => es.filter((x) => x.id !== id));
            setEvSheet(null);
          }}
          setError={setError}
        />
      )}

      {sheet && (
        <TaskSheet
          task={sheet.task}
          defaultDay={day}
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
