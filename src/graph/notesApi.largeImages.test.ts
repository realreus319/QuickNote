// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const graphClientMocks = vi.hoisted(() => ({
  graphFetch: vi.fn(),
  graphFetchBlob: vi.fn(),
}))

vi.mock('@/graph/graphClient', () => graphClientMocks)

import {
  AUTO_DOWNLOAD_NOTE_ATTACHMENT_MAX_BYTES,
  downloadRemoteNoteAttachment,
  fetchRemoteNotesDelta,
} from '@/graph/notesApi'
import type { LocalNoteAttachment } from '@/types/domain'

describe('large remote note images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps images over the auto-download threshold as metadata only', async () => {
    const savedDeltaLink =
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=large-image'

    graphClientMocks.graphFetch.mockImplementation((_token, path: string) => {
      if (path === savedDeltaLink) {
        return Promise.resolve({
          value: [
            {
              id: 'remote-note-1',
              subject: 'Large image',
              body: { content: '<p>Photo</p><img src="cid:large-image-1">' },
              createdDateTime: '2026-07-22T00:00:00.000Z',
              lastModifiedDateTime: '2026-07-22T00:00:00.000Z',
              hasAttachments: true,
              changeKey: 'change-1',
              singleValueExtendedProperties: [],
            },
          ],
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=done',
        })
      }

      if (path.includes('/attachments?$select=')) {
        return Promise.resolve({
          value: [
            {
              id: 'remote-image-1',
              name: 'large.jpg',
              contentType: 'image/jpeg',
              size: AUTO_DOWNLOAD_NOTE_ATTACHMENT_MAX_BYTES + 1,
              isInline: true,
            },
          ],
        })
      }

      if (path.includes('/attachments/remote-image-1?')) {
        return Promise.resolve({
          id: 'remote-image-1',
          name: 'large.jpg',
          contentType: 'image/jpeg',
          size: AUTO_DOWNLOAD_NOTE_ATTACHMENT_MAX_BYTES + 1,
          contentId: 'large-image-1',
          isInline: true,
        })
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    const result = await fetchRemoteNotesDelta(
      'token',
      'account-a',
      savedDeltaLink,
    )
    const attachments = result.changes[0]?.quicknoteAttachments as
      | LocalNoteAttachment[]
      | undefined

    expect(attachments).toEqual([
      expect.objectContaining({
        remoteId: 'remote-image-1',
        size: AUTO_DOWNLOAD_NOTE_ATTACHMENT_MAX_BYTES + 1,
        base64: '',
        storageState: 'remote-only',
      }),
    ])
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })

  it('rejects manual downloads over the hard attachment limit before fetching bytes', async () => {
    const attachment = {
      id: 'image-1',
      remoteId: 'remote-image-1',
      name: 'too-large.jpg',
      mimeType: 'image/jpeg',
      size: 36 * 1024 * 1024,
      base64: '',
      contentId: 'large-image-1',
      createdAt: '2026-07-22T00:00:00.000Z',
      storageState: 'remote-only',
    } satisfies LocalNoteAttachment

    await expect(
      downloadRemoteNoteAttachment('token', 'remote-note-1', attachment),
    ).rejects.toThrow('超过 35 MB')
    expect(graphClientMocks.graphFetch).not.toHaveBeenCalled()
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })
})
