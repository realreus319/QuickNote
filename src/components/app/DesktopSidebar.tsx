import { NotebookPen, SquareCheckBig } from 'lucide-react'

import { NavLink } from '@/components/app/BottomNav'
import { SyncBadge } from '@/components/app/SyncBadge'

export function DesktopSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-divider/80 bg-[#fbfbf9] px-5 py-6 md:flex md:flex-col">
      <div>
        <p className="text-sm font-medium text-text-secondary">QuickNote</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-text-primary">
          轻记
        </h2>
      </div>

      <div className="mt-5">
        <SyncBadge />
      </div>

      <nav className="mt-8 space-y-2">
        <NavLink to="/notes" label="笔记" icon={NotebookPen} />
        <NavLink to="/todos" label="待办" icon={SquareCheckBig} />
      </nav>
    </aside>
  )
}
