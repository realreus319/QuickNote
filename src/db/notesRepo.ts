import { db } from '@/db/db'
import { enqueuePendingOperation } from '@/db/pendingRepo'
import type { LocalNote, LocalNoteAttachment } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'
import {
  convertRemoteNoteHtmlToStoredHtml,
  derivePlainTextFromStoredHtml,
  pruneAttachmentsForStoredHtml,
} from '@/utils/noteRichHtml'
import { readString, splitRemoteNoteContent } from '@/utils/text'

export const NOTE_TAGS = ['全部', '通话笔记', '未分类', '工作', '个人']

function sortNotes(notes: LocalNote[]) {
  return notes.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export async function listNotes() {
  return sortNotes((await db.notes.toArray()).filter((note) => !note.deleted))
}

export async function removeLegacyDemoNotes() {
  const demoIds = (await db.notes.toArray())
    .filter((note) => note.id.startsWith('demo-note-'))
    .map((note) => note.id)

  if (demoIds.length) {
    await db.notes.bulkDelete(demoIds)
  }
}

export async function getNoteById(noteId: string) {
  return db.notes.get(noteId)
}

export async function createNote() {
  const now = toIsoNow()
  const note: LocalNote = {
    id: generateLocalId('note'),
    title: '',
    content: '',
    bodyHtml: '<p></p>',
    attachments: [],
    tags: ['未分类'],
    pinned: false,
    source: 'local',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }

  await db.notes.put(note)
  await enqueuePendingOperation('note', 'create', note.id, note as unknown as Record<string, unknown>)

  return note
}

export async function updateNote(
  noteId: string,
  patch: Partial<Pick<LocalNote, 'title' | 'bodyHtml' | 'tags' | 'pinned' | 'attachments'>>,
) {
  const current = await db.notes.get(noteId)

  if (!current) return

  const nextBodyHtml = patch.bodyHtml ?? current.bodyHtml
  const nextAttachments = pruneAttachmentsForStoredHtml(
    patch.attachments ?? current.attachments,
    nextBodyHtml,
  )

  const next: LocalNote = {
    ...current,
    ...patch,
    bodyHtml: nextBodyHtml,
    attachments: nextAttachments,
    content: derivePlainTextFromStoredHtml(nextBodyHtml),
    updatedAt: toIsoNow(),
    syncStatus: 'pending',
  }

  await db.notes.put(next)
  await enqueuePendingOperation(
    'note',
    current.remoteId ? 'update' : 'create',
    noteId,
    next as unknown as Record<string, unknown>,
  )

  return next
}

export async function deleteNote(noteId: string) {
  const current = await db.notes.get(noteId)

  if (!current) return

  await db.notes.put({
    ...current,
    deleted: true,
    updatedAt: toIsoNow(),
    syncStatus: 'pending',
  })

  await enqueuePendingOperation('note', 'delete', noteId, {
    id: noteId,
    remoteId: current.remoteId,
  })
}

export async function searchNotes(query: string) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) return []

  return (await listNotes()).filter((note) => {
    const haystack = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase()

    return haystack.includes(normalized)
  })
}

