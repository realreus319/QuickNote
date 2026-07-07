# Explore Brief: Replace Note Editor with Tiptap

## Rejected Alternatives

- Keep patching the current `contentEditable` editor: rejected because selection, mobile text dragging, and HTML normalization remain browser-fragile.
- Store Tiptap JSON as the canonical note body: rejected because the current Microsoft Notes sync path already uses HTML end to end and JSON would add conversion and migration risk.
- Use the official experimental Figure example directly: rejected because the example is not published or maintained and the app only needs a narrow image block model.

## Final Commitments

- Persisted note body stays `LocalNote.bodyHtml`.
- Tiptap version family is `3.27.2`.
- Supported round-trip formatting set:
  - paragraphs
  - hard breaks
  - bold
  - italic
  - underline
  - strike
  - ordered lists
  - bullet lists
  - blockquotes
  - links
  - block images
- Image model is block-only and renders back to:
  - `<figure data-quicknote-image="true"><img ... /></figure>`
- Toolbar scope for this change:
  - bold
  - italic
  - strike
  - ordered list
  - bullet list
  - add image
  - paste / drop image

## Cross-Module Data Flow

- Detail route hydrates `title`, `bodyHtml`, and `attachments` from Dexie into the editor shell.
- `bodyHtml` is normalized into Tiptap-compatible HTML before `setContent()`.
- Tiptap `onUpdate` exports HTML back into canonical stored HTML with `quicknote-asset://...` image refs.
- `updateNote()` persists the normalized `bodyHtml` and pruned attachments.
- Graph sync converts stored HTML into remote HTML with `cid:` refs before PATCH / POST.
- Remote note pull converts Graph HTML plus attachments back into stored HTML before Dexie persistence.

## Open Questions Resolved

- Storage model: HTML only.
- Sync fidelity: preserve the common formatting set above, not arbitrary Microsoft-private HTML.
- Image model: block image only, no caption.
- Editor controls: keep the existing toolbar scope and ensure unsupported controls are not added in this change.
