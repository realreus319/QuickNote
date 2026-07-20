import {
  createRemoteNote,
  deleteRemoteNote,
  fetchRemoteNotes,
  type RemoteNoteSnapshot,
  updateRemoteNote,
} from '@/graph/notesApi'
import {
  applyRemoteNoteSnapshot,
  getNoteById,
  listNotes,
  markNoteConflict,
  removeDeletedNote,
  syncRemoteNotes,
} from '@/db/notesRepo'
import type { PendingOperation } from '@/types/domain'
import { RichTextMergeError } from '@/utils/noteRichHtml'
import { readString } from '@/utils/text'

async function applySnapshot(noteId: string, snapshot: RemoteNoteSnapshot) {
  await applyRemoteNoteSnapshot(noteId, {
    remoteId: snapshot.remoteId,
    title: snapshot.title,
    bodyHtml: snapshot.bodyHtml,
    lastSyncedBodyHtml: snapshot.lastSyncedBodyHtml,
    content: snapshot.content,
    attachments: snapshot.attachments,
    color: snapshot.color,
    remoteChangeKey: snapshot.remoteChangeKey,
  })
}

export async function replayNoteOperation(accessToken: string, operation: PendingOperation) {
  const note = await getNoteById(operation.localId)

  if (operation.operation === 'delete') {
    const remoteId = readString(operation.payload.remoteId, note?.remoteId ?? '')
    if (remoteId) {
      await deleteRemoteNote(accessToken, remoteId)
    }
    await removeDeletedNote(operation.localId)
    return
  }

  if (!note) return

  if (!note.remoteId || operation.operation === 'create') {
    const snapshot = await createRemoteNote(accessToken, note)
    await applySnapshot(operation.localId, snapshot)
    return
  }

  try {
    const snapshot = await updateRemoteNote(accessToken, note)
    await applySnapshot(operation.localId, snapshot)
  } catch (caughtError) {
    if (caughtError instanceof RichTextMergeError) {
      await markNoteConflict(operation.localId)
    }

    throw caughtError
  }
}

export async function pullNotes(accessToken: string) {
  const cachedNotes = await listNotes()
  const notes = await fetchRemoteNotes(accessToken, cachedNotes)
  await syncRemoteNotes(notes)
  return listNotes()
}
