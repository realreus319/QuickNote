import {
  createRemoteNote,
  deleteRemoteNote,
  fetchRemoteNotesDelta,
  type RemoteNoteSnapshot,
  updateRemoteNote,
} from '@/graph/notesApi'
import { GraphRequestError } from '@/graph/graphClient'
import {
  deleteAppStateValue,
  getAppStateValue,
  setAppStateValue,
} from '@/db/appStateRepo'
import {
  applyRemoteNotesDelta,
  applyRemoteNoteSnapshot,
  getNoteById,
  listNotes,
  markNoteConflict,
  removeDeletedNote,
} from '@/db/notesRepo'
import type { PendingOperation } from '@/types/domain'
import { RichTextMergeError } from '@/utils/noteRichHtml'
import { readString } from '@/utils/text'

const NOTES_SNAPSHOT_ACCOUNT_KEY = 'notesSnapshotAccountId'

async function applySnapshot(
  noteId: string,
  snapshot: RemoteNoteSnapshot,
  expectedRevision: number,
  ownerKey: string,
) {
  await applyRemoteNoteSnapshot(
    noteId,
    {
      remoteId: snapshot.remoteId,
      title: snapshot.title,
      bodyHtml: snapshot.bodyHtml,
      lastSyncedBodyHtml: snapshot.lastSyncedBodyHtml,
      content: snapshot.content,
      attachments: snapshot.attachments,
      color: snapshot.color,
      remoteChangeKey: snapshot.remoteChangeKey,
    },
    expectedRevision,
    ownerKey,
  )
}

export function getNotesDeltaStateKey(homeAccountId: string) {
  const accountKey = homeAccountId.trim()

  if (!accountKey) {
    throw new Error('缺少 Microsoft 账户标识')
  }

  return `notesDeltaLink:v3:${accountKey}`
}

export function isInvalidNotesDeltaError(error: unknown) {
  if (!(error instanceof GraphRequestError)) {
    return false
  }

  if (error.status === 410) {
    return true
  }

  return (
    [400, 404].includes(error.status) &&
    /(syncstate|resync|required|invalid[^\n]*(delta|token)|deltatoken)/i.test(error.body)
  )
}

export async function replayNoteOperation(
  accessToken: string,
  operation: PendingOperation,
  homeAccountId: string,
) {
  const ownerKey = homeAccountId.trim()

  if (!ownerKey || operation.ownerKey !== ownerKey) {
    throw new Error('便签同步操作不属于当前账户')
  }

  const expectedRevision = Math.max(1, operation.targetRevision ?? 1)
  const note = await getNoteById(operation.localId, ownerKey)

  if (operation.operation === 'delete') {
    const remoteId = readString(operation.payload.remoteId, note?.remoteId ?? '')
    if (remoteId) {
      try {
        await deleteRemoteNote(accessToken, remoteId)
      } catch (error) {
        if (!(error instanceof GraphRequestError) || error.status !== 404) {
          throw error
        }
      }
    }
    await removeDeletedNote(operation.localId, ownerKey)
    return
  }

  if (!note) return

  try {
    const snapshot = note.remoteId
      ? await updateRemoteNote(accessToken, note)
      : await createRemoteNote(accessToken, note, ownerKey)
    await applySnapshot(
      operation.localId,
      snapshot,
      expectedRevision,
      ownerKey,
    )
  } catch (caughtError) {
    if (caughtError instanceof RichTextMergeError) {
      await markNoteConflict(operation.localId, ownerKey)
    }

    throw caughtError
  }
}

export async function pullNotes(accessToken: string, homeAccountId: string) {
  const accountId = homeAccountId.trim()
  const deltaStateKey = getNotesDeltaStateKey(accountId)
  const cachedNotes = await listNotes(accountId)
  const savedDeltaLink = await getAppStateValue(deltaStateKey, '')
  const snapshotAccountId = await getAppStateValue(NOTES_SNAPSHOT_ACCOUNT_KEY, '')
  const activeDeltaLink = snapshotAccountId === accountId ? savedDeltaLink : ''
  let deltaResult

  try {
    deltaResult = await fetchRemoteNotesDelta(
      accessToken,
      accountId,
      activeDeltaLink || undefined,
      cachedNotes,
    )
  } catch (caughtError) {
    if (!activeDeltaLink || !isInvalidNotesDeltaError(caughtError)) {
      throw caughtError
    }

    await deleteAppStateValue(deltaStateKey)
    deltaResult = await fetchRemoteNotesDelta(
      accessToken,
      accountId,
      undefined,
      cachedNotes,
    )
  }

  await applyRemoteNotesDelta(
    deltaResult.changes,
    deltaResult.removedRemoteIds,
    deltaResult.initial ? deltaResult.seenRemoteIds : undefined,
    accountId,
  )
  await setAppStateValue(NOTES_SNAPSHOT_ACCOUNT_KEY, accountId)
  await setAppStateValue(deltaStateKey, deltaResult.deltaLink)

  return listNotes(accountId)
}
