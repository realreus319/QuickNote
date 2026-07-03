import { createFileRoute, Navigate } from '@tanstack/react-router'
import { LockKeyhole, StickyNote, WifiOff } from 'lucide-react'

import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/useAuth'
import { useNetworkStatus } from '@/sync/network'

function HomePage() {
  const { error, initializing, isAuthenticated, login } = useAuth()
  const networkStatus = useNetworkStatus()

  if (initializing) {
    return <LoadingState label="正在恢复登录状态…" />
  }

  if (isAuthenticated) {
    return <Navigate to="/notes" />
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[36px] bg-white px-6 py-8 shadow-[0_20px_45px_rgba(17,17,17,0.06)]">
        <div className="inline-flex size-14 items-center justify-center rounded-full bg-[rgba(246,190,58,0.18)] text-accent">
          <StickyNote className="size-6" />
        </div>
        <h1 className="mt-6 text-[34px] leading-none font-semibold tracking-[-0.05em] text-text-primary">
          QuickNote
        </h1>
        <p className="mt-3 text-base leading-7 text-text-secondary">
          轻量便签与待办，同步到你的 Microsoft 账户
        </p>

        <div className="mt-6 space-y-3 rounded-[28px] bg-[#f7f7f5] p-4 text-sm text-text-secondary">
          <div className="flex items-center gap-3">
            <LockKeyhole className="size-4" />
            纯前端登录，不会要求你填写客户端密钥
          </div>
          <div className="flex items-center gap-3">
            <WifiOff className="size-4" />
            断网时仍可阅读本地便签与待办
          </div>
        </div>

        {networkStatus === 'offline' ? (
          <p className="mt-5 text-sm text-text-secondary">当前是离线模式，登录需要联网。</p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-[color:var(--color-danger)]">{error}</p>
        ) : null}

        <Button
          className="mt-8 h-13 w-full rounded-[20px] bg-accent text-base text-white hover:bg-[#efb52d]"
          onClick={() => void login()}
        >
          连接微软账户
        </Button>
      </section>
    </main>
  )
}

export const Route = createFileRoute('/')({
  component: HomePage,
})
