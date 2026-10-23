'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { CATEGORIES, CURRENCIES, currencyOf, formatDate, pad, toDateStr, won } from './shared';
import ExpenseRow from './expense-row';
import TripsView from './trips';
import Today from './today';
import Week from './week';
import Month from './month';
import Workout from './workout';
import Memo from './memo';
import Icon from './icons';
import { askConfirm } from './confirm';

// 아래 책갈피 메뉴
const PAGES = [
  { id: 'today', icon: 'today', label: '오늘', color: '#f0cfc9' },
  { id: 'week', icon: 'week', label: '주간', color: '#cfdde3' },
  { id: 'month', icon: 'month', label: '월간', color: '#cbdcc3' },
  { id: 'memo', icon: 'memo', label: '메모', color: '#ddd3e6' },
  { id: 'ledger', icon: 'ledger', label: '가계부', color: '#f4d9c3' },
  { id: 'workout', icon: 'habit', label: '습관', color: '#f3deaa' },
  { id: 'trips', icon: 'trips', label: '여행', color: '#c6dcd6' },
];

// 그 날짜의 환율(1 외화 = ? 원). 주말·휴일은 서비스가 직전 영업일 값을 주고, 미래 날짜는 최신 환율을 쓴다.
async function fetchRate(currency, date, signal) {
  const day = date > toDateStr(new Date()) ? 'latest' : date;
  const res = await fetch(`https://api.frankfurter.dev/v1/${day}?base=${currency}&symbols=KRW`, { signal });
  if (!res.ok) throw new Error('환율 조회 실패');
  const data = await res.json();
  return { rate: data.rates.KRW, date: data.date };
}

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

