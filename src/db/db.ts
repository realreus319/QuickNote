import Dexie, { type Table } from 'dexie'

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
  }
}

export const db = new QuickNoteDatabase()
