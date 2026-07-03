import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { SearchInput } from '@/components/common/SearchInput'
import { NoteCard } from '@/components/notes/NoteCard'
import { TodoItem } from '@/components/todos/TodoItem'
import { searchNotes } from '@/db/notesRepo'
import { searchTodos } from '@/db/todoRepo'

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

  return (
    <section className="space-y-5">
      <TopBar title="搜索" subtitle="离线也能从本地便签与待办里找到你要的内容。" />
      <SearchInput placeholder="搜索便签与待办" value={query} onChange={setQuery} />

      {!query.trim() ? (
        <EmptyState title="从一个关键词开始" description="例如：资料、客户、回电、今天。" />
      ) : null}

      {query.trim() && !results.notes.length && !results.todos.length ? (
        <EmptyState title="没有找到结果" description="换一个更短的关键词试试看。" />
      ) : null}

      {results.notes.length ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">笔记</h2>
          <div className="columns-2 gap-4 md:columns-3">
            {results.notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      ) : null}

      {results.todos.length ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">待办</h2>
          <div className="space-y-3">
            {results.todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => undefined}
                onDelete={() => undefined}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export const Route = createFileRoute('/search')({
  component: SearchPage,
})
