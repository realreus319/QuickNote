import { getAttachmentBlobRecordId } from '@/db/attachmentKeys'
import { db } from '@/db/db'
import type {
  LocalNote,
  LocalNoteAttachment,
  NoteAttachmentBlobRecord,
} from '@/types/domain'
import { base64ToBlob, blobToBase64 } from '@/utils/noteAttachments'

export const DEFAULT_ATTACHMENT_CACHE_BUDGET_BYTES = 300 * 1024 * 1024
const MAX_ATTACHMENT_CACHE_TARGET_BYTES = 250 * 1024 * 1024

export function stripAttachmentBytes(
  attachments: LocalNoteAttachment[],
): LocalNoteAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    base64: undefined,
  }))
}

export async function persistNoteAttachmentBlobs(
  noteId: string,
  ownerKey: string,
  attachments: LocalNoteAttachment[],
) {
  const now = new Date().toISOString()
  const records = attachments
    .filter(
      (attachment): attachment is LocalNoteAttachment & { base64: string } =>
        Boolean(attachment.base64) &&
        attachment.storageState !== 'remote-only',
    )
    .map(
      (attachment): NoteAttachmentBlobRecord => ({
        id: getAttachmentBlobRecordId(ownerKey, noteId, attachment.id),
        ownerKey,
        noteId,
        attachmentId: attachment.id,
        blob: base64ToBlob(attachment.base64, attachment.mimeType),
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        lastAccessedAt: now,
      }),
    )

  if (records.length) {
    await db.noteAttachmentBlobs.bulkPut(records)
  }
}

export async function hydrateNoteAttachmentBlobs(
  noteId: string,
  ownerKey: string,
  attachments: LocalNoteAttachment[],
) {
  if (!attachments.length) return attachments

  const ids = attachments.map((attachment) =>
    getAttachmentBlobRecordId(ownerKey, noteId, attachment.id),
  )
  const records = await db.noteAttachmentBlobs.bulkGet(ids)

  return Promise.all(
    attachments.map(async (attachment, index) => {
      const record = records[index]

      if (!record) {
        return {
          ...attachment,
          base64: undefined,
          storageState:
            attachment.remoteId && attachment.storageState === 'available'
              ? ('remote-only' as const)
              : attachment.storageState,
        }
      }

      return {
        ...attachment,
        base64: await blobToBase64(record.blob),
        storageState: 'available' as const,
      }
    }),
  )
}

export async function getNoteAttachmentBlob(
  noteId: string,
  attachmentId: string,
  ownerKey: string,
) {
  const id = getAttachmentBlobRecordId(ownerKey, noteId, attachmentId)
  return (await db.noteAttachmentBlobs.get(id))?.blob
}

export async function getAttachmentCacheUsage(ownerKey: string) {
  if (!ownerKey) return { bytes: 0, count: 0 }

  const records = await db.noteAttachmentBlobs
    .where('ownerKey')
    .equals(ownerKey)
    .toArray()

  return {
    bytes: records.reduce((total, record) => total + record.blob.size, 0),
    count: records.length,
  }
}

export async function deleteNoteAttachmentBlobs(
  noteId: string,
  ownerKey: string,
) {
  const records = await db.noteAttachmentBlobs
    .where('[ownerKey+noteId]')
    .equals([ownerKey, noteId])
    .toArray()

  if (records.length) {
    await db.noteAttachmentBlobs.bulkDelete(records.map((record) => record.id))
  }
}

function canEvictRemoteCacheRecord(
  record: NoteAttachmentBlobRecord,
  note: LocalNote | undefined,
) {
  const attachment = note?.attachments.find(
    (item) => item.id === record.attachmentId,
  )

  return Boolean(
    note?.syncStatus === 'synced' &&
      attachment?.remoteId &&
      !note.deleted,
  )
}

async function removeCachedRecords(
  ownerKey: string,
  records: NoteAttachmentBlobRecord[],
) {
  if (!records.length) return { count: 0, bytes: 0 }

  const attachmentIdsByNote = new Map<string, Set<string>>()

  for (const record of records) {
    const ids = attachmentIdsByNote.get(record.noteId) ?? new Set<string>()
    ids.add(record.attachmentId)
    attachmentIdsByNote.set(record.noteId, ids)
  }

  await db.transaction(
    'rw',
    db.noteAttachmentBlobs,
    db.notes,
    async () => {
      await db.noteAttachmentBlobs.bulkDelete(
        records.map((record) => record.id),
      )

      for (const [noteId, attachmentIds] of attachmentIdsByNote) {
        const note = await db.notes.get(noteId)

        if (!note || note.ownerKey !== ownerKey) continue

        await db.notes.put({
          ...note,
          attachments: note.attachments.map((attachment) =>
            attachmentIds.has(attachment.id)
              ? {
                  ...attachment,
                  base64: undefined,
                  storageState: 'remote-only' as const,
                }
              : attachment,
          ),
        })
      }
    },
  )

  return {
    count: records.length,
    bytes: records.reduce((total, record) => total + record.blob.size, 0),
  }
}

export async function clearRemoteAttachmentCache(ownerKey: string) {
  if (!ownerKey) return { count: 0, bytes: 0 }

  const [records, notes] = await Promise.all([
    db.noteAttachmentBlobs.where('ownerKey').equals(ownerKey).toArray(),
    db.notes.where('ownerKey').equals(ownerKey).toArray(),
  ])
  const noteById = new Map(notes.map((note) => [note.id, note]))
  const removable = records.filter((record) =>
    canEvictRemoteCacheRecord(record, noteById.get(record.noteId)),
  )

  return removeCachedRecords(ownerKey, removable)
}

export async function enforceAttachmentCacheBudget(
  ownerKey: string,
  maxBytes = DEFAULT_ATTACHMENT_CACHE_BUDGET_BYTES,
) {
  const records = await db.noteAttachmentBlobs
    .where('ownerKey')
    .equals(ownerKey)
    .toArray()
  const notes = await db.notes.where('ownerKey').equals(ownerKey).toArray()
  const noteById = new Map(notes.map((note) => [note.id, note]))
  const orphanRecords = records.filter((record) => {
    const note = noteById.get(record.noteId)
    return !note?.attachments.some(
      (attachment) => attachment.id === record.attachmentId,
    )
  })

  if (orphanRecords.length) {
    await db.noteAttachmentBlobs.bulkDelete(
      orphanRecords.map((record) => record.id),
    )
  }

  const orphanIds = new Set(orphanRecords.map((record) => record.id))
  const liveRecords = records.filter((record) => !orphanIds.has(record.id))
  let totalBytes = liveRecords.reduce(
    (total, record) => total + record.blob.size,
    0,
  )

  if (totalBytes <= maxBytes) return orphanRecords.length

  const targetBytes = Math.min(
    MAX_ATTACHMENT_CACHE_TARGET_BYTES,
    Math.floor(maxBytes * 0.85),
  )
  const candidates = liveRecords
    .filter((record) =>
      canEvictRemoteCacheRecord(record, noteById.get(record.noteId)),
    )
    .sort((left, right) =>
      left.lastAccessedAt.localeCompare(right.lastAccessedAt),
    )
  const toRemove: NoteAttachmentBlobRecord[] = []

  for (const record of candidates) {
    if (totalBytes <= targetBytes) break
    toRemove.push(record)
    totalBytes -= record.blob.size
  }

  await removeCachedRecords(ownerKey, toRemove)
  return orphanRecords.length + toRemove.length
}
