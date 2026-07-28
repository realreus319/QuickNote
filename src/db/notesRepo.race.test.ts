// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  transaction: vi.fn(
    async (
      _mode: string,
      _notes: unknown,
      _blobs: unknown,
      callback: () => Promise<unknown>,
    ) => callback(),
  ),
}))

const attachmentMocks = vi.hoisted(() => ({
  deleteNoteAttachmentBlobs: vi.fn(),
  enforceAttachmentCacheBudget: vi.fn(),
  hydrateNoteAttachmentBlobs: vi.fn(),
  persistNoteAttachmentBlobs: vi.fn(),
  stripAttachmentBytes: vi.fn((attachments: Array<Record<string, unknown>>) =>
    attachments.map((attachment) => ({
      ...attachment,
      base64: undefined,
    })),
  ),
}))

vi.mock('@/db/db', () => ({
  db: {
    notes: {
      get: dbMocks.get,
      put: dbMocks.put,
    },
    noteAttachmentBlobs: {},
    pendingOperations: {},
    transaction: dbMocks.transaction,
  },
}))
vi.mock('@/db/attachmentBlobRepo', () => attachmentMocks)
vi.mock('@/db/pendingRepo', () => ({
  enqueuePendingOperation: vi.fn(),
}))

import { applyRemoteNoteSnapshot } from '@/db/notesRepo'
import type { LocalNote } from '@/types/domain'

function makeNote(overrides: Partial<LocalNote> = {}): LocalNote {
  return {
    id: 'note-1',
    ownerKey: 'account-a',
    remoteId: 'remote-1',
    title: 'Local title',
    content: 'new local edit',
    bodyHtml: '<p>new local edit</p>',
    attachments: [],
    color: 'yellow',
    pinned: false,
    source: 'microsoft-notes',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:02:00.000Z',
    localRevision: 2,
    syncedRevision: 0,
    syncStatus: 'pending',
    ...overrides,
  }
}

const remoteSnapshot = {
  remoteId: 'remote-1',
  title: 'Old uploaded title',
  content: 'old uploaded body',
  bodyHtml: '<p>old uploaded body</p>',
  lastSyncedBodyHtml: '<p>old uploaded body</p>',
  attachments: [],
  color: 'green' as const,
  remoteChangeKey: 'change-2',
}

describe('applyRemoteNoteSnapshot revision guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves a newer local edit when an older sync response arrives', async () => {
    dbMocks.get.mockResolvedValue(makeNote())

    await applyRemoteNoteSnapshot(
      'note-1',
      remoteSnapshot,
      1,
      'account-a',
    )

    expect(dbMocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Local title',
        bodyHtml: '<p>new local edit</p>',
        content: 'new local edit',
        localRevision: 2,
        syncedRevision: 1,
        syncStatus: 'pending',
      }),
    )
  })

  it('applies the remote snapshot when no newer local revision exists', async () => {
    dbMocks.get.mockResolvedValue(
      makeNote({
        localRevision: 1,
        syncedRevision: 0,
      }),
    )

    await applyRemoteNoteSnapshot(
      'note-1',
      remoteSnapshot,
      1,
      'account-a',
    )

    expect(dbMocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Old uploaded title',
        bodyHtml: '<p>old uploaded body</p>',
        content: 'old uploaded body',
        syncedRevision: 1,
        syncStatus: 'synced',
      }),
    )
  })

  it('ignores a snapshot for another account', async () => {
    dbMocks.get.mockResolvedValue(makeNote({ ownerKey: 'account-b' }))

    await applyRemoteNoteSnapshot(
      'note-1',
      remoteSnapshot,
      1,
      'account-a',
    )

    expect(dbMocks.put).not.toHaveBeenCalled()
    expect(attachmentMocks.persistNoteAttachmentBlobs).not.toHaveBeenCalled()
  })
})