export async function syncRemoteNotes(notes: Array<Record<string, unknown>>) {
  const now = toIsoNow()
  const currentByRemoteId = new Map(
    (await db.notes.toArray())
      .filter((note) => note.remoteId)
      .map((note) => [note.remoteId as string, note]),
  )

  const mapped: LocalNote[] = notes.map((item) => {
    const remoteId = readString(item.id)
    const existing = currentByRemoteId.get(remoteId)
    const bodyRecord =
      item.body && typeof item.body === 'object'
        ? (item.body as { content?: string })
        : undefined
    const richHtml =
      typeof item.quicknoteRichHtml === 'string'
        ? item.quicknoteRichHtml
        : bodyRecord?.content
          ? String(bodyRecord.content)
          : undefined
    const remoteTitle = readString(item.subject)
    const remoteAttachments = Array.isArray(item.quicknoteAttachments)
      ? (item.quicknoteAttachments as LocalNoteAttachment[])
      : existing?.attachments ?? []
    const storedBodyHtml = richHtml
      ? convertRemoteNoteHtmlToStoredHtml(richHtml, remoteAttachments)
      : '<p></p>'
    const rawContent = richHtml
      ? derivePlainTextFromStoredHtml(storedBodyHtml)
      : readString(item.content ?? item.bodyPreview ?? item.displayName)
    const parsed = remoteTitle
      ? {
          title: remoteTitle,
          content: rawContent.replace(/\r\n/g, '\n').trim(),
        }
      : splitRemoteNoteContent(rawContent)
    const shouldPreserveExistingAttachments = Boolean(item.quicknoteAttachmentsError)

    return {
      id: existing?.id ?? generateLocalId('note'),
      remoteId,
      title: parsed.title,
      content: parsed.content,
      bodyHtml: storedBodyHtml,
      attachments: shouldPreserveExistingAttachments
        ? existing?.attachments ?? []
        : remoteAttachments,
      tags: existing?.tags?.length ? existing.tags : ['未分类'],
      pinned: existing?.pinned ?? false,
      source: 'microsoft-notes',
      createdAt: readString(item.createdDateTime, existing?.createdAt ?? now),
      updatedAt: readString(item.lastModifiedDateTime, existing?.updatedAt ?? now),
      lastSyncedAt: now,
      lastSyncedTitle: remoteTitle,
      lastSyncedBodyHtml: richHtml ?? '<p></p>',
      remoteChangeKey: readString(item.changeKey, existing?.remoteChangeKey ?? ''),
      syncStatus: 'synced',
      deleted: false,
    }
  })

  const remoteIds = new Set(mapped.map((note) => note.remoteId).filter(Boolean))
  const survivingLocals = (await db.notes.toArray()).filter(
    (note) => !note.remoteId || remoteIds.has(note.remoteId),
  )

  await db.notes.clear()
  await db.notes.bulkPut([...survivingLocals.filter((note) => !note.remoteId), ...mapped])
}

export async function applySyncedNote(noteId: string, remoteId: string) {
  const note = await db.notes.get(noteId)

  if (!note) return

  await db.notes.put({
    ...note,
    remoteId,
    source: 'microsoft-notes',
    syncStatus: 'synced',
    lastSyncedAt: toIsoNow(),
    lastSyncedTitle: note.title,
    lastSyncedBodyHtml: note.bodyHtml,
  })
}

interface AppliedRemoteNoteSnapshot {
  remoteId: string
  title: string
  bodyHtml: string
  lastSyncedBodyHtml: string
  content: string
  attachments: LocalNoteAttachment[]
  remoteChangeKey?: string
}

export async function applyRemoteNoteSnapshot(
  noteId: string,
  snapshot: AppliedRemoteNoteSnapshot,
) {
  const note = await db.notes.get(noteId)

  if (!note) return

  await db.notes.put({
    ...note,
    remoteId: snapshot.remoteId,
    title: snapshot.title,
    content: snapshot.content,
    bodyHtml: snapshot.bodyHtml,
    attachments: snapshot.attachments,
    source: 'microsoft-notes',
    syncStatus: 'synced',
    lastSyncedAt: toIsoNow(),
    lastSyncedTitle: snapshot.title,
    lastSyncedBodyHtml: snapshot.lastSyncedBodyHtml,
    remoteChangeKey: snapshot.remoteChangeKey,
  })
}

export async function markNoteConflict(noteId: string) {
  const note = await db.notes.get(noteId)

  if (!note) return

  await db.notes.put({
    ...note,
    syncStatus: 'conflict',
    updatedAt: toIsoNow(),
  })
}

export async function removeDeletedNote(noteId: string) {
  await db.notes.delete(noteId)
}
