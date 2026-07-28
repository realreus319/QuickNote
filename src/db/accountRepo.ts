import { LEGACY_OWNER_KEY, normalizeOwnerKey } from '@/db/accountScope'
import { getAttachmentBlobRecordId } from '@/db/attachmentKeys'
import { db } from '@/db/db'

export async function claimLegacyDataForAccount(ownerKeyValue: string) {
  const ownerKey = normalizeOwnerKey(ownerKeyValue)

  if (!ownerKey) {
    return
  }

  await db.transaction(
    'rw',
    db.notes,
    db.noteAttachmentBlobs,
    db.todoLists,
    db.todos,
    db.pendingOperations,
    async () => {
      const hasOwnedData =
        (await db.notes.where('ownerKey').equals(ownerKey).count()) > 0 ||
        (await db.todos.where('ownerKey').equals(ownerKey).count()) > 0 ||
        (await db.todoLists.where('ownerKey').equals(ownerKey).count()) > 0

      if (hasOwnedData) {
        return
      }

      const legacyBlobs = await db.noteAttachmentBlobs
        .where('ownerKey')
        .equals(LEGACY_OWNER_KEY)
        .toArray()

      if (legacyBlobs.length) {
        await db.noteAttachmentBlobs.bulkPut(
          legacyBlobs.map((record) => ({
            ...record,
            id: getAttachmentBlobRecordId(
              ownerKey,
              record.noteId,
              record.attachmentId,
            ),
            ownerKey,
          })),
        )
        await db.noteAttachmentBlobs.bulkDelete(
          legacyBlobs.map((record) => record.id),
        )
      }

      await db.notes
        .where('ownerKey')
        .equals(LEGACY_OWNER_KEY)
        .modify({ ownerKey })
      await db.todoLists
        .where('ownerKey')
        .equals(LEGACY_OWNER_KEY)
        .modify({ ownerKey })
      await db.todos
        .where('ownerKey')
        .equals(LEGACY_OWNER_KEY)
        .modify({ ownerKey })
      await db.pendingOperations
        .where('ownerKey')
        .equals(LEGACY_OWNER_KEY)
        .modify({ ownerKey })
    },
  )
}
