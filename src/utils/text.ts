export function getExcerpt(input: string, maxLength = 120) {
  const normalized = input.replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trim()}…`
}

export function readString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

export function getWordCount(title: string, content: string) {
  return `${(title + content).replace(/\s+/g, '').length}字`
}

export function mergeNoteForRemote(title: string, content: string) {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if (!trimmedTitle) {
    return trimmedContent
  }

  if (!trimmedContent) {
    return trimmedTitle
  }

  return `${trimmedTitle}\n\n${trimmedContent}`
}

export function splitRemoteNoteContent(raw: string) {
  const normalized = raw.replace(/\r\n/g, '\n').trim()

  if (!normalized) {
    return { title: '', content: '' }
  }

  const parts = normalized.split('\n')
  const title = parts[0]?.trim() ?? ''
  const content = normalized.startsWith(title)
    ? normalized.slice(title.length).trim()
    : normalized

  return { title, content }
}
