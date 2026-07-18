import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { SearchInput } from '@/components/common/SearchInput'
import { NoteMasonry } from '@/components/notes/NoteMasonry'
import { TodoItem } from '@/components/todos/TodoItem'
import { searchNotes } from '@/db/notesRepo'
import { deleteTodo, searchTodos, updateTodo } from '@/db/todoRepo'

function SearchPage() {
  const [query, setQuery] = useState('')
  const results = useLiveQuery(
    async () => ({
      notes: await searchNotes(query),
      todos: await searchTodos(query),
    }),
    [query],
    {
      notes: [],
      todos: [],
    },
  )

  const hasQuery = Boolean(query.trim())
  const resultCount = results.notes.length + results.todos.length

  return (
    <section className="space-y-6">
      <TopBar
        title="搜索"
        subtitle={hasQuery ? `${resultCount} 个匹配结果` : '统一检索本地笔记与待办'}
      />
      <SearchInput
        placeholder="输入标题、正文或待办内容"
        value={query}
        onChange={setQuery}
        autoFocus
      />

      {!hasQuery ? (
        <EmptyState title="从一个关键词开始" description="例如：客户、会议、资料、今天。" />
      ) : null}

      {hasQuery && !resultCount ? (
        <EmptyState title="没有找到结果" description="换一个更短或更具体的关键词试试。" />
      ) : null}

      {results.notes.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">笔记</h2>
            <span className="text-xs text-text-muted">{results.notes.length}</span>
          </div>
          <NoteMasonry notes={results.notes} />
        </section>
      ) : null}

      {results.todos.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">待办</h2>
            <span className="text-xs text-text-muted">{results.todos.length}</span>
          </div>
          <div className="overflow-hidden rounded-[16px] border border-divider bg-white divide-y divide-divider">
            {results.todos.map((todo) => (
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
        </section>
      ) : null}
    </section>
  )
}

export const Route = createFileRoute('/search')({
  component: SearchPage,
})
