# Proposal: Refine Note Detail into a Full-Screen Rich HTML Editor

## Summary

Replace the current split note detail experience with a single rich HTML editor that renders formatting inline, places images inside the note body at their actual positions, removes the bottom navigation from the detail route, and synchronizes note changes using remote-version-aware merge logic instead of blunt full-note replacement behavior.

## Why This Change

The current detail route duplicates content across an editable textarea, attachment gallery, and markdown preview. It also strips formatting on sync because the app flattens remote HTML into plain text. The user expects a phone-style note detail page with one rendered body, inline images, stable rich text formatting, and smoother note-to-detail transitions.

## Goals

- Make the note detail page a single full-screen editing surface.
- Use HTML rich text as the canonical note body format.
- Keep images inline at their body positions instead of a separate attachment section.
- Preserve formatting across local edits and remote sync.
- Use remote `changeKey` data to merge title and body changes more safely before PATCH.
- Add card-to-detail and detail-to-list transitions when supported by the browser.

## Non-Goals

- Real-time multi-user collaboration
- Arbitrary third-party embeds
- A server-side operational transform or CRDT backend

## Scope

### In Scope

- Full-screen detail layout and shell exceptions for `/notes/$noteId`
- Rich HTML editing toolbar and inline image insertion
- Local HTML normalization and plain-text excerpt derivation
- Remote HTML storage and retrieval without markdown round-trip loss
- Fine-grained note sync driven by per-field change detection and three-way merge
- Shared-element style transitions between note cards and detail pages

### Out of Scope

- Rich text comments or mentions
- Desktop split-pane note editor
- Semantic collaborative conflict UI beyond existing sync status surfaces

## Constraints

- The app must remain pure frontend.
- Sync must continue using Microsoft Graph message APIs under `v1.0`.
- The implementation must degrade safely on browsers without `View Transition API`.
- The merge logic must not silently overwrite remote changes when the remote `changeKey` moved and patch application fails.

## Risks

- Browser `contenteditable` behavior can vary across mobile engines.
- Raw HTML diff-and-patch merge may fail when local and remote edits touch the same regions.
- Outlook may rewrite parts of stored HTML, complicating stable merge baselines.

## Mitigations

- Normalize editor HTML before local persistence and before sync comparisons.
- Use baseline-aware three-way merge with an explicit failure path that leaves the note pending instead of overwriting remote data blindly.
- Keep a plain-text excerpt derived from HTML for cards and search so the surrounding app remains stable.
