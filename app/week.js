'use client';

import { useState } from 'react';
import { WEEKDAY_COLORS, WEEKDAY_EN, addDays, mondayOf, monthDay, occursOn, timeText, todayStr, weekday } from './dates';
import { labelHex } from './shared';
import { usePlanner } from './planner-data';
import EventSheet from './event-sheet';
import TaskRow from './task-row';
import TaskSheet from './task-sheet';
import Icon from './icons';

// 주간 스케줄표: 월~일 요일별 줄에 그날의 일정·할 일·여행을 보여준다.
export default function Week({ setError }) {
  const today = todayStr();
  const [monday, setMonday] = useState(mondayOf(today));
  const sunday = addDays(monday, 6);
  const P = usePlanner(monday, sunday, setError);
  const [sheet, setSheet] = useState(null); // { kind: 'event' | 'task', item, day }

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const categories = [...new Set([...P.tasks, ...P.events].map((x) => x.category).filter(Boolean))];

  const eventsOn = (day) =>
    P.events
      .filter((ev) => occursOn(ev, day))
      .sort((a, b) => (a.start_time ?? '99') < (b.start_time ?? '99') ? -1 : (a.start_time ?? '99') > (b.start_time ?? '99') ? 1 : 0);

  const close = () => setSheet(null);

  return (
    <section className="week">
      <div className="card week-head">
        <div className="week-nav">
          <button type="button" onClick={() => setMonday(addDays(monday, -7))} aria-label="지난주">
            ◀
          </button>
          <div>
            <h2>주간 플래너</h2>
            <span className="range-pill">
              {monthDay(monday)} ~ {monthDay(sunday)}
            </span>
          </div>
          <button type="button" onClick={() => setMonday(addDays(monday, 7))} aria-label="다음주">
            ▶
          </button>
        </div>
        {monday !== mondayOf(today) && (
          <button type="button" className="mini" onClick={() => setMonday(mondayOf(today))}>
            이번 주로
          </button>
        )}
      </div>

      <ul className="week-list">
        {days.map((day) => {
          const wd = weekday(day);
          const bands = P.trips.filter((t) => t.start_date <= day && day <= t.end_date);
          const dayItems = P.items.filter((i) => i.day === day);
          const dayTasks = P.tasks.filter((t) => occursOn(t, day));
          const dayEvents = eventsOn(day);
          const empty = !bands.length && !dayItems.length && !dayTasks.length && !dayEvents.length;
          return (
            <li key={day} className={day === today ? 'week-row today' : 'week-row'}>
              <div className="wd" style={{ '--c': WEEKDAY_COLORS[wd] }}>
                <span>{WEEKDAY_EN[wd]}</span>
                <b>{Number(day.slice(8))}</b>
              </div>
              <div className="week-body">
                {bands.map((t) => (
                  <span className="trip-band" key={t.id}>
                    <Icon name="suitcase" size={14} /> {t.name}
                  </span>
                ))}
                {dayEvents.map((ev) => (
                  <button type="button" className="ev-line" key={ev.id} style={{ '--c': labelHex(ev.color) }} onClick={() => setSheet({ kind: 'event', item: ev, day })}>
                    <span className="ev-time">{timeText(ev.start_time) || '하루 종일'}</span>
                    <strong>{ev.title}</strong>
                    {ev.repeat !== 'none' && <small><Icon name="repeat" size={12} /></small>}
                  </button>
                ))}
                {dayItems.map((i) => (
                  <p className="trip-line" key={i.id}>
                    <Icon name="pin" size={13} /> {i.visit_time ? `${timeText(i.visit_time)} ` : ''}
                    {i.place}
                  </p>
                ))}
                {dayTasks.length > 0 && (
                  <ul className="checklist">
                    {dayTasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        done={P.isDone(t, day)}
                        onToggle={() => P.toggleTask(t, day)}
                        onOpen={() => setSheet({ kind: 'task', item: t, day })}
                      />
                    ))}
                  </ul>
                )}
                {empty && <p className="week-empty">비어 있어요</p>}
                <div className="week-foot">
                  <span className="adds">
                    <button type="button" onClick={() => setSheet({ kind: 'event', item: null, day })}>
                      + 일정
                    </button>
                    <button type="button" onClick={() => setSheet({ kind: 'task', item: null, day })}>
                      + 할 일
                    </button>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

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
