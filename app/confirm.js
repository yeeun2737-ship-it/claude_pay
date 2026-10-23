'use client';

import { useEffect, useState } from 'react';

// 브라우저 기본 confirm 창은 일부 화면(앱 안 브라우저 등)에서 뜨지 않고 "취소"로 처리된다.
// 그래서 삭제 확인은 이 앱 안의 창으로 받는다. 사용: if (!(await askConfirm('메시지'))) return;
let open = null;

export function askConfirm(message) {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(message));
    open({ message, resolve });
  });
}

// 레이아웃에 한 번만 놓는다.
export default function ConfirmHost() {
  const [ask, setAsk] = useState(null);

  useEffect(() => {
    open = setAsk;
    return () => {
      open = null;
    };
  }, []);

  const answer = (ok) => {
    ask.resolve(ok);
    setAsk(null);
  };

  if (!ask) return null;
  return (
    <div className="overlay confirm-overlay" onClick={() => answer(false)}>
      <div className="sheet confirm-sheet" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <p>{ask.message}</p>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => answer(false)}>
            취소
          </button>
          <button type="button" className="danger" autoFocus onClick={() => answer(true)}>
            삭제하기
          </button>
        </div>
      </div>
    </div>
  );
}
