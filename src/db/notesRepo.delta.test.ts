// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => {
  const records = new Map<string, object>()
  const notes = {
    toArray: vi.fn(() => Promise.resolve([...records.values()])),
    bulkDelete: vi.fn((ids: string[]) => {
      for (const id of ids) records.delete(id)
      return Promise.resolve()
    }),
    bulkPut: vi.fn((items: Array<{ id: string }>) => {
      for (const item of items) records.set(item.id, item)
      return Promise.resolve()
    }),
  }
  const transaction = vi.fn(
    (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
  )

  return { notes, records, transaction }
})

vi.mock('@/db/db', () => ({
  db: {
    notes: dbMocks.notes,
    transaction: dbMocks.transaction,
  },
}))
vi.mock('@/db/pendingRepo', () => ({
  enqueuePendingOperation: vi.fn(),
}))

import { applyRemoteNotesDelta } from '@/db/notesRepo'
import type { LocalNote } from '@/types/domain'

function makeLocalNote(id: string, remoteId?: string): LocalNote {
  return {
    id,
    remoteId,
    title: id,
    content: '',
    bodyHtml: '<p></p>',
    attachments: [],
    color: 'yellow',
    pinned: false,
    source: remoteId ? 'microsoft-notes' : 'local',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    syncStatus: 'synced',
  }
}

function makeRemoteChange(id: string, subject: string) {
  return {
    id,
    subject,
    body: { content: `<p>${subject}</p>` },
    quicknoteRichHtml: `<p>${subject}</p>`,
    quicknoteAttachments: [],
    quicknoteAttachmentsChangeKey: `change-${id}`,
    quicknoteColor: 'green',
    createdDateTime: '2026-07-20T00:00:00.000Z',
    lastModifiedDateTime: '2026-07-20T01:00:00.000Z',
    changeKey: `change-${id}`,
  }
}

describe('applyRemoteNotesDelta', () => {
  beforeEach(() => {
    dbMocks.records.clear()
    vi.clearAllMocks()
  })

  it('upserts changed and new notes while deleting removed remote notes', async () => {
    dbMocks.records.set('local-existing', makeLocalNote('local-existing', 'remote-existing'))
    dbMocks.records.set('local-deleted', makeLocalNote('local-deleted', 'remote-deleted'))
    dbMocks.records.set('local-only', makeLocalNote('local-only'))

    await applyRemoteNotesDelta(
      [
        makeRemoteChange('remote-existing', 'Updated title'),
        makeRemoteChange('remote-new', 'New title'),
      ],
      ['remote-deleted'],
    )

    const notes = [...dbMocks.records.values()] as unknown as LocalNote[]

    expect(notes.find((note) => note.remoteId === 'remote-existing')).toMatchObject({
      id: 'local-existing',
      title: 'Updated title',
      color: 'green',
    })
    expect(notes.find((note) => note.remoteId === 'remote-new')).toMatchObject({
      title: 'New title',
    })
    expect(notes.some((note) => note.remoteId === 'remote-deleted')).toBe(false)
    expect(notes.some((note) => note.id === 'local-only')).toBe(true)
  })

  it('reconciles obsolete remote notes only for a completed full snapshot', async () => {
    dbMocks.records.set('local-obsolete', makeLocalNote('local-obsolete', 'remote-obsolete'))
    dbMocks.records.set('local-only', makeLocalNote('local-only'))

    await applyRemoteNotesDelta(
      [makeRemoteChange('remote-current', 'Current')],
      [],
      ['remote-current'],
    )

    const notes = [...dbMocks.records.values()] as unknown as LocalNote[]

    expect(notes.some((note) => note.remoteId === 'remote-obsolete')).toBe(false)
    expect(notes.some((note) => note.remoteId === 'remote-current')).toBe(true)
    expect(notes.some((note) => note.id === 'local-only')).toBe(true)
  })
})
