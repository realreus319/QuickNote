import { requireActiveOwnerKey } from '@/db/accountScope'
import { db } from '@/db/db'
import { enqueuePendingOperation } from '@/db/pendingRepo'
import type { LocalTodo, LocalTodoList } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'
import { readString } from '@/utils/text'

function todoRevision(todo: LocalTodo) {
  return Math.max(1, todo.localRevision ?? 1)
}

function syncedTodoRevision(todo: LocalTodo) {
  return Math.max(0, todo.syncedRevision ?? (todo.syncStatus === 'synced' ? todoRevision(todo) : 0))
}

function hasUnsyncedTodoChanges(todo: LocalTodo) {
  return todoRevision(todo) > syncedTodoRevision(todo) || todo.syncStatus !== 'synced'
}

function defaultTodoList(ownerKey: string): LocalTodoList {
  return {
    id: `local-default-list:${ownerKey}`,
    ownerKey,
    displayName: '默认清单',
    wellknownListName: 'defaultList',
  }
}

export async function ensureDefaultTodoList(ownerKey = requireActiveOwnerKey()) {
  const existing = await db.todoLists.where('ownerKey').equals(ownerKey).toArray()
  const localDefault = existing.find((list) => !list.remoteId) ?? existing[0]

  if (localDefault) return localDefault

  const fallback = defaultTodoList(ownerKey)
  await db.todoLists.put(fallback)
  return fallback
}

export async function listTodoLists(ownerKey = requireActiveOwnerKey()) {
  return db.todoLists.where('ownerKey').equals(ownerKey).toArray()
}

export async function listTodos(ownerKey = requireActiveOwnerKey()) {
  return (await db.todos.where('ownerKey').equals(ownerKey).toArray())
    .filter((todo) => !todo.deleted)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
}

export async function createTodo(
  listId: string,
  title: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const resolvedListId = listId || (await ensureDefaultTodoList(ownerKey)).id
  const list = await db.todoLists.get(resolvedListId)

  if (!list || list.ownerKey !== ownerKey) {
    throw new Error('待办清单不属于当前账户')
  }

  const now = toIsoNow()
  const todo: LocalTodo = {
    id: generateLocalId('todo'),
    ownerKey,
    listId: resolvedListId,
    title,
    status: 'notStarted',
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncedRevision: 0,
  }

  await db.transaction('rw', db.todos, db.pendingOperations, async () => {
    await db.todos.put(todo)
    await enqueuePendingOperation(
      'todo',
      'create',
      todo.id,
      todo as unknown as Record<string, unknown>,
      ownerKey,
    )
  })

  return todo
}

export async function updateTodo(
  todoId: string,
  patch: Partial<Pick<LocalTodo, 'title' | 'status' | 'body' | 'dueDateTime'>>,
  ownerKey = requireActiveOwnerKey(),
) {
  return db.transaction('rw', db.todos, db.pendingOperations, async () => {
    const current = await db.todos.get(todoId)

    if (!current || current.ownerKey !== ownerKey) return undefined

    const localRevision = todoRevision(current) + 1
    const next: LocalTodo = {
      ...current,
      ...patch,
      ownerKey,
      updatedAt: toIsoNow(),
      localRevision,
      syncedRevision: syncedTodoRevision(current),
      syncStatus: 'pending',
    }

    await db.todos.put(next)
    await enqueuePendingOperation(
      'todo',
      current.remoteId ? 'update' : 'create',
      todoId,
      next as unknown as Record<string, unknown>,
      ownerKey,
    )

    return next
  })
}

export async function deleteTodo(
  todoId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  await db.transaction('rw', db.todos, db.pendingOperations, async () => {
    const current = await db.todos.get(todoId)

    if (!current || current.ownerKey !== ownerKey) return

    const list = await db.todoLists.get(current.listId)
    const localRevision = todoRevision(current) + 1
    const next: LocalTodo = {
      ...current,
      ownerKey,
      deleted: true,
      updatedAt: toIsoNow(),
      localRevision,
      syncedRevision: syncedTodoRevision(current),
      syncStatus: 'pending',
    }

    await db.todos.put(next)
    await enqueuePendingOperation(
      'todo',
      'delete',
      todoId,
      {
        id: todoId,
        ownerKey,
        remoteId: current.remoteId,
        listRemoteId: list?.ownerKey === ownerKey ? list.remoteId : undefined,
        localRevision,
      },
      ownerKey,
    )
  })
}

export async function searchTodos(
  query: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) return []

  return (await listTodos(ownerKey)).filter((todo) => {
    const haystack = `${todo.title} ${todo.body ?? ''}`.toLowerCase()

    return haystack.includes(normalized)
  })
}

