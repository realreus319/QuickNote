import { listTodoLists, applySyncedTodo, removeDeletedTodo, syncRemoteTodoLists, syncRemoteTodos } from '@/db/todoRepo'
import { db } from '@/db/db'
import {
  createRemoteTodo,
  deleteRemoteTodo,
  fetchRemoteTodoLists,
  fetchRemoteTodos,
  updateRemoteTodo,
} from '@/graph/todoApi'
import type { PendingOperation } from '@/types/domain'
import { readString } from '@/utils/text'

async function resolveListRemoteId(localListId: string) {
  const lists = await listTodoLists()
  const exact = lists.find((list) => list.id === localListId)

  if (exact?.remoteId) return exact.remoteId

  return lists.find((list) => list.remoteId)?.remoteId
}

export async function replayTodoOperation(accessToken: string, operation: PendingOperation) {
  const todo = await db.todos.get(operation.localId)
  const remoteId = readString(operation.payload.remoteId, todo?.remoteId ?? '')
  const listRemoteId = todo ? await resolveListRemoteId(todo.listId) : undefined

  if (operation.operation === 'delete') {
    if (listRemoteId && remoteId) {
      await deleteRemoteTodo(accessToken, listRemoteId, remoteId)
    }
    await removeDeletedTodo(operation.localId)
    return
  }

  if (!todo) return

  if (!listRemoteId) {
    throw new Error('缺少可同步的远端任务清单')
  }

  if (!todo.remoteId || operation.operation === 'create') {
    const response = await createRemoteTodo(accessToken, listRemoteId, todo)
    await applySyncedTodo(operation.localId, readString(response.id))
    return
  }

  await updateRemoteTodo(accessToken, listRemoteId, todo)
  await applySyncedTodo(operation.localId, todo.remoteId)
}

export async function pullTodos(accessToken: string) {
  const lists = await fetchRemoteTodoLists(accessToken)
  await syncRemoteTodoLists(lists)
  const localLists = await listTodoLists()

  for (const list of localLists) {
    if (!list.remoteId) continue
    const tasks = await fetchRemoteTodos(accessToken, list.remoteId)
    await syncRemoteTodos(list.id, tasks)
  }
}
