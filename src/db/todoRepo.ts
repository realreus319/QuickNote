import { db } from '@/db/db'
import { enqueuePendingOperation } from '@/db/pendingRepo'
import type { LocalTodo, LocalTodoList } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'
import { readString } from '@/utils/text'

const defaultTodoList: LocalTodoList = {
  id: 'local-default-list',
  displayName: '默认清单',
  wellknownListName: 'defaultList',
}

export async function ensureDefaultTodoList() {
  const existing = await db.todoLists.toArray()
  const localDefault = existing.find((list) => !list.remoteId) ?? existing[0]

  if (localDefault) return localDefault

  await db.todoLists.put(defaultTodoList)
  return defaultTodoList
}

export async function listTodoLists() {
  return db.todoLists.toArray()
}

export async function listTodos() {
  return (await db.todos.toArray())
    .filter((todo) => !todo.deleted)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
}

export async function createTodo(listId: string, title: string) {
  const resolvedListId = listId || (await ensureDefaultTodoList()).id
  const now = toIsoNow()
  const todo: LocalTodo = {
    id: generateLocalId('todo'),
    listId: resolvedListId,
    title,
    status: 'notStarted',
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  }

  await db.todos.put(todo)
  await enqueuePendingOperation('todo', 'create', todo.id, todo as unknown as Record<string, unknown>)

  return todo
}

export async function updateTodo(
  todoId: string,
  patch: Partial<Pick<LocalTodo, 'title' | 'status' | 'body' | 'dueDateTime'>>,
) {
  const current = await db.todos.get(todoId)

  if (!current) return

  const next: LocalTodo = {
    ...current,
    ...patch,
    updatedAt: toIsoNow(),
    syncStatus: 'pending',
  }

  await db.todos.put(next)
  await enqueuePendingOperation(
    'todo',
    current.remoteId ? 'update' : 'create',
    todoId,
    next as unknown as Record<string, unknown>,
  )

  return next
}

export async function deleteTodo(todoId: string) {
  const current = await db.todos.get(todoId)

  if (!current) return

  await db.todos.put({
    ...current,
    deleted: true,
    updatedAt: toIsoNow(),
    syncStatus: 'pending',
  })

  await enqueuePendingOperation('todo', 'delete', todoId, {
    id: todoId,
    remoteId: current.remoteId,
  })
}

export async function searchTodos(query: string) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) return []

  return (await listTodos()).filter((todo) => {
    const haystack = `${todo.title} ${todo.body ?? ''}`.toLowerCase()

    return haystack.includes(normalized)
  })
}

export async function syncRemoteTodoLists(lists: Array<Record<string, unknown>>) {
  const current = await db.todoLists.toArray()
  const localByRemoteId = new Map(current.filter((list) => list.remoteId).map((list) => [list.remoteId as string, list]))

  const mapped = lists.map((item) => ({
    id: localByRemoteId.get(readString(item.id))?.id ?? generateLocalId('todo-list'),
    remoteId: readString(item.id),
    displayName: readString(item.displayName, '任务清单'),
    wellknownListName: typeof item.wellknownListName === 'string' ? item.wellknownListName : undefined,
  }))

  await db.todoLists.clear()
  if (mapped.length) {
    await db.todoLists.bulkPut(mapped)
    return
  }

  await db.todoLists.put(await ensureDefaultTodoList())
}

export async function syncRemoteTodos(listId: string, todos: Array<Record<string, unknown>>) {
  const current = await db.todos.where('listId').equals(listId).toArray()
  const localByRemoteId = new Map(current.filter((todo) => todo.remoteId).map((todo) => [todo.remoteId as string, todo]))
  const now = toIsoNow()

  const mapped: LocalTodo[] = todos.map((item) => {
    const status: LocalTodo['status'] =
      item.status === 'completed' || item.status === 'inProgress'
        ? item.status
        : 'notStarted'
    const importance: LocalTodo['importance'] =
      item.importance === 'high' || item.importance === 'low'
        ? item.importance
        : 'normal'

    return {
      id: localByRemoteId.get(readString(item.id))?.id ?? generateLocalId('todo'),
      remoteId: readString(item.id),
      listId,
      title: readString(item.title),
      body:
        typeof item.body === 'object'
          ? readString((item.body as { content?: string }).content)
          : undefined,
      status,
      importance,
      dueDateTime:
        typeof item.dueDateTime === 'object'
          ? readString((item.dueDateTime as { dateTime?: string }).dateTime)
          : undefined,
      createdAt: readString(item.createdDateTime, now),
      updatedAt: readString(item.lastModifiedDateTime, now),
      syncStatus: 'synced',
      deleted: false,
    }
  })

  await db.todos.where('listId').equals(listId).delete()
  if (mapped.length) {
    await db.todos.bulkPut(mapped)
  }
}

export async function applySyncedTodo(todoId: string, remoteId: string) {
  const todo = await db.todos.get(todoId)

  if (!todo) return

  await db.todos.put({
    ...todo,
    remoteId,
    syncStatus: 'synced',
    updatedAt: toIsoNow(),
  })
}

export async function removeDeletedTodo(todoId: string) {
  await db.todos.delete(todoId)
}
