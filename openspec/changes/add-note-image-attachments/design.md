# Design: Add Image Attachments to Notes

## Overview

The feature extends the existing local-first note model with an `attachments` array that stores image metadata and base64 content. The note editor becomes the primary interaction surface for adding and previewing images, while the sync layer converts those attachments into inline Outlook message attachments referenced from the message HTML body by `cid:`.

## Data Model

### LocalNoteAttachment

- `id`
- `remoteId`
- `name`
- `mimeType`
- `size`
- `base64`
- `contentId`
- `createdAt`

### LocalNote

Add:

- `attachments`

The app keeps attachments embedded inside the note record instead of a separate Dexie table so note create/update queue payloads stay self-contained and replayable.

## Local Editing Flow

### Add Attachment

The editor supports two ingestion paths:

1. Native paste into the note textarea or note editor container
2. Explicit actions:
   - file picker upload
   - clipboard read button for browsers that expose `navigator.clipboard.read()`

Accepted types are image MIME types supported by the current implementation target. Each accepted image is converted to base64 once and stored in the note record.

### Preview and Removal

Attached images render in a compact preview grid below the textarea. Each preview cell exposes:

- filename
- size label
- copy image action
- remove action

### Copy to Clipboard

The preferred path uses `ClipboardItem` with the original MIME type. If the browser refuses image clipboard writes, the UI reports that limitation and keeps the attachment intact.

## Remote Sync Model

## Remote Body Format

The remote message body becomes HTML. The text portion is HTML-escaped and line breaks are preserved. Each attachment is appended as an inline image block:

```html
<p>escaped note text</p>
<figure data-quicknote-image="true">
  <img src="cid:quicknote-image-123" alt="filename.png" />
</figure>
```

This preserves plain text content for round-trip parsing and uses the documented inline image attachment flow for Microsoft Graph message attachments.

### Create

1. Create the note message in the Notes folder with the HTML body and `IPM.StickyNote` message class.
2. Upload all image attachments:
   - direct attachment POST when under 3 MB
   - upload session when above 3 MB
3. If any attachment upload fails, delete the just-created remote note and surface an error so the queued create can retry safely.

### Update

1. Patch the remote message body HTML.
2. List existing remote attachments for that message.
3. Delete existing inline image attachments managed by the note body.
4. Upload the current local image attachments.

The update flow is intentionally convergent rather than patch-diff-based; retrying the same update must reach the same remote result.

### Pull

1. Fetch notes from the Notes folder and include `hasAttachments`.
2. Only for notes where `hasAttachments` is true:
   - list message attachments
   - fetch image attachment details
   - fall back to `/$value` download if metadata does not include bytes
3. Parse the HTML body back into plain text and preserve image ordering using `cid:` references from the body.

## Error Handling

- Unsupported clipboard APIs:
  - keep file upload and standard paste available
  - show a concise toast message for explicit copy/paste actions that are blocked
- Oversized or unsupported images:
  - reject the image before it is written into Dexie
  - show a user-facing message immediately
- Pull attachment failure for one note:
  - keep the note text
  - treat that note as having zero pulled attachments for the current sync pass instead of failing all note pull

## Verification Strategy

- Add targeted unit tests for note HTML rendering and HTML-to-text round-trip behavior.
- Add targeted unit tests for remote attachment ordering based on `cid:` references.
- Run lint, typecheck, tests, and build before closing the change.
