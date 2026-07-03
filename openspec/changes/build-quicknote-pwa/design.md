# Design: Build QuickNote PWA

## Purpose Statement

QuickNote is a lightweight browser-first notes and todo app for personal Microsoft account users who want the feel of a phone memo application with the safety of local-first storage. The design must optimize for quick capture, readable editing, offline continuity, and unobtrusive sync rather than dense controls or administration-heavy surfaces.

## Design Specification

### Aesthetic Direction

Editorial memo minimalism with warm utility accents. The interface should feel like a native notes application: quiet surfaces, large breathing room, restrained strokes, and a single warm yellow call-to-action used only where the app asks the user to create or sync.

### Color Palette

- Background: `#F6F6F4`
- Alternate background: `#F7F7F5`
- Surface: `#FFFFFF`
- Primary text: `#1F1F1F`
- Secondary text: `#777777`
- Weak text: `#B5B5B5`
- Divider: `#EEEEEE`
- Search field: `#ECECEA`
- Accent: `#F6BE3A`
- Accent alt: `#F5C242`

### Typography

User constraints override generic design defaults here. The app will use the mandated system stack to preserve native memo-app familiarity:

- `-apple-system`
- `BlinkMacSystemFont`
- `"Segoe UI"`
- `"PingFang SC"`
- `"Microsoft YaHei"`
- `sans-serif`

Type scale should skew larger than default web dashboards:

- App titles: 28 to 32 px, semibold
- Section titles: 20 to 24 px, semibold
- Body text: 15 to 17 px
- Metadata: 12 to 13 px

### Layout Strategy

- Mobile-first single-column shell with a fixed bottom navigation and floating add button
- Notes list as a two-column masonry wall with non-uniform cards to preserve memo-app rhythm
- Desktop as a restrained split layout: left nav rail, center collection pane, optional right editor/detail pane
- Large padding, generous row height, and soft rounded surfaces instead of widget-heavy chrome

## Architecture Overview

The application remains entirely frontend and is split into five layers:

1. `auth/`
   - Owns MSAL configuration, account state, and access token acquisition.
2. `graph/`
   - Owns typed Microsoft Graph request functions and error normalization.
3. `db/`
   - Owns Dexie schema plus repository helpers for notes, todos, queue items, and app state.
4. `query/` and `sync/`
   - Own service-side orchestration: fetch, sync, retry, queue replay, network recovery, and status reporting.
5. `routes/` and `components/`
   - Own the user-facing shell, pages, and mobile/desktop interactions.

## Runtime Model

### Auth State

- MSAL owns token caching in browser storage.
- The React app exposes auth state through `AuthProvider`.
- Protected flows request tokens lazily when sync or fetch work starts.
- If auth fails or the user is signed out, remote fetches stop and local data remains readable.

### Local Data State

- Dexie is the source of truth for offline reading, search, queueing, and last-known remote snapshots.
- TanStack Query is the source of truth for in-flight remote operations, fetch status, sync mutations, retries, and refetch on reconnect.
- UI pages read from Dexie-backed query functions so rendering stays stable offline.

### Sync State

- `syncManager` coordinates a full sync cycle:
  1. acquire account and token
  2. flush pending queue sequentially
  3. fetch latest notes
  4. fetch todo lists and tasks
  5. write normalized data back to Dexie
  6. update app state timestamps and sync badge state
- Sync status is persisted in `appState` so the settings page and global badge can show current state after reload.

## Data Model

### Dexie Tables

#### `notes`

- `id`
- `remoteId`
- `title`
- `content`
- `bodyHtml`
- `tags`
- `pinned`
- `source`
- `createdAt`
- `updatedAt`
- `lastSyncedAt`
- `syncStatus`
- `deleted`

Indexes:

- `id`
- `remoteId`
- `updatedAt`
- `pinned`
- `syncStatus`
- multi-entry `tags`

#### `todoLists`

- `id`
- `remoteId`
- `displayName`
- `wellknownListName`

Indexes:

- `id`
- `remoteId`
- `wellknownListName`

#### `todos`

- `id`
- `remoteId`
- `listId`
- `title`
- `body`
- `status`
- `importance`
- `dueDateTime`
- `createdAt`
- `updatedAt`
- `syncStatus`
- `deleted`

Indexes:

- `id`
- `remoteId`
- `listId`
- `status`
- `dueDateTime`
- `syncStatus`

#### `pendingOperations`

- `id`
- `entityType`
- `operation`
- `localId`
- `payload`
- `createdAt`
- `retryCount`
- `lastError`

Indexes:

- `id`
- `entityType`
- `localId`
- `createdAt`

#### `appState`

- `key`
- `value`

Keys include:

- `lastSyncedAt`
- `syncStatus`
- `lastSyncError`
- `networkStatus`
- `demoSeeded`

## Route Design

- `/`
  - Login gate when signed out
  - Redirect to `/notes` when signed in
