import Dexie, { type Table } from 'dexie'

import type {
  AppStateRecord,
  LocalNote,
  LocalTodo,
  LocalTodoList,
  PendingOperation,
} from '@/types/domain'

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
  }
}

export const db = new QuickNoteDatabase()
