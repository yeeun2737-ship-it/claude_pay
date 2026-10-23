'use client';

import { useState } from 'react';
import { WEEKDAY_NAMES, addDays, dayTitle, daysInMonth, occursOn, timeText, todayStr, weekday } from './dates';
import { labelHex, pad } from './shared';
import { usePlanner } from './planner-data';
import EventSheet from './event-sheet';
import TaskRow from './task-row';
import TaskSheet from './task-sheet';
import { minutesText } from './workout';
import Icon from './icons';

// 월간 달력: 날짜 칸에 일정, 여행 기간 띠를 보여주고 날짜를 누르면 그날을 자세히 본다.
export default function Month({ setError }) {
  const today = todayStr();
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState(today);
  const [sheet, setSheet] = useState(null); // { kind: 'event' | 'task', item, day }

  const first = `${ym.y}-${pad(ym.m)}-01`;
  const offset = weekday(first);
  const total = daysInMonth(ym.y, ym.m);
  const rows = Math.ceil((offset + total) / 7);
  const gridStart = addDays(first, -offset);
  const gridEnd = addDays(gridStart, rows * 7 - 1);
  const days = Array.from({ length: rows * 7 }, (_, i) => addDays(gridStart, i));

  const P = usePlanner(gridStart, gridEnd, setError);
  const categories = [...new Set([...P.tasks, ...P.events].map((x) => x.category).filter(Boolean))];

  const eventsOn = (day) =>
    P.events.filter((ev) => occursOn(ev, day)).sort((a, b) => ((a.start_time ?? '99') < (b.start_time ?? '99') ? -1 : 1));
  const tripsOn = (day) => P.trips.filter((t) => t.start_date <= day && day <= t.end_date);

  const move = (delta) => {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };
  const thisMonth = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7));
  const close = () => setSheet(null);

  const workoutDays = new Set(P.workouts.map((w) => w.day));
  const selWorkouts = P.workouts.filter((w) => w.day === selected);
  const selEvents = eventsOn(selected);
  const selTasks = P.tasks.filter((t) => occursOn(t, selected));

  return (
    <section className="month">
      <div className="card month-head">
        <div className="week-nav">
          <button type="button" onClick={() => move(-1)} aria-label="지난달">
            ◀
          </button>
          <div>
            <h2>월간 플래너</h2>
            <span className="range-pill">
              {ym.y}년 {ym.m}월
            </span>
          </div>
          <button type="button" onClick={() => move(1)} aria-label="다음달">
            ▶
          </button>
        </div>
        {!thisMonth && (
          <button
            type="button"
            className="mini"
            onClick={() => {
              setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
              setSelected(today);
            }}
          >
            이번 달로
          </button>
        )}
      </div>

      <div className="cal">
        {WEEKDAY_NAMES.map((n, i) => (
          <span key={n} className={i === 0 ? 'cal-dow sun' : 'cal-dow'}>
            {n}
          </span>
        ))}
        {days.map((day) => {
          const evs = eventsOn(day);
          const bands = tripsOn(day);
          const cls = ['cal-cell', day === today && 'today', day === selected && 'sel', !day.startsWith(`${ym.y}-${pad(ym.m)}`) && 'dim']
            .filter(Boolean)
            .join(' ');
          return (
            <button type="button" key={day} className={cls} onClick={() => setSelected(day)}>
              <span className="cal-num">{Number(day.slice(8))}</span>
              {workoutDays.has(day) && <span className="cal-wo"><Icon name="workout" size={12} /></span>}
              {evs.slice(0, 2).map((ev) => (
                <span className="cal-ev" key={ev.id} style={{ '--c': labelHex(ev.color) }}>
                  {ev.title}
                </span>
              ))}
              {evs.length > 2 && <span className="cal-more">+{evs.length - 2}</span>}
              {bands.map((t) => (
                <i className="cal-trip" key={t.id} title={t.name}>
                  {day === t.start_date || weekday(day) === 0 ? t.name : ''}
                </i>
              ))}
            </button>
          );
        })}
      </div>

      <div className="card day-detail">
        <h3>{dayTitle(selected)}</h3>
        {tripsOn(selected).map((t) => (
          <span className="trip-band" key={t.id}>
            <Icon name="suitcase" size={14} /> {t.name}
          </span>
        ))}

        <div className="detail-sec">
          <div className="card-title">
            <b><Icon name="pin" size={16} /> 일정</b>
            <button type="button" className="mini" onClick={() => setSheet({ kind: 'event', item: null, day: selected })}>
              + 일정
            </button>
          </div>
          {selEvents.length === 0 && <p className="plan-empty">일정이 없어요</p>}
          {selEvents.map((ev) => (
            <button type="button" className="ev-line" key={ev.id} style={{ '--c': labelHex(ev.color) }} onClick={() => setSheet({ kind: 'event', item: ev, day: selected })}>
              <span className="ev-time">{timeText(ev.start_time) || '하루 종일'}</span>
              <strong>{ev.title}</strong>
              {ev.repeat !== 'none' && <small><Icon name="repeat" size={12} /></small>}
            </button>
          ))}
        </div>

        <div className="detail-sec">
          <div className="card-title">
            <b><Icon name="today" size={16} /> 할 일</b>
            <button type="button" className="mini" onClick={() => setSheet({ kind: 'task', item: null, day: selected })}>
              + 할 일
            </button>
          </div>
          {selTasks.length === 0 && <p className="plan-empty">할 일이 없어요</p>}
          <ul className="checklist">
            {selTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                done={P.isDone(t, selected)}
                onToggle={() => P.toggleTask(t, selected)}
                onOpen={() => setSheet({ kind: 'task', item: t, day: selected })}
              />
            ))}
          </ul>
        </div>

        {selWorkouts.length > 0 && (
          <div className="detail-sec">
            <b><Icon name="workout" size={16} /> 운동</b>
            {selWorkouts.map((w) => (
              <p className="spent-line" key={w.id}>
                <span>{w.kind}</span>
                <b>{minutesText(w.minutes)}</b>
              </p>
            ))}
          </div>
        )}
      </div>

      {sheet?.kind === 'event' && (
        <EventSheet
          event={sheet.item}
          defaultDay={sheet.day}
          categories={categories}
          onClose={close}
          onSaved={(ev) => {
            P.saveEvent(ev);
            close();
          }}
          onDeleted={(id) => {
            P.removeEvent(id);
            close();
          }}
          setError={setError}
        />
      )}
      {sheet?.kind === 'task' && (
        <TaskSheet
          task={sheet.item}
          defaultDay={sheet.day}
          categories={categories}
          onClose={close}
          onSaved={(t) => {
            P.saveTask(t);
            close();
          }}
          onDeleted={(id) => {
            P.removeTask(id);
            close();
          }}
          setError={setError}
        />
      )}
    </section>
  );
}
