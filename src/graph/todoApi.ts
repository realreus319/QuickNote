import {
  fetchAllGraphPages,
  graphFetch,
  GraphRequestError,
} from '@/graph/graphClient'
import type { LocalTodo } from '@/types/domain'

function encodePathSegment(value: string) {
  return encodeURIComponent(value)
}

export async function fetchRemoteTodoLists(accessToken: string) {
  return fetchAllGraphPages<Record<string, unknown>>(
    accessToken,
    '/v1.0/me/todo/lists?$top=100',
  )
}

export async function fetchRemoteTodos(accessToken: string, listRemoteId: string) {
  return fetchAllGraphPages<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${encodePathSegment(listRemoteId)}/tasks?$top=100`,
  )
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
        body: todo.body ? { content: todo.body, contentType: 'text' } : undefined,
        dueDateTime: todo.dueDateTime
          ? {
              dateTime: todo.dueDateTime,
              timeZone: 'UTC',
            }
          : undefined,
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
        body: todo.body ? { content: todo.body, contentType: 'text' } : undefined,
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
