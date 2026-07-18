import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Settings2 } from 'lucide-react'
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

const filters = [
  { id: 'today', label: '今天' },
  { id: 'all', label: '全部' },
  { id: 'completed', label: '已完成' },
] as const

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
        return todo.status !== 'completed' && (isToday(todo.dueDateTime) || !todo.dueDateTime)
      }

      return true
    })
  }, [filter, resolvedListId, todos])

  const incompleteCount = useMemo(
    () =>
      (todos ?? []).filter(
        (todo) => (!resolvedListId || todo.listId === resolvedListId) && todo.status !== 'completed',
      ).length,
    [resolvedListId, todos],
  )

  if (!lists || !todos) {
    return <LoadingState label="正在加载待办…" />
  }

  return (
    <section className="space-y-6">
      <TopBar
        title="待办"
        subtitle={incompleteCount ? `${incompleteCount} 项尚未完成` : '当前清单已经完成'}
        actions={
          <Button asChild variant="ghost" size="icon-lg" className="rounded-[12px] border border-divider bg-white" aria-label="打开设置">
            <Link to="/settings">
              <Settings2 className="size-[18px]" />
            </Link>
          </Button>
        }
      />

      {activeLists.length ? (
        <TodoListPicker
          lists={activeLists}
          selectedListId={resolvedListId}
          onSelect={setSelectedListId}
        />
      ) : null}

      <div className="inline-flex rounded-[12px] border border-divider bg-white p-1" aria-label="待办筛选">
        {filters.map((item) => {
          const active = item.id === filter

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-[9px] px-3.5 py-2 text-[13px] font-medium transition-colors ${
                active ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-surface-muted'
              }`}
              aria-pressed={active}
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
        <div className="overflow-hidden rounded-[16px] border border-divider bg-white divide-y divide-divider">
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
          title={filter === 'completed' ? '还没有已完成项目' : '清单很轻'}
          description={filter === 'completed' ? '完成的事项会出现在这里。' : '添加一条任务，或者切换筛选条件。'}
        />
      )}
    </section>
  )
}

export const Route = createFileRoute('/todos')({
  component: TodosPage,
})
