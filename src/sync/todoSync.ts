import { db } from '@/db/db'
import {
  applySyncedTodo,
  listTodoLists,
  removeDeletedTodo,
  syncRemoteTodoLists,
  syncRemoteTodos,
} from '@/db/todoRepo'
import {
  createRemoteTodo,
  deleteRemoteTodo,
  fetchRemoteTodoLists,
  fetchRemoteTodos,
  updateRemoteTodo,
} from '@/graph/todoApi'
import type { PendingOperation } from '@/types/domain'
import { readString } from '@/utils/text'

async function resolveListRemoteId(localListId: string, ownerKey: string) {
  const list = await db.todoLists.get(localListId)

  if (!list || list.ownerKey !== ownerKey || !list.remoteId) {
    return undefined
  }

  return list.remoteId
}

export async function replayTodoOperation(
  accessToken: string,
  operation: PendingOperation,
  ownerKey: string,
) {
  if (operation.ownerKey !== ownerKey) {
    throw new Error('待办同步操作不属于当前账户')
  }

  const expectedRevision = Math.max(1, operation.targetRevision ?? 1)
  const todo = await db.todos.get(operation.localId)
  const ownedTodo = todo?.ownerKey === ownerKey ? todo : undefined
  const remoteId = readString(operation.payload.remoteId, ownedTodo?.remoteId ?? '')
  const listRemoteId =
    readString(operation.payload.listRemoteId) ||
    (ownedTodo ? await resolveListRemoteId(ownedTodo.listId, ownerKey) : undefined)

  if (operation.operation === 'delete') {
    if (listRemoteId && remoteId) {
      await deleteRemoteTodo(accessToken, listRemoteId, remoteId)
    }
    await removeDeletedTodo(operation.localId, ownerKey)
    return
  }

  if (!ownedTodo) return

  if (!listRemoteId) {
    throw new Error('当前待办缺少对应的远端任务清单')
  }

  if (!ownedTodo.remoteId) {
    const response = await createRemoteTodo(accessToken, listRemoteId, ownedTodo)
    const createdRemoteId = readString(response.id)

    if (!createdRemoteId) {
      throw new Error('远端待办创建后未返回标识')
    }

    await applySyncedTodo(
      operation.localId,
      createdRemoteId,
      expectedRevision,
      ownerKey,
    )
    return
  }

  await updateRemoteTodo(accessToken, listRemoteId, ownedTodo)
  await applySyncedTodo(
    operation.localId,
    ownedTodo.remoteId,
    expectedRevision,
    ownerKey,
  )
}

export async function pullTodos(accessToken: string, ownerKey: string) {
  const lists = await fetchRemoteTodoLists(accessToken)
  await syncRemoteTodoLists(lists, ownerKey)
  const localLists = await listTodoLists(ownerKey)

  for (const list of localLists) {
    if (!list.remoteId) continue
    const tasks = await fetchRemoteTodos(accessToken, list.remoteId)
    await syncRemoteTodos(list.id, tasks, ownerKey)
  }
}
