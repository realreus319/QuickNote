import { requireActiveOwnerKey } from '@/db/accountScope'
import { db } from '@/db/db'
import { enqueuePendingOperation } from '@/db/pendingRepo'
import type { LocalNote, LocalNoteAttachment } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'
import { DEFAULT_NOTE_COLOR, normalizeNoteColor } from '@/utils/noteColor'
import {
  convertRemoteNoteHtmlToStoredHtml,
  derivePlainTextFromStoredHtml,
  pruneAttachmentsForStoredHtml,
} from '@/utils/noteRichHtml'
import { readString, splitRemoteNoteContent } from '@/utils/text'

function sortNotes(notes: LocalNote[]) {
  return notes.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

function noteRevision(note: LocalNote) {
  return Math.max(1, note.localRevision ?? 1)
}

function syncedNoteRevision(note: LocalNote) {
  return Math.max(0, note.syncedRevision ?? (note.syncStatus === 'synced' ? noteRevision(note) : 0))
}

function hasUnsyncedLocalChanges(note: LocalNote) {
  return noteRevision(note) > syncedNoteRevision(note) || note.syncStatus !== 'synced'
}

function mergeAttachmentMetadata(
  localAttachments: LocalNoteAttachment[],
  remoteAttachments: LocalNoteAttachment[],
) {
  const remoteByContentId = new Map(
    remoteAttachments.map((attachment) => [attachment.contentId, attachment]),
  )

  return localAttachments.map((attachment) => {
    const remote = remoteByContentId.get(attachment.contentId)

    return remote
      ? {
          ...attachment,
          remoteId: remote.remoteId ?? attachment.remoteId,
          name: remote.name || attachment.name,
          size: remote.size || attachment.size,
        }
      : attachment
  })
}

export async function listNotes(ownerKey = requireActiveOwnerKey()) {
  return sortNotes(
    (await db.notes.where('ownerKey').equals(ownerKey).toArray()).filter(
      (note) => !note.deleted,
    ),
  )
}

export async function getNoteById(
  noteId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const note = await db.notes.get(noteId)
  return note?.ownerKey === ownerKey ? note : undefined
}

export async function createNote(ownerKey = requireActiveOwnerKey()) {
  const now = toIsoNow()
  const note: LocalNote = {
    id: generateLocalId('note'),
    ownerKey,
    title: '',
    content: '',
    bodyHtml: '<p></p>',
    attachments: [],
    color: DEFAULT_NOTE_COLOR,
    pinned: false,
    source: 'local',
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncedRevision: 0,
    syncStatus: 'pending',
  }

  await db.transaction('rw', db.notes, db.pendingOperations, async () => {
    await db.notes.put(note)
    await enqueuePendingOperation(
      'note',
      'create',
      note.id,
      note as unknown as Record<string, unknown>,
      ownerKey,
    )
  })

  return note
}

export async function updateNote(
  noteId: string,
  patch: Partial<Pick<LocalNote, 'title' | 'bodyHtml' | 'pinned' | 'attachments' | 'color'>>,
  ownerKey = requireActiveOwnerKey(),
) {
  return db.transaction('rw', db.notes, db.pendingOperations, async () => {
    const current = await db.notes.get(noteId)

    if (!current || current.ownerKey !== ownerKey) return undefined

    const nextBodyHtml = patch.bodyHtml ?? current.bodyHtml
    const nextAttachments = pruneAttachmentsForStoredHtml(
      patch.attachments ?? current.attachments,
      nextBodyHtml,
    )
    const localRevision = noteRevision(current) + 1

    const next: LocalNote = {
      ...current,
      ...patch,
      ownerKey,
      bodyHtml: nextBodyHtml,
      attachments: nextAttachments,
      content: derivePlainTextFromStoredHtml(nextBodyHtml),
      updatedAt: toIsoNow(),
      localRevision,
      syncedRevision: syncedNoteRevision(current),
      syncStatus: 'pending',
    }

    await db.notes.put(next)
    await enqueuePendingOperation(
      'note',
      current.remoteId ? 'update' : 'create',
      noteId,
      next as unknown as Record<string, unknown>,
      ownerKey,
    )

    return next
  })
}

export async function deleteNote(
  noteId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  await db.transaction('rw', db.notes, db.pendingOperations, async () => {
    const current = await db.notes.get(noteId)

    if (!current || current.ownerKey !== ownerKey) return

    const localRevision = noteRevision(current) + 1
    const next: LocalNote = {
      ...current,
      ownerKey,
      deleted: true,
      updatedAt: toIsoNow(),
      localRevision,
      syncedRevision: syncedNoteRevision(current),
      syncStatus: 'pending',
    }

    await db.notes.put(next)
    await enqueuePendingOperation(
      'note',
      'delete',
      noteId,
      {
        id: noteId,
        ownerKey,
        remoteId: current.remoteId,
        localRevision,
      },
      ownerKey,
    )
  })
}

export async function searchNotes(
  query: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) return []

  return (await listNotes(ownerKey)).filter((note) => {
    const haystack = `${note.title} ${note.content}`.toLowerCase()

    return haystack.includes(normalized)
  })
}

