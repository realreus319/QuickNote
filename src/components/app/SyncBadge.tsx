import { useLiveQuery } from 'dexie-react-hooks'
import { CloudOff, Cloudy, RefreshCw, TriangleAlert, UserRoundX } from 'lucide-react'

import { db } from '@/db/db'
import { useNetworkStatus } from '@/sync/network'

const statusMap = {
  unauthenticated: {
    icon: UserRoundX,
    label: '未登录',
    className: 'bg-white text-text-secondary',
  },
  syncing: {
    icon: RefreshCw,
    label: '同步中',
    className: 'bg-[rgba(246,190,58,0.18)] text-text-primary',
  },
  synced: {
    icon: Cloudy,
    label: '已同步',
    className: 'bg-white text-text-secondary',
  },
  offline: {
    icon: CloudOff,
    label: '离线',
    className: 'bg-white text-text-secondary',
  },
  error: {
    icon: TriangleAlert,
    label: '同步失败',
    className: 'bg-[rgba(204,95,76,0.12)] text-[color:var(--color-danger)]',
  },
} as const

export function SyncBadge() {
  const networkStatus = useNetworkStatus()
  const record = useLiveQuery(() => db.appState.get('syncStatus'), [])
  const resolved = networkStatus === 'offline' ? 'offline' : (record?.value as keyof typeof statusMap | undefined) ?? 'unauthenticated'
  const current = statusMap[resolved]
  const Icon = current.icon

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[999px] px-3 py-1.5 text-xs font-medium ${current.className}`}
    >
      <Icon className={`size-3.5 ${resolved === 'syncing' ? 'animate-spin' : ''}`} />
      {current.label}
    </span>
  )
}
