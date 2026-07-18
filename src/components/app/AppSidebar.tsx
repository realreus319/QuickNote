import { Link, useNavigate } from '@tanstack/react-router'
import { NotebookPen, Plus, Search, Settings2, SquareCheckBig } from 'lucide-react'

import { useAuth } from '@/auth/useAuth'
import { SyncBadge } from '@/components/app/SyncBadge'
import { Button } from '@/components/ui/button'
import { createNote } from '@/db/notesRepo'
import { cn } from '@/lib/utils'

const navigation = [
  { to: '/notes', label: '笔记', icon: NotebookPen },
  { to: '/todos', label: '待办', icon: SquareCheckBig },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/settings', label: '设置', icon: Settings2 },
] as const

export function AppSidebar() {
  const navigate = useNavigate()
  const { account } = useAuth()

  async function handleCreateNote() {
    const note = await createNote()
    await navigate({
      to: '/notes/$noteId',
      params: { noteId: note.id },
    })
  }

  return (
    <aside className="hidden min-h-dvh border-r border-divider/80 bg-surface/85 px-4 py-5 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <Link to="/notes" className="flex items-center gap-3 px-2 py-2" aria-label="返回笔记首页">
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-text-primary text-sm font-semibold text-white">
          Q
        </span>
        <div>
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">QuickNote</p>
          <p className="text-[11px] text-text-muted">安静记录，可靠同步</p>
        </div>
      </Link>

      <Button
        className="mt-5 h-11 justify-start rounded-[12px] bg-text-primary px-3.5 text-white shadow-none hover:bg-[#2a2a28]"
        onClick={() => void handleCreateNote()}
      >
        <Plus className="size-4" />
        新建笔记
      </Button>

      <nav className="mt-6 space-y-1" aria-label="主导航">
        {navigation.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary',
              )}
              activeProps={{
                className:
                  'flex h-11 items-center gap-3 rounded-[12px] bg-surface-muted px-3 text-sm font-semibold text-text-primary transition-colors',
              }}
            >
              <Icon className="size-[18px]" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-divider/80 pt-4">
        <SyncBadge />
        <div className="min-w-0 rounded-[12px] bg-surface-muted px-3 py-2.5">
          <p className="truncate text-xs font-medium text-text-primary">
            {account?.name || account?.username || 'Microsoft 账户'}
          </p>
          {account?.name && account.username ? (
            <p className="mt-0.5 truncate text-[11px] text-text-muted">{account.username}</p>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
