const GRAPH_BASE = 'https://graph.microsoft.com'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_MAX_IMAGE_PIXELS = 40_000_000
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const RETRYABLE_METHODS = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'PUT',
  'PATCH',
  'DELETE',
])

export interface GraphRequestInit extends RequestInit {
  timeoutMs?: number
  maxRetries?: number
}

export interface GraphBlobRequestInit extends GraphRequestInit {
  maxBytes?: number
  maxImagePixels?: number
}

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
  retryAfterMs?: number
  requestId?: string

  constructor(
    message: string,
    status: number,
    body = message,
    options: {
      retryAfterMs?: number
      requestId?: string
    } = {},
  ) {
    super(message)
    this.status = status
    this.body = body
    this.retryAfterMs = options.retryAfterMs
    this.requestId = options.requestId
  }
}

function createRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `quicknote-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function createGraphHeaders(accessToken: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('client-request-id', createRequestId())
  headers.set('return-client-request-id', 'true')

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined

  const seconds = Number(value)

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000
  }

  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

function getRetryDelay(attempt: number, retryAfterMs?: number) {
  if (retryAfterMs != null) {
    return Math.min(retryAfterMs, 60_000)
  }

  return Math.min(30_000, 1_000 * 2 ** attempt)
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

function createAttemptSignal(
  externalSignal: AbortSignal | null | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(new DOMException('Graph 请求超时', 'TimeoutError'))
  }, timeoutMs)

  const abortFromExternal = () => {
    controller.abort(externalSignal?.reason)
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal()
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, {
        once: true,
      })
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    },
  }
}

function canRetry(method: string, attempt: number, maxRetries: number) {
  return attempt < maxRetries && RETRYABLE_METHODS.has(method)
}

export async function graphFetchRaw(
  accessToken: string,
  path: string,
  init: GraphRequestInit = {},
) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    ...requestInit
  } = init
  const method = (requestInit.method ?? 'GET').toUpperCase()
  let attempt = 0

  while (true) {
    const { signal, cleanup } = createAttemptSignal(
      requestInit.signal,
      timeoutMs,
    )

    try {
      const response = await fetch(resolveGraphRequestUrl(path), {
        ...requestInit,
        signal,
        headers: createGraphHeaders(accessToken, requestInit),
      })

      if (response.ok) {
        return response
      }

      const body = await response.text()
      const retryAfterMs = parseRetryAfter(
        response.headers.get('retry-after'),
      )
      const error = new GraphRequestError(
        body || response.statusText,
        response.status,
        body,
        {
          retryAfterMs,
          requestId:
            response.headers.get('request-id') ??
            response.headers.get('client-request-id') ??
            undefined,
        },
      )

      if (
        !RETRYABLE_STATUS_CODES.has(response.status) ||
        !canRetry(method, attempt, maxRetries)
      ) {
        throw error
      }

      await sleep(getRetryDelay(attempt, retryAfterMs))
      attempt += 1
    } catch (error) {
      if (requestInit.signal?.aborted) {
        throw error
      }

      if (error instanceof GraphRequestError) {
        throw error
      }

      if (!canRetry(method, attempt, maxRetries)) {
        throw error
      }

      await sleep(getRetryDelay(attempt))
      attempt += 1
    } finally {
      cleanup()
    }
  }
}

export async function graphFetch<T>(
  accessToken: string,
  path: string,
  init?: GraphRequestInit,
) {
  const response = await graphFetchRaw(accessToken, path, init)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function assertSafeImageBlob(blob: Blob, maxImagePixels?: number) {
  if (
    maxImagePixels == null ||
    !blob.type.toLowerCase().startsWith('image/') ||
    typeof createImageBitmap !== 'function'
  ) {
    return
  }

  let bitmap: ImageBitmap | undefined

  try {
    bitmap = await createImageBitmap(blob)

    if (bitmap.width * bitmap.height > maxImagePixels) {
      throw new Error('图片超过允许下载的安全分辨率')
    }
  } finally {
    bitmap?.close()
  }
}

async function responseToLimitedBlob(
  response: Response,
  maxBytes?: number,
  maxImagePixels?: number,
) {
  let blob: Blob

  if (maxBytes == null) {
    blob = await response.blob()
  } else {
    const declaredSize = Number(response.headers.get('content-length') ?? 0)

    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      await response.body?.cancel()
      throw new Error('图片超过允许下载的大小')
    }

    if (!response.body) {
      blob = await response.blob()

      if (blob.size > maxBytes) {
        throw new Error('图片超过允许下载的大小')
      }
    } else {
      const reader = response.body.getReader()
      const chunks: ArrayBuffer[] = []
      let totalBytes = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break
        if (!value) continue

        totalBytes += value.byteLength

        if (totalBytes > maxBytes) {
          await reader.cancel()
          throw new Error('图片实际大小超过允许下载的限制')
        }

        const chunk = new Uint8Array(value.byteLength)
        chunk.set(value)
        chunks.push(chunk.buffer)
      }

      blob = new Blob(chunks, {
        type:
          response.headers.get('content-type') ??
          'application/octet-stream',
      })
    }
  }

  await assertSafeImageBlob(blob, maxImagePixels)
  return blob
}

export async function graphFetchBlob(
  accessToken: string,
  path: string,
  init: GraphBlobRequestInit = {},
) {
  const {
    maxBytes,
    maxImagePixels = maxBytes == null
      ? undefined
      : DEFAULT_MAX_IMAGE_PIXELS,
    ...requestInit
  } = init
  const response = await graphFetchRaw(accessToken, path, requestInit)
  const blob = await responseToLimitedBlob(
    response,
    maxBytes,
    maxImagePixels,
  )

  return {
    blob,
    contentType: response.headers.get('content-type') ?? blob.type,
  }
}

export async function graphFetchBlobWithLimit(
  accessToken: string,
  path: string,
  maxBytes: number,
  init?: GraphRequestInit,
) {
  return graphFetchBlob(accessToken, path, {
    ...init,
    maxBytes,
  })
}

export async function fetchAllGraphPages<T>(
  accessToken: string,
  initialPath: string,
  init?: GraphRequestInit,
) {
  const values: T[] = []
  const visitedLinks = new Set<string>()
  let pageLink = initialPath

  while (pageLink) {
    if (visitedLinks.has(pageLink)) {
      throw new Error('Graph 分页链接出现循环')
    }

    visitedLinks.add(pageLink)
    const page = await graphFetch<{
      value?: T[]
      '@odata.nextLink'?: string
    }>(accessToken, pageLink, init)

    values.push(...(page.value ?? []))
    pageLink = page['@odata.nextLink'] ?? ''
  }

  return values
}
