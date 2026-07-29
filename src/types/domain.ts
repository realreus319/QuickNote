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
  /** Plain-text projection derived from bodyHtml for search, preview and merge checks. */
  content: string
  /** Canonical local HTML. Tiptap hydrates from it and images use quicknote-asset:// IDs. */
  bodyHtml: string
  attachments: LocalNoteAttachment[]
  color: NoteColor
  pinned: boolean
  source: NoteSource
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
  /** Last server-confirmed title used as the common base for three-way merge. */
  lastSyncedTitle?: string
  /** Last server-confirmed canonical HTML used as the common merge ancestor. */
  lastSyncedBodyHtml?: string
  lastSyncedColor?: NoteColor
  /** Graph changeKey observed for the last hydrated server snapshot. */
  remoteChangeKey?: string
  remoteAttachmentsChangeKey?: string
  /** Monotonic local edit version captured by each Outbox operation. */
  localRevision?: number
  /** Highest local revision confirmed by Graph and safely applied locally. */
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
  base64?: string
  contentId: string
  createdAt: string
  storageState?: NoteAttachmentStorageState
  lastError?: string
}

export interface NoteAttachmentBlobRecord {
  id: string
  ownerKey: string
  noteId: string
  attachmentId: string
  blob: Blob
  mimeType: string
  size: number
  createdAt: string
  lastAccessedAt: string
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