export default function Home() {
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState('today');
  const [tab, setTab] = useState('list');
  const [session, setSession] = useState(undefined);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    place: '',
    category: CATEGORIES[0].name,
    date: toDateStr(new Date()),
    memo: '',
    currency: 'KRW',
    rate: '',
    krw: '',
    tripId: '',
  });
  // 원화 금액을 사용자가 직접 고친 상태(true)면 환율·금액이 바뀌어도 자동 계산으로 덮어쓰지 않는다
  const [krwManual, setKrwManual] = useState(false);
  // 저장돼 있던 환율을 보여주는 중이면(수정 화면) 새로 가져오지 않는다
  const [rateLocked, setRateLocked] = useState(false);
  const [rateNote, setRateNote] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!open || form.currency === 'KRW' || !form.date || rateLocked) return;
    const controller = new AbortController();
    setRateNote('환율 가져오는 중...');
    fetchRate(form.currency, form.date, controller.signal)
      .then(({ rate, date }) => {
        setForm((f) => ({ ...f, rate: String(rate) }));
        setRateNote(`${date} 기준 환율을 가져왔어요`);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setForm((f) => ({ ...f, rate: '' }));
        setRateNote('환율을 가져오지 못했어요. 환율이나 원화 금액을 직접 입력해 주세요');
      });
    return () => controller.abort();
  }, [open, form.currency, form.date, rateLocked]);

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
    supabase
      .from('trips')
      .select('*')
      .then(({ data, error }) => {
        if (error) setError('여행을 불러오지 못했어요: ' + error.message);
        else setTrips(data);
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
      setAuthInfo('인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요 ');
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
          ? `${missing.join(', ')}은(는) 못 읽었어요. 직접 입력해 주세요 `
          : '다 읽었어요! 맞는지 확인하고 추가해 주세요 ',
      );
    } catch (err) {
      setScanNote(`영수증을 읽지 못했어요: ${err.message}. 직접 입력해 주세요 `);
    } finally {
      setScanning(false);
    }
  }

  function openPassword() {
    setPwForm({ current: '', next: '', confirm: '' });
    setPwMessage('');
    setPwOpen(true);
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwMessage('새 비밀번호가 서로 달라요');
      return;
    }
    if (pwForm.next === pwForm.current) {
      setPwMessage('지금 비밀번호와 다른 번호로 정해 주세요');
      return;
    }
    setPwBusy(true);
    setPwMessage('');
    // 세션만 훔쳐서 비밀번호를 바꾸지 못하게 현재 비밀번호를 먼저 확인한다
    const check = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: toPassword(pwForm.current),
    });
    if (check.error) {
      setPwBusy(false);
      setPwMessage('현재 비밀번호가 맞지 않아요');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: toPassword(pwForm.next) });
    setPwBusy(false);
    if (error) {
      setPwMessage(
        error.message.includes('different from the old')
          ? '지금 비밀번호와 다른 번호로 정해 주세요'
          : authMessage(error),
      );
      return;
    }
    setPwOpen(false);
    setError('');
  }

  async function logout() {
    await supabase.auth.signOut();
    setExpenses([]);
    setOpen(false);
    setEditingId(null);
    setTab('list');
    setPage('today');
  }

  if (session === undefined) return <main className="app" />;

  if (!session) {
    const login = authMode === 'login';
    return (
      <main className="app lock">
        <form className="hero" onSubmit={authenticate}>
          <p className="brand"><Icon name="diary" size={30} /> 소소노트</p>
          <p className="label">{login ? '로그인하고 내 다이어리를 열어요' : '이메일로 내 다이어리를 만들어요'}</p>
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

  const activeTrip = trips.find((t) => t.is_active);
  const tripName = (id) => trips.find((t) => t.id === id)?.name;
  const foreign = form.currency !== 'KRW';
  // 원화 금액: 직접 고친 값이 있으면 그 값, 아니면 금액 × 환율(반올림)
  const autoKrw = Number(form.amount) > 0 && Number(form.rate) > 0 ? Math.round(Number(form.amount) * Number(form.rate)) : '';
  const krwValue = krwManual ? form.krw : String(autoKrw);

  // 금액·통화·날짜가 바뀌면 원화 금액은 다시 자동 계산으로 돌아간다
  const setAmount = (e) => {
    setKrwManual(false);
    setForm({ ...form, amount: e.target.value });
  };
  const setCurrency = (code) => {
    setKrwManual(false);
    setRateLocked(false);
    setForm({ ...form, currency: code, rate: '' });
  };
  const setDate = (e) => {
    setKrwManual(false);
    setRateLocked(false);
    setForm({ ...form, date: e.target.value });
  };
  const setRate = (e) => {
    setKrwManual(false);
    setForm({ ...form, rate: e.target.value });
  };
  const setKrw = (e) => {
    setKrwManual(true);
    setForm({ ...form, krw: e.target.value });
  };

  const emptyForm = {
    amount: '',
    place: '',
    category: CATEGORIES[0].name,
    date: toDateStr(new Date()),
    memo: '',
    currency: 'KRW',
    rate: '',
    krw: '',
    tripId: '',
  };

  function openNew() {
    // 고치던 내용이 새 입력 칸에 남지 않게 비우고, 여행 모드가 켜져 있으면 그 여행과 통화를 미리 고른다
    const base = editingId !== null ? emptyForm : form;
    setForm(
      activeTrip
        ? { ...base, tripId: String(activeTrip.id), currency: activeTrip.currency, rate: '' }
        : { ...base, tripId: '' },
    );
    setEditingId(null);
    setKrwManual(false);
    setRateLocked(false);
    setRateNote('');
    setScanNote('');
    setOpen(true);
  }

  function openEdit(e) {
    const isForeign = e.currency !== 'KRW';
    setForm({
      amount: String(isForeign ? e.original_amount : e.amount),
      place: e.place,
      category: e.category,
      date: e.date,
      memo: e.memo ?? '',
      currency: e.currency,
      rate: isForeign ? String(e.exchange_rate) : '',
      krw: String(e.amount),
      tripId: e.trip_id ? String(e.trip_id) : '',
    });
    // 저장해 둔 환율과 원화 금액을 그대로 보여준다
    setKrwManual(isForeign);
    setRateLocked(isForeign);
    setRateNote(isForeign ? '저장된 환율이에요' : '');
    setEditingId(e.id);
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.place.trim()) return;
    const krw = Number(krwValue);
    if (foreign && !(Number.isInteger(krw) && krw > 0)) {
      setError('원화 금액이나 환율을 입력해 주세요');
      return;
    }
    const editing = editingId !== null;
    const row = {
      amount: foreign ? krw : amount,
      place: form.place.trim(),
      category: form.category,
      date: form.date,
      memo: form.memo.trim(),
      currency: form.currency,
      original_amount: foreign ? amount : null,
      exchange_rate: foreign ? Number((krw / amount).toFixed(6)) : null,
      trip_id: form.tripId ? Number(form.tripId) : null,
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
      setKrwManual(false);
      setRateLocked(false);
    } else {
      setForm({ ...form, amount: '', place: '', memo: '', krw: '' });
      setKrwManual(false);
    }
    setScanNote('');
    setOpen(false);
  }

  async function remove() {
    if (!(await askConfirm('이 지출을 삭제할까요?'))) return;
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
      <header className="topbar">
        <button className="top-btn" onClick={openPassword}>
          <Icon name="key" size={14} /> 비밀번호
        </button>
        <p className="brand"><Icon name="diary" size={24} /> 소소노트</p>
        <button className="top-btn" onClick={logout}>
          로그아웃
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {page === 'today' && <Today setError={setError} />}
      {page === 'week' && <Week setError={setError} />}
      {page === 'month' && <Month setError={setError} />}
      {page === 'workout' && <Workout setError={setError} />}
      {page === 'memo' && <Memo setError={setError} />}

      {page === 'ledger' && (
        <>
          <header className="hero">
            <p className="label">{today.getMonth() + 1}월 지출 합계</p>
            <p className="total">{won(monthTotal)}</p>
            <span className="sticker">티끌도 모이면... 티끌! 🫠</span>
          </header>

          <nav className="tabs">
            <button className={tab === 'list' ? 'tab on' : 'tab'} onClick={() => setTab('list')}>
              <Icon name="book" size={16} /> 내역
            </button>
            <button className={tab === 'stats' ? 'tab on' : 'tab'} onClick={() => setTab('stats')}>
              <Icon name="chart" size={16} /> 통계
            </button>
          </nav>
        </>
      )}

      {page === 'trips' && (
        <TripsView
          trips={trips}
          setTrips={setTrips}
          expenses={expenses}
          setExpenses={setExpenses}
          setError={setError}
          onEditExpense={openEdit}
        />
      )}

      {page === 'ledger' && tab === 'stats' && (
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
              <p><Icon name="chart" size={44} /></p>
              <p>이번 달 통계가 아직 없어요!</p>
            </div>
          ) : (
            <div className="chart-card">
              <h3><Icon name="donut" size={20} /> 카테고리별 비율</h3>
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
                <circle cx="50" cy="50" r="45" fill="none" stroke="#4a4039" strokeWidth="1.6" />
                <circle cx="50" cy="50" r="27" fill="none" stroke="#4a4039" strokeWidth="1.6" />
                <text x="50" y="48" textAnchor="middle" fontSize="6" fill="#4a4039">
                  총 지출
                </text>
                <text x="50" y="58" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#4a4039">
                  {monthTotal.toLocaleString('ko-KR')}
                </text>
              </svg>
            </div>
          )}
          {monthExpenses.length > 0 && (
            <div className="chart-card">
              <h3><Icon name="week" size={20} /> 일별 지출</h3>
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
                          fill={v === maxDaily ? '#dcbc6c' : '#e8c0b9'}
                          stroke="#4a4039"
                          strokeWidth="1.2"
                        />
                      )}
                      {(i + 1 === 1 || (i + 1) % 5 === 0) && (
                        <text x={5 + i * w + w / 2} y="121" textAnchor="middle" fontSize="8" fill="#4a4039">
                          {i + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
                <line x1="5" y1="105" x2="305" y2="105" stroke="#4a4039" strokeWidth="1.5" />
                <text x="5" y="10" fontSize="8" fontWeight="700" fill="#4a4039">
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
                      <Icon name={c.icon} size={14} /> {c.name} <small>{c.count}건</small>
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

      <section className="list" hidden={page !== 'ledger' || tab !== 'list'}>
        {groups.length === 0 && (
          <div className="empty">
            <p><Icon name="book" size={44} /></p>
            <p>아직 쓴 돈이 없어요!</p>
            <p className="sub">아래 + 버튼으로 첫 지출을 적어봐요</p>
          </div>
        )}
        {groups.length > 0 && <p className="hint">항목을 누르면 고치거나 지울 수 있어요</p>}
        {groups.map(([date, items]) => (
          <div className="day" key={date}>
            <div className="day-head">
              <span>{formatDate(date)}</span>
              <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <ul>
              {items.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  tripLabel={e.trip_id ? `${tripName(e.trip_id) ?? ''}` : null}
                  people={trips.find((t) => t.id === e.trip_id)?.people ?? 1}
                  onOpen={openEdit}
                />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {page === 'ledger' && (
        <button className="fab" onClick={openNew} aria-label="지출 추가">
          +
        </button>
      )}

      <nav className="bookmarks" aria-label="메뉴">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={page === p.id ? 'bm on' : 'bm'}
            style={{ '--c': p.color }}
            onClick={() => {
              setPage(p.id);
              document.querySelector('.app')?.scrollTo(0, 0);
            }}
          >
            <span><Icon name={p.icon} size={21} /></span>
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>{editingId === null ? <><Icon name="ledger" /> 지출 적기</> : <><Icon name="pencil" /> 지출 고치기</>}</h2>

            {editingId === null && (
              <label className="scan">
                <input type="file" accept="image/*" hidden onChange={scanReceipt} disabled={scanning} />
                <span className="scan-btn">{scanning ? '읽는 중...' : <><Icon name="camera" size={16} /> 영수증으로 채우기</>}</span>
                {scanNote && <small className="scan-note">{scanNote}</small>}
              </label>
            )}

            <div className="field">
              통화
              <div className="curs">
                {CURRENCIES.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    className={form.currency === c.code ? 'cat on' : 'cat'}
                    style={{ '--c': '#f3deaa' }}
                    onClick={() => setCurrency(c.code)}
                  >
                    {c.symbol} {c.label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              {foreign ? `금액 (${currencyOf(form.currency).label})` : '금액'}
              <input
                type="number"
                inputMode={foreign ? 'decimal' : 'numeric'}
                min={foreign ? '0.01' : '1'}
                step={foreign ? 'any' : '1'}
                placeholder="0"
                value={form.amount}
                onChange={setAmount}
                required
              />
            </label>

            {foreign && (
              <>
                <label>
                  환율 (1{currencyOf(form.currency).label} = ?원)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.rate}
                    onChange={setRate}
                  />
                </label>
                <label>
                  원화 금액 (원)
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={krwValue}
                    onChange={setKrw}
                    required
                  />
                  {rateNote && <small className="scan-note">{rateNote}</small>}
                </label>
              </>
            )}

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
                    <Icon name={c.icon} size={14} /> {c.name}
                  </button>
                ))}
              </div>
            </div>

            <label>
              날짜
              <input type="date" value={form.date} onChange={setDate} required />
            </label>

            <label>
              메모
              <input type="text" placeholder="(선택)" value={form.memo} onChange={set('memo')} />
            </label>

            {trips.length > 0 && (
              <label>
                여행
                <select value={form.tripId} onChange={set('tripId')}>
                  <option value="">연결 안 함</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

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

      {pwOpen && (
        <div className="overlay" onClick={() => setPwOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={changePassword}>
            <h2><Icon name="key" /> 비밀번호 바꾸기</h2>
            {[
              ['current', '현재 비밀번호', 'current-password'],
              ['next', '새 비밀번호 (숫자 4자리)', 'new-password'],
              ['confirm', '새 비밀번호 확인', 'new-password'],
            ].map(([key, label, autoComplete]) => (
              <label key={key}>
                {label}
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete={autoComplete}
                  title="숫자 4자리를 입력해 주세요"
                  required
                  value={pwForm[key]}
                  onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value.replace(/\D/g, '') })}
                />
              </label>
            ))}
            {pwMessage && <small className="scan-note">{pwMessage}</small>}
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setPwOpen(false)}>
                취소
              </button>
              <button type="submit" className="primary" disabled={pwBusy}>
                {pwBusy ? '바꾸는 중...' : '바꾸기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
