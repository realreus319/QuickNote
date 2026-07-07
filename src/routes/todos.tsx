import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Filter, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { TodoItem } from '@/components/todos/TodoItem'
import { TodoListPicker } from '@/components/todos/TodoListPicker'
import { TodoQuickAdd } from '@/components/todos/TodoQuickAdd'
import { Button } from '@/components/ui/button'
import {
  createTodo,
  deleteTodo,
  listTodoLists,
  listTodos,
  updateTodo,
} from '@/db/todoRepo'
import { isToday } from '@/utils/date'

type TodoFilter = 'today' | 'all' | 'completed'

function TodosPage() {
  const lists = useLiveQuery(() => listTodoLists(), [])
  const todos = useLiveQuery(() => listTodos(), [])
  const [selectedListId, setSelectedListId] = useState('')
  const [filter, setFilter] = useState<TodoFilter>('today')

  const activeLists = lists ?? []
  const resolvedListId = selectedListId || activeLists[0]?.id || ''

  const visibleTodos = useMemo(() => {
    if (!todos) return []

    return todos.filter((todo) => {
      const matchesList = !resolvedListId || todo.listId === resolvedListId

      if (!matchesList) return false

      if (filter === 'completed') {
        return todo.status === 'completed'
      }

      if (filter === 'today') {
        return isToday(todo.dueDateTime) || !todo.dueDateTime
      }

      return true
    })
  }, [filter, resolvedListId, todos])

  if (!lists || !todos) {
    return <LoadingState label="正在加载待办…" />
  }

  return (
    <section className="space-y-5">
      <TopBar
        title="待办"
        subtitle="保持清单轻一点，今天的事就更容易开始。"
        actions={
          <>
            <Button variant="ghost" size="icon-lg" className="rounded-full bg-white">
              <Filter className="size-4.5" />
            </Button>
            <Button variant="ghost" size="icon-lg" className="rounded-full bg-white">
              <Settings2 className="size-4.5" />
            </Button>
          </>
        }
      />

      <TodoListPicker
        lists={activeLists}
        selectedListId={resolvedListId}
        onSelect={setSelectedListId}
      />

      <div className="flex gap-2">
        {[
          { id: 'today', label: '今天' },
          { id: 'all', label: '全部' },
          { id: 'completed', label: '已完成' },
        ].map((item) => {
          const active = item.id === filter

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as TodoFilter)}
              className={`rounded-[999px] px-4 py-2 text-sm ${
                active ? 'bg-text-primary text-white' : 'bg-[#ececea] text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <TodoQuickAdd
        onSubmit={async (title) => {
          await createTodo(resolvedListId || activeLists[0]?.id || '', title)
        }}
      />

      {visibleTodos.length ? (
        <div className="space-y-3">
          {visibleTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() =>
                void updateTodo(todo.id, {
                  status: todo.status === 'completed' ? 'notStarted' : 'completed',
                })
              }
              onDelete={() => void deleteTodo(todo.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="清单很轻"
          description="先添加一条任务，或者换个筛选条件看看。"
        />
      )}
    </section>
  )
}

export const Route = createFileRoute('/todos')({
  component: TodosPage,
})
