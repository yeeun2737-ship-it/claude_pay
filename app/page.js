'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const CATEGORIES = [
  { name: '식비', emoji: '🍙', color: '#ffd23f' },
  { name: '카페', emoji: '☕', color: '#ff8fb1' },
  { name: '교통', emoji: '🚌', color: '#7fd6ff' },
  { name: '쇼핑', emoji: '🛍️', color: '#b9a3ff' },
  { name: '구독', emoji: '📺', color: '#8fe3a3' },
  { name: '기타', emoji: '✨', color: '#ffb36b' },
];

const catOf = (name) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[5];

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const won = (n) => n.toLocaleString('ko-KR') + '원';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return `${m}월 ${d}일 (${DAYS[new Date(y, m - 1, d).getDay()]})`;
}

export default function Home() {
  const [expenses, setExpenses] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('list');
  const [unlocked, setUnlocked] = useState(null);
  const [password, setPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [form, setForm] = useState({
    amount: '',
    place: '',
    category: CATEGORIES[0].name,
    date: toDateStr(new Date()),
    memo: '',
  });

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => setUnlocked(data.unlocked));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('불러오지 못했어요: ' + error.message);
        else setExpenses(data);
      });
  }, [unlocked]);

  async function unlock(e) {
    e.preventDefault();
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setPassword('');
    if (res.ok) {
      setLockError('');
      setUnlocked(true);
    } else {
      setLockError('비밀번호가 달라요 🙅');
    }
  }

  async function lock() {
    await fetch('/api/auth', { method: 'DELETE' });
    setExpenses([]);
    setOpen(false);
    setUnlocked(false);
  }

  if (unlocked === null) return <main className="app" />;

  if (!unlocked) {
    return (
      <main className="app lock">
        <form className="hero" onSubmit={unlock}>
          <p className="brand">🐷 티끌모아 티끌</p>
          <p className="label">🔒 비밀번호를 입력해요</p>
          <input
            className="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="비밀번호"
          />
          {lockError && <p className="lock-error">{lockError}</p>}
          <button type="submit" className="unlock">
            열기
          </button>
        </form>
      </main>
    );
  }

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const monthTotal = expenses
    .filter((e) => e.date.startsWith(monthKey))
    .reduce((sum, e) => sum + e.amount, 0);

  const monthExpenses = expenses.filter((e) => e.date.startsWith(monthKey));
  const byCategory = CATEGORIES.map((c) => {
    const items = monthExpenses.filter((e) => e.category === c.name);
    return { ...c, count: items.length, sum: items.reduce((s, e) => s + e.amount, 0) };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.sum - a.sum);
  const dailyAvg = Math.round(monthTotal / today.getDate());

  const groups = Object.entries(
    expenses.reduce((acc, e) => {
      (acc[e.date] ??= []).push(e);
      return acc;
    }, {}),
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.place.trim()) return;
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...form, amount, place: form.place.trim(), memo: form.memo.trim() })
      .select()
      .single();
    if (error) {
      setError('저장하지 못했어요: ' + error.message);
      return;
    }
    setError('');
    setExpenses([data, ...expenses]);
    setForm({ ...form, amount: '', place: '', memo: '' });
    setOpen(false);
  }

  return (
    <main className="app">
      <header className="hero">
        <button className="lock-btn" onClick={lock} aria-label="잠그기">
          🔒
        </button>
        <p className="brand">🐷 티끌모아 티끌</p>
        <p className="label">{today.getMonth() + 1}월 지출 합계</p>
        <p className="total">{won(monthTotal)}</p>
        <span className="sticker">티끌도 모이면... 티끌! 🫠</span>
      </header>

      {error && <p className="error">{error}</p>}

      <nav className="tabs">
        <button className={tab === 'list' ? 'tab on' : 'tab'} onClick={() => setTab('list')}>
          📒 내역
        </button>
        <button className={tab === 'stats' ? 'tab on' : 'tab'} onClick={() => setTab('stats')}>
          📊 통계
        </button>
      </nav>

      {tab === 'stats' && (
        <section className="stats">
          <div className="numbers">
            <div>
              <small>지출 건수</small>
              <strong>{monthExpenses.length}건</strong>
            </div>
            <div>
              <small>하루 평균</small>
              <strong>{won(dailyAvg)}</strong>
            </div>
          </div>
          {byCategory.length === 0 ? (
            <div className="empty">
              <p>📊</p>
              <p>이번 달 통계가 아직 없어요!</p>
            </div>
          ) : (
            <ul className="bars">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <div className="bar-head">
                    <span>
                      {c.emoji} {c.name} <small>{c.count}건</small>
                    </span>
                    <span>
                      {won(c.sum)} · {Math.round((c.sum / monthTotal) * 100)}%
                    </span>
                  </div>
                  <div className="track">
                    <div
                      className="fill"
                      style={{ width: `${(c.sum / monthTotal) * 100}%`, background: c.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="list" hidden={tab !== 'list'}>
        {groups.length === 0 && (
          <div className="empty">
            <p>🫥</p>
            <p>아직 쓴 돈이 없어요!</p>
            <p className="sub">아래 + 버튼으로 첫 지출을 적어봐요</p>
          </div>
        )}
        {groups.map(([date, items]) => (
          <div className="day" key={date}>
            <div className="day-head">
              <span>{formatDate(date)}</span>
              <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <ul>
              {items.map((e) => {
                const c = catOf(e.category);
                return (
                  <li key={e.id}>
                    <span className="chip" style={{ background: c.color }}>
                      {c.emoji} {c.name}
                    </span>
                    <div className="info">
                      <strong>{e.place}</strong>
                      {e.memo && <small>{e.memo}</small>}
                    </div>
                    <span className="amount">{won(e.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <button className="fab" onClick={() => setOpen(true)} aria-label="지출 추가">
        +
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>💸 지출 적기</h2>

            <label>
              금액
              <input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="0"
                value={form.amount}
                onChange={set('amount')}
                required
              />
            </label>

            <label>
              사용처
              <input
                type="text"
                placeholder="어디서 썼나요?"
                value={form.place}
                onChange={set('place')}
                required
              />
            </label>

            <div className="field">
              카테고리
              <div className="cats">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    className={form.category === c.name ? 'cat on' : 'cat'}
                    style={{ '--c': c.color }}
                    onClick={() => setForm({ ...form, category: c.name })}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </div>

            <label>
              날짜
              <input type="date" value={form.date} onChange={set('date')} required />
            </label>

            <label>
              메모
              <input type="text" placeholder="(선택)" value={form.memo} onChange={set('memo')} />
            </label>

            <div className="actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="submit" className="primary">
                추가하기
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
