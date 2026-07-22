import { LEGACY_OWNER_KEY, normalizeOwnerKey } from '@/db/accountScope'
import { db } from '@/db/db'

export async function claimLegacyDataForAccount(ownerKeyValue: string) {
  const ownerKey = normalizeOwnerKey(ownerKeyValue)

  if (!ownerKey) {
    return
  }

  await db.transaction(
    'rw',
    db.notes,
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
