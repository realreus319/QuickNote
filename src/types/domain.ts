export type EntityType = 'note' | 'todo'
export type PendingOperationType = 'create' | 'update' | 'delete'
export type NoteSource = 'microsoft-notes' | 'local'
export type NoteSyncStatus = 'synced' | 'pending' | 'conflict' | 'error'
export type TodoSyncStatus = 'synced' | 'pending' | 'error'
export type AppSyncStatus =
  | 'unauthenticated'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export interface LocalNote {
  id: string
  remoteId?: string
  title: string
  content: string
  bodyHtml: string
  attachments: LocalNoteAttachment[]
  tags: string[]
  pinned: boolean
  source: NoteSource
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
  lastSyncedTitle?: string
  lastSyncedBodyHtml?: string
  remoteChangeKey?: string
  syncStatus: NoteSyncStatus
  deleted?: boolean
}

export interface LocalNoteAttachment {
  id: string
  remoteId?: string
  name: string
  mimeType: string
  size: number
  base64: string
  contentId: string
  createdAt: string
}

export interface LocalTodoList {
  id: string
  remoteId?: string
  displayName: string
  wellknownListName?: string
}

export interface LocalTodo {
  id: string
  remoteId?: string
  listId: string
  title: string
  body?: string
  status: 'notStarted' | 'inProgress' | 'completed'
  importance?: 'low' | 'normal' | 'high'
  dueDateTime?: string
  createdAt?: string
  updatedAt?: string
  syncStatus: TodoSyncStatus
  deleted?: boolean
}

export interface PendingOperation {
  id: string
  entityType: EntityType
  operation: PendingOperationType
  localId: string
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
  lastError?: string
}

export interface AppStateRecord<T = unknown> {
  key: string
  value: T
}

export interface SearchResults {
  notes: LocalNote[]
  todos: LocalTodo[]
}

export interface SyncResult {
  status: AppSyncStatus
  notesError?: string
  todosError?: string
  lastSyncedAt?: string
}
