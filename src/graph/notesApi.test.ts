import { describe, expect, it } from 'vitest'

import { isRemoteImageAttachment } from '@/graph/notesApi'

describe('notesApi', () => {
  it('treats image attachments as remote note images even when isInline is false', () => {
    expect(
      isRemoteImageAttachment({
        contentType: 'image/jpeg',
        isInline: false,
      }),
    ).toBe(true)
  })
})
