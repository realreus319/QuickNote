import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CloudOff, RefreshCw, TriangleAlert, UserRoundX } from 'lucide-react'

import { db } from '@/db/db'
import { useNetworkStatus } from '@/sync/network'
import { cn } from '@/lib/utils'

const statusMap = {
  unauthenticated: {
    icon: UserRoundX,
    label: '未登录',
    className: 'text-text-secondary',
  },
  syncing: {
    icon: RefreshCw,
    label: '同步中',
    className: 'text-text-primary',
  },
  synced: {
    icon: Check,
    label: '已同步',
    className: 'text-text-secondary',
  },
  offline: {
    icon: CloudOff,
    label: '离线',
    className: 'text-text-secondary',
  },
  error: {
    icon: TriangleAlert,
    label: '同步失败',
    className: 'text-[color:var(--color-danger)]',
  },
} as const

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const networkStatus = useNetworkStatus()
  const record = useLiveQuery(() => db.appState.get('syncStatus'), [])
  const resolved =
    networkStatus === 'offline'
      ? 'offline'
      : ((record?.value as keyof typeof statusMap | undefined) ?? 'unauthenticated')
  const current = statusMap[resolved]
  const Icon = current.icon

  return (
    <Link
      to="/sync"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-divider/90 bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-muted',
        current.className,
        compact && 'px-2.5 py-1 text-[11px]',
      )}
      title="查看同步状态"
    >
      <Icon className={cn('size-3.5', resolved === 'syncing' && 'animate-spin')} />
      {current.label}
    </Link>
  )
}
