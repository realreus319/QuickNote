import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronRight,
  Cloud,
  Database,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { TopBar } from '@/components/app/TopBar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { db } from '@/db/db'
import { useAuth } from '@/auth/useAuth'
import { useSyncMutation } from '@/query/syncMutations'
import { useNetworkStatus } from '@/sync/network'
import { formatLongDate } from '@/utils/date'
import { readString } from '@/utils/text'

function SettingsPage() {
  const { account, logout } = useAuth()
  const networkStatus = useNetworkStatus()
  const mutation = useSyncMutation()
  const notesCount = useLiveQuery(() => db.notes.count(), [], 0)
  const todosCount = useLiveQuery(() => db.todos.count(), [], 0)
  const pendingCount = useLiveQuery(() => db.pendingOperations.count(), [], 0)
  const lastSyncedAt = useLiveQuery(() => db.appState.get('lastSyncedAt'), [])

  async function clearLocalData() {
    await db.transaction(
      'rw',
      db.notes,
      db.todos,
      db.todoLists,
      db.pendingOperations,
      db.appState,
      async () => {
        await Promise.all([
          db.notes.clear(),
          db.todos.clear(),
          db.todoLists.clear(),
          db.pendingOperations.clear(),
          db.appState.clear(),
        ])
      },
    )

    toast('本地数据已清空')
  }

  const accountLabel = account?.name || account?.username || 'Microsoft 账户'
  const lastSyncLabel = lastSyncedAt?.value
    ? formatLongDate(readString(lastSyncedAt.value))
    : '尚未完成同步'

  return (
    <section className="space-y-7">
      <TopBar title="设置" subtitle="账户、同步与本地数据" />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">账户</h2>
        <div className="overflow-hidden rounded-[16px] border border-divider bg-white divide-y divide-divider">
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              <UserRound className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">Microsoft 账户</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">{accountLabel}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <ShieldCheck className="size-3.5 text-accent" />
              已连接
            </span>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-muted"
            onClick={() => void logout()}
          >
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              <LogOut className="size-[18px]" />
            </span>
            <span className="flex-1 text-sm font-medium text-text-primary">退出登录</span>
            <ChevronRight className="size-4 text-text-muted" />
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">同步</h2>
        <div className="overflow-hidden rounded-[16px] border border-divider bg-white divide-y divide-divider">
          <Link
            to="/sync"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-muted"
          >
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              <Cloud className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">同步状态</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">{lastSyncLabel}</p>
            </div>
            {pendingCount ? (
              <span className="rounded-full bg-[#fff7dc] px-2 py-1 text-[11px] font-medium text-[#80600c]">
                {pendingCount} 项等待
              </span>
            ) : null}
            <ChevronRight className="size-4 text-text-muted" />
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-muted disabled:opacity-60"
            onClick={() => void mutation.mutateAsync()}
            disabled={mutation.isPending || networkStatus === 'offline'}
          >
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              <RefreshCw className={`size-[18px] ${mutation.isPending ? 'animate-spin' : ''}`} />
            </span>
            <span className="flex-1 text-sm font-medium text-text-primary">
              {mutation.isPending ? '正在同步' : '立即同步'}
            </span>
            <ChevronRight className="size-4 text-text-muted" />
          </button>
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              {networkStatus === 'offline' ? <WifiOff className="size-[18px]" /> : <Wifi className="size-[18px]" />}
            </span>
            <span className="flex-1 text-sm font-medium text-text-primary">网络状态</span>
            <span className="text-xs text-text-secondary">
              {networkStatus === 'offline' ? '离线模式' : '在线'}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">数据</h2>
        <div className="overflow-hidden rounded-[16px] border border-divider bg-white divide-y divide-divider">
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-surface-muted text-text-secondary">
              <Database className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">本地内容</p>
              <p className="mt-0.5 text-xs text-text-muted">
                笔记 {notesCount} · 待办 {todosCount} · 待同步 {pendingCount}
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-muted"
              >
                <span className="flex size-9 items-center justify-center rounded-[11px] bg-[rgba(201,79,69,0.08)] text-[color:var(--color-danger)]">
                  <Trash2 className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[color:var(--color-danger)]">清空本地数据</p>
                  <p className="mt-0.5 text-xs text-text-muted">不会删除 Microsoft 云端内容</p>
                </div>
                <ChevronRight className="size-4 text-text-muted" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-[rgba(201,79,69,0.08)] text-[color:var(--color-danger)]">
                  <Trash2 />
                </AlertDialogMedia>
                <AlertDialogTitle>确认清空本地数据？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除此设备上的笔记、待办和离线队列。
                  {pendingCount
                    ? ` 当前还有 ${pendingCount} 项尚未同步，清空后可能无法恢复。`
                    : ' 已同步的内容可在重新登录后从 Microsoft 恢复。'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void clearLocalData()}>
                  清空本地数据
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-text-muted">
        QuickNote 使用 Microsoft Graph 访问 Outlook Notes 与 Microsoft To Do，数据同步需要对应账户授权。
      </p>
    </section>
  )
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
