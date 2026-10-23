'use client';

import { useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabase';
import LocationPicker from './location-picker';
import TripMap from './trip-map';
import Icon from './icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 여행 기간의 모든 날짜(YYYY-MM-DD). 시간대 때문에 하루가 밀리지 않게 UTC로 센다.
function daysBetween(start, end) {
  const days = [];
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const dayLabel = (day) => {
  const [, m, d] = day.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]})`;
};

const timeText = (t) => (t ? t.slice(0, 5) : '시간 미정');

function PlanItem({ item, order, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'plan-item dragging' : 'plan-item'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="handle" aria-label="끌어서 순서 바꾸기" {...attributes} {...listeners}>
        ≡
      </button>
      <span className="order">{order}</span>
      <div className="plan-body" onClick={() => onOpen(item)}>
        <strong>{item.place}</strong>
        <small>
          {item.lat !== null && <><Icon name="pin" size={12} /> </>}
          {timeText(item.visit_time)}
          {item.note && ` · ${item.note}`}
        </small>
      </div>
    </li>
  );
}

export default function TripPlan({ trip, setError }) {
  const [items, setItems] = useState([]);
  const [sheet, setSheet] = useState(null); // { id: 수정 중인 일정 id 또는 null, form }
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = () =>
    supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', trip.id)
      .order('day')
      .order('position')
      .order('id')
      .then(({ data, error }) => {
        if (error) setError('일정을 불러오지 못했어요: ' + error.message);
        else setItems(data);
      });

  useEffect(() => {
    load();
  }, [trip.id]);

  const itemsOf = (day) => items.filter((i) => i.day === day);
  const nextPosition = (day) => Math.max(-1, ...itemsOf(day).map((i) => i.position)) + 1;

  const days = daysBetween(trip.start_date, trip.end_date);

  function openNew(day) {
    setSheet({ id: null, form: { day, place: '', visit_time: '', note: '', lat: null, lng: null } });
  }

  function openEdit(item) {
    setSheet({
      id: item.id,
      form: {
        day: item.day,
        place: item.place,
        visit_time: item.visit_time?.slice(0, 5) ?? '',
        note: item.note ?? '',
        lat: item.lat,
        lng: item.lng,
      },
    });
  }

  async function save(e) {
    e.preventDefault();
    const { id, form } = sheet;
    const old = items.find((i) => i.id === id);
    setBusy(true);
    const row = {
      day: form.day,
      place: form.place.trim(),
      visit_time: form.visit_time || null,
      note: form.note.trim(),
      lat: form.lat,
      lng: form.lng,
    };
    // 새 일정이거나 다른 날짜로 옮기면 그 날짜의 맨 뒤에 둔다
    if (!old || old.day !== form.day) row.position = nextPosition(form.day);
    const query = old
      ? supabase.from('trip_items').update(row).eq('id', id)
      : supabase.from('trip_items').insert({ ...row, trip_id: trip.id });
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      setError('일정을 저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setItems(old ? items.map((i) => (i.id === id ? data : i)) : [...items, data]);
    setSheet(null);
  }

  async function remove() {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    const { error } = await supabase.from('trip_items').delete().eq('id', sheet.id);
    if (error) {
      setError('일정을 삭제하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setItems(items.filter((i) => i.id !== sheet.id));
    setSheet(null);
  }

  async function reorder(day, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = itemsOf(day);
    const moved = arrayMove(
      list,
      list.findIndex((i) => i.id === active.id),
      list.findIndex((i) => i.id === over.id),
    ).map((item, index) => ({ ...item, position: index }));
    setItems([...items.filter((i) => i.day !== day), ...moved]);
    const changed = moved.filter((item) => list.find((o) => o.id === item.id).position !== item.position);
    const results = await Promise.all(
      changed.map((item) => supabase.from('trip_items').update({ position: item.position }).eq('id', item.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      setError('순서를 저장하지 못했어요: ' + failed.error.message);
      load();
    }
  }

  const setField = (key) => (e) => setSheet({ ...sheet, form: { ...sheet.form, [key]: e.target.value } });

  return (
    <div className="plan">
      <TripMap days={days} items={items} />
      <h3><Icon name="month" size={20} /> 일정</h3>
      {days.map((day, index) => {
        const list = itemsOf(day);
        return (
          <div className="plan-day" key={day}>
            <div className="plan-day-head">
              <span>
                Day {index + 1} · {dayLabel(day)}
              </span>
              <button type="button" onClick={() => openNew(day)}>
                + 추가
              </button>
            </div>
            {list.length === 0 && <p className="plan-empty">아직 일정이 없어요</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(ev) => reorder(day, ev)}>
              <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="plan-list">
                  {list.map((item, i) => (
                    <PlanItem key={item.id} item={item} order={i + 1} onOpen={openEdit} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        );
      })}

      {sheet && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{sheet.id === null ? <><Icon name="pin" /> 일정 추가</> : <><Icon name="pencil" /> 일정 고치기</>}</h2>
            <label>
              날짜
              <select value={sheet.form.day} onChange={setField('day')}>
                {days.map((day, index) => (
                  <option key={day} value={day}>
                    Day {index + 1} · {dayLabel(day)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              장소
              <input
                type="text"
                placeholder="예: 오사카성"
                maxLength={60}
                required
                value={sheet.form.place}
                onChange={setField('place')}
              />
            </label>
            <LocationPicker
              query={sheet.form.place}
              value={sheet.form.lat === null ? null : { lat: sheet.form.lat, lng: sheet.form.lng }}
              onChange={({ lat, lng, name }) =>
                setSheet((s) => ({ ...s, form: { ...s.form, lat, lng, ...(name ? { place: name } : {}) } }))
              }
              onClear={() => setSheet((s) => ({ ...s, form: { ...s.form, lat: null, lng: null } }))}
            />
            <label>
              방문 시각 (선택)
              <input type="time" value={sheet.form.visit_time} onChange={setField('visit_time')} />
            </label>
            <label>
              메모 (선택)
              <input
                type="text"
                placeholder="예약 번호, 준비물 등"
                maxLength={200}
                value={sheet.form.note}
                onChange={setField('note')}
              />
            </label>
            <div className={sheet.id === null ? 'actions' : 'actions edit'}>
              <button type="button" className="ghost" onClick={() => setSheet(null)}>
                취소
              </button>
              {sheet.id !== null && (
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
      )}
    </div>
  );
}
