import { requireActiveOwnerKey } from '@/db/accountScope'
import { db } from '@/db/db'
import { enqueuePendingOperation } from '@/db/pendingRepo'
import { toIsoNow } from '@/utils/date'

export async function resolveNoteConflictKeepLocal(
  noteId: string,
  ownerKey = requireActiveOwnerKey(),
) {
  return db.transaction('rw', db.notes, db.pendingOperations, async () => {
    const note = await db.notes.get(noteId)

    if (!note || note.ownerKey !== ownerKey) {
      throw new Error('冲突笔记不属于当前账户')
    }

    const localRevision = Math.max(1, note.localRevision ?? 1) + 1
    const next = {
      ...note,
      localRevision,
      syncStatus: 'pending' as const,
      remoteChangeKey: undefined,
      updatedAt: toIsoNow(),
    }

    await db.notes.put(next)
    await enqueuePendingOperation(
      'note',
      note.remoteId ? 'update' : 'create',
      note.id,
      next as unknown as Record<string, unknown>,
      ownerKey,
    )

    return next
  })
}
