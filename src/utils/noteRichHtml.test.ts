// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { LocalNoteAttachment } from '@/types/domain'
import {
  convertRemoteNoteHtmlToStoredHtml,
  hydrateLocalNoteHtml,
  isStoredNoteHtmlInSync,
  mergeRichHtmlBodies,
  prepareRemoteNoteHtml,
  storeEditorNoteHtml,
} from '@/utils/noteRichHtml'

const attachment: LocalNoteAttachment = {
  id: 'attachment-1',
  remoteId: 'remote-1',
  name: 'shot.png',
  mimeType: 'image/png',
  size: 4,
  base64: 'AAAA',
  contentId: 'cid-1',
  createdAt: '2026-07-02T10:00:00.000Z',
}

describe('noteRichHtml', () => {
  it('hydrates stored asset urls into displayable data urls', () => {
    const storedHtml =
      '<p>Hello</p><figure data-quicknote-image="true"><img src="quicknote-asset://attachment-1" data-attachment-id="attachment-1" alt="shot.png"></figure>'

    const hydrated = hydrateLocalNoteHtml(storedHtml, [attachment])

    expect(hydrated).toContain('data:image/png;base64,AAAA')
    expect(hydrated).toContain('data-attachment-id="attachment-1"')
  })

  it('hydrates stale cid-based local html into displayable data urls', () => {
    const hydrated = hydrateLocalNoteHtml(
      '<p>Hello</p><figure data-quicknote-image="true"><img src="cid:cid-1" alt="shot.png"></figure>',
      [
        {
          ...attachment,
          contentId: '<cid-1>',
        },
      ],
    )

    expect(hydrated).toContain('data:image/png;base64,AAAA')
    expect(hydrated).toContain('data-attachment-id="attachment-1"')
  })

  it('stores editor html back to quicknote asset urls', () => {
    const editorHtml =
      '<p>Hello</p><figure data-quicknote-image="true"><img src="data:image/png;base64,AAAA" data-attachment-id="attachment-1" alt="shot.png"></figure>'

    const stored = storeEditorNoteHtml(editorHtml, [attachment])

    expect(stored).toContain('quicknote-asset://attachment-1')
    expect(stored).not.toContain('data:image/png;base64,AAAA')
  })

  it('treats hydrated image editor html as synced with the stored html', () => {
    const storedHtml =
      '<p>Hello</p><figure data-quicknote-image="true"><img src="quicknote-asset://attachment-1" data-attachment-id="attachment-1" alt="shot.png"></figure>'
    const hydratedHtml = hydrateLocalNoteHtml(storedHtml, [attachment])

    expect(isStoredNoteHtmlInSync(hydratedHtml, storedHtml, [attachment])).toBe(true)
  })

  it('prepares remote html with cid references', () => {
    const storedHtml =
      '<p>Hello</p><figure data-quicknote-image="true"><img src="quicknote-asset://attachment-1" data-attachment-id="attachment-1" alt="shot.png"></figure>'

    const remote = prepareRemoteNoteHtml(storedHtml, [attachment])

    expect(remote).toContain('src="cid:cid-1"')
    expect(remote).not.toContain('quicknote-asset://')
  })

  it('maps remote cid images back to local assets when attachment content ids contain angle brackets', () => {
    const stored = convertRemoteNoteHtmlToStoredHtml(
      '<p>Hello</p><figure><img src="cid:cid-1" alt="shot.png"></figure>',
      [
        {
          ...attachment,
          contentId: '<cid-1>',
        },
      ],
    )

    expect(stored).toContain('quicknote-asset://attachment-1')
    expect(stored).toContain('data-attachment-id="attachment-1"')
  })

  it('keeps remote image attachments that are not referenced in the source html', () => {
    const stored = convertRemoteNoteHtmlToStoredHtml(
      [
        '<p>Hello</p>',
        '<figure><img src="cid:cid-1" alt="shot.png"></figure>',
        '<figure><img src="cid:cid-2" alt="shot-2.png"></figure>',
      ].join(''),
      [
        {
          ...attachment,
          id: 'attachment-1',
          contentId: 'cid-1',
        },
        {
          ...attachment,
          id: 'attachment-2',
          contentId: 'cid-2',
        },
        {
          ...attachment,
          id: 'attachment-3',
          contentId: 'cid-3',
          name: 'shot-3.png',
        },
      ],
    )

    expect(stored).toContain('quicknote-asset://attachment-1')
    expect(stored).toContain('quicknote-asset://attachment-2')
    expect(stored).toContain('quicknote-asset://attachment-3')
    expect(stored.indexOf('quicknote-asset://attachment-3')).toBeGreaterThan(
      stored.indexOf('quicknote-asset://attachment-2'),
    )
  })

  it('merges local html edits onto a newer remote html baseline', () => {
    const base = '<p>Hello world</p>'
    const local = '<p>Hello brave world</p>'
    const remote = '<p>Hello world!</p>'

    const merged = mergeRichHtmlBodies(base, local, remote)

    expect(merged).toBe('<p>Hello brave world!</p>')
  })

  it('preserves strong and em tags during remote round trip', () => {
    const storedHtml = '<p><strong>Bold</strong> and <em>italic</em></p>'

    const remoteHtml = prepareRemoteNoteHtml(storedHtml, [])
    const storedAgain = convertRemoteNoteHtmlToStoredHtml(remoteHtml, [])

    expect(remoteHtml).toContain('<strong>Bold</strong>')
    expect(remoteHtml).toContain('<em>italic</em>')
    expect(storedAgain).toContain('<strong>Bold</strong>')
    expect(storedAgain).toContain('<em>italic</em>')
  })

  it('normalizes styled spans from remote html into semantic rich-text tags', () => {
    const stored = convertRemoteNoteHtmlToStoredHtml(
      [
        '<p>',
        '<span style="font-weight: 700;">Bold</span>',
        ' ',
        '<span style="font-style: italic;">Italic</span>',
        ' ',
        '<span style="text-decoration: underline line-through;">Decorated</span>',
        '</p>',
      ].join(''),
      [],
    )

    expect(stored).toContain('<strong>Bold</strong>')
    expect(stored).toContain('<em>Italic</em>')
    expect(stored).toContain('Decorated')
    expect(stored).not.toContain('font-weight: 700')
    expect(stored).not.toContain('font-style: italic')
    expect(stored).not.toContain('text-decoration: underline line-through')
  })
})
