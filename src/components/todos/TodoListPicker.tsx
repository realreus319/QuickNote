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
    <div className="flex gap-2 overflow-x-auto pb-1">
      {lists.map((list) => {
        const active = list.id === selectedListId

        return (
          <button
            key={list.id}
            type="button"
            onClick={() => onSelect(list.id)}
            className={`rounded-[999px] px-4 py-2 text-sm whitespace-nowrap ${
              active
                ? 'bg-text-primary text-white'
                : 'bg-[#ececea] text-text-secondary'
            }`}
          >
            {list.displayName}
          </button>
        )
      })}
    </div>
  )
}
