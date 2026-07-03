import type { ReactNode } from 'react'
import { Navigate, useRouterState } from '@tanstack/react-router'

import { BottomNav } from '@/components/app/BottomNav'
import { FloatingAddButton } from '@/components/app/FloatingAddButton'
import { SyncBadge } from '@/components/app/SyncBadge'
import { useAuth } from '@/auth/useAuth'
import { useAutoSync } from '@/query/syncMutations'

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useAutoSync(isAuthenticated)

  const plain =
    pathname === '/' || pathname === '/auth/callback'
  const noteDetail = /^\/notes\/[^/]+$/.test(pathname)

  if (!isAuthenticated && !plain) {
    return <Navigate to="/" />
  }

  if (plain) {
    return <>{children}</>
  }

  if (noteDetail) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div>
      <div className="min-h-screen flex-1">
        <div className="app-shell-width px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-32">
          <div className="mb-4 flex justify-end">
            <SyncBadge />
          </div>
          {children}
        </div>
      </div>
      <FloatingAddButton />
      <BottomNav />
    </div>
  )
}