- `/notes`
  - Notes masonry list, tag pills, search launcher, floating add button
- `/notes/$noteId`
  - Note editor view
  - On desktop, may also be used in a split pane
- `/todos`
  - Todo list with filter tabs and quick add
- `/search`
  - Unified local search across notes and todos
- `/sync`
  - Sync activity and queue view for debugging user-visible sync state
- `/settings`
  - Account, network, local cache counts, sync actions, and beta warning
- `/auth/callback`
  - MSAL redirect processing and route recovery

## Graph Integration

### Authentication

- `clientId`: `28ff6548-87cc-47c8-b478-335cdcabde6c`
- `authority`: `https://login.microsoftonline.com/consumers`
- `redirectUri`: `window.location.origin`
- scopes:
  - `User.Read`
  - `offline_access`
  - `Tasks.ReadWrite`
  - `Mail.ReadWrite`

### API Clients

`graphClient.ts` responsibilities:

- acquire a valid token
- inject `Authorization: Bearer`
- send JSON requests
- normalize Graph errors into user-displayable application errors

`notesApi.ts` responsibilities:

- fetch notes from `v1.0/me/mailFolders/notes/messages`
- fall back to resolving the localized Outlook Notes folder through `mailFolders`
- create note messages with the `IPM.StickyNote` message class
- update and delete note messages

`todoApi.ts` responsibilities:

- fetch todo lists
- fetch tasks for each list
- create task
- update task
- delete task

### Error Policy

- Outlook Notes sync failures should map to `便签同步失败，可稍后重试`
- To Do API failures should map to `待办同步失败，可稍后重试`
- Auth and permission failures should not wipe local data
- Token or permission errors should surface in settings and sync views

## Offline and Queue Design

### Local Mutation Strategy

When the user edits while offline or before a remote write completes:

- update Dexie immediately
- mark entity `syncStatus` as `pending`
- enqueue a `PendingOperation`
- reflect pending state in UI without blocking editing

### Queue Replay Strategy

Pending operations execute oldest-first and one-at-a-time:

1. create note or todo
2. update note or todo
3. delete note or todo

Rules:

- Create replay maps returned remote IDs back onto local entities.
- Update replay skips if the local entity is already deleted.
- Delete replay clears local deleted entries after remote success.
- Failures increment `retryCount`, persist `lastError`, and stop the current replay loop to avoid cascading invalid state.
- Replay re-runs automatically when:
  - app becomes online
  - user manually triggers sync
  - app starts online with pending operations present

## Search Design

- Search reads exclusively from Dexie.
- Notes match on title, content, and tags.
- Todos match on title and optional body.
- Results are grouped into `笔记` and `待办`.
- Empty state remains available offline and does not depend on Graph access.

## Component Design

### Shell Components

- `AppShell`
  - responsive layout wrapper
- `BottomNav`
  - mobile navigation
- `DesktopSidebar`
  - desktop primary navigation
- `TopBar`
  - page title and contextual actions
- `FloatingAddButton`
  - route-aware create action
- `SyncBadge`
  - shows sync and offline state

### Notes Components

- `NoteCard`
  - renders title, excerpt, updated date, pinned state
- `NoteMasonry`
  - two-column mobile wall and responsive desktop grid
- `NoteEditor`
  - title input, metadata row, content textarea, autosave behavior
- `NoteDetailHeader`
  - back, share placeholder, palette placeholder, more menu

### Todo Components

- `TodoItem`
  - checkbox, title, due date, status styling
- `TodoListPicker`
  - chooses Microsoft todo list
- `TodoQuickAdd`
  - inline entry for a new task

### Shared Components

- `SearchInput`
- `EmptyState`
- `LoadingState`
- `ErrorState`

## PWA Design

- Use `vite-plugin-pwa` with an app-shell precache strategy.
- Precache only static application assets and shell routes.
- Exclude Microsoft Graph requests and auth callback traffic from runtime caching.
- Do not cache access tokens anywhere in the service worker.
- When offline, the service worker should still return the app shell so React can boot and read Dexie.

Manifest fields:

- `name`: `QuickNote`
- `short_name`: `轻记`
- `display`: `standalone`
- `theme_color`: `#F6BE3A`
- `background_color`: `#F6F6F4`

## Implementation Notes

- Because the repo is empty, scaffolding will create a root app directly in the current workspace rather than nesting a second repository inside `quicknote/`.
- Demo seed data should be injected only when no real local or remote data exists, so the app remains useful before first sync without masking real Microsoft data.
- The note editor should prefer `textarea` for stability and autosave on debounced local writes.

## Verification Strategy

- Static verification:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
- Manual verification:
  - signed-out login page
  - signed-in route access
  - note create and edit flow
  - todo create and complete flow
  - offline app shell load
  - offline read from IndexedDB
  - queue replay on reconnect
  - search while offline
  - responsive review at 390 px and 1440 px
