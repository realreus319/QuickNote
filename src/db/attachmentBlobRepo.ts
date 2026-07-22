import { getAttachmentBlobRecordId } from '@/db/attachmentKeys'
import { db } from '@/db/db'
import type {
  LocalNoteAttachment,
  NoteAttachmentBlobRecord,
} from '@/types/domain'
import {
  base64ToBlob,
  blobToBase64,
} from '@/utils/noteAttachments'

export const DEFAULT_ATTACHMENT_CACHE_BUDGET_BYTES = 300 * 1024 * 1024
const ATTACHMENT_CACHE_TARGET_BYTES = 250 * 1024 * 1024

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
  const attachmentIds = new Set(attachments.map((attachment) => attachment.id))
  const existing = await db.noteAttachmentBlobs
    .where('[ownerKey+noteId]')
    .equals([ownerKey, noteId])
    .toArray()
  const orphanIds = existing
    .filter((record) => !attachmentIds.has(record.attachmentId))
    .map((record) => record.id)

  if (orphanIds.length) {
    await db.noteAttachmentBlobs.bulkDelete(orphanIds)
  }

  const now = new Date().toISOString()
  const records = attachments
    .filter((attachment) => Boolean(attachment.base64))
    .map(
      (attachment): NoteAttachmentBlobRecord => ({
        id: getAttachmentBlobRecordId(ownerKey, noteId, attachment.id),
        ownerKey,
        noteId,
        attachmentId: attachment.id,
        blob: base64ToBlob(
          attachment.base64 as string,
          attachment.mimeType,
        ),
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
  const now = new Date().toISOString()
  const touched: NoteAttachmentBlobRecord[] = []
  const hydrated = await Promise.all(
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

      touched.push({
        ...record,
        lastAccessedAt: now,
      })

      return {
        ...attachment,
        base64: await blobToBase64(record.blob),
        storageState: 'available' as const,
      }
    }),
  )

  if (touched.length) {
    await db.noteAttachmentBlobs.bulkPut(touched)
  }

  return hydrated
}

export async function getNoteAttachmentBlob(
  noteId: string,
  attachmentId: string,
  ownerKey: string,
) {
  const id = getAttachmentBlobRecordId(ownerKey, noteId, attachmentId)
  const record = await db.noteAttachmentBlobs.get(id)

  if (!record) return undefined

  await db.noteAttachmentBlobs.put({
    ...record,
    lastAccessedAt: new Date().toISOString(),
  })

  return record.blob
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
  let totalBytes = records.reduce(
    (total, record) => total + record.blob.size,
    0,
  )

  if (totalBytes <= maxBytes) return 0

  const notes = await db.notes.where('ownerKey').equals(ownerKey).toArray()
  const noteById = new Map(notes.map((note) => [note.id, note]))
  const candidates = records
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
  let deletedCount = 0

  await db.transaction(
    'rw',
    db.noteAttachmentBlobs,
    db.notes,
    async () => {
      for (const record of candidates) {
        if (totalBytes <= ATTACHMENT_CACHE_TARGET_BYTES) break

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
