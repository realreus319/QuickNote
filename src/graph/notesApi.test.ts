import { beforeEach, describe, expect, it, vi } from 'vitest'

const graphClientMocks = vi.hoisted(() => ({
  graphFetch: vi.fn(),
  graphFetchBlob: vi.fn(),
}))

vi.mock('@/graph/graphClient', () => graphClientMocks)

import {
  canReuseRemoteAttachments,
  fetchRemoteNotes,
  isRemoteImageAttachment,
  MICROSOFT_NOTE_COLOR_PROPERTY_ID,
  readRemoteNoteColor,
} from '@/graph/notesApi'
import type { LocalNote } from '@/types/domain'

describe('notesApi', () => {
  beforeEach(() => {
    graphClientMocks.graphFetch.mockReset()
    graphClientMocks.graphFetchBlob.mockReset()
  })

  it('treats image attachments as remote note images even when isInline is false', () => {
    expect(
      isRemoteImageAttachment({
        contentType: 'image/jpeg',
        isInline: false,
      }),
    ).toBe(true)
  })

  it('reuses locally persisted attachments only for the hydrated remote version', () => {
    const cachedNote = {
      remoteAttachmentsChangeKey: 'change-key-2',
    } as LocalNote

    expect(canReuseRemoteAttachments('change-key-2', cachedNote)).toBe(true)
    expect(canReuseRemoteAttachments('change-key-3', cachedNote)).toBe(false)
    expect(canReuseRemoteAttachments('', cachedNote)).toBe(false)
    expect(canReuseRemoteAttachments('change-key-2', undefined)).toBe(false)
  })

  it('reads the Microsoft Sticky Note color extended property', () => {
    expect(
      readRemoteNoteColor({
        singleValueExtendedProperties: [
          {
            id: MICROSOFT_NOTE_COLOR_PROPERTY_ID,
            value: '1',
          },
        ],
      }),
    ).toBe('green')
  })

  it('does not request attachment data again when the cached remote version is current', async () => {
    const cachedAttachment = {
      id: 'local-image-1',
      remoteId: 'remote-image-1',
      name: 'image.png',
      mimeType: 'image/png',
      size: 3,
      base64: 'AAA',
      contentId: 'quicknote-image-1',
      createdAt: '2026-07-20T00:00:00.000Z',
    }
    const cachedNote: LocalNote = {
      id: 'local-note-1',
      remoteId: 'remote-note-1',
      title: 'Cached note',
      content: '',
      bodyHtml:
        '<figure><img src="quicknote-asset://local-image-1" data-attachment-id="local-image-1"></figure>',
      attachments: [cachedAttachment],
      color: 'yellow',
      pinned: false,
      source: 'microsoft-notes',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
      remoteChangeKey: 'change-key-2',
      remoteAttachmentsChangeKey: 'change-key-2',
      syncStatus: 'synced',
    }

    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path.endsWith('?$top=1')) {
        return Promise.resolve({})
      }

      if (path.includes('$select=id,subject,body')) {
        return Promise.resolve({
          value: [
            {
              id: 'remote-note-1',
              subject: 'Cached note',
              body: { content: '<p>Cached</p><img src="cid:quicknote-image-1">' },
              hasAttachments: true,
              changeKey: 'change-key-2',
            },
          ],
        })
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    const notes = await fetchRemoteNotes('access-token', [cachedNote])
    const requestedPaths = graphClientMocks.graphFetch.mock.calls.map((call) => String(call[1]))
    const cachedAttachments =
      notes[0] && 'quicknoteAttachments' in notes[0]
        ? notes[0].quicknoteAttachments
        : undefined

    expect(cachedAttachments).toEqual([cachedAttachment])
    expect(notes[0]?.quicknoteColor).toBe('yellow')
    expect(requestedPaths.some((path) => path.includes('/attachments'))).toBe(false)
    expect(requestedPaths.some((path) => path.includes(encodeURIComponent(MICROSOFT_NOTE_COLOR_PROPERTY_ID)))).toBe(true)
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })
})
