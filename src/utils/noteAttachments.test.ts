// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { LocalNoteAttachment } from '@/types/domain'
import {
  buildRemoteNoteBodyHtml,
  extractLocalNoteContentFromHtml,
  sortAttachmentsByBodyOrder,
} from '@/utils/noteAttachments'

const attachments: LocalNoteAttachment[] = [
  {
    id: 'local-1',
    name: 'alpha.png',
    mimeType: 'image/png',
    size: 4,
    base64: 'AAAA',
    contentId: 'quicknote-alpha',
    createdAt: '2026-07-02T10:00:00.000Z',
  },
  {
    id: 'local-2',
    name: 'beta.png',
    mimeType: 'image/png',
    size: 4,
    base64: 'BBBB',
    contentId: 'quicknote-beta',
    createdAt: '2026-07-02T10:01:00.000Z',
  },
]

describe('buildRemoteNoteBodyHtml', () => {
  it('renders escaped note text and cid-based inline images', () => {
    const html = buildRemoteNoteBodyHtml('First line\n<script>alert(1)</script>', attachments)

    expect(html).toContain('First line<br />')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('src="cid:quicknote-alpha"')
    expect(html).toContain('src="cid:quicknote-beta"')
    expect(html).toContain('data-quicknote-image="true"')
  })
})

describe('extractLocalNoteContentFromHtml', () => {
  it('restores plain text without inline image markup', () => {
    const html = `
      <p>Alpha<br />Beta</p>
      <figure data-quicknote-image="true">
        <img src="cid:quicknote-alpha" alt="alpha.png" />
      </figure>
      <p>Gamma</p>
    `

    expect(extractLocalNoteContentFromHtml(html)).toBe('Alpha\nBeta\nGamma')
  })
})

describe('sortAttachmentsByBodyOrder', () => {
  it('orders attachments by cid occurrence in the body html', () => {
    const html = `
      <figure data-quicknote-image="true"><img src="cid:quicknote-beta" /></figure>
      <figure data-quicknote-image="true"><img src="cid:quicknote-alpha" /></figure>
    `

    expect(sortAttachmentsByBodyOrder(attachments, html).map((item) => item.contentId)).toEqual([
      'quicknote-beta',
      'quicknote-alpha',
    ])
  })
})
