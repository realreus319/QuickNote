import { getAttachmentBlobRecordId } from '@/db/attachmentKeys'
import { db } from '@/db/db'
import type {
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
        Boolean(attachment.base64),
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

  const liveRecords = records.filter(
    (record) => !orphanRecords.some((orphan) => orphan.id === record.id),
  )
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
    .filter((record) => {
      const note = noteById.get(record.noteId)
      const attachment = note?.attachments.find(
        (item) => item.id === record.attachmentId,
      )

      return Boolean(
        note?.syncStatus === 'synced' &&
          attachment?.remoteId &&
          !note.deleted,
      )
    })
    .sort((left, right) =>
      left.lastAccessedAt.localeCompare(right.lastAccessedAt),
    )
  let deletedCount = orphanRecords.length

  await db.transaction(
    'rw',
    db.noteAttachmentBlobs,
    db.notes,
    async () => {
      for (const record of candidates) {
        if (totalBytes <= targetBytes) break

        await db.noteAttachmentBlobs.delete(record.id)
        const note = await db.notes.get(record.noteId)

        if (note?.ownerKey === ownerKey) {
          await db.notes.put({
            ...note,
            attachments: note.attachments.map((attachment) =>
              attachment.id === record.attachmentId
                ? {
                    ...attachment,
                    base64: undefined,
                    storageState: 'remote-only' as const,
                  }
                : attachment,
            ),
          })
        }

        totalBytes -= record.blob.size
        deletedCount += 1
      }
    },
  )

  return deletedCount
}
