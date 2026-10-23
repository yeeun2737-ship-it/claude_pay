import { labelHex } from './shared';
import Icon from './icons';

// 할 일 한 줄: 동그란 체크, 제목, 카테고리·반복 표시. 오늘·주간 탭에서 같이 쓴다.
export default function TaskRow({ task, done, onToggle, onOpen, note }) {
  return (
    <li className={done ? 'task done' : 'task'}>
      <button
        type="button"
        className="check"
        style={{ '--c': labelHex(task.color) }}
        onClick={onToggle}
        aria-label={done ? '완료 취소' : '완료'}
      >
        {done ? '✓' : ''}
      </button>
      <div className="task-body" onClick={onOpen}>
        <strong>{task.title}</strong>
        {(task.category || task.repeat !== 'none' || note) && (
          <small>
            {task.repeat !== 'none' && <><Icon name="repeat" size={12} /> </>}
            {[task.category, note].filter(Boolean).join(' · ')}
          </small>
        )}
      </div>
    </li>
  );
}
