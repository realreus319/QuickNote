import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NOTE_COLOR,
  migrateNoteColorState,
  normalizeNoteColor,
  noteColorFromMicrosoftFacetValue,
  noteColorFromMicrosoftValue,
  noteColorToMicrosoftFacetValue,
  noteColorToMicrosoftValue,
  resolveSyncedNoteColor,
} from '@/utils/noteColor'

describe('note colors', () => {
  it('maps the five Microsoft Sticky Note color values in both directions', () => {
    const mappings = [
      ['blue', '0'],
      ['green', '1'],
      ['pink', '2'],
      ['yellow', '3'],
      ['white', '4'],
    ] as const

    for (const [color, remoteValue] of mappings) {
      expect(noteColorToMicrosoftValue(color)).toBe(remoteValue)
      expect(noteColorFromMicrosoftValue(remoteValue)).toBe(color)
    }
  })

  it('uses yellow for missing or unsupported values', () => {
    expect(normalizeNoteColor(undefined)).toBe(DEFAULT_NOTE_COLOR)
    expect(normalizeNoteColor('purple')).toBe(DEFAULT_NOTE_COLOR)
    expect(noteColorFromMicrosoftValue('99')).toBe(DEFAULT_NOTE_COLOR)
  })

  it('maps modern Sticky Notes facet colors onto the five-color paper palette', () => {
    expect(noteColorFromMicrosoftFacetValue(0)).toBe('white')
    expect(noteColorFromMicrosoftFacetValue(1)).toBe('yellow')
    expect(noteColorFromMicrosoftFacetValue(2)).toBe('green')
    expect(noteColorFromMicrosoftFacetValue(3)).toBe('pink')
    expect(noteColorFromMicrosoftFacetValue(4)).toBe('pink')
    expect(noteColorFromMicrosoftFacetValue(5)).toBe('blue')
    expect(noteColorFromMicrosoftFacetValue(6)).toBe('white')
    expect(noteColorFromMicrosoftFacetValue(99)).toBeUndefined()
    expect(noteColorFromMicrosoftFacetValue('invalid')).toBeUndefined()

    expect(noteColorToMicrosoftFacetValue('white')).toBe(0)
    expect(noteColorToMicrosoftFacetValue('yellow')).toBe(1)
    expect(noteColorToMicrosoftFacetValue('green')).toBe(2)
    expect(noteColorToMicrosoftFacetValue('pink')).toBe(3)
    expect(noteColorToMicrosoftFacetValue('blue')).toBe(5)
  })

  it('migrates legacy remote notes to a safe yellow sync baseline', () => {
    expect(migrateNoteColorState(undefined, undefined, true)).toEqual({
      color: 'yellow',
      lastSyncedColor: 'yellow',
    })
    expect(migrateNoteColorState('invalid', 'invalid', true)).toEqual({
      color: 'yellow',
      lastSyncedColor: 'yellow',
    })
  })

  it('does not invent a remote baseline for a local-only legacy note', () => {
    expect(migrateNoteColorState(undefined, undefined, false)).toEqual({
      color: 'yellow',
      lastSyncedColor: undefined,
    })
  })

  it('accepts remote color when local color is unchanged from its baseline', () => {
    expect(resolveSyncedNoteColor('yellow', 'yellow', 'green')).toBe('green')
  })

  it('keeps an explicitly changed local color when the remote color also changed', () => {
    expect(resolveSyncedNoteColor('yellow', 'blue', 'pink')).toBe('blue')
  })
})
