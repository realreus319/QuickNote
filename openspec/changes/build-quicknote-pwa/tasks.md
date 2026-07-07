# Implementation Plan

- [x] 1. Bootstrap the frontend workspace
  - Initialize the root Vite React TypeScript project with `pnpm`
  - Add Tailwind CSS v4, shadcn/ui prerequisites, TanStack Router, TanStack Query, Dexie, MSAL, and PWA dependencies
  - Configure ESLint, TypeScript build, and base scripts
  - _Requirement: Microsoft Account Session Gate, Installable Offline PWA Shell_

- [x] 2. Establish app styling and shell primitives
  - Create the global design tokens and Tailwind-compatible stylesheet
  - Add the main app shell, responsive navigation, page layout, and floating action button
  - Add shared empty, loading, error, and sync badge states
  - _Requirement: Responsive Memo-Style Application Shell_

- [x] 3. Configure routing and root providers
  - Set up TanStack Router routes for all required destinations
  - Wire QueryClient, AuthProvider, and router providers in the root app
  - Add route guards and redirect behavior for signed-in and signed-out flows
  - _Requirement: Microsoft Account Session Gate, Responsive Memo-Style Application Shell_

- [x] 4. Implement MSAL authentication
  - Configure MSAL with the provided Microsoft consumer application settings
  - Add login, logout, redirect callback handling, and token acquisition helpers
  - Surface auth failure states without breaking local read-only usage
  - _Requirement: Microsoft Account Session Gate_

- [x] 5. Build the Dexie local data layer
  - Implement Dexie schema and repositories for notes, todo lists, todos, pending operations, and app state
  - Add helper functions for counts, filters, and local search reads
  - Add demo seed behavior for first-run empty state
  - _Requirement: Local-First Note Collection, Todo List and Task Management, Offline Local Search, Queue-Backed Local-First Sync_

- [x] 6. Implement Microsoft Graph clients
  - Add shared Graph fetch logic with normalized errors
  - Implement notes and todo API wrappers for the required endpoints
  - Ensure Graph and auth requests are isolated from service worker caching
  - _Requirement: Microsoft Account Session Gate, Queue-Backed Local-First Sync, User-Visible Sync Status_

- [x] 7. Build sync orchestration
  - Implement network status helpers and sync manager
  - Replay pending operations in order and reconcile returned remote IDs
  - Persist sync status, last sync time, and failure messages in app state
  - _Requirement: Queue-Backed Local-First Sync, User-Visible Sync Status_

- [x] 8. Implement the notes experience
  - Build the notes list, tag chips, masonry layout, and note cards
  - Build the note detail editor with local autosave and delete flow
  - Wire local-first mutations and sync queue integration for note CRUD
  - _Requirement: Local-First Note Collection, Note Creation and Editing, Note Organization and Discovery_

- [x] 9. Implement the todo experience
  - Build the todo page, filters, list picker, and quick-add controls
  - Wire local-first todo create, update, complete, and delete flows
  - Reflect completed-state styling and offline behavior
  - _Requirement: Todo List and Task Management, Todo Filtering_

- [x] 10. Implement unified local search and sync/settings pages
  - Build grouped search results for notes and todos using local repositories
  - Build the sync page and settings page with manual sync, cache actions, and state summaries
  - Surface beta and offline messaging using consumer-friendly copy
  - _Requirement: Offline Local Search, Settings Visibility, User-Visible Sync Status_

- [x] 11. Configure the PWA runtime
  - Add the PWA manifest and service worker configuration
  - Precache only the app shell and static assets
  - Verify offline shell boot and local IndexedDB rendering behavior
  - _Requirement: Installable Offline PWA Shell_

- [x] 12. Finalize documentation and verification
  - Write README setup, Microsoft app registration, offline notes, and troubleshooting guidance
  - Run lint, typecheck, and build verification
  - Update this task list with final statuses
  - _Requirement: Microsoft Account Session Gate, Installable Offline PWA Shell_
