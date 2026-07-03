import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'

import { TopBar } from '@/components/app/TopBar'
import { Button } from '@/components/ui/button'
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

  async function clearCache() {
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

    toast('本地缓存已清空')
  }

  return (
    <section className="space-y-5">
      <TopBar title="设置" subtitle="管理账户、同步状态和本地缓存。" />

      <div className="space-y-3">
        <div className="bg-memo-card rounded-[24px] px-5 py-4">
          <p className="text-sm text-text-secondary">Microsoft 账户</p>
          <p className="mt-2 text-base font-medium text-text-primary">
            {account?.username ?? '未连接'}
          </p>
        </div>
        <div className="bg-memo-card rounded-[24px] px-5 py-4">
          <p className="text-sm text-text-secondary">最后同步时间</p>
          <p className="mt-2 text-base font-medium text-text-primary">
            {formatLongDate(readString(lastSyncedAt?.value))}
          </p>
        </div>
        <div className="bg-memo-card rounded-[24px] px-5 py-4">
          <p className="text-sm text-text-secondary">当前网络状态</p>
          <p className="mt-2 text-base font-medium text-text-primary">
            {networkStatus === 'offline' ? '离线模式' : '在线'}
          </p>
        </div>
        <div className="bg-memo-card rounded-[24px] px-5 py-4">
          <p className="text-sm text-text-secondary">本地缓存数量</p>
          <p className="mt-2 text-base font-medium text-text-primary">
            便签 {notesCount} · 待办 {todosCount} · 队列 {pendingCount}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Button
          className="h-12 rounded-[18px] bg-accent text-white"
          onClick={() => void mutation.mutateAsync()}
        >
          手动同步
        </Button>
        <Button
          variant="secondary"
          className="h-12 rounded-[18px]"
          onClick={() => void clearCache()}
        >
          清空本地缓存
        </Button>
        <Button
          variant="secondary"
          className="h-12 rounded-[18px]"
          asChild
        >
          <Link to="/sync">查看同步详情</Link>
        </Button>
        <Button
          variant="secondary"
          className="h-12 rounded-[18px]"
          onClick={() => void logout()}
        >
          退出登录
        </Button>
      </div>

      <div className="rounded-[24px] border border-divider bg-white/70 px-5 py-4 text-sm leading-7 text-text-secondary">
        便签同步使用 Outlook Notes 文件夹，需要 Mail.ReadWrite 授权。
      </div>
    </section>
  )
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