export async function syncRemoteTodoLists(
  lists: Array<Record<string, unknown>>,
  ownerKey: string,
) {
  await db.transaction('rw', db.todoLists, async () => {
    const current = await db.todoLists.where('ownerKey').equals(ownerKey).toArray()
    const localByRemoteId = new Map(
      current
        .filter((list) => list.remoteId)
        .map((list) => [list.remoteId as string, list]),
    )

    const mapped = lists
      .map((item) => {
        const remoteId = readString(item.id)

        if (!remoteId) return null

        return {
          id: localByRemoteId.get(remoteId)?.id ?? generateLocalId('todo-list'),
          ownerKey,
          remoteId,
          displayName: readString(item.displayName, '任务清单'),
          wellknownListName:
            typeof item.wellknownListName === 'string'
              ? item.wellknownListName
              : undefined,
        } satisfies LocalTodoList
      })
      .filter((list): list is LocalTodoList => Boolean(list))

    const seenRemoteIds = new Set(mapped.map((list) => list.remoteId))
    const removedIds = current
      .filter((list) => list.remoteId && !seenRemoteIds.has(list.remoteId))
      .map((list) => list.id)

    if (removedIds.length) {
      await db.todoLists.bulkDelete(removedIds)
    }

    if (mapped.length) {
      await db.todoLists.bulkPut(mapped)
    }
  })

  const ownedLists = await listTodoLists(ownerKey)

  if (!ownedLists.length) {
    await db.todoLists.put(defaultTodoList(ownerKey))
  }
}

export async function syncRemoteTodos(
  listId: string,
  todos: Array<Record<string, unknown>>,
  ownerKey: string,
) {
  await db.transaction('rw', db.todos, async () => {
    const current = await db.todos
      .where('[ownerKey+listId]')
      .equals([ownerKey, listId])
      .toArray()
    const localByRemoteId = new Map(
      current
        .filter((todo) => todo.remoteId)
        .map((todo) => [todo.remoteId as string, todo]),
    )
    const now = toIsoNow()
    const mapped: LocalTodo[] = []
    const seenRemoteIds = new Set<string>()

    for (const item of todos) {
      const remoteId = readString(item.id)

      if (!remoteId) continue

      seenRemoteIds.add(remoteId)
      const existing = localByRemoteId.get(remoteId)
      const status: LocalTodo['status'] =
        item.status === 'completed' || item.status === 'inProgress'
          ? item.status
          : 'notStarted'
      const importance: LocalTodo['importance'] =
        item.importance === 'high' || item.importance === 'low'
          ? item.importance
          : 'normal'
      const localRevision = existing ? todoRevision(existing) : 1

      const remoteTodo: LocalTodo = {
        id: existing?.id ?? generateLocalId('todo'),
        ownerKey,
        remoteId,
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
        createdAt: readString(item.createdDateTime, existing?.createdAt ?? now),
        updatedAt: readString(item.lastModifiedDateTime, existing?.updatedAt ?? now),
        localRevision,
        syncedRevision: localRevision,
        syncStatus: 'synced',
        deleted: false,
      }

      mapped.push(
        existing && hasUnsyncedTodoChanges(existing)
          ? {
              ...remoteTodo,
              title: existing.title,
              body: existing.body,
              status: existing.status,
              importance: existing.importance,
              dueDateTime: existing.dueDateTime,
              updatedAt: existing.updatedAt,
              localRevision: todoRevision(existing),
              syncedRevision: syncedTodoRevision(existing),
              syncStatus: existing.syncStatus,
              deleted: existing.deleted,
            }
          : remoteTodo,
      )
    }

    const removedIds = current
      .filter(
        (todo) =>
          todo.remoteId &&
          !seenRemoteIds.has(todo.remoteId) &&
          !hasUnsyncedTodoChanges(todo),
      )
      .map((todo) => todo.id)

    if (removedIds.length) {
      await db.todos.bulkDelete(removedIds)
    }

    if (mapped.length) {
      await db.todos.bulkPut(mapped)
    }
  })
}

export async function applySyncedTodo(
  todoId: string,
  remoteId: string,
  expectedRevision: number,
  ownerKey: string,
) {
  const todo = await db.todos.get(todoId)

  if (!todo || todo.ownerKey !== ownerKey) return

  const currentRevision = todoRevision(todo)
  const fullySynced = currentRevision === expectedRevision

  await db.todos.put({
    ...todo,
    remoteId,
    syncStatus: fullySynced ? 'synced' : 'pending',
    syncedRevision: Math.max(syncedTodoRevision(todo), expectedRevision),
    updatedAt: fullySynced ? toIsoNow() : todo.updatedAt,
  })
}

export async function removeDeletedTodo(
  todoId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const todo = await db.todos.get(todoId)

  if (todo?.ownerKey === ownerKey) {
    await db.todos.delete(todoId)
  }
}
