// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import {
  buildNoteContentSignature,
  buildNoteSnapshotSignature,
  shouldAutosaveNote,
} from '@/utils/noteHydration'
import type { LocalNoteAttachment } from '@/types/domain'

function makeAttachment(overrides: Partial<LocalNoteAttachment> = {}): LocalNoteAttachment {
  return {
    id: 'attachment-1',
    name: 'image.png',
    mimeType: 'image/png',
    size: 3,
    base64: 'AAA',
    contentId: 'cid-1',
    createdAt: '2026-07-02T00:00:00Z',
    ...overrides,
  }
}

describe('noteHydration', () => {
  it('includes the note id in the snapshot signature', () => {
    const attachments = [makeAttachment()]
    const noteSnapshot = buildNoteSnapshotSignature({
      id: 'note-1',
      title: '测试',
      bodyHtml: '<p>hello</p>',
      attachments,
    })
    const differentSnapshot = buildNoteSnapshotSignature({
      id: 'note-2',
      title: '测试',
      bodyHtml: '<p>hello</p>',
      attachments,
    })

    expect(noteSnapshot).not.toBe(differentSnapshot)
  })

  it('matches the hydrated editor state signature', () => {
    const attachments = [makeAttachment()]
    const hydratedSignature = buildNoteContentSignature('测试', '<p>hello</p>', attachments)

    expect(shouldAutosaveNote(hydratedSignature, hydratedSignature, false)).toBe(false)
  })

  it('blocks autosave while the note is still hydrating', () => {
    const attachments = [makeAttachment()]
    const noteSnapshot = buildNoteSnapshotSignature({
      id: 'note-1',
      title: '测试',
      bodyHtml: '<p>hello</p>',
      attachments,
    })

    expect(
      shouldAutosaveNote(
        buildNoteContentSignature('', '<p></p>', []),
        noteSnapshot,
        true,
      ),
    ).toBe(false)
  })

  it('allows autosave after the user changes the hydrated content', () => {
    const attachments = [makeAttachment()]
    const noteSnapshot = buildNoteSnapshotSignature({
      id: 'note-1',
      title: '测试',
      bodyHtml: '<p>hello</p>',
      attachments,
    })

    expect(
      shouldAutosaveNote(
        buildNoteContentSignature('测试', '<p>hello <strong>world</strong></p>', attachments),
        noteSnapshot,
        false,
      ),
    ).toBe(true)
  })
})
