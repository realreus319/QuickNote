import type { LocalNote, NoteColor } from '@/types/domain'

export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow'

export const NOTE_COLOR_OPTIONS: ReadonlyArray<{
  value: NoteColor
  label: string
}> = [
  { value: 'yellow', label: '黄色' },
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'pink', label: '粉色' },
  { value: 'white', label: '白色' },
]

const microsoftValueByColor: Record<NoteColor, string> = {
  blue: '0',
  green: '1',
  pink: '2',
  yellow: '3',
  white: '4',
}

const colorByMicrosoftValue = new Map(
  Object.entries(microsoftValueByColor).map(([color, value]) => [value, color as NoteColor]),
)

export function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLOR_OPTIONS.some((option) => option.value === value)
}

export function normalizeNoteColor(value: unknown): NoteColor {
  return isNoteColor(value) ? value : DEFAULT_NOTE_COLOR
}

export function migrateNoteColorState(
  color: unknown,
  lastSyncedColor: unknown,
  hasRemoteCopy: boolean,
): Pick<LocalNote, 'color' | 'lastSyncedColor'> {
  return {
    color: normalizeNoteColor(color),
    lastSyncedColor: hasRemoteCopy
      ? normalizeNoteColor(lastSyncedColor)
      : isNoteColor(lastSyncedColor)
        ? lastSyncedColor
        : undefined,
  }
}

export function noteColorFromMicrosoftValue(value: unknown): NoteColor {
  const normalizedValue =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''

  return colorByMicrosoftValue.get(normalizedValue) ?? DEFAULT_NOTE_COLOR
}

export function noteColorToMicrosoftValue(color: NoteColor): string {
  return microsoftValueByColor[color]
}

export function resolveSyncedNoteColor(
  baseline: NoteColor | undefined,
  local: NoteColor,
  remote: NoteColor,
): NoteColor {
  return local === (baseline ?? local) ? remote : local
}

export function getNoteColorLabel(color: NoteColor) {
  return NOTE_COLOR_OPTIONS.find((option) => option.value === color)?.label ?? '黄色'
}
