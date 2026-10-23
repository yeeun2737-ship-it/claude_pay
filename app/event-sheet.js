'use client';

import { useState } from 'react';
import { supabase } from './supabase';
import ItemFields from './item-fields';
import Icon from './icons';
import TimeInput from './time-input';
import { askConfirm } from './confirm';

// 일정 추가·수정 창. event가 없으면 새 일정.
export default function EventSheet({ event, defaultDay, defaultTime = '', categories, onClose, onSaved, onDeleted, setError }) {
  const [form, setForm] = useState(
    event
      ? {
          title: event.title,
          day: event.day,
          start_time: event.start_time?.slice(0, 5) ?? '',
          end_time: event.end_time?.slice(0, 5) ?? '',
          color: event.color,
          category: event.category,
          repeat: event.repeat,
          repeat_until: event.repeat_until ?? '',
        }
      : { title: '', day: defaultDay, start_time: defaultTime, end_time: '', color: 'blue', category: '', repeat: 'none', repeat_until: '' },
  );
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (form.end_time && form.end_time < form.start_time) return;
    setBusy(true);
    const row = {
      title: form.title.trim(),
      day: form.day,
      start_time: form.start_time || null,
      end_time: form.start_time && form.end_time ? form.end_time : null,
      color: form.color,
      category: form.category.trim(),
      repeat: form.repeat,
      repeat_until: form.repeat === 'none' ? null : form.repeat_until || null,
    };
    const query = event ? supabase.from('events').update(row).eq('id', event.id) : supabase.from('events').insert(row);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      setError('일정을 저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    onSaved(data);
  }

  async function remove() {
    if (!(await askConfirm('이 일정을 삭제할까요?' + (event.repeat !== 'none' ? '\n반복되는 모든 날짜에서 사라져요.' : '')))) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      setError('일정을 삭제하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    onDeleted(event.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{event ? <><Icon name="pencil" /> 일정 고치기</> : <><Icon name="pin" /> 일정 추가</>}</h2>
        <label>
          일정
          <input
            type="text"
            maxLength={80}
            required
            autoFocus
            placeholder="예: 치과 예약"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          날짜
          <input type="date" required value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} />
        </label>
        <div className="time-pair">
          <div className="field">
            시작 시각 (선택)
            <TimeInput label="시작 시각" value={form.start_time} onChange={(v) => setForm((f) => ({ ...f, start_time: v, end_time: v ? f.end_time : '' }))} />
          </div>
          <div className="field">
            마감 시각 (선택)
            <TimeInput label="마감 시각" disabled={!form.start_time} value={form.end_time} onChange={(v) => setForm((f) => ({ ...f, end_time: v }))} />
          </div>
        </div>
        {form.end_time && form.end_time < form.start_time && <p className="time-warn">마감 시각이 시작 시각보다 빨라요</p>}
        <ItemFields form={form} setForm={setForm} categories={categories} />
        <div className={event ? 'actions edit' : 'actions'}>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {event && (
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
