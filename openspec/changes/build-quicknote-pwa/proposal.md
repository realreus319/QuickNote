# Proposal: Build QuickNote PWA

## Summary

Create a pure frontend Progressive Web App named `QuickNote / 轻记` that combines lightweight notes and todos with Microsoft account sign-in, Outlook Notes / Sticky Notes sync, Microsoft To Do sync, offline reading, offline editing, local search, and automatic replay of pending changes when connectivity returns.

## Why This Change

The repository is currently empty and does not provide the requested note-taking experience, Microsoft account integration, or local-first sync behavior. The requested product is a consumer note app, not an admin console, so the implementation needs a dedicated shell, local storage model, sync model, and mobile-first interface rather than a generic dashboard scaffold.

## Goals

- Deliver a working MVP that runs entirely in the browser.
- Use `pnpm`, Vite, React, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Router, TanStack Query, Dexie, `@azure/msal-browser`, and `vite-plugin-pwa`.
- Support Microsoft personal account sign-in and sign-out through MSAL.
- Read and write Outlook Notes and Microsoft To Do when permissions and APIs are available.
- Preserve useful offline behavior through IndexedDB-backed local data and a replayable pending queue.
- Ship a mobile-first, notes-app visual design that still works naturally on desktop.
- Build and document the app with `pnpm build`, `pnpm dev`, and `pnpm preview`.

## Non-Goals

- Building a backend, proxy, or server-rendered application.
- Adding collaboration, sharing, comments, attachments, or AI features.
- Implementing a rich text editor, Markdown toolbar, or enterprise workspace features.
- Depending on Microsoft Graph support for note tags or sticky note theming beyond minimal local metadata.
- Caching Graph responses or access tokens in the service worker cache.

## Scope

### In Scope

- Project bootstrap and tooling setup
- Responsive app shell and route structure
- Microsoft sign-in flow and callback handling
- Dexie schema and local repositories
- Query-backed sync and manual retry flows
- Notes CRUD, detail editing, local tags, pinning, and deletion
- Todo list and task CRUD with simple filtering
- Local search across notes and todos
- PWA manifest and offline app shell
- README and local verification commands

### Out of Scope

- Multi-user collaboration
- Server-side data merge logic
- Push notifications
- Rich media note attachments
- Theme marketplace or deep note customization

## Constraints

- Package manager must be `pnpm`.
- Tailwind must use the v4 Vite integration.
- The app must remain pure frontend and must not use a client secret.
- Access tokens must not be stored in IndexedDB.
- The UI must resemble a phone note or memo app instead of a dashboard.
- Outlook Notes failures must degrade gracefully without breaking the rest of the app.

## What Changes

1. Initialize a Vite + React + TypeScript app with `pnpm`.
2. Configure Tailwind CSS v4, shadcn/ui, TanStack Router, TanStack Query, Dexie, MSAL, and PWA support.
3. Build a mobile-first application shell with notes, todos, search, sync, settings, and auth callback routes.
4. Add MSAL-based Microsoft consumer account authentication.
5. Implement Graph API clients for Outlook Notes mailFolder messages and v1.0 To Do endpoints.
6. Add IndexedDB repositories for notes, todo lists, todos, pending operations, and app state.
7. Implement a queue-based sync manager that supports manual sync and replay on reconnect.
8. Implement notes, todos, search, and settings user flows with graceful offline behavior.
9. Document setup, permissions, and operational caveats in `README.md`.

## Risks

- Outlook Notes folder availability and message-class handling may vary by account.
- Service worker caching can accidentally interfere with auth flows if not narrowly scoped.
- Local-first sync introduces identity mapping and retry edge cases for create and delete flows.
- Empty-repo scaffolding means all linting, build, routing, storage, and UI integration must be assembled from scratch.

## Mitigations

- Isolate Graph access behind typed clients with error normalization.
- Persist only app shell assets in the service worker cache.
- Treat sync as queue-driven and idempotent where possible.
- Seed demo data only when remote data is unavailable and keep it clearly replaceable by real sync results.
