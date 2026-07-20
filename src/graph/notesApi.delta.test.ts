// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const graphClientMocks = vi.hoisted(() => ({
  graphFetch: vi.fn(),
  graphFetchBlob: vi.fn(),
}))

vi.mock('@/graph/graphClient', () => graphClientMocks)

import {
  fetchRemoteNotesDelta,
  MICROSOFT_NOTE_COLOR_PROPERTY_ID,
  updateRemoteNote,
} from '@/graph/notesApi'
import type { LocalNote } from '@/types/domain'

function makeMessage(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject: `Note ${id}`,
    body: { content: `<p>${id}</p>` },
    bodyPreview: id,
    createdDateTime: '2026-07-20T00:00:00.000Z',
    lastModifiedDateTime: '2026-07-20T00:00:00.000Z',
    hasAttachments: false,
    changeKey: `change-${id}`,
    ...overrides,
  }
}

describe('fetchRemoteNotesDelta', () => {
  beforeEach(() => {
    graphClientMocks.graphFetch.mockReset()
    graphClientMocks.graphFetchBlob.mockReset()
  })

  it('follows every initial page and imports more than 100 notes', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => makeMessage(`note-${index}`))
    const nextLink = 'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=page-2'
    const deltaLink = 'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=done'

    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path.endsWith('/notes/messages?$top=1')) {
        return Promise.resolve({})
      }

      if (path.includes('/messages/delta?') && path.includes('$select=')) {
        return Promise.resolve({
          value: firstPage,
          '@odata.nextLink': nextLink,
        })
      }

      if (path === nextLink) {
        return Promise.resolve({
          value: [makeMessage('note-100')],
          '@odata.deltaLink': deltaLink,
        })
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    const result = await fetchRemoteNotesDelta('token', 'account-full', undefined)

    expect(result.initial).toBe(true)
    expect(result.changes).toHaveLength(101)
    expect(result.seenRemoteIds).toHaveLength(101)
    expect(result.deltaLink).toBe(deltaLink)
    expect(graphClientMocks.graphFetch).toHaveBeenCalledTimes(3)
  })

  it('uses one empty delta request when nothing changed', async () => {
    const savedDeltaLink =
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=previous'
    const nextDeltaLink =
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=current'

    graphClientMocks.graphFetch.mockResolvedValue({
      value: [],
      '@odata.deltaLink': nextDeltaLink,
    })

    const result = await fetchRemoteNotesDelta(
      'token',
      'account-incremental',
      savedDeltaLink,
    )

    expect(result).toMatchObject({
      changes: [],
      removedRemoteIds: [],
      initial: false,
      deltaLink: nextDeltaLink,
    })
    expect(graphClientMocks.graphFetch).toHaveBeenCalledOnce()
    expect(graphClientMocks.graphFetch).toHaveBeenCalledWith(
      'token',
      savedDeltaLink,
      expect.any(Object),
    )
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })

  it('keeps Notes folder discovery cached per account', async () => {
    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path.endsWith('/notes/messages?$top=1')) {
        return Promise.resolve({})
      }

      if (path.includes('/notes/messages/delta?')) {
        return Promise.resolve({
          value: [],
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=account',
        })
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    await fetchRemoteNotesDelta('token', 'folder-account-one', undefined)
    await fetchRemoteNotesDelta('token', 'folder-account-two', undefined)

    const folderProbes = graphClientMocks.graphFetch.mock.calls.filter((call) =>
      String(call[1]).endsWith('/notes/messages?$top=1'),
    )

    expect(folderProbes).toHaveLength(2)
  })

  it('fetches a single detail record only when a delta item is incomplete', async () => {
    const savedDeltaLink =
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=partial'

    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path === savedDeltaLink) {
        return Promise.resolve({
          value: [{ id: 'partial-note', subject: 'Partial' }],
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=complete',
        })
      }

      if (path.includes('/me/messages/partial-note?')) {
        return Promise.resolve(makeMessage('partial-note', { subject: 'Complete' }))
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    const result = await fetchRemoteNotesDelta(
      'token',
      'account-partial',
      savedDeltaLink,
    )

    expect(result.changes[0]?.subject).toBe('Complete')
    expect(graphClientMocks.graphFetch).toHaveBeenCalledTimes(2)
  })

  it('returns updates and removals from an incremental page', async () => {
    graphClientMocks.graphFetch.mockResolvedValue({
      value: [
        makeMessage('changed-note', { subject: 'Changed' }),
        { id: 'deleted-note', '@removed': { reason: 'deleted' } },
      ],
      '@odata.deltaLink':
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=next',
    })

    const result = await fetchRemoteNotesDelta(
      'token',
      'account-changes',
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=old',
    )

    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]?.subject).toBe('Changed')
    expect(result.removedRemoteIds).toEqual(['deleted-note'])
  })

  it('reuses matching cached image bytes when only note fields changed', async () => {
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
    const cachedNote = {
      id: 'local-note-1',
      remoteId: 'remote-note-1',
      title: 'Before',
      content: '',
      bodyHtml: '<p>Cached</p>',
      attachments: [cachedAttachment],
      color: 'yellow',
      pinned: false,
      source: 'microsoft-notes',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
      remoteChangeKey: 'old-change',
      remoteAttachmentsChangeKey: 'old-change',
      syncStatus: 'synced',
    } satisfies LocalNote

    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path.includes('/messages/delta?')) {
        return Promise.resolve({
          value: [
            makeMessage('remote-note-1', {
              subject: 'Title changed',
              body: { content: '<p>Cached</p><img src="cid:quicknote-image-1">' },
              hasAttachments: true,
              changeKey: 'new-change',
            }),
          ],
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=next',
        })
      }

      if (path.includes('/attachments?$select=')) {
        return Promise.resolve({
          value: [
            {
              id: 'remote-image-1',
              name: 'image.png',
              contentType: 'image/png',
              size: 3,
              contentId: 'quicknote-image-1',
              isInline: true,
            },
          ],
        })
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    const result = await fetchRemoteNotesDelta(
      'token',
      'account-attachments',
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=old',
      [cachedNote],
    )
    const requestedPaths = graphClientMocks.graphFetch.mock.calls.map((call) => String(call[1]))
    const attachments = result.changes[0]?.quicknoteAttachments

    expect(attachments).toEqual([
      expect.objectContaining({
        remoteId: 'remote-image-1',
        base64: 'AAA',
      }),
    ])
    expect(
      requestedPaths.some(
        (path) => path.includes('/attachments/') || path.endsWith('/$value'),
      ),
    ).toBe(false)
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })

  it('fails the delta round when attachment hydration fails', async () => {
    const savedDeltaLink =
      'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=attachments'

    graphClientMocks.graphFetch.mockImplementation((_accessToken, path: string) => {
      if (path === savedDeltaLink) {
        return Promise.resolve({
          value: [
            makeMessage('remote-note-failure', {
              body: { content: '<img src="cid:image-failure">' },
              hasAttachments: true,
            }),
          ],
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=uncommitted',
        })
      }

      if (path.includes('/attachments?$select=')) {
        return Promise.reject(new Error('attachment list failed'))
      }

      throw new Error(`Unexpected Graph request: ${path}`)
    })

    await expect(
      fetchRemoteNotesDelta('token', 'account-attachment-failure', savedDeltaLink),
    ).rejects.toThrow('attachment list failed')

    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })

  it('updates only color without downloading an unchanged image again', async () => {
    const richHtmlPropertyId =
      'String {66f5a359-4659-4830-9070-00040ec6ac6e} Name QuickNoteRichHtml'
    const storedHtml =
      '<p>Cached</p><figure><img src="quicknote-asset://local-image-1" data-attachment-id="local-image-1"></figure>'
    const remoteHtml = '<p>Cached</p><figure><img src="cid:quicknote-image-1"></figure>'
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
    const note = {
      id: 'local-note-1',
      remoteId: 'remote-note-1',
      title: 'Color only',
      content: 'Cached',
      bodyHtml: storedHtml,
      attachments: [cachedAttachment],
      color: 'blue',
      pinned: false,
      source: 'microsoft-notes',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
      lastSyncedTitle: 'Color only',
      lastSyncedBodyHtml: storedHtml,
      lastSyncedColor: 'yellow',
      remoteChangeKey: 'old-change',
      remoteAttachmentsChangeKey: 'old-change',
      syncStatus: 'pending',
    } satisfies LocalNote
    let detailRequestCount = 0
    let patchBody: Record<string, unknown> | undefined

    graphClientMocks.graphFetch.mockImplementation(
      (_accessToken, path: string, init?: RequestInit) => {
        if (path.includes('/me/messages/remote-note-1?')) {
          detailRequestCount += 1
          return Promise.resolve(
            makeMessage('remote-note-1', {
              subject: 'Color only',
              body: { content: remoteHtml },
              hasAttachments: true,
              changeKey: detailRequestCount === 1 ? 'old-change' : 'new-change',
              singleValueExtendedProperties: [
                { id: richHtmlPropertyId, value: storedHtml },
                {
                  id: MICROSOFT_NOTE_COLOR_PROPERTY_ID,
                  value: detailRequestCount === 1 ? '3' : '0',
                },
              ],
            }),
          )
        }

        if (path.endsWith('/me/messages/remote-note-1') && init?.method === 'PATCH') {
          if (typeof init.body !== 'string') {
            throw new Error('Expected a JSON request body')
          }

          patchBody = JSON.parse(init.body) as Record<string, unknown>
          return Promise.resolve({})
        }

        if (path.includes('/attachments?$select=')) {
          return Promise.resolve({
            value: [
              {
                id: 'remote-image-1',
                name: 'image.png',
                contentType: 'image/png',
                size: 3,
                contentId: 'quicknote-image-1',
                isInline: true,
              },
            ],
          })
        }

        throw new Error(`Unexpected Graph request: ${path}`)
      },
    )

    const snapshot = await updateRemoteNote('token', note)
    const requestedPaths = graphClientMocks.graphFetch.mock.calls.map((call) => String(call[1]))

    expect(snapshot.color).toBe('blue')
    expect(Object.keys(patchBody ?? {})).toEqual(['singleValueExtendedProperties'])
    expect(patchBody?.singleValueExtendedProperties).toEqual([
      {
        id: MICROSOFT_NOTE_COLOR_PROPERTY_ID,
        value: '0',
      },
    ])
    expect(
      requestedPaths.some(
        (path) => path.includes('/attachments/') || path.endsWith('/$value'),
      ),
    ).toBe(false)
    expect(graphClientMocks.graphFetchBlob).not.toHaveBeenCalled()
  })
})
