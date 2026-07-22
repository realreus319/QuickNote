import {
  getOwnerGeneration,
  isCurrentOwnerGeneration,
  normalizeOwnerKey,
} from '@/db/accountScope'
import { setAppStateValue } from '@/db/appStateRepo'
import {
  completePendingOperation,
  listPendingOperations,
  markPendingOperationError,
} from '@/db/pendingRepo'
import { GraphRequestError } from '@/graph/graphClient'
import { getNetworkStatus } from '@/sync/network'
import { pullNotes, replayNoteOperation } from '@/sync/notesSync'
import { pullTodos, replayTodoOperation } from '@/sync/todoSync'
import type { PendingOperationStatus, SyncResult } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { RichTextMergeError } from '@/utils/noteRichHtml'

const activeSyncs = new Map<string, Promise<SyncResult>>()

function scopedStateKey(ownerKey: string, key: string) {
  return `account:${ownerKey}:${key}`
}

async function setSyncStatus(
  ownerKey: string,
  ownerGeneration: number,
  status: SyncResult['status'],
  extra?: Record<string, unknown>,
) {
  await setAppStateValue(scopedStateKey(ownerKey, 'syncStatus'), status)

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      await setAppStateValue(scopedStateKey(ownerKey, key), value)
    }
  }

  if (!isCurrentOwnerGeneration(ownerKey, ownerGeneration)) {
    return
  }

  await setAppStateValue('syncStatus', status)

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      await setAppStateValue(key, value)
    }
  }
}

function classifyOperationError(error: unknown): {
  status?: PendingOperationStatus
  retryAfterMs?: number
} {
  if (error instanceof RichTextMergeError) {
    return { status: 'conflict' }
  }

  if (error instanceof GraphRequestError) {
    if (error.status === 401) {
      return { status: 'retry-wait', retryAfterMs: 60_000 }
    }

    if ([400, 403].includes(error.status)) {
      return { status: 'dead-letter' }
    }

    return { retryAfterMs: error.retryAfterMs }
  }

  return {}
}

async function runSync(
  getAccessToken: () => Promise<string>,
  isAuthenticated: boolean,
  ownerKey: string,
  ownerGeneration: number,
): Promise<SyncResult> {
  if (!isAuthenticated) {
    await setSyncStatus(ownerKey, ownerGeneration, 'unauthenticated')
    return {
      status: 'unauthenticated',
    }
  }

  if (getNetworkStatus() === 'offline') {
    await setSyncStatus(ownerKey, ownerGeneration, 'offline')
    return {
      status: 'offline',
    }
  }

  const lastSyncAttemptAt = toIsoNow()
  await setSyncStatus(ownerKey, ownerGeneration, 'syncing', {
    lastSyncAttemptAt,
    lastSyncError: '',
  })

  let accessToken: string

  try {
    accessToken = await getAccessToken()
  } catch {
    const message = '需要重新登录以授权 Mail.ReadWrite'
    await setSyncStatus(ownerKey, ownerGeneration, 'error', {
      lastSyncError: message,
    })
    return {
      status: 'error',
    }
  }

  const pendingOperations = await listPendingOperations(ownerKey)
  let operationErrors = 0
  let firstOperationError = ''
  let authorizationError = false

  for (const operation of pendingOperations) {
    const expectedRevision = Math.max(1, operation.targetRevision ?? 1)

    try {
      if (operation.entityType === 'note') {
        await replayNoteOperation(accessToken, operation, ownerKey)
      } else {
        await replayTodoOperation(accessToken, operation, ownerKey)
      }

      await completePendingOperation(
        operation.id,
        expectedRevision,
        ownerKey,
      )
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : '同步失败，请稍后重试'
      const classification = classifyOperationError(caughtError)
      await markPendingOperationError(operation.id, message, classification)
      operationErrors += 1
      firstOperationError ||= message

      if (caughtError instanceof GraphRequestError && caughtError.status === 401) {
        authorizationError = true
        break
      }
    }
  }

  if (authorizationError) {
    const message = 'Microsoft 授权已失效，重新授权后会继续同步'
    await setSyncStatus(ownerKey, ownerGeneration, 'error', {
      lastSyncError: message,
    })
    return {
      status: 'error',
      operationErrors,
    }
  }

  let notesError: string | undefined
  let todosError: string | undefined

  try {
    await pullNotes(accessToken, ownerKey)
  } catch (error) {
    notesError =
      error instanceof Error ? error.message : '便签同步失败，可稍后重试'
  }

  try {
    await pullTodos(accessToken, ownerKey)
  } catch (error) {
    todosError =
      error instanceof Error ? error.message : '待办同步失败，可稍后重试'
  }

  await setAppStateValue(
    scopedStateKey(ownerKey, 'lastNotesError'),
    notesError ?? '',
  )
  await setAppStateValue(
    scopedStateKey(ownerKey, 'lastTodosError'),
    todosError ?? '',
  )

  if (isCurrentOwnerGeneration(ownerKey, ownerGeneration)) {
    await setAppStateValue('lastNotesError', notesError ?? '')
    await setAppStateValue('lastTodosError', todosError ?? '')
  }

  if (operationErrors || notesError || todosError) {
    const message =
      firstOperationError || notesError || todosError || '部分内容同步失败'
    await setSyncStatus(ownerKey, ownerGeneration, 'error', {
      lastSyncError: message,
    })
    return {
      status: 'error',
      notesError,
      todosError,
      operationErrors,
    }
  }

  const lastSyncedAt = toIsoNow()
  await setAppStateValue(
    scopedStateKey(ownerKey, 'lastSyncedAt'),
    lastSyncedAt,
  )

  if (isCurrentOwnerGeneration(ownerKey, ownerGeneration)) {
    await setAppStateValue('lastSyncedAt', lastSyncedAt)
  }

  await setSyncStatus(ownerKey, ownerGeneration, 'synced')
  return {
    status: 'synced',
    lastSyncedAt,
  }
}

export function syncAll(
  getAccessToken: () => Promise<string>,
  isAuthenticated: boolean,
  homeAccountId: string,
) {
  const ownerKey = normalizeOwnerKey(homeAccountId)

  if (isAuthenticated && !ownerKey) {
    return Promise.resolve({
      status: 'error',
      notesError: '缺少 Microsoft 账户标识',
    } satisfies SyncResult)
  }

  const syncKey = ownerKey || 'unauthenticated'
  const existing = activeSyncs.get(syncKey)

  if (existing) {
    return existing
  }

  const ownerGeneration = getOwnerGeneration()
  const promise = runSync(
    getAccessToken,
    isAuthenticated,
    ownerKey,
    ownerGeneration,
  ).finally(() => {
    if (activeSyncs.get(syncKey) === promise) {
      activeSyncs.delete(syncKey)
    }
  })

  activeSyncs.set(syncKey, promise)
  return promise
}
