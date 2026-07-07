import { CalendarDays } from 'lucide-react'

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
    <div className="bg-memo-card flex items-start gap-3 rounded-[24px] px-4 py-4">
      <Checkbox checked={completed} onCheckedChange={onToggle} className="mt-1 rounded-full" />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] leading-7 ${
            completed
              ? 'text-text-muted line-through'
              : 'text-text-primary'
          }`}
        >
          {todo.title}
        </p>
        {todo.dueDateTime ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <CalendarDays className="size-3.5" />
            {formatNoteDate(todo.dueDateTime)}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="text-xs text-text-muted"
        onClick={onDelete}
      >
        删除
      </button>
    </div>
  )
}
