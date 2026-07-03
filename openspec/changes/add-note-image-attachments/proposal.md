# Proposal: Add Image Attachments to Notes

## Summary

Add image attachments to QuickNote notes so users can paste screenshots, preview attached images, copy them back to the clipboard, and keep them synchronized with the current Microsoft Outlook Notes message backend.

## Why This Change

The current note experience only stores text. Users cannot capture screenshots or visual references, which makes the app incomplete for day-to-day note-taking. The app already uses Outlook message drafts in the Notes folder, and Microsoft Graph provides stable message attachment APIs that can support inline image attachments without returning to the broken `/beta/me/notes` route.

## Goals

- Let users add images to notes from the system clipboard and from local files.
- Preview attached images directly in the note editor.
- Let users copy an attached image back to the clipboard.
- Keep image attachments available offline after the note is opened and synchronized.
- Synchronize images with the Microsoft Notes backend using the existing `Mail.ReadWrite` scope.

## Non-Goals

- Supporting non-image attachments such as PDFs, documents, or archives.
- Building drag-and-drop uploads, image annotation, or resizing tools.
- Adding image attachments to todos.
- Introducing server-side storage or a custom media backend.

## Scope

### In Scope

- Extend the local note schema to persist image attachment metadata and content.
- Add file-picker and clipboard-paste image ingestion in the note detail editor.
- Add preview, remove, and copy-image actions in the note detail editor.
- Encode note bodies as HTML with inline `cid:` image references for remote sync.
- Read image attachments from Microsoft Graph message attachments during note pull sync.
- Replace inline image attachments on remote note update so local and remote state converge.

### Out of Scope

- Arbitrary file attachments
- OCR, AI summarization, or image search
- Inline image placement inside Markdown text flow

## Constraints

- The app must remain pure frontend.
- The implementation must continue using Outlook Notes message APIs under `v1.0`.
- Remote failures must not create duplicate remote notes.
- Attachment upload logic must support the documented Microsoft Graph inline attachment flow and degrade gracefully when clipboard APIs are unavailable.

## What Changes

1. Add a note attachment data model and migration-safe local persistence.
2. Add note body HTML helpers that preserve plain text content and append inline image placeholders.
3. Extend the Graph notes client to list, upload, and delete message attachments.
4. Add note editor controls for image paste, preview, remove, and clipboard copy.
5. Add verification coverage for note HTML rendering and remote attachment mapping.

## Risks

- Partial remote note creation could produce duplicates if attachment upload fails after the message is created.
- Attachment pull can become expensive if every note triggers extra per-message requests.
- Clipboard read and clipboard write image APIs vary across browsers.

## Mitigations

- Roll back remote note creation if any attachment upload fails during initial create.
- Only fetch remote attachments for notes that report `hasAttachments`.
- Keep standard paste handling and file-picker upload paths even when explicit clipboard-read support is unavailable.
