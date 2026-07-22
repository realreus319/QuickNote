import Dexie, { type Table } from 'dexie'

import { LEGACY_OWNER_KEY, normalizeOwnerKey } from '@/db/accountScope'
import type {
  AppStateRecord,
  LocalNote,
  LocalTodo,
  LocalTodoList,
  PendingOperation,
} from '@/types/domain'
import { migrateNoteColorState } from '@/utils/noteColor'

class QuickNoteDatabase extends Dexie {
  notes!: Table<LocalNote, string>
  todoLists!: Table<LocalTodoList, string>
  todos!: Table<LocalTodo, string>
  pendingOperations!: Table<PendingOperation, string>
  appState!: Table<AppStateRecord, string>

  constructor() {
    super('quicknote-db')

    this.version(4).stores({
      notes: 'id, remoteId, updatedAt, pinned, syncStatus, deleted',
      todoLists: 'id, remoteId, wellknownListName',
      todos: 'id, remoteId, listId, status, dueDateTime, syncStatus, deleted',
      pendingOperations: 'id, entityType, localId, createdAt',
      appState: 'key',
    })

    this.version(5)
      .stores({
        notes: 'id, remoteId, updatedAt, pinned, syncStatus, deleted',
        todoLists: 'id, remoteId, wellknownListName',
        todos: 'id, remoteId, listId, status, dueDateTime, syncStatus, deleted',
        pendingOperations: 'id, entityType, localId, createdAt',
        appState: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<LocalNote, string>('notes')
          .toCollection()
          .modify((note) => {
            const migrated = migrateNoteColorState(
              note.color,
              note.lastSyncedColor,
              Boolean(note.remoteId),
            )
            note.color = migrated.color
            note.lastSyncedColor = migrated.lastSyncedColor
          })
      })

    this.version(6)
      .stores({
        notes:
          'id, ownerKey, [ownerKey+remoteId], [ownerKey+updatedAt], pinned, syncStatus, deleted',
        todoLists: 'id, ownerKey, [ownerKey+remoteId], wellknownListName',
        todos:
          'id, ownerKey, [ownerKey+remoteId], [ownerKey+listId], status, dueDateTime, syncStatus, deleted',
        pendingOperations:
          'id, ownerKey, [ownerKey+createdAt], [ownerKey+localId], entityType, status, nextAttemptAt',
        appState: 'key',
      })
      .upgrade(async (transaction) => {
        const snapshotAccount = await transaction
          .table<AppStateRecord<string>, string>('appState')
          .get('notesSnapshotAccountId')
        const migratedOwnerKey =
          normalizeOwnerKey(snapshotAccount?.value) || LEGACY_OWNER_KEY

        await transaction
          .table<LocalNote, string>('notes')
          .toCollection()
          .modify((note) => {
            note.ownerKey = normalizeOwnerKey(note.ownerKey) || migratedOwnerKey
            note.localRevision = Math.max(1, note.localRevision ?? 1)
            note.syncedRevision = Math.max(
              0,
              note.syncedRevision ?? (note.syncStatus === 'synced' ? note.localRevision : 0),
            )
            note.attachments = (note.attachments ?? []).map((attachment) => ({
              ...attachment,
              storageState:
                attachment.storageState ?? (attachment.base64 ? 'available' : 'remote-only'),
            }))
          })

        await transaction
          .table<LocalTodoList, string>('todoLists')
          .toCollection()
          .modify((list) => {
            list.ownerKey = normalizeOwnerKey(list.ownerKey) || migratedOwnerKey
          })

        await transaction
          .table<LocalTodo, string>('todos')
          .toCollection()
          .modify((todo) => {
            todo.ownerKey = normalizeOwnerKey(todo.ownerKey) || migratedOwnerKey
            todo.localRevision = Math.max(1, todo.localRevision ?? 1)
            todo.syncedRevision = Math.max(
              0,
              todo.syncedRevision ?? (todo.syncStatus === 'synced' ? todo.localRevision : 0),
            )
          })

        await transaction
          .table<PendingOperation, string>('pendingOperations')
          .toCollection()
          .modify((operation) => {
            operation.ownerKey = normalizeOwnerKey(operation.ownerKey) || migratedOwnerKey
            operation.targetRevision = Math.max(1, operation.targetRevision ?? 1)
            operation.status = operation.status ?? 'pending'
          })
      })
  }
}

export const db = new QuickNoteDatabase()
