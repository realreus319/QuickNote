import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAuth } from '@/auth/useAuth'
import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { SearchInput } from '@/components/common/SearchInput'
import { NoteMasonry } from '@/components/notes/NoteMasonry'
import { Button } from '@/components/ui/button'
import { listNotes } from '@/db/notesRepo'

function NotesIndexPage() {
  const { isAuthenticated } = useAuth()
  const notes = useLiveQuery(() => listNotes(), [])
  const [query, setQuery] = useState('')

  const filteredNotes = useMemo(() => {
    if (!notes) return []

    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) return notes

    return notes.filter((note) =>
      `${note.title} ${note.content}`.toLowerCase().includes(normalizedQuery),
    )
  }, [notes, query])

  const pinnedNotes = filteredNotes.filter((note) => note.pinned)
  const recentNotes = filteredNotes.filter((note) => !note.pinned)

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="请先登录"
        description="连接 Microsoft 账户后，就能同步你的便签。"
        action={<Link to="/">返回首页</Link>}
      />
    )
  }

  if (!notes) {
    return <LoadingState label="正在加载笔记…" />
  }

  const hasQuery = Boolean(query.trim())

  return (
    <section className="space-y-6">
      <TopBar
        title="笔记"
        subtitle={`${notes.length} 条内容，按最近更新排列`}
        actions={
          <Button
            asChild
            variant="ghost"
            size="icon-lg"
            className="rounded-[12px] border border-divider bg-white"
            aria-label="打开设置"
          >
            <Link to="/settings">
              <Settings2 className="size-[18px]" />
            </Link>
          </Button>
        }
      />

      <SearchInput placeholder="搜索标题与正文" value={query} onChange={setQuery} />

      {filteredNotes.length ? (
        <div className="space-y-8">
          {pinnedNotes.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">固定</h2>
                <span className="text-xs text-text-muted">{pinnedNotes.length}</span>
              </div>
              <NoteMasonry notes={pinnedNotes} />
            </section>
          ) : null}

          {recentNotes.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">最近</h2>
                <span className="text-xs text-text-muted">{recentNotes.length}</span>
              </div>
              <NoteMasonry notes={recentNotes} />
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={hasQuery ? '没有匹配的笔记' : '从第一条笔记开始'}
          description={hasQuery ? '换个关键词试试。' : '点击右下角“新建”，快速记录一条内容。'}
        />
      )}
    </section>
  )
}

export const Route = createFileRoute('/notes/')({
  component: NotesIndexPage,
})
