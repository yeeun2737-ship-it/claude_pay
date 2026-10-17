'use client';

import { useEffect, useState } from 'react';

const CATEGORIES = [
  { name: '식비', emoji: '🍙', color: '#f59e0b' },
  { name: '카페', emoji: '☕', color: '#ec4899' },
  { name: '교통', emoji: '🚌', color: '#0ea5e9' },
  { name: '쇼핑', emoji: '🛍️', color: '#8b5cf6' },
  { name: '구독', emoji: '📺', color: '#10b981' },
  { name: '기타', emoji: '✨', color: '#64748b' },
];

const catOf = (name) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[5];

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const won = (n) => n.toLocaleString('ko-KR') + '원';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 영수증 사진을 긴 변 1600px 이하 JPEG로 줄여 base64(헤더 제외)로 반환
async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

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
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [editingId, setEditingId] = useState(null);
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
    fetch('/api/expenses')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setExpenses(data);
      })
      .catch((err) => setError('불러오지 못했어요: ' + err.message));
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
      setLockError('PIN이 달라요 🙅');
    }
  }

  async function scanReceipt(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanNote('');
    try {
      const res = await fetch('/api/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await shrinkImage(file), mimeType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((f) => ({
        ...f,
        amount: data.amount ? String(data.amount) : '',
        date: data.date ?? '',
        place: data.place ?? '',
      }));
      const missing = [
        !data.amount && '금액',
        !data.date && '날짜',
        !data.place && '사용처',
      ].filter(Boolean);
      setScanNote(
        missing.length
          ? `${missing.join(', ')}은(는) 못 읽었어요. 직접 입력해 주세요 ✍️`
          : '다 읽었어요! 맞는지 확인하고 추가해 주세요 👀',
      );
    } catch (err) {
      setScanNote(`영수증을 읽지 못했어요: ${err.message}. 직접 입력해 주세요 ✍️`);
    } finally {
      setScanning(false);
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
          <p className="brand">티끌모아 티끌</p>
          <p className="label">🔒 PIN 4자리를 입력해요</p>
          <input
            className="pw"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
            aria-label="PIN"
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

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dailyTotals = Array.from({ length: daysInMonth }, (_, i) =>
    monthExpenses
      .filter((e) => Number(e.date.slice(8, 10)) === i + 1)
      .reduce((s, e) => s + e.amount, 0),
  );
  const maxDaily = Math.max(...dailyTotals);

  // 도넛 차트: 카테고리별 조각을 둘레(원주) 위에 이어 붙인다
  const R = 36;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;
  const arcs = byCategory.map((c) => {
    const len = (c.sum / monthTotal) * CIRC;
    const arc = { name: c.name, color: c.color, len, offset: acc };
    acc += len;
    return arc;
  });

  const groups = Object.entries(
    expenses.reduce((acc, e) => {
      (acc[e.date] ??= []).push(e);
      return acc;
    }, {}),
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const emptyForm = {
    amount: '',
    place: '',
    category: CATEGORIES[0].name,
    date: toDateStr(new Date()),
    memo: '',
  };

  function openNew() {
    // 고치던 내용이 새 입력 칸에 남지 않게 비운다
    if (editingId !== null) setForm(emptyForm);
    setEditingId(null);
    setScanNote('');
    setOpen(true);
  }

  function openEdit(e) {
    setForm({
      amount: String(e.amount),
      place: e.place,
      category: e.category,
      date: e.date,
      memo: e.memo ?? '',
    });
    setEditingId(e.id);
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.place.trim()) return;
    const editing = editingId !== null;
    const res = await fetch(editing ? `/api/expenses/${editingId}` : '/api/expenses', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError('저장하지 못했어요: ' + data.error);
      return;
    }
    setError('');
    setExpenses(editing ? expenses.map((x) => (x.id === data.id ? data : x)) : [data, ...expenses]);
    if (editing) {
      setForm(emptyForm);
      setEditingId(null);
    } else {
      setForm({ ...form, amount: '', place: '', memo: '' });
    }
    setScanNote('');
    setOpen(false);
  }

  async function remove() {
    if (!window.confirm('이 지출을 삭제할까요?')) return;
    const res = await fetch(`/api/expenses/${editingId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError('삭제하지 못했어요: ' + data.error);
      return;
    }
    setError('');
    setExpenses(expenses.filter((x) => x.id !== editingId));
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
  }

  return (
    <main className="app">
      <header className="hero">
        <button className="lock-btn" onClick={lock} aria-label="잠그기">
          🔒
        </button>
        <p className="brand">티끌모아 티끌</p>
        <p className="label">{today.getMonth() + 1}월 지출 합계</p>
        <p className="total">{won(monthTotal)}</p>
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
            <div className="chart-card">
              <h3>🍩 카테고리별 비율</h3>
              <svg viewBox="0 0 100 100" className="donut" role="img" aria-label="카테고리별 지출 비율 도넛 차트">
                <g transform="rotate(-90 50 50)">
                  {arcs.map((a) => (
                    <circle
                      key={a.name}
                      cx="50"
                      cy="50"
                      r={R}
                      fill="none"
                      stroke={a.color}
                      strokeWidth="18"
                      strokeDasharray={`${a.len} ${CIRC - a.len}`}
                      strokeDashoffset={-a.offset}
                    />
                  ))}
                </g>
                <text x="50" y="48" textAnchor="middle" fontSize="6" fill="#6b7280">
                  총 지출
                </text>
                <text x="50" y="58" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#111827">
                  {monthTotal.toLocaleString('ko-KR')}
                </text>
              </svg>
            </div>
          )}
          {monthExpenses.length > 0 && (
            <div className="chart-card">
              <h3>📅 일별 지출</h3>
              <svg viewBox="0 0 310 130" className="daily" role="img" aria-label="일별 지출 막대 그래프">
                {dailyTotals.map((v, i) => {
                  const w = 300 / daysInMonth;
                  const h = maxDaily ? (v / maxDaily) * 90 : 0;
                  return (
                    <g key={i}>
                      {v > 0 && (
                        <rect
                          x={5 + i * w + w * 0.15}
                          y={105 - h}
                          width={w * 0.7}
                          height={h}
                          rx="1.5"
                          fill={v === maxDaily ? '#4f46e5' : '#c7d2fe'}
                        />
                      )}
                      {(i + 1 === 1 || (i + 1) % 5 === 0) && (
                        <text x={5 + i * w + w / 2} y="121" textAnchor="middle" fontSize="8" fill="#6b7280">
                          {i + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
                <line x1="5" y1="105" x2="305" y2="105" stroke="#e5e7eb" strokeWidth="1.5" />
                <text x="5" y="10" fontSize="8" fontWeight="600" fill="#6b7280">
                  최대 {maxDaily.toLocaleString('ko-KR')}원
                </text>
              </svg>
            </div>
          )}
          {byCategory.length > 0 && (
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
        {groups.length > 0 && <p className="hint">💡 항목을 누르면 고치거나 지울 수 있어요</p>}
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
                  <li key={e.id} className="row" onClick={() => openEdit(e)}>
                    <span className="chip" style={{ '--c': c.color }}>
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

      <button className="fab" onClick={openNew} aria-label="지출 추가">
        +
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>{editingId === null ? '💸 지출 적기' : '✏️ 지출 고치기'}</h2>

            {editingId === null && (
              <label className="scan">
                <input type="file" accept="image/*" hidden onChange={scanReceipt} disabled={scanning} />
                <span className="scan-btn">{scanning ? '읽는 중... 🔍' : '📷 영수증으로 채우기'}</span>
                {scanNote && <small className="scan-note">{scanNote}</small>}
              </label>
            )}

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

            <div className={editingId === null ? 'actions' : 'actions edit'}>
              <button type="button" className="ghost" onClick={() => setOpen(false)}>
                취소
              </button>
              {editingId !== null && (
                <button type="button" className="danger" onClick={remove}>
                  삭제
                </button>
              )}
              <button type="submit" className="primary">
                {editingId === null ? '추가하기' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
