import { describe, expect, it } from 'vitest'

import { pickRemoteNoteTemplateId } from '@/graph/noteTemplateApi'

describe('pickRemoteNoteTemplateId', () => {
  it('prefers the newest note without attachments', () => {
    expect(
      pickRemoteNoteTemplateId([
        { id: 'with-image', hasAttachments: true },
        { id: 'plain-note', hasAttachments: false },
        { id: 'older-plain-note', hasAttachments: false },
      ]),
    ).toBe('plain-note')
  })

  it('treats a missing hasAttachments field as a reusable plain template', () => {
    expect(pickRemoteNoteTemplateId([{ id: 'legacy-note' }])).toBe(
      'legacy-note',
    )
  })

  it('ignores records without an id', () => {
    expect(
      pickRemoteNoteTemplateId([
        { hasAttachments: false },
        { id: '', hasAttachments: false },
      ]),
    ).toBeUndefined()
  })
})
