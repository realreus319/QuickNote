# Design: Refine Note Detail into a Full-Screen Rich HTML Editor

## Overview

The note model will treat `bodyHtml` as the only editable source of truth. The UI will no longer render separate edit and preview copies of the same content. Instead, the detail page hosts one rich HTML editor with inline image insertion, while cards and search use plain text derived from the stored HTML.

## Data Model Changes

### LocalNote additions

- `lastSyncedTitle`
- `lastSyncedBodyHtml`
- `remoteChangeKey`

### LocalNote semantics

- `content`: derived plain text excerpt, not an editable source
- `bodyHtml`: canonical local editor content
- `attachments`: inline image binary store; the editor body references attachments through local asset ids

## Editor Model

### Stored HTML

Local note HTML stores inline images as app-local asset references:

```html
<p>hello</p>
<figure data-quicknote-image="true">
  <img src="quicknote-asset://attachment-1" data-attachment-id="attachment-1" alt="image.png">
</figure>
```

### Display HTML

Before rendering inside the rich editor, asset references are hydrated to displayable `data:` URLs derived from the attachment store. On save, the editor HTML is normalized back to asset references so note bodies do not duplicate image base64 payloads.

### Commands

- bold
- italic
- strike
- unordered list
- ordered list
- paragraph reset
- line break
- insert inline image at current selection

## Full-Screen Detail Route

`/notes/$noteId` becomes a shell exception:

- no bottom navigation
- no floating add button
- no outer memo-card container
- minimal header only

## Sync Strategy

## Field-Level Change Detection

For each note sync attempt:

- compare local title with `lastSyncedTitle`
- compare local `bodyHtml` with `lastSyncedBodyHtml`
- compare attachment ids and content hashes with the last synced attachment baseline

Only changed fields are included in the Graph PATCH body.

## Three-Way Merge

When remote `changeKey` differs from local `remoteChangeKey`:

- fetch the latest remote note
- merge title using `base -> local` patch application onto remote title
- merge `bodyHtml` using `base -> local` patch application onto remote HTML
- if any patch application fails, stop and leave the note pending with conflict status instead of overwriting remote state

This does not rely on Graph providing character-level patch APIs; it uses local diff application to produce the next whole-field value.

## Attachment Diff

- additions: upload only new inline image attachments
- deletions: delete only removed attachments
- unchanged images: keep as-is
- reorder: update HTML only

## View Transitions

Each note card and detail page root gets a stable `view-transition-name` derived from note id. Navigation is wrapped in `document.startViewTransition()` when supported. Browsers without the API use normal route navigation.

## Verification

- Unit tests for stored HTML <-> hydrated HTML conversion
- Unit tests for body merge behavior against moved remote `changeKey`
- Unit tests for remote body conversion between local asset urls and remote `cid:` refs
