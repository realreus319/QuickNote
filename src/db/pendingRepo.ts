import { db } from '@/db/db'
import type { EntityType, PendingOperationType } from '@/types/domain'
import { generateLocalId } from '@/utils/id'
import { toIsoNow } from '@/utils/date'

export async function listPendingOperations() {
  return db.pendingOperations.orderBy('createdAt').toArray()
}

export async function countPendingOperations() {
  return db.pendingOperations.count()
}

export async function removePendingOperation(id: string) {
  await db.pendingOperations.delete(id)
}

export async function removePendingOperationsForLocalId(localId: string) {
  const items = await db.pendingOperations.where('localId').equals(localId).toArray()

  await db.pendingOperations.bulkDelete(items.map((item) => item.id))
}

export async function markPendingOperationError(id: string, lastError: string) {
  const operation = await db.pendingOperations.get(id)

  if (!operation) return

  await db.pendingOperations.put({
    ...operation,
    retryCount: operation.retryCount + 1,
    lastError,
  })
}

export async function enqueuePendingOperation(
  entityType: EntityType,
  operation: PendingOperationType,
  localId: string,
  payload: Record<string, unknown>,
) {
  const existing = (await db.pendingOperations.where('localId').equals(localId).toArray())
    .filter((item) => item.entityType === entityType)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  const first = existing[0]

  if (operation === 'delete') {
    await db.pendingOperations.bulkDelete(existing.map((item) => item.id))
    await db.pendingOperations.put({
      id: generateLocalId('queue'),
      entityType,
      operation,
      localId,
      payload,
      createdAt: toIsoNow(),
      retryCount: 0,
    })
    return
  }

  if (first?.operation === 'create') {
    await db.pendingOperations.put({
      ...first,
      payload: {
        ...first.payload,
        ...payload,
      },
    })
    return
  }

  if (first?.operation === 'update') {
    await db.pendingOperations.put({
      ...first,
      payload: {
        ...first.payload,
        ...payload,
      },
    })
    return
  }

  await db.pendingOperations.put({
    id: generateLocalId('queue'),
    entityType,
    operation,
    localId,
    payload,
    createdAt: toIsoNow(),
    retryCount: 0,
  })
}
