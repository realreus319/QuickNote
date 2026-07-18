import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createNote, listNotes } from '@/db/notesRepo'
import { formatNoteDate } from '@/utils/date'
import { getExcerpt } from '@/utils/text'

function NotesLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const notes = useLiveQuery(() => listNotes(), [])
  const detailOpen = /^\/notes\/[^/]+$/.test(pathname)

  async function handleCreate() {
    const note = await createNote()
    await navigate({ to: '/notes/$noteId', params: { noteId: note.id } })
  }

  if (!detailOpen) {
    return <Outlet />
  }

  return (
    <div className="min-h-dvh xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="hidden h-dvh overflow-y-auto border-r border-divider bg-app-bg/80 p-4 xl:sticky xl:top-0 xl:block">
        <div className="sticky top-0 z-10 -mx-1 bg-app-bg/95 px-1 pb-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <Link to="/notes" className="text-sm font-semibold text-text-primary">
              全部笔记
            </Link>
            <Button
              size="icon-sm"
              variant="ghost"
              className="rounded-[10px] border border-divider bg-white"
              onClick={() => void handleCreate()}
              aria-label="新建笔记"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-text-muted">{notes?.length ?? 0} 条内容</p>
        </div>

        <nav className="space-y-1.5" aria-label="笔记列表">
          {(notes ?? []).map((note) => (
            <Link
              key={note.id}
              to="/notes/$noteId"
              params={{ noteId: note.id }}
              viewTransition
              className="block rounded-[12px] border border-transparent px-3 py-3 transition-colors hover:bg-white"
              activeProps={{
                className:
                  'block rounded-[12px] border border-divider bg-white px-3 py-3 shadow-[0_6px_18px_rgba(25,25,24,0.045)]',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-1 min-w-0 flex-1 text-[13px] font-semibold text-text-primary">
                  {note.title || '未命名笔记'}
                </p>
                <time className="shrink-0 text-[10px] text-text-muted" dateTime={note.updatedAt}>
                  {formatNoteDate(note.updatedAt)}
                </time>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                {getExcerpt(note.content || '点击开始记录内容', 80)}
              </p>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/notes')({
  component: NotesLayout,
})
