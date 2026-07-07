// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildQuickNoteTiptapExtensions } from '@/components/notes/quickNoteTiptap'

describe('quickNoteTiptap', () => {
  it('round-trips the supported common formatting set and block images', () => {
    const editor = new Editor({
      extensions: buildQuickNoteTiptapExtensions(),
      content: [
        '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <s>Strike</s></p>',
        '<blockquote><p>Quoted</p></blockquote>',
        '<ul><li><p>Bullet</p></li></ul>',
        '<ol><li><p>Number</p></li></ol>',
        '<figure data-quicknote-image="true"><img src="quicknote-asset://attachment-1" data-attachment-id="attachment-1" alt="shot.png"></figure>',
      ].join(''),
    })

    const html = editor.getHTML()

    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<em>Italic</em>')
    expect(html).toContain('<u>Underline</u>')
    expect(html).toContain('<s>Strike</s>')
    expect(html).toContain('<blockquote><p>Quoted</p></blockquote>')
    expect(html).toContain('<ul><li><p>Bullet</p></li></ul>')
    expect(html).toContain('<ol><li><p>Number</p></li></ol>')
    expect(html).toContain('<figure data-quicknote-image="true">')
    expect(html).toContain('data-attachment-id="attachment-1"')
    expect(html).toContain('src="quicknote-asset://attachment-1"')
  })

  it('accepts hydrated image html and exports canonical figure html', () => {
    const editor = new Editor({
      extensions: buildQuickNoteTiptapExtensions(),
      content:
        '<figure data-quicknote-image="true" contenteditable="false" draggable="false"><img src="data:image/png;base64,AAAA" data-attachment-id="attachment-1" alt="shot.png" draggable="false"></figure>',
    })

    const html = editor.getHTML()

    expect(html).toContain('<figure data-quicknote-image="true">')
    expect(html).toContain('data-attachment-id="attachment-1"')
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).not.toContain('contenteditable="false"')
    expect(html).not.toContain('draggable="false"')
  })
})
