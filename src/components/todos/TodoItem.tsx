import { CalendarDays, Trash2 } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import type { LocalTodo } from '@/types/domain'
import { formatNoteDate } from '@/utils/date'

interface TodoItemProps {
  todo: LocalTodo
  onToggle: () => void
  onDelete: () => void
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  const completed = todo.status === 'completed'

  return (
    <div className="group flex min-h-16 items-start gap-3 bg-white px-4 py-4">
      <Checkbox
        checked={completed}
        onCheckedChange={onToggle}
        className="mt-0.5 size-5 rounded-full border-[#c9c9c3] data-[state=checked]:border-text-primary data-[state=checked]:bg-text-primary"
        aria-label={completed ? `将“${todo.title}”标记为未完成` : `完成“${todo.title}”`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] leading-6 transition-colors ${
            completed ? 'text-text-muted line-through' : 'text-text-primary'
          }`}
        >
          {todo.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
          {todo.dueDateTime ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatNoteDate(todo.dueDateTime)}
            </span>
          ) : null}
          {todo.syncStatus !== 'synced' ? (
            <span className={todo.syncStatus === 'error' ? 'text-[color:var(--color-danger)]' : ''}>
              {todo.syncStatus === 'error' ? '同步失败' : '等待同步'}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text-muted opacity-70 transition-colors hover:bg-surface-muted hover:text-[color:var(--color-danger)] focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onDelete}
        aria-label={`删除“${todo.title}”`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
