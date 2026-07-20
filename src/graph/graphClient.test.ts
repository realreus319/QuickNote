import { describe, expect, it } from 'vitest'

import { resolveGraphRequestUrl } from '@/graph/graphClient'

describe('resolveGraphRequestUrl', () => {
  it('accepts Graph-relative paths and full delta links', () => {
    expect(resolveGraphRequestUrl('/v1.0/me/messages')).toBe(
      'https://graph.microsoft.com/v1.0/me/messages',
    )
    expect(
      resolveGraphRequestUrl(
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=opaque-token',
      ),
    ).toBe('https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=opaque-token')
  })

  it('rejects pagination links outside Microsoft Graph', () => {
    expect(() => resolveGraphRequestUrl('https://example.com/messages/delta')).toThrow(
      'Graph 分页链接来源无效',
    )
  })
})
