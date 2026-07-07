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

    this.version(1).stores({
      notes: 'id, remoteId, updatedAt, pinned, syncStatus, *tags, deleted',
      todoLists: 'id, remoteId, wellknownListName',
      todos: 'id, remoteId, listId, status, dueDateTime, syncStatus, deleted',
      pendingOperations: 'id, entityType, localId, createdAt',
      appState: 'key',
    })

    this.version(2)
      .stores({
        notes: 'id, remoteId, updatedAt, pinned, syncStatus, *tags, deleted',
        todoLists: 'id, remoteId, wellknownListName',
        todos: 'id, remoteId, listId, status, dueDateTime, syncStatus, deleted',
        pendingOperations: 'id, entityType, localId, createdAt',
        appState: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction.table('notes').toCollection().modify((rawNote) => {
          const note = rawNote as LocalNote & {
            attachments?: unknown
          }

          if (!Array.isArray(note.attachments)) {
            note.attachments = []
          }
        })
      })

    this.version(3)
      .stores({
        notes: 'id, remoteId, updatedAt, pinned, syncStatus, *tags, deleted',
        todoLists: 'id, remoteId, wellknownListName',
        todos: 'id, remoteId, listId, status, dueDateTime, syncStatus, deleted',
        pendingOperations: 'id, entityType, localId, createdAt',
        appState: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction.table('notes').toCollection().modify((rawNote) => {
          const note = rawNote as LocalNote & {
            bodyHtml?: string
            lastSyncedTitle?: string
            lastSyncedBodyHtml?: string
            remoteChangeKey?: string
          }

          const plainText = typeof note.content === 'string' ? note.content : ''
          const escapedText = plainText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br />')

          note.bodyHtml = note.bodyHtml || `<p>${escapedText || '&nbsp;'}</p>`

          if (note.remoteId) {
            note.lastSyncedTitle ??= note.title
            note.lastSyncedBodyHtml ??= note.bodyHtml
          }
        })
      })
  }
}

export const db = new QuickNoteDatabase()
