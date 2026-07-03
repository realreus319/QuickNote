# Implementation Plan

- [x] 1. Extend the note data model for image attachments
  - Add local attachment types and note storage fields
  - Add helper functions for base64 conversion, HTML body rendering, and HTML parsing
  - _Requirement: Note Image Attachment Persistence_

- [x] 2. Extend Microsoft Graph note sync for image attachments
  - Fetch message attachments during note pulls when `hasAttachments` is true
  - Upload inline images on create and update, including upload-session fallback
  - Roll back remote note creation if attachment upload fails
  - _Requirement: Synced Inline Image Attachments_

- [x] 3. Add note editor image interactions
  - Support clipboard paste and file picker upload
  - Render image previews with remove and copy actions
  - Autosave attachment mutations through the existing local-first queue
  - _Requirement: Note Editor Image Workflow_

- [x] 4. Verify and document the behavior
  - Add targeted unit tests
  - Update README to note image support and API caveats
  - Run test, lint, typecheck, and build verification
  - _Requirement: Note Image Attachment Persistence, Note Editor Image Workflow, Synced Inline Image Attachments_
