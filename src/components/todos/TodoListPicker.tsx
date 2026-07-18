import type { LocalTodoList } from '@/types/domain'

interface TodoListPickerProps {
  lists: LocalTodoList[]
  selectedListId: string
  onSelect: (listId: string) => void
}

export function TodoListPicker({
  lists,
  selectedListId,
  onSelect,
}: TodoListPickerProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-[13px] bg-surface-muted p-1" aria-label="待办清单">
      {lists.map((list) => {
        const active = list.id === selectedListId

        return (
          <button
            key={list.id}
            type="button"
            onClick={() => onSelect(list.id)}
            className={`rounded-[10px] px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-white text-text-primary shadow-[0_2px_8px_rgba(25,25,24,0.06)]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-pressed={active}
          >
            {list.displayName}
          </button>
        )
      })}
    </div>
  )
}
