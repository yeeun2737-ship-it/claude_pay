'use client';

import { useState } from 'react';
import { supabase } from './supabase';
import ItemFields from './item-fields';
import Icon from './icons';
import { askConfirm } from './confirm';

// 할 일 추가·수정 창. task가 없으면 새 할 일.
export default function TaskSheet({ task, defaultDay, categories, onClose, onSaved, onDeleted, setError }) {
  const [form, setForm] = useState(
    task
      ? {
          title: task.title,
          day: task.day,
          color: task.color,
          category: task.category,
          repeat: task.repeat,
          repeat_until: task.repeat_until ?? '',
        }
      : { title: '', day: defaultDay, color: 'pink', category: '', repeat: 'none', repeat_until: '' },
  );
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const row = {
      title: form.title.trim(),
      day: form.day,
      color: form.color,
      category: form.category.trim(),
      repeat: form.repeat,
      repeat_until: form.repeat === 'none' ? null : form.repeat_until || null,
    };
    const query = task ? supabase.from('tasks').update(row).eq('id', task.id) : supabase.from('tasks').insert(row);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      setError('할 일을 저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    onSaved(data);
  }

  async function remove() {
    if (!(await askConfirm('이 할 일을 삭제할까요?' + (task.repeat !== 'none' ? '\n반복되는 모든 날짜에서 사라져요.' : '')))) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      setError('할 일을 삭제하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    onDeleted(task.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{task ? <><Icon name="pencil" /> 할 일 고치기</> : <><Icon name="today" /> 할 일 추가</>}</h2>
        <label>
          할 일
          <input
            type="text"
            maxLength={80}
            required
            autoFocus
            placeholder="예: 영어 에세이 쓰기"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          날짜
          <input type="date" required value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} />
        </label>
        <ItemFields form={form} setForm={setForm} categories={categories} />
        <div className={task ? 'actions edit' : 'actions'}>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {task && (
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
