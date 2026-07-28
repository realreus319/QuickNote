import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchAllGraphPages,
  graphFetch,
  graphFetchBlob,
  resolveGraphRequestUrl,
} from '@/graph/graphClient'

const originalFetch = globalThis.fetch
const originalCreateImageBitmap = globalThis.createImageBitmap

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap
  } else {
    Reflect.deleteProperty(globalThis, 'createImageBitmap')
  }

  vi.restoreAllMocks()
})

describe('resolveGraphRequestUrl', () => {
  it('accepts Graph-relative paths and full delta links', () => {
    expect(resolveGraphRequestUrl('/v1.0/me/messages')).toBe(
      'https://graph.microsoft.com/v1.0/me/messages',
    )
    expect(
      resolveGraphRequestUrl(
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=opaque-token',
      ),
    ).toBe(
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=opaque-token',
    )
  })

  it('rejects pagination links outside Microsoft Graph', () => {
    expect(() =>
      resolveGraphRequestUrl('https://example.com/messages/delta'),
    ).toThrow('Graph 分页链接来源无效')
  })
})

describe('Graph resilience', () => {
  it('follows every nextLink page', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [{ id: 'one' }],
            '@odata.nextLink':
              'https://graph.microsoft.com/v1.0/me/todo/lists?page=2',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: 'two' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    globalThis.fetch = fetchMock

    await expect(
      fetchAllGraphPages<{ id: string }>(
        'token',
        '/v1.0/me/todo/lists?$top=100',
      ),
    ).resolves.toEqual([{ id: 'one' }, { id: 'two' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries throttled idempotent requests using Retry-After', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('throttled', {
          status: 429,
          headers: { 'retry-after': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    globalThis.fetch = fetchMock

    await expect(
      graphFetch<{ id: string }>('token', '/v1.0/me/messages'),
    ).resolves.toEqual({ id: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-idempotent POST requests', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('server error', {
        status: 503,
      }),
    )
    globalThis.fetch = fetchMock

    await expect(
      graphFetch('token', '/v1.0/me/messages', {
        method: 'POST',
        body: JSON.stringify({ subject: 'draft' }),
      }),
    ).rejects.toThrow('server error')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an attachment before reading bytes when Content-Length is too large', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-length': String(10 * 1024 * 1024),
          'content-type': 'image/png',
        },
      }),
    )
    globalThis.fetch = fetchMock

    await expect(
      graphFetchBlob('token', '/v1.0/me/messages/1/attachments/1/$value', {
        maxBytes: 5 * 1024 * 1024,
      }),
    ).rejects.toThrow('超过允许下载的大小')
  })

  it('rejects compressed images with unsafe decoded dimensions', async () => {
    const close = vi.fn()
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        width: 10_000,
        height: 10_000,
        close,
      }),
    })
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-length': '3',
          'content-type': 'image/png',
        },
      }),
    )

    await expect(
      graphFetchBlob('token', '/v1.0/me/messages/1/attachments/1/$value', {
        maxBytes: 5 * 1024 * 1024,
      }),
    ).rejects.toThrow('安全分辨率')
    expect(close).toHaveBeenCalledOnce()
  })
})
