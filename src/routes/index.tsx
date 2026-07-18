import { createFileRoute, Navigate } from '@tanstack/react-router'
import { Cloud, LockKeyhole, NotebookPen, WifiOff } from 'lucide-react'

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

  const offline = networkStatus === 'offline'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app-bg px-5 py-10">
      <section className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[13px] bg-text-primary text-sm font-semibold text-white">
            Q
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">QuickNote</p>
            <p className="text-xs text-text-muted">个人笔记与待办</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-divider bg-white p-6 shadow-[0_20px_60px_rgba(25,25,24,0.06)] sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-[13px] bg-[#fff7dc] text-[#80600c]">
            <NotebookPen className="size-5" />
          </span>
          <h1 className="mt-6 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] text-text-primary sm:text-[42px]">
            安静记录，可靠同步
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-text-secondary">
            在一个清爽的工作台里管理笔记与待办。离线时继续使用，联网后自动同步到你的 Microsoft 账户。
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] bg-surface-muted px-4 py-3.5">
              <LockKeyhole className="size-4 text-text-secondary" />
              <p className="mt-2 text-sm font-medium text-text-primary">纯前端授权</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">无需填写客户端密钥</p>
            </div>
            <div className="rounded-[14px] bg-surface-muted px-4 py-3.5">
              <Cloud className="size-4 text-text-secondary" />
              <p className="mt-2 text-sm font-medium text-text-primary">本地优先</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">断网也能阅读与编辑</p>
            </div>
          </div>

          {offline ? (
            <div className="mt-5 flex items-start gap-2 rounded-[12px] bg-surface-muted px-3.5 py-3 text-sm text-text-secondary">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              当前处于离线模式，连接网络后才能登录。
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[12px] bg-[rgba(201,79,69,0.07)] px-3.5 py-3 text-sm leading-6 text-[color:var(--color-danger)]">
              {error}
            </div>
          ) : null}

          <Button
            className="mt-7 h-12 w-full rounded-[13px] bg-text-primary text-[15px] font-semibold text-white shadow-none hover:bg-[#2a2a28]"
            disabled={offline}
            onClick={() => void login()}
          >
            连接 Microsoft 账户
          </Button>
          <p className="mt-3 text-center text-[11px] leading-5 text-text-muted">
            登录即表示允许 QuickNote 访问你授权的 Notes 与 To Do 数据。
          </p>
        </div>
      </section>
    </main>
  )
}

export const Route = createFileRoute('/')({
  component: HomePage,
})
