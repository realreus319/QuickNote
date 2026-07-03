const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
})

const longDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function toIsoNow() {
  return new Date().toISOString()
}

export function formatNoteDate(value?: string) {
  if (!value) return '刚刚'

  return shortDateFormatter.format(new Date(value))
}

export function formatLongDate(value?: string) {
  if (!value) return '未同步'

  return longDateFormatter.format(new Date(value))
}

export function isToday(value?: string) {
  if (!value) return false

  const target = new Date(value)
  const now = new Date()

  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  )
}
