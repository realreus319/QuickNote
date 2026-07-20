import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const noteMasonryPath = resolve(process.cwd(), 'src/components/notes/NoteMasonry.tsx')

describe('NoteMasonry layout', () => {
  it('uses a multi-column flow so shorter cards do not inherit a taller row height', () => {
    const source = readFileSync(noteMasonryPath, 'utf8')

    expect(source).toContain('columns-2')
    expect(source).toContain('xl:columns-3')
    expect(source).toContain('break-inside-avoid')
    expect(source).not.toContain('grid-cols-2')
  })
})
