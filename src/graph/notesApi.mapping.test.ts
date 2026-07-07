// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { remapRemoteAttachmentsForStoredHtml } from '@/graph/notesApi'
import type { LocalNoteAttachment } from '@/types/domain'

function makeRemoteAttachment(
  overrides: Partial<LocalNoteAttachment> & { remoteId: string },
): LocalNoteAttachment {
  return {
    id: overrides.id ?? overrides.remoteId,
    remoteId: overrides.remoteId,
    name: overrides.name ?? 'image.png',
    mimeType: overrides.mimeType ?? 'image/png',
    size: overrides.size ?? 1,
    base64: overrides.base64 ?? 'AAA',
    contentId: overrides.contentId ?? overrides.remoteId,
    createdAt: overrides.createdAt ?? '2026-07-02T00:00:00Z',
  }
}

describe('notesApi attachment remapping', () => {
  it('reuses stored image ids from the html order', () => {
    const attachments = [
      makeRemoteAttachment({ remoteId: 'remote-1', contentId: 'cid-1' }),
      makeRemoteAttachment({ remoteId: 'remote-2', contentId: 'cid-2' }),
    ]

    const remapped = remapRemoteAttachmentsForStoredHtml(
      attachments,
      [
        '<figure><img src="quicknote-asset://local-a" alt="a" /></figure>',
        '<figure><img src="quicknote-asset://local-b" alt="b" /></figure>',
      ].join(''),
    )

    expect(remapped.map((attachment) => attachment.id)).toEqual(['local-a', 'local-b'])
    expect(remapped.map((attachment) => attachment.remoteId)).toEqual(['remote-1', 'remote-2'])
  })
})
