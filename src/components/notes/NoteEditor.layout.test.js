import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const noteEditorPath = resolve(process.cwd(), 'src/components/notes/NoteEditor.tsx')

describe('NoteEditor layout', () => {
  it('keeps the toolbar responsive and sticky on larger screens', () => {
    const source = readFileSync(noteEditorPath, 'utf8')

    expect(source).toContain('md:sticky md:top-4')
    expect(source).toContain('placeholder="标题"')
    expect(source).toContain('formatLongDate(updatedAt)')
  })
})
