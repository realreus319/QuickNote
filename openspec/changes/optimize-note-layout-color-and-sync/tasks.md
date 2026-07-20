# Implementation Plan

- [x] 1. Remove gaps from the note masonry
  - Replace row-aligned card layout with responsive CSS columns
  - Prevent individual note cards from breaking across columns
  - Add layout source verification
  - _Requirement: Dense Variable-Height Note Layout_

- [x] 2. Reuse unchanged image attachments
  - Persist the successfully hydrated remote attachment version
  - Reuse IndexedDB base64 content for unchanged note and attachment identities
  - Preserve cached images and the old delta cursor on hydration failure
  - Add API and attachment reuse tests
  - _Requirement: Cached Note Attachment Reuse_

- [x] 3. Synchronize the Microsoft seven-color model
  - Persist color and `lastSyncedColor`
  - Read and write modern Sticky Notes facet metadata
  - Retain classic `PidLidNoteColor` compatibility
  - Add exact purple and charcoal domain values and visual tokens
  - Add an accessible seven-option radio menu
  - Version the delta cursor to force one safe color rehydration
  - _Requirement: Microsoft Seven-Color Notes, Immediate Offline Color Mutation_

- [x] 4. Replace capped note pulls with account-scoped delta sync
  - Follow all initial pages and save the final delta link
  - Apply incremental additions, updates, and deletions by remote ID
  - Keep cursor updates atomic with note and attachment hydration
  - Recover from invalid tokens through a non-destructive full rebuild
  - Keep Microsoft To Do synchronization unchanged
  - _Requirement: Complete Account-Scoped Notes Delta, Atomic Delta Cursor Advancement, Invalid Delta Recovery_

- [x] 5. Handle live Microsoft Graph constraints
  - Remove extended-property expansion from the delta request
  - Hydrate modern color facet and QuickNote rich HTML through separate detail requests
  - Avoid the unsupported attachment `contentId` collection projection
  - Verify live sync no longer returns HTTP 400
  - _Requirement: Graph-Compatible Changed-Note Hydration_

- [x] 6. Verify production behavior
  - Run targeted layout, color, Notes API, attachment, and delta tests
  - Run changed-file lint and TypeScript checks
  - Run the production build
  - Verify exact seven-color data against an authenticated Microsoft account
  - Verify a second no-change refresh performs no detail or attachment requests
  - _Requirement: No-Change Notes Refresh Efficiency_
