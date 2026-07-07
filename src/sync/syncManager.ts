import { setAppStateValue } from '@/db/appStateRepo'
import { listPendingOperations, markPendingOperationError, removePendingOperation } from '@/db/pendingRepo'
import { pullNotes, replayNoteOperation } from '@/sync/notesSync'
import { getNetworkStatus } from '@/sync/network'
import { pullTodos, replayTodoOperation } from '@/sync/todoSync'
import type { SyncResult } from '@/types/domain'
import { toIsoNow } from '@/utils/date'

async function setSyncStatus(status: SyncResult['status'], extra?: Record<string, unknown>) {
  await setAppStateValue('syncStatus', status)

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      await setAppStateValue(key, value)
    }
  }
}

export async function syncAll(getAccessToken: () => Promise<string>, isAuthenticated: boolean) {
  if (!isAuthenticated) {
    await setSyncStatus('unauthenticated')
    return {
      status: 'unauthenticated',
    } satisfies SyncResult
  }

  if (getNetworkStatus() === 'offline') {
    await setSyncStatus('offline')
    return {
      status: 'offline',
    } satisfies SyncResult
  }

  await setSyncStatus('syncing', {
    lastSyncError: '',
  })

  let accessToken: string

  try {
    accessToken = await getAccessToken()
  } catch {
    const message = '需要重新登录以授权 Mail.ReadWrite'
    await setSyncStatus('error', {
      lastSyncError: message,
    })

    return {
      status: 'error',
    } satisfies SyncResult
  }

  const pendingOperations = await listPendingOperations()

  for (const operation of pendingOperations) {
    try {
      if (operation.entityType === 'note') {
        await replayNoteOperation(accessToken, operation)
      } else {
        await replayTodoOperation(accessToken, operation)
      }

      await removePendingOperation(operation.id)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : '同步失败，请稍后重试'
      await markPendingOperationError(operation.id, message)
      await setSyncStatus('error', {
        lastSyncError: message,
      })

      return {
        status: 'error',
      } satisfies SyncResult
    }
  }

  let notesError: string | undefined
  let todosError: string | undefined

  try {
    await pullNotes(accessToken)
  } catch {
    notesError = '便签同步失败，可稍后重试'
  }

  try {
    await pullTodos(accessToken)
  } catch {
    todosError = '待办同步失败，可稍后重试'
  }

  const lastSyncedAt = toIsoNow()

  await setAppStateValue('lastSyncedAt', lastSyncedAt)
  await setAppStateValue('lastNotesError', notesError ?? '')
  await setAppStateValue('lastTodosError', todosError ?? '')

  if (notesError || todosError) {
    await setSyncStatus('error', {
      lastSyncError: notesError ?? todosError ?? '',
    })
    return {
      status: 'error',
      notesError,
      todosError,
      lastSyncedAt,
    } satisfies SyncResult
  }

  await setSyncStatus('synced')
  return {
    status: 'synced',
    lastSyncedAt,
  } satisfies SyncResult
}
