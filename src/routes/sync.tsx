import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'

import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { db } from '@/db/db'
import { listPendingOperations } from '@/db/pendingRepo'
import { useSyncMutation } from '@/query/syncMutations'
import { readString } from '@/utils/text'

function SyncPage() {
  const mutation = useSyncMutation()
  const pending = useLiveQuery(() => listPendingOperations(), [])
  const status = useLiveQuery(() => db.appState.get('syncStatus'), [])
  const lastNotesError = useLiveQuery(() => db.appState.get('lastNotesError'), [])
  const lastTodosError = useLiveQuery(() => db.appState.get('lastTodosError'), [])

  return (
    <section className="space-y-5">
      <TopBar
        title="同步"
        subtitle="这里会显示当前同步状态、失败提示和待处理队列。"
        actions={
          <Button
            className="rounded-[18px] bg-accent px-4 text-white"
            onClick={() => void mutation.mutateAsync()}
          >
            立即同步
          </Button>
        }
      />

      <div className="bg-memo-card rounded-[28px] p-5">
        <p className="text-sm text-text-secondary">当前状态</p>
        <p className="mt-2 text-xl font-semibold text-text-primary">
          {readString(status?.value, '未初始化')}
        </p>
        {lastNotesError?.value ? (
          <p className="mt-3 text-sm text-[color:var(--color-danger)]">
            {readString(lastNotesError.value)}
          </p>
        ) : null}
        {lastTodosError?.value ? (
          <p className="mt-2 text-sm text-[color:var(--color-danger)]">
            {readString(lastTodosError.value)}
          </p>
        ) : null}
      </div>

      {pending?.length ? (
        <div className="space-y-3">
          {pending.map((item) => (
            <div key={item.id} className="bg-memo-card rounded-[24px] px-4 py-4 text-sm">
              <p className="font-medium text-text-primary">
                {item.entityType === 'note' ? '便签' : '待办'} · {item.operation}
              </p>
              <p className="mt-1 text-text-secondary">本地 ID：{item.localId}</p>
              <p className="mt-1 text-text-muted">重试次数：{item.retryCount}</p>
              {item.lastError ? (
                <p className="mt-2 text-[color:var(--color-danger)]">{item.lastError}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="没有待同步项目" description="当前没有 pending queue，应用会在后台继续保持同步。" />
      )}
    </section>
  )
}

export const Route = createFileRoute('/sync')({
  component: SyncPage,
})
