'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { monthDay } from './dates';
import Icon from './icons';
import { askConfirm } from './confirm';

// 포스트잇 색(메모 번호로 정해서 DB에 따로 저장하지 않는다)
const PAPERS = ['#fbeea8', '#f6d2cb', '#d3e4cb', '#cfe0e8', '#e3d9ec', '#f8dfc4'];
const paperOf = (note) => PAPERS[note ? note.id % PAPERS.length : 0];

// '#맛집, 공부 여행' → ['맛집', '공부', '여행'] (중복 제거, 최대 10개, 20자까지)
const parseTags = (text) => [
  ...new Set(
    text
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#+/, '').trim().slice(0, 20))
      .filter(Boolean),
  ),
].slice(0, 10);

function MemoSheet({ note, allTags, onClose, onSaved, onDeleted, setError }) {
  const [form, setForm] = useState(note ? { title: note.title, body: note.body, tags: note.tags.join(', ') } : { title: '', body: '', tags: '' });
  const [busy, setBusy] = useState(false);
  const current = parseTags(form.tags);

  const addTag = (tag) => setForm((f) => ({ ...f, tags: [...new Set([...parseTags(f.tags), tag])].join(', ') }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const row = { title: form.title.trim(), body: form.body, tags: parseTags(form.tags), updated_at: new Date().toISOString() };
    const query = note ? supabase.from('notes').update(row).eq('id', note.id) : supabase.from('notes').insert(row);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) return setError('메모를 저장하지 못했어요: ' + error.message);
    setError('');
    onSaved(data);
  }

  async function remove() {
    if (!(await askConfirm('이 메모를 삭제할까요?'))) return;
    const { error } = await supabase.from('notes').delete().eq('id', note.id);
    if (error) return setError('메모를 삭제하지 못했어요: ' + error.message);
    setError('');
    onDeleted(note.id);
  }

  return (
    <div className="overlay postit-overlay" onClick={onClose}>
      <form className="sheet postit-sheet" style={{ '--pit': paperOf(note) }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{note ? <><Icon name="pencil" /> 메모 고치기</> : <><Icon name="memo" /> 새 메모</>}</h2>
        <label className="note-label">
          <input className="note-title" type="text" required autoFocus maxLength={60} placeholder="제목" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </label>
        <label className="note-label">
          <textarea className="note-body" rows={9} placeholder="여기에 자유롭게 적어요" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </label>
        <label className="note-label">
          <input className="note-tags" type="text" placeholder="# 태그 (쉼표나 띄어쓰기로 구분)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        </label>
        {allTags.filter((t) => !current.includes(t)).length > 0 && (
          <div className="kinds">
            {allTags
              .filter((t) => !current.includes(t))
              .map((t) => (
                <button type="button" className="kind" key={t} onClick={() => addTag(t)}>
                  #{t}
                </button>
              ))}
          </div>
        )}
        <div className={note ? 'actions edit' : 'actions'}>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {note && (
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

// 메모장: 제목+본문 자유 메모, 태그로 거르고 제목·본문을 검색한다.
export default function Memo({ setError }) {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [sheet, setSheet] = useState(null); // { item }

  useEffect(() => {
    supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('메모를 불러오지 못했어요: ' + error.message);
        else setNotes(data);
        setLoaded(true);
      });
  }, []);

  const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();
  const needle = q.trim().toLowerCase();
  const shown = notes.filter((n) => (!tag || n.tags.includes(tag)) && (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle)));

  const onSaved = (saved) => {
    setNotes((ns) => [saved, ...ns.filter((n) => n.id !== saved.id)]);
    setSheet(null);
  };

  return (
    <section className="memo">
      <div className="card memo-head">
        <div className="card-title">
          <h2>메모장</h2>
          <button type="button" className="mini" onClick={() => setSheet({ item: null })}>
            + 새 메모
          </button>
        </div>
        <input type="search" className="memo-search" placeholder="제목·내용 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="메모 검색" />
        {allTags.length > 0 && (
          <div className="day-chips">
            <button type="button" className={tag === '' ? 'chip-btn on' : 'chip-btn'} onClick={() => setTag('')}>
              전체
            </button>
            {allTags.map((t) => (
              <button type="button" key={t} className={tag === t ? 'chip-btn on' : 'chip-btn'} onClick={() => setTag(tag === t ? '' : t)}>
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {loaded && notes.length === 0 && (
        <div className="empty">
          <p><Icon name="memo" size={44} /></p>
          <p>아직 메모가 없어요!</p>
          <p className="sub">위의 + 새 메모로 첫 메모를 적어 보세요</p>
        </div>
      )}
      {loaded && notes.length > 0 && shown.length === 0 && <p className="plan-empty center">찾는 메모가 없어요</p>}

      <ul className="memo-list">
        {shown.map((n) => (
          <li key={n.id}>
            <button type="button" className="memo-card" style={{ '--pit': paperOf(n) }} onClick={() => setSheet({ item: n })}>
              <strong>{n.title}</strong>
              {n.body && <p>{n.body}</p>}
              <span className="memo-foot">
                {n.tags.map((t) => (
                  <i key={t}>#{t}</i>
                ))}
                <small>{monthDay(n.updated_at.slice(0, 10))}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sheet && (
        <MemoSheet
          note={sheet.item}
          allTags={allTags}
          onClose={() => setSheet(null)}
          onSaved={onSaved}
          onDeleted={(id) => {
            setNotes((ns) => ns.filter((n) => n.id !== id));
            setSheet(null);
          }}
          setError={setError}
        />
      )}
    </section>
  );
}
