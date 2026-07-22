export type EntityType = 'note' | 'todo'
export type PendingOperationType = 'create' | 'update' | 'delete'
export type PendingOperationStatus =
  | 'pending'
  | 'retry-wait'
  | 'conflict'
  | 'dead-letter'
export type NoteSource = 'microsoft-notes' | 'local'
export type NoteColor =
  | 'white'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'charcoal'
export type NoteSyncStatus = 'synced' | 'pending' | 'conflict' | 'error'
export type TodoSyncStatus = 'synced' | 'pending' | 'error'
export type AppSyncStatus =
  | 'unauthenticated'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export type NoteAttachmentStorageState = 'available' | 'remote-only' | 'error'

export interface LocalNote {
  id: string
  ownerKey?: string
  remoteId?: string
  title: string
  content: string
  bodyHtml: string
  attachments: LocalNoteAttachment[]
  color: NoteColor
  pinned: boolean
  source: NoteSource
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
  lastSyncedTitle?: string
  lastSyncedBodyHtml?: string
  lastSyncedColor?: NoteColor
  remoteChangeKey?: string
  remoteAttachmentsChangeKey?: string
  localRevision?: number
  syncedRevision?: number
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
  storageState?: NoteAttachmentStorageState
  lastError?: string
}

export interface LocalTodoList {
  id: string
  ownerKey?: string
  remoteId?: string
  displayName: string
  wellknownListName?: string
}

export interface LocalTodo {
  id: string
  ownerKey?: string
  remoteId?: string
  listId: string
  title: string
  body?: string
  status: 'notStarted' | 'inProgress' | 'completed'
  importance?: 'low' | 'normal' | 'high'
  dueDateTime?: string
  createdAt?: string
  updatedAt?: string
  localRevision?: number
  syncedRevision?: number
  syncStatus: TodoSyncStatus
  deleted?: boolean
}

export interface PendingOperation {
  id: string
  ownerKey?: string
  entityType: EntityType
  operation: PendingOperationType
  localId: string
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
  targetRevision?: number
  status?: PendingOperationStatus
  nextAttemptAt?: string
  lastAttemptAt?: string
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
  operationErrors?: number
  lastSyncedAt?: string
}
