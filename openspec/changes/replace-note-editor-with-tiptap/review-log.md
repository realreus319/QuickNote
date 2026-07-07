## proposal Round 1 — 2026-07-07 15:10
### Fixed
- Defined the exact persisted source of truth as `LocalNote.bodyHtml`.
- Locked the supported formatting set and excluded arbitrary HTML preservation.
- Locked image handling to block-only images with the existing attachment store and Graph `cid:` mapping.

### Outstanding
- None.

## design Round 1 — 2026-07-07 15:14
### Fixed
- Defined the exact Tiptap extension set and limited the supported formatting subset.
- Locked block-image rendering to the existing canonical `figure + img` HTML shape.
- Defined the save and sync invariants so the detail route still autosaves `bodyHtml` and attachments through the existing note pipeline.

### Outstanding
- None.

## specs Round 1 — 2026-07-07 15:15
### Fixed
- Added explicit requirements for Tiptap ownership of note body editing.
- Added round-trip guarantees for the approved common formatting set.
- Added requirements for canonicalized merge inputs to avoid false conflicts.

### Outstanding
- None.

## tasks Round 1 — 2026-07-07 15:16
### Fixed
- Sequenced the implementation into dependency integration, normalization, image model, sync hardening, and verification.
- Kept each task within one bounded subsystem and under the current change scope.

### Outstanding
- None.
