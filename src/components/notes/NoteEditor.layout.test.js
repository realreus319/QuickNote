import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const noteEditorPath = resolve(process.cwd(), 'src/components/notes/NoteEditor.tsx')

describe('NoteEditor layout', () => {
  it('keeps the toolbar title and metadata together in a sticky top section', () => {
    const source = readFileSync(noteEditorPath, 'utf8')

    expect(source).toContain("sticky top-0")
    expect(source).toContain('placeholder="标题"')
    expect(source).toContain('formatLongDate(updatedAt)')
  })
})
