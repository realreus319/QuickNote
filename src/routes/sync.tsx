import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  ChevronDown,
  CloudOff,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { TopBar } from '@/components/app/TopBar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { resolveNoteConflictKeepLocal } from '@/db/conflictRepo'
import { db } from '@/db/db'
import {
  listAllPendingOperations,
  retryPendingOperation,
} from '@/db/pendingRepo'
import { useSyncMutation } from '@/query/syncMutations'
import { useNetworkStatus } from '@/sync/network'
import type { PendingOperation } from '@/types/domain'
import { readString } from '@/utils/text'

const statusPresentation = {
  synced: {
    icon: Check,
    title: '所有内容已同步',
    description: '此设备上的更改已经保存到 Microsoft。',
    className: 'bg-[rgba(227,173,39,0.1)] text-[#80600c]',
  },
  syncing: {
    icon: RefreshCw,
    title: '正在同步',
    description: '正在检查云端内容与本地更改。',
    className: 'bg-surface-muted text-text-secondary',
  },
  offline: {
    icon: CloudOff,
    title: '当前处于离线模式',
    description: '更改会保存在本地，恢复联网后自动继续同步。',
    className: 'bg-surface-muted text-text-secondary',
  },
  error: {
    icon: TriangleAlert,
    title: '部分内容同步失败',
    description: '本地内容仍然安全，可以在下方查看并恢复。',
    className: 'bg-[rgba(201,79,69,0.08)] text-[color:var(--color-danger)]',
  },
  unauthenticated: {
    icon: TriangleAlert,
    title: '需要重新连接账户',
    description: '请返回登录页重新连接 Microsoft 账户。',
    className: 'bg-surface-muted text-text-secondary',
  },
} as const

function operationStatusText(item: PendingOperation) {
  switch (item.status) {
    case 'conflict':
      return '本地和云端同时修改，需要选择恢复方式'
    case 'dead-letter':
      return '多次重试仍然失败，已暂停自动重试'
    case 'retry-wait':
      return item.nextAttemptAt
        ? `等待重试：${new Date(item.nextAttemptAt).toLocaleString()}`
        : '等待自动重试'
    default:
      return item.operation === 'create'
        ? '等待创建到云端'
        : item.operation === 'update'
          ? '等待更新云端内容'
          : '等待从云端删除'
  }
}

function operationBadge(item: PendingOperation) {
  if (item.status === 'conflict') return '内容冲突'
  if (item.status === 'dead-letter') return '已暂停'
  if (item.status === 'retry-wait') return '等待重试'
  return `已重试 ${item.retryCount} 次`
}

function SyncPage() {
  const mutation = useSyncMutation()
  const networkStatus = useNetworkStatus()
  const pending = useLiveQuery(() => listAllPendingOperations(), [])
  const status = useLiveQuery(() => db.appState.get('syncStatus'), [])
  const lastNotesError = useLiveQuery(() => db.appState.get('lastNotesError'), [])
  const lastTodosError = useLiveQuery(() => db.appState.get('lastTodosError'), [])

  const storedStatus = readString(status?.value, 'unauthenticated')
  const resolvedStatus = networkStatus === 'offline' ? 'offline' : storedStatus
  const presentation =
    statusPresentation[resolvedStatus as keyof typeof statusPresentation] ??
    statusPresentation.unauthenticated
  const StatusIcon = presentation.icon
  const errorMessages = [lastNotesError?.value, lastTodosError?.value]
    .map((value) => readString(value))
    .filter(Boolean)

  async function handleRecover(item: PendingOperation) {
    try {
      if (item.status === 'conflict' && item.entityType === 'note') {
        await resolveNoteConflictKeepLocal(item.localId)
        toast('已选择保留本地版本，将重新同步到云端')
      } else {
        await retryPendingOperation(item.id)
        toast('已恢复同步操作')
      }

      if (networkStatus === 'online') {
        await mutation.mutateAsync()
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '恢复同步失败')
    }
  }

  return (
    <section className="space-y-6">
      <TopBar
        title="同步"
        subtitle="Microsoft Notes 与 To Do"
        actions={
          <Button
            className="h-10 rounded-[11px] bg-text-primary px-4 text-white shadow-none hover:bg-[#2a2a28]"
            disabled={mutation.isPending || networkStatus === 'offline'}
            onClick={() => void mutation.mutateAsync()}
          >
            <RefreshCw className={`size-4 ${mutation.isPending ? 'animate-spin' : ''}`} />
            {mutation.isPending ? '同步中' : '立即同步'}
          </Button>
        }
      />

      <div className="rounded-[18px] border border-divider bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] ${presentation.className}`}>
            <StatusIcon className={`size-5 ${resolvedStatus === 'syncing' ? 'animate-spin' : ''}`} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">{presentation.title}</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{presentation.description}</p>
            {pending?.length ? (
              <p className="mt-3 text-xs font-medium text-[#80600c]">{pending.length} 项需要处理</p>
            ) : null}
          </div>
        </div>

        {errorMessages.length ? (
          <div className="mt-5 space-y-2 rounded-[13px] bg-[rgba(201,79,69,0.06)] px-4 py-3 text-sm leading-6 text-[color:var(--color-danger)]">
            {errorMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
      </div>

      {pending?.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">同步队列</h2>
            <span className="text-xs text-text-muted">{pending.length}</span>
          </div>
          <div className="divide-y divide-divider overflow-hidden rounded-[16px] border border-divider bg-white">
            {pending.map((item) => (
              <div key={item.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {item.entityType === 'note' ? '笔记' : '待办'}待同步
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      {operationStatusText(item)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[11px] text-text-muted">
                    {operationBadge(item)}
                  </span>
                </div>

                {(item.status === 'conflict' || item.status === 'dead-letter') ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={mutation.isPending || networkStatus === 'offline'}
                      onClick={() => void handleRecover(item)}
                    >
                      <RotateCcw className="size-4" />
                      {item.status === 'conflict' ? '保留本地并重新同步' : '重新启用同步'}
                    </Button>
                  </div>
                ) : null}

                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-text-muted">
                    <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                    诊断信息
                  </summary>
                  <div className="mt-2 rounded-[10px] bg-surface-muted px-3 py-2 font-mono text-[11px] leading-5 break-all text-text-secondary">
                    <p>本地 ID：{item.localId}</p>
                    <p>操作：{item.operation}</p>
                    <p>状态：{item.status ?? 'pending'}</p>
                    {item.lastError ? <p className="text-[color:var(--color-danger)]">错误：{item.lastError}</p> : null}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState title="没有待同步项目" description="应用会在后台保持本地内容与 Microsoft 一致。" />
      )}
    </section>
  )
}

export const Route = createFileRoute('/sync')({
  component: SyncPage,
})
