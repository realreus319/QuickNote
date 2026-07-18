import { Link } from '@tanstack/react-router'
import { NotebookPen, Search, SquareCheckBig } from 'lucide-react'

const items = [
  { to: '/notes', label: '笔记', icon: NotebookPen },
  { to: '/todos', label: '待办', icon: SquareCheckBig },
  { to: '/search', label: '搜索', icon: Search },
] as const

export function BottomNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <nav
        className="pointer-events-auto mx-auto grid max-w-sm grid-cols-3 rounded-[22px] border border-divider/90 bg-white/92 p-1.5 shadow-floating backdrop-blur-xl"
        aria-label="主导航"
      >
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-medium text-text-muted transition-colors"
              activeProps={{
                className:
                  'flex h-12 flex-col items-center justify-center gap-1 rounded-[16px] bg-surface-muted text-[10px] font-semibold text-text-primary transition-colors',
              }}
            >
              <Icon className="size-[18px]" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
