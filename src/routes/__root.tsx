import { createRootRoute, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import { RefreshCw, TriangleAlert } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

function RootLayout() {
  return (
    <TooltipProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app-bg px-5 py-10">
      <section className="w-full max-w-md rounded-[20px] border border-divider bg-white p-6 text-center shadow-[0_20px_60px_rgba(25,25,24,0.06)]">
        <span className="mx-auto flex size-11 items-center justify-center rounded-[13px] bg-[rgba(201,79,69,0.08)] text-[color:var(--color-danger)]">
          <TriangleAlert className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-text-primary">页面暂时无法显示</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          本地内容不会因此丢失。可以先重新加载页面，问题仍然存在时再清理该网站的旧缓存。
        </p>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-xs text-text-muted">查看错误详情</summary>
          <pre className="mt-2 max-h-32 overflow-auto rounded-[10px] bg-surface-muted p-3 text-[11px] leading-5 whitespace-pre-wrap text-[color:var(--color-danger)]">
            {error.message}
          </pre>
        </details>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" className="h-11 rounded-[11px]" onClick={reset}>
            重试
          </Button>
          <Button
            className="h-11 rounded-[11px] bg-text-primary text-white hover:bg-[#2a2a28]"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="size-4" />
            重新加载
          </Button>
        </div>
      </section>
    </main>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
})
