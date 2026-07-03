import type { LocalNote, LocalNoteAttachment } from '@/types/domain'

function buildAttachmentSignature(attachments: LocalNoteAttachment[]) {
  return attachments
    .map((attachment) => `${attachment.id}:${attachment.contentId}:${attachment.base64.length}`)
    .join('|')
}

export function buildNoteSnapshotSignature(note: Pick<LocalNote, 'id' | 'title' | 'bodyHtml' | 'attachments'>) {
  return [note.id, note.title, note.bodyHtml, buildAttachmentSignature(note.attachments ?? [])].join(
    '\u0000',
  )
}

export function buildNoteContentSignature(
  title: string,
  bodyHtml: string,
  attachments: LocalNoteAttachment[],
) {
  return [title, bodyHtml, buildAttachmentSignature(attachments)].join('\u0000')
}

export function shouldAutosaveNote(
  currentSignature: string,
  hydrationSignature: string | null,
  isHydrating: boolean,
) {
  if (isHydrating) {
    return false
  }

  if (!hydrationSignature) {
    return true
  }

  return currentSignature !== hydrationSignature
}
