import { requireActiveOwnerKey } from '@/db/accountScope'
import { db } from '@/db/db'
import type {
  EntityType,
  PendingOperationStatus,
  PendingOperationType,
} from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'

export const PENDING_OPERATION_EVENT = 'quicknote:pending-operation'
const MAX_RETRY_COUNT = 8

function notifyPendingOperationChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PENDING_OPERATION_EVENT))
  }
}

function operationRevision(payload: Record<string, unknown>, fallback = 1) {
  const value = Number(payload.localRevision)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function sortOperations<T extends { createdAt: string }>(operations: T[]) {
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function listAllPendingOperations(
  ownerKey = requireActiveOwnerKey(),
) {
  return sortOperations(
    await db.pendingOperations.where('ownerKey').equals(ownerKey).toArray(),
  )
}

export async function listPendingOperations(ownerKey = requireActiveOwnerKey()) {
  const now = toIsoNow()
  const operations = await listAllPendingOperations(ownerKey)

  return operations.filter((operation) => {
    const status = operation.status ?? 'pending'

    if (status === 'conflict' || status === 'dead-letter') {
      return false
    }

    return !operation.nextAttemptAt || operation.nextAttemptAt <= now
  })
}

export async function countPendingOperations(ownerKey = requireActiveOwnerKey()) {
  return db.pendingOperations.where('ownerKey').equals(ownerKey).count()
}

export async function completePendingOperation(
  id: string,
  targetRevision: number,
  ownerKey = requireActiveOwnerKey(),
) {
  const removed = await db.transaction('rw', db.pendingOperations, async () => {
    const operation = await db.pendingOperations.get(id)

    if (
      !operation ||
      operation.ownerKey !== ownerKey ||
      (operation.targetRevision ?? 1) !== targetRevision
    ) {
      return false
    }

    await db.pendingOperations.delete(id)
    return true
  })

  if (removed) notifyPendingOperationChanged()
  return removed
}

export async function removePendingOperationsForLocalId(
  localId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const items = await db.pendingOperations
    .where('[ownerKey+localId]')
    .equals([ownerKey, localId])
    .toArray()

  await db.pendingOperations.bulkDelete(items.map((item) => item.id))
  notifyPendingOperationChanged()
}

export async function retryPendingOperation(
  id: string,
  ownerKey = requireActiveOwnerKey(),
) {
  await db.transaction(
    'rw',
    db.pendingOperations,
    db.notes,
    db.todos,
    async () => {
      const operation = await db.pendingOperations.get(id)

      if (!operation || operation.ownerKey !== ownerKey) {
        throw new Error('同步操作不属于当前账户')
      }

      await db.pendingOperations.put({
        ...operation,
        status: 'pending',
        retryCount: 0,
        nextAttemptAt: undefined,
        lastAttemptAt: undefined,
        lastError: undefined,
      })

      if (operation.entityType === 'note') {
        const note = await db.notes.get(operation.localId)
        if (note?.ownerKey === ownerKey) {
          await db.notes.put({
            ...note,
            syncStatus: 'pending',
          })
        }
      } else {
        const todo = await db.todos.get(operation.localId)
        if (todo?.ownerKey === ownerKey) {
          await db.todos.put({
            ...todo,
            syncStatus: 'pending',
          })
        }
      }
    },
  )
  notifyPendingOperationChanged()
}

export async function markPendingOperationError(
  id: string,
  lastError: string,
  options: {
    status?: PendingOperationStatus
    retryAfterMs?: number
  } = {},
) {
  const operation = await db.pendingOperations.get(id)

  if (!operation) return

  const retryCount = operation.retryCount + 1
  const status =
    options.status ??
    (retryCount >= MAX_RETRY_COUNT ? 'dead-letter' : 'retry-wait')
  const retryAfterMs =
    options.retryAfterMs ??
    Math.min(15 * 60_000, 2 ** Math.min(retryCount, 8) * 1_000)

  await db.pendingOperations.put({
    ...operation,
    retryCount,
    status,
    lastAttemptAt: toIsoNow(),
    nextAttemptAt:
      status === 'retry-wait'
        ? new Date(Date.now() + retryAfterMs).toISOString()
        : undefined,
    lastError,
  })
  notifyPendingOperationChanged()
}

export async function enqueuePendingOperation(
  entityType: EntityType,
  operation: PendingOperationType,
  localId: string,
  payload: Record<string, unknown>,
  ownerKey = requireActiveOwnerKey(),
) {
  const existing = (
    await db.pendingOperations
      .where('[ownerKey+localId]')
      .equals([ownerKey, localId])
      .toArray()
  )
    .filter((item) => item.entityType === entityType)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  const first = existing[0]
  const targetRevision = operationRevision(
    payload,
    Math.max(1, first?.targetRevision ?? 1),
  )

  if (operation === 'delete') {
    await db.pendingOperations.bulkDelete(existing.map((item) => item.id))
    await db.pendingOperations.put({
      id: generateLocalId('queue'),
      ownerKey,
      entityType,
      operation,
      localId,
      payload,
      createdAt: toIsoNow(),
      retryCount: 0,
      targetRevision,
      status: 'pending',
    })
    notifyPendingOperationChanged()
    return
  }

  if (first?.operation === 'create' || first?.operation === 'update') {
    await db.pendingOperations.put({
      ...first,
      ownerKey,
      payload: {
        ...first.payload,
        ...payload,
      },
      targetRevision,
      retryCount: 0,
      status: 'pending',
      nextAttemptAt: undefined,
      lastAttemptAt: undefined,
      lastError: undefined,
    })
    notifyPendingOperationChanged()
    return
  }

  await db.pendingOperations.put({
    id: generateLocalId('queue'),
    ownerKey,
    entityType,
    operation,
    localId,
    payload,
    createdAt: toIsoNow(),
    retryCount: 0,
    targetRevision,
    status: 'pending',
  })
  notifyPendingOperationChanged()
}
