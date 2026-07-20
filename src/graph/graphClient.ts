const GRAPH_BASE = 'https://graph.microsoft.com'

export function resolveGraphRequestUrl(path: string) {
  if (path.startsWith('/')) {
    return `${GRAPH_BASE}${path}`
  }

  const url = new URL(path)

  if (url.origin !== GRAPH_BASE) {
    throw new Error('Graph 分页链接来源无效')
  }

  return url.toString()
}

export class GraphRequestError extends Error {
  status: number
  body: string

  constructor(message: string, status: number, body = message) {
    super(message)
    this.status = status
    this.body = body
  }
}

function createGraphHeaders(accessToken: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

export async function graphFetchRaw(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(resolveGraphRequestUrl(path), {
    ...init,
    headers: createGraphHeaders(accessToken, init),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new GraphRequestError(body || response.statusText, response.status, body)
  }

  return response
}

export async function graphFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const response = await graphFetchRaw(accessToken, path, init)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function graphFetchBlob(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const response = await graphFetchRaw(accessToken, path, init)

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') ?? '',
  }
}
