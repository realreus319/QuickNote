import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const stylesPath = resolve(process.cwd(), 'src/styles.css')

describe('note rich editor list styles', () => {
  it('restores bullet and ordered list markers inside the editor', () => {
    const stylesheet = readFileSync(stylesPath, 'utf8')

    expect(stylesheet).toMatch(/\.note-rich-editor ul\s*\{[\s\S]*list-style-type:\s*disc;/)
    expect(stylesheet).toMatch(/\.note-rich-editor ol\s*\{[\s\S]*list-style-type:\s*decimal;/)
  })
})