function mapRemoteNote(
  item: Record<string, unknown>,
  existing: LocalNote | undefined,
  now: string,
  ownerKey: string,
): LocalNote {
  const remoteId = readString(item.id)

  if (!remoteId) {
    throw new Error('远端便签缺少标识')
  }

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
  const remoteColor = normalizeNoteColor(item.quicknoteColor)
  const localRevision = existing ? noteRevision(existing) : 1

  const mapped: LocalNote = {
    id: existing?.id ?? generateLocalId('note'),
    ownerKey,
    remoteId,
    title: parsed.title,
    content: parsed.content,
    bodyHtml: storedBodyHtml,
    attachments: remoteAttachments,
    color: remoteColor,
    pinned: existing?.pinned ?? false,
    source: 'microsoft-notes',
    createdAt: readString(item.createdDateTime, existing?.createdAt ?? now),
    updatedAt: readString(item.lastModifiedDateTime, existing?.updatedAt ?? now),
    lastSyncedAt: now,
    lastSyncedTitle: remoteTitle,
    lastSyncedBodyHtml: richHtml ?? '<p></p>',
    lastSyncedColor: remoteColor,
    remoteChangeKey: readString(item.changeKey, existing?.remoteChangeKey ?? ''),
    remoteAttachmentsChangeKey: readString(
      item.quicknoteAttachmentsChangeKey,
      existing?.remoteAttachmentsChangeKey ?? '',
    ),
    localRevision,
    syncedRevision: localRevision,
    syncStatus: 'synced',
    deleted: false,
  }

  if (!existing || !hasUnsyncedLocalChanges(existing)) {
    return mapped
  }

  return {
    ...mapped,
    title: existing.title,
    content: existing.content,
    bodyHtml: existing.bodyHtml,
    attachments: existing.attachments,
    color: existing.color,
    pinned: existing.pinned,
    updatedAt: existing.updatedAt,
    lastSyncedAt: existing.lastSyncedAt,
    lastSyncedTitle: existing.lastSyncedTitle,
    lastSyncedBodyHtml: existing.lastSyncedBodyHtml,
    lastSyncedColor: existing.lastSyncedColor,
    remoteChangeKey: existing.remoteChangeKey,
    remoteAttachmentsChangeKey: existing.remoteAttachmentsChangeKey,
    localRevision: noteRevision(existing),
    syncedRevision: syncedNoteRevision(existing),
    syncStatus: existing.syncStatus,
    deleted: existing.deleted,
  }
}

export async function applyRemoteNotesDelta(
  changes: Array<Record<string, unknown>>,
  removedRemoteIds: string[],
  fullSnapshotRemoteIds: string[] | undefined,
  ownerKey: string,
) {
  await db.transaction('rw', db.notes, async () => {
    const currentNotes = await db.notes.where('ownerKey').equals(ownerKey).toArray()
    const currentByRemoteId = new Map(
      currentNotes
        .filter((note) => note.remoteId)
        .map((note) => [note.remoteId as string, note]),
    )
    const now = toIsoNow()
    const removed = new Set(removedRemoteIds)
    const mappedByRemoteId = new Map<string, LocalNote>()

    for (const item of changes) {
      const remoteId = readString(item.id)

      if (removed.has(remoteId)) {
        continue
      }

      const mapped = mapRemoteNote(
        item,
        currentByRemoteId.get(remoteId),
        now,
        ownerKey,
      )
      mappedByRemoteId.set(remoteId, mapped)
    }

    const fullSnapshot = fullSnapshotRemoteIds
      ? new Set(fullSnapshotRemoteIds)
      : undefined
    const localIdsToDelete = currentNotes
      .filter(
        (note) =>
          note.remoteId &&
          !hasUnsyncedLocalChanges(note) &&
          (removed.has(note.remoteId) ||
            (fullSnapshot && !fullSnapshot.has(note.remoteId))),
      )
      .map((note) => note.id)

    if (localIdsToDelete.length) {
      await db.notes.bulkDelete(localIdsToDelete)
    }

    if (mappedByRemoteId.size) {
      await db.notes.bulkPut([...mappedByRemoteId.values()])
    }
  })
}

