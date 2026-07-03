import { Link } from '@tanstack/react-router'
import { NotebookPen, SquareCheckBig } from 'lucide-react'

import { cn } from '@/lib/utils'

const items = [
  { to: '/notes', label: '笔记', icon: NotebookPen },
  { to: '/todos', label: '待办', icon: SquareCheckBig },
] as const

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-divider/80 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium text-[#999999] transition-colors"
              activeProps={{
                className:
                  'flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium text-[#111111] transition-colors',
              }}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function NavLink({
  to,
  label,
  icon: Icon,
}: {
  to: '/notes' | '/todos'
  label: string
  icon: typeof NotebookPen
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium text-text-secondary transition-colors',
      )}
      activeProps={{
        className:
          'flex items-center gap-3 rounded-[22px] bg-white text-text-primary shadow-[0_10px_25px_rgba(17,17,17,0.05)] px-4 py-3 text-sm font-medium transition-colors',
      }}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}
