import type { ReactNode } from 'react'
import { Navigate, useRouterState } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app/AppSidebar'
import { BottomNav } from '@/components/app/BottomNav'
import { FloatingAddButton } from '@/components/app/FloatingAddButton'
import { SyncBadge } from '@/components/app/SyncBadge'
import { useAuth } from '@/auth/useAuth'
import { useAutoSync } from '@/query/syncMutations'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  useAutoSync(isAuthenticated)

  const plain = pathname === '/' || pathname === '/auth/callback'
  const noteDetail = /^\/notes\/[^/]+$/.test(pathname)

  if (!isAuthenticated && !plain) {
    return <Navigate to="/" />
  }

  if (plain) {
    return <>{children}</>
  }

  return (
    <div className="min-h-dvh bg-app-bg">
      <div className="app-shell-width lg:grid lg:min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        <AppSidebar />
        <main
          className={cn(
            'min-w-0 lg:border-r lg:border-divider/70',
            noteDetail
              ? 'min-h-dvh bg-surface'
              : 'safe-bottom-nav px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8 lg:pb-12',
          )}
        >
          {!noteDetail ? (
            <div className="mb-5 flex justify-end lg:hidden">
              <SyncBadge compact />
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {!noteDetail ? (
        <>
          <FloatingAddButton />
          <BottomNav />
        </>
      ) : null}
    </div>
  )
}
