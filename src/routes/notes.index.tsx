import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderOpen, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useAuth } from '@/auth/useAuth'
import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { SearchInput } from '@/components/common/SearchInput'
import { NoteMasonry } from '@/components/notes/NoteMasonry'
import { Button } from '@/components/ui/button'
import { NOTE_TAGS, listNotes } from '@/db/notesRepo'

function NotesIndexPage() {
  const { isAuthenticated } = useAuth()
  const notes = useLiveQuery(() => listNotes(), [])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('全部')

  const filteredNotes = useMemo(() => {
    if (!notes) return []

    return notes.filter((note) => {
      const matchesTag = tag === '全部' || note.tags.includes(tag)
      const matchesQuery =
        !query.trim() ||
        `${note.title} ${note.content}`.toLowerCase().includes(query.trim().toLowerCase())

      return matchesTag && matchesQuery
    })
  }, [notes, query, tag])

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="请先登录"
        description="登录 Microsoft 账户后，就能开始同步你的便签。"
        action={<Link to="/">返回首页</Link>}
      />
    )
  }

  if (!notes) {
    return <LoadingState label="正在加载便签…" />
  }

  return (
    <section className="space-y-5">
      <TopBar
        title="笔记"
        subtitle="像手机备忘录一样，想到什么就先记下来。"
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-full bg-white"
              onClick={() => toast('可通过标签管理分类')}
            >
              <FolderOpen className="size-4.5" />
            </Button>
            <Button asChild variant="ghost" size="icon-lg" className="rounded-full bg-white">
              <Link to="/settings">
                <Settings2 className="size-4.5" />
              </Link>
            </Button>
          </>
        }
      />

      <SearchInput placeholder="搜索笔记" value={query} onChange={setQuery} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {NOTE_TAGS.map((item) => {
          const active = item === tag

          return (
            <button
              key={item}
              type="button"
              onClick={() => setTag(item)}
              className={`rounded-[999px] px-4 py-2 text-sm whitespace-nowrap ${
                active ? 'bg-text-primary text-white' : 'bg-[#ececea] text-text-secondary'
              }`}
            >
              {item}
            </button>
          )
        })}
      </div>

      {filteredNotes.length ? (
        <NoteMasonry notes={filteredNotes} />
      ) : (
        <EmptyState
          title={query.trim() || tag !== '全部' ? '还没有匹配的笔记' : '还没有笔记'}
          description={
            query.trim() || tag !== '全部'
              ? '换个关键词试试，或者点击右下角新建一条便签。'
              : '点击右下角新建第一条便签。'
          }
        />
      )}
    </section>
  )
}

export const Route = createFileRoute('/notes/')({
  component: NotesIndexPage,
})
