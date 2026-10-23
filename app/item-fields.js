import { DEFAULT_CATEGORIES, LABEL_COLORS, REPEATS } from './shared';

// 일정·할 일 입력 창에서 같이 쓰는 칸: 색 라벨, 카테고리, 반복
export default function ItemFields({ form, setForm, categories }) {
  const suggestions = [...new Set([...DEFAULT_CATEGORIES, ...categories])];
  return (
    <>
      <div className="field">
        색 라벨
        <div className="colors">
          {LABEL_COLORS.map((c) => (
            <button type="button" key={c.id} className="color-pick" aria-label={`${c.name} ${c.note}`} onClick={() => setForm((f) => ({ ...f, color: c.id }))}>
              <span className={form.color === c.id ? 'swatch on' : 'swatch'} style={{ background: c.hex }} />
              <small>{c.note}</small>
            </button>
          ))}
        </div>
      </div>
      <label>
        카테고리 (선택)
        <input
          type="text"
          list="category-list"
          maxLength={20}
          placeholder="예: 공부, 약속"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
        <datalist id="category-list">
          {suggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label>
        반복
        <select value={form.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}>
          {REPEATS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {form.repeat !== 'none' && (
        <label>
          반복 종료일 (선택)
          <input
            type="date"
            min={form.day}
            value={form.repeat_until}
            onChange={(e) => setForm((f) => ({ ...f, repeat_until: e.target.value }))}
          />
        </label>
      )}
    </>
  );
}