export async function attachRemoteIdToNote(
  noteId: string,
  remoteId: string,
  expectedRevision: number,
  ownerKey: string,
) {
  const note = await db.notes.get(noteId)

  if (!note || note.ownerKey !== ownerKey || noteRevision(note) < expectedRevision) {
    return
  }

  await db.notes.put({
    ...note,
    remoteId,
    source: 'microsoft-notes',
    syncStatus: 'pending',
  })
}

export async function applySyncedNote(
  noteId: string,
  remoteId: string,
  expectedRevision = 1,
  ownerKey = requireActiveOwnerKey(),
) {
  const note = await db.notes.get(noteId)

  if (!note || note.ownerKey !== ownerKey) return

  const currentRevision = noteRevision(note)
  const fullySynced = currentRevision === expectedRevision

  await db.notes.put({
    ...note,
    remoteId,
    source: 'microsoft-notes',
    syncStatus: fullySynced ? 'synced' : 'pending',
    lastSyncedAt: toIsoNow(),
    lastSyncedTitle: note.title,
    lastSyncedBodyHtml: note.bodyHtml,
    lastSyncedColor: note.color,
    syncedRevision: Math.max(syncedNoteRevision(note), expectedRevision),
  })
}

interface AppliedRemoteNoteSnapshot {
  remoteId: string
  title: string
  bodyHtml: string
  lastSyncedBodyHtml: string
  content: string
  attachments: LocalNoteAttachment[]
  color: LocalNote['color']
  remoteChangeKey?: string
}

export async function applyRemoteNoteSnapshot(
  noteId: string,
  snapshot: AppliedRemoteNoteSnapshot,
  expectedRevision: number,
  ownerKey: string,
) {
  const note = await db.notes.get(noteId)

  if (!note || note.ownerKey !== ownerKey) return

  const currentRevision = noteRevision(note)
  const fullySynced = currentRevision === expectedRevision
  const common = {
    remoteId: snapshot.remoteId,
    source: 'microsoft-notes' as const,
    lastSyncedAt: toIsoNow(),
    lastSyncedTitle: snapshot.title,
    lastSyncedBodyHtml: snapshot.lastSyncedBodyHtml,
    lastSyncedColor: snapshot.color,
    remoteChangeKey: snapshot.remoteChangeKey,
    remoteAttachmentsChangeKey: snapshot.remoteChangeKey,
    syncedRevision: Math.max(syncedNoteRevision(note), expectedRevision),
  }

  await db.notes.put(
    fullySynced
      ? {
          ...note,
          ...common,
          title: snapshot.title,
          content: snapshot.content,
          bodyHtml: snapshot.bodyHtml,
          attachments: snapshot.attachments,
          color: snapshot.color,
          syncStatus: 'synced',
        }
      : {
          ...note,
          ...common,
          attachments: mergeAttachmentMetadata(
            note.attachments,
            snapshot.attachments,
          ),
          syncStatus: 'pending',
        },
  )
}

export async function cacheRemoteAttachment(
  noteId: string,
  attachment: LocalNoteAttachment,
  ownerKey = requireActiveOwnerKey(),
) {
  const note = await db.notes.get(noteId)

  if (!note || note.ownerKey !== ownerKey) return undefined

  const attachments = note.attachments.map((candidate) =>
    candidate.id === attachment.id ? attachment : candidate,
  )
  const next = {
    ...note,
    attachments,
  }

  await db.notes.put(next)
  return next
}

export async function markNoteConflict(
  noteId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const note = await db.notes.get(noteId)

  if (!note || note.ownerKey !== ownerKey) return

  await db.notes.put({
    ...note,
    syncStatus: 'conflict',
    updatedAt: toIsoNow(),
  })
}

export async function removeDeletedNote(
  noteId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  const note = await db.notes.get(noteId)

  if (note?.ownerKey === ownerKey) {
    await db.notes.delete(noteId)
  }
}
