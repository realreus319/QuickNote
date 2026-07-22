import {
  fetchAllGraphPages,
  graphFetch,
  GraphRequestError,
} from '@/graph/graphClient'
import type { LocalTodo } from '@/types/domain'
import { readString } from '@/utils/text'

const QUICKNOTE_LINKED_RESOURCE_APPLICATION = 'QuickNote'
const QUICKNOTE_PROJECT_URL = 'https://github.com/realreus319/QuickNote'

function encodePathSegment(value: string) {
  return encodeURIComponent(value)
}

function taskHasLocalId(task: Record<string, unknown>, localId: string) {
  if (!Array.isArray(task.linkedResources)) return false

  return task.linkedResources.some((resource) => {
    if (!resource || typeof resource !== 'object') return false

    const record = resource as Record<string, unknown>
    return (
      readString(record.applicationName) ===
        QUICKNOTE_LINKED_RESOURCE_APPLICATION &&
      readString(record.externalId) === localId
    )
  })
}

export async function fetchRemoteTodoLists(accessToken: string) {
  return fetchAllGraphPages<Record<string, unknown>>(
    accessToken,
    '/v1.0/me/todo/lists?$top=100',
  )
}

export async function fetchRemoteTodos(
  accessToken: string,
  listRemoteId: string,
) {
  return fetchAllGraphPages<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks?$top=100`,
  )
}

export async function findRemoteTodoByLocalId(
  accessToken: string,
  listRemoteId: string,
  localId: string,
) {
  const tasks = await fetchAllGraphPages<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks?$top=100&$expand=linkedResources`,
  )

  return tasks.find((task) => taskHasLocalId(task, localId))
}

export async function createRemoteTodo(
  accessToken: string,
  listRemoteId: string,
  todo: LocalTodo,
) {
  return graphFetch<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks`,
    {
      method: 'POST',
      maxRetries: 0,
      body: JSON.stringify({
        title: todo.title,
        status: todo.status,
        body: todo.body
          ? { content: todo.body, contentType: 'text' }
          : undefined,
        dueDateTime: todo.dueDateTime
          ? {
              dateTime: todo.dueDateTime,
              timeZone: 'UTC',
            }
          : undefined,
        linkedResources: [
          {
            webUrl: QUICKNOTE_PROJECT_URL,
            applicationName: QUICKNOTE_LINKED_RESOURCE_APPLICATION,
            displayName: todo.title || 'QuickNote task',
            externalId: todo.id,
          },
        ],
      }),
    },
  )
}

export async function updateRemoteTodo(
  accessToken: string,
  listRemoteId: string,
  todo: LocalTodo,
) {
  if (!todo.remoteId) {
    throw new Error('缺少远端待办标识')
  }

  return graphFetch<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks/${encodePathSegment(todo.remoteId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        title: todo.title,
        status: todo.status,
        body: todo.body
          ? { content: todo.body, contentType: 'text' }
          : undefined,
        dueDateTime: todo.dueDateTime
          ? {
              dateTime: todo.dueDateTime,
              timeZone: 'UTC',
            }
          : null,
      }),
    },
  )
}

export async function deleteRemoteTodo(
  accessToken: string,
  listRemoteId: string,
  remoteId: string,
) {
  try {
    await graphFetch<void>(
      accessToken,
      `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks/${encodePathSegment(remoteId)}`,
      {
        method: 'DELETE',
      },
    )
  } catch (error) {
    if (error instanceof GraphRequestError && error.status === 404) {
      return
    }

    throw error
  }
}
