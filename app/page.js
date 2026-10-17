'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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

// 화면에서는 숫자 4자리만 받는다. Supabase는 비밀번호가 6자 이상이어야 해서 고정 문자열을 붙여 보낸다.
const toPassword = (pin) => `${pin}-tikkeul`;

function authMessage(error) {
  const m = error.message ?? '';
  if (m.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요';
  if (m.includes('already registered')) return '이미 가입된 이메일이에요';
  if (m.includes('at least')) return '비밀번호는 숫자 4자리예요';
  if (m.includes('Email not confirmed')) return '메일 인증을 먼저 완료해 주세요';
  if (m.includes('rate limit')) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요';
  return m;
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
  const [session, setSession] = useState(undefined);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
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
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('불러오지 못했어요: ' + error.message);
        else setExpenses(data);
      });
  }, [userId]);

  async function authenticate(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setAuthInfo('');
    const credentials = { email: email.trim(), password: toPassword(password) };
    const { data, error } =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setAuthBusy(false);
    if (error) {
      setAuthError(authMessage(error));
      return;
    }
    if (authMode === 'signup' && data.user?.identities?.length === 0) {
      setAuthError('이미 가입된 이메일이에요');
      return;
    }
    if (authMode === 'signup' && !data.session) {
      setAuthInfo('인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요 📬');
    }
    setPassword('');
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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

  async function logout() {
    await supabase.auth.signOut();
    setExpenses([]);
    setOpen(false);
    setEditingId(null);
    setTab('list');
  }

  if (session === undefined) return <main className="app" />;

  if (!session) {
    const login = authMode === 'login';
    return (
      <main className="app lock">
        <form className="hero" onSubmit={authenticate}>
          <p className="brand">티끌모아 티끌</p>
          <p className="label">{login ? '로그인하고 내 가계부를 열어요' : '이메일로 내 가계부를 만들어요'}</p>
          <input
            className="auth-in"
            type="email"
            autoComplete="email"
            placeholder="이메일"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="이메일"
          />
          <input
            className="auth-in"
            type="password"
            autoComplete={login ? 'current-password' : 'new-password'}
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="비밀번호 (숫자 4자리)"
            title="숫자 4자리를 입력해 주세요"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
            aria-label="비밀번호"
          />
          {authError && <p className="lock-error">{authError}</p>}
          {authInfo && <p className="lock-error">{authInfo}</p>}
          <button type="submit" className="unlock" disabled={authBusy}>
            {authBusy ? '잠시만요...' : login ? '로그인' : '가입하기'}
          </button>
          <button
            type="button"
            className="switch"
            onClick={() => {
              setAuthMode(login ? 'signup' : 'login');
              setAuthError('');
              setAuthInfo('');
            }}
          >
            {login ? '계정이 없어요 → 가입하기' : '이미 계정이 있어요 → 로그인'}
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
    const row = {
      amount,
      place: form.place.trim(),
      category: form.category,
      date: form.date,
      memo: form.memo.trim(),
    };
    const query = editing
      ? supabase.from('expenses').update(row).eq('id', editingId)
      : supabase.from('expenses').insert(row);
    const { data, error } = await query.select().single();
    if (error) {
      setError('저장하지 못했어요: ' + error.message);
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
    const { error } = await supabase.from('expenses').delete().eq('id', editingId);
    if (error) {
      setError('삭제하지 못했어요: ' + error.message);
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
        <button className="lock-btn" onClick={logout}>
          로그아웃
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
