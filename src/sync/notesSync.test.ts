import { beforeEach, describe, expect, it, vi } from 'vitest'

const appStateMocks = vi.hoisted(() => ({
  deleteAppStateValue: vi.fn(),
  getAppStateValue: vi.fn(),
  setAppStateValue: vi.fn(),
}))
const notesApiMocks = vi.hoisted(() => ({
  createRemoteNote: vi.fn(),
  deleteRemoteNote: vi.fn(),
  fetchRemoteNotesDelta: vi.fn(),
  updateRemoteNote: vi.fn(),
}))
const notesRepoMocks = vi.hoisted(() => ({
  applyRemoteNoteSnapshot: vi.fn(),
  applyRemoteNotesDelta: vi.fn(),
  getNoteById: vi.fn(),
  listNotes: vi.fn(),
  markNoteConflict: vi.fn(),
  removeDeletedNote: vi.fn(),
}))

vi.mock('@/db/appStateRepo', () => appStateMocks)
vi.mock('@/graph/notesApi', () => notesApiMocks)
vi.mock('@/db/notesRepo', () => notesRepoMocks)

import { GraphRequestError } from '@/graph/graphClient'
import {
  getNotesDeltaStateKey,
  isInvalidNotesDeltaError,
  pullNotes,
} from '@/sync/notesSync'

describe('pullNotes delta state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesRepoMocks.listNotes.mockResolvedValue([])
    appStateMocks.getAppStateValue.mockResolvedValue('')
  })

  it('isolates delta links by home account id', async () => {
    const result = {
      changes: [],
      removedRemoteIds: [],
      seenRemoteIds: [],
      deltaLink: 'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=new',
      initial: false,
    }
    appStateMocks.getAppStateValue.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'notesSnapshotAccountId' ? 'account-a' : 'saved-account-a-link',
      ),
    )
    notesApiMocks.fetchRemoteNotesDelta.mockResolvedValue(result)

    await pullNotes('token', 'account-a')

    expect(getNotesDeltaStateKey('account-a')).toBe('notesDeltaLink:v3:account-a')
    expect(getNotesDeltaStateKey('account-b')).toBe('notesDeltaLink:v3:account-b')
    expect(appStateMocks.getAppStateValue).toHaveBeenCalledWith(
      'notesDeltaLink:v3:account-a',
      '',
    )
    expect(notesApiMocks.fetchRemoteNotesDelta).toHaveBeenCalledWith(
      'token',
      'account-a',
      'saved-account-a-link',
      [],
    )
    expect(appStateMocks.setAppStateValue).toHaveBeenCalledWith(
      'notesDeltaLink:v3:account-a',
      result.deltaLink,
    )
  })

  it('forces a full snapshot when the visible local data belongs to another account', async () => {
    const rebuilt = {
      changes: [],
      removedRemoteIds: [],
      seenRemoteIds: [],
      deltaLink: 'account-b-rebuilt-link',
      initial: true,
    }
    appStateMocks.getAppStateValue.mockImplementation((key: string) =>
      Promise.resolve(key === 'notesSnapshotAccountId' ? 'account-a' : 'saved-account-b-link'),
    )
    notesApiMocks.fetchRemoteNotesDelta.mockResolvedValue(rebuilt)

    await pullNotes('token', 'account-b')

    expect(notesApiMocks.fetchRemoteNotesDelta).toHaveBeenCalledWith(
      'token',
      'account-b',
      undefined,
      [],
    )
    expect(notesRepoMocks.applyRemoteNotesDelta).toHaveBeenCalledWith([], [], [])
    expect(appStateMocks.setAppStateValue).toHaveBeenCalledWith(
      'notesSnapshotAccountId',
      'account-b',
    )
  })

  it('does not apply changes or advance the cursor when hydration fails', async () => {
    appStateMocks.getAppStateValue.mockImplementation((key: string) =>
      Promise.resolve(key === 'notesSnapshotAccountId' ? 'account-failure' : 'saved-link'),
    )
    notesApiMocks.fetchRemoteNotesDelta.mockRejectedValue(new Error('attachment failed'))

    await expect(pullNotes('token', 'account-failure')).rejects.toThrow('attachment failed')

    expect(notesRepoMocks.applyRemoteNotesDelta).not.toHaveBeenCalled()
    expect(appStateMocks.setAppStateValue).not.toHaveBeenCalled()
    expect(appStateMocks.deleteAppStateValue).not.toHaveBeenCalled()
  })

  it('clears an invalid token and rebuilds a full snapshot before cleanup', async () => {
    const rebuilt = {
      changes: [{ id: 'remote-note-1' }],
      removedRemoteIds: [],
      seenRemoteIds: ['remote-note-1'],
      deltaLink: 'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=rebuilt',
      initial: true,
    }
    appStateMocks.getAppStateValue.mockImplementation((key: string) =>
      Promise.resolve(key === 'notesSnapshotAccountId' ? 'account-expired' : 'expired-link'),
    )
    notesApiMocks.fetchRemoteNotesDelta
      .mockRejectedValueOnce(new GraphRequestError('SyncStateNotFound', 410))
      .mockResolvedValueOnce(rebuilt)

    await pullNotes('token', 'account-expired')

    expect(appStateMocks.deleteAppStateValue).toHaveBeenCalledWith(
      'notesDeltaLink:v3:account-expired',
    )
    expect(notesApiMocks.fetchRemoteNotesDelta).toHaveBeenNthCalledWith(
      2,
      'token',
      'account-expired',
      undefined,
      [],
    )
    expect(notesRepoMocks.applyRemoteNotesDelta).toHaveBeenCalledWith(
      rebuilt.changes,
      rebuilt.removedRemoteIds,
      rebuilt.seenRemoteIds,
    )
    expect(appStateMocks.setAppStateValue).toHaveBeenCalledWith(
      'notesDeltaLink:v3:account-expired',
      rebuilt.deltaLink,
    )
  })

  it('recognizes Graph invalid-delta responses without retrying unrelated failures', () => {
    expect(isInvalidNotesDeltaError(new GraphRequestError('gone', 410))).toBe(true)
    expect(
      isInvalidNotesDeltaError(
        new GraphRequestError('{"error":{"code":"InvalidDeltaToken"}}', 400),
      ),
    ).toBe(true)
    expect(isInvalidNotesDeltaError(new GraphRequestError('forbidden', 403))).toBe(false)
  })
})
