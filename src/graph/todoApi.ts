import { graphFetch } from '@/graph/graphClient'
import type { LocalTodo } from '@/types/domain'

export async function fetchRemoteTodoLists(accessToken: string) {
  const response = await graphFetch<{ value?: Array<Record<string, unknown>> }>(
    accessToken,
    '/v1.0/me/todo/lists',
  )

  return response.value ?? []
}

export async function fetchRemoteTodos(accessToken: string, listRemoteId: string) {
  const response = await graphFetch<{ value?: Array<Record<string, unknown>> }>(
    accessToken,
    `/v1.0/me/todo/lists/${listRemoteId}/tasks`,
  )

  return response.value ?? []
}

export async function createRemoteTodo(
  accessToken: string,
  listRemoteId: string,
  todo: LocalTodo,
) {
  return graphFetch<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/todo/lists/${listRemoteId}/tasks`,
    {
      method: 'POST',
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
    `/v1.0/me/todo/lists/${listRemoteId}/tasks/${todo.remoteId}`,
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
  return graphFetch<void>(
    accessToken,
    `/v1.0/me/todo/lists/${listRemoteId}/tasks/${remoteId}`,
    {
      method: 'DELETE',
    },
  )
}
