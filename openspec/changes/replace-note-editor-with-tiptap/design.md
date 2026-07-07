# Design: Replace the Note Detail Editor with Tiptap

## Overview

This change swaps the current note detail editor shell from manual `contentEditable` logic to Tiptap 3.27.2. The app continues to persist note bodies as canonical HTML strings, not ProseMirror JSON. Tiptap becomes an editing engine and parser, while `noteRichHtml.ts` remains the canonical bridge between:

- stored local HTML with `quicknote-asset://...` image refs
- hydrated editor HTML with displayable image sources
- remote Microsoft Notes HTML with `cid:` image refs

## Editor Architecture

### Tiptap integration

- Use `useEditor` with `EditorContent`.
- Isolate the editor in its own component so unrelated route state does not re-render it.
- Set `shouldRerenderOnTransaction: false`.
- Use `useEditorState` for toolbar active-state subscriptions.
- Keep note title editing outside the Tiptap document.

### Extensions

- `StarterKit` configured to keep:
  - paragraph
  - hard break
  - bold
  - italic
  - underline
  - strike
  - bullet list
  - ordered list
  - list item
  - blockquote
  - link
- `Image` for image rendering, but only through a wrapped custom node flow.
- `FileHandler` for paste/drop image events.
- A local custom block image extension that parses and renders the app's canonical figure structure.

### Unsupported structures

The editor will not support arbitrary HTML. Content is normalized into the supported common-formatting subset before it reaches Tiptap. Unsupported remote structures are downgraded during normalization instead of being preserved opaquely.

## Canonical HTML Model

### Stored local HTML

The only persisted note body shape is canonical HTML:

- paragraphs as `<p>`
- line breaks as `<br>`
- marks as `<strong>`, `<em>`, `<u>`, `<s>`
- lists as `<ul>/<ol>/<li>`
- blockquote as `<blockquote>`
- links as `<a href="...">`
- images as `<figure data-quicknote-image="true"><img src="quicknote-asset://..." data-attachment-id="..." alt="..."></figure>`

### Hydrated editor HTML

Before editor load, stored image refs are replaced with displayable URLs while retaining `data-attachment-id`. Tiptap edits hydrated HTML, and the export path converts it back into stored canonical HTML before persistence.

### Remote Microsoft Notes HTML

Before Graph write:

- local image refs become `cid:<contentId>`
- local-only attributes are stripped
- figure wrappers remain the canonical block image container

After Graph read:

- remote `cid:` image refs map back to local attachment ids
- images missing from the HTML but present in attachments remain appended as block images, preserving the current fallback behavior

## Image Handling

### Block image node

- Images are block-only.
- The editor does not allow inline image placement inside text nodes.
- The node renders back to the existing figure/image HTML shape so current sync helpers remain valid.

### Image insertion flow

- File paste/drop/button insert goes through `FileHandler` or the existing file picker.
- The file becomes a `LocalNoteAttachment`.
- The editor inserts a block image node tied to the attachment id.
- The exported HTML is canonicalized before calling `onBodyHtmlChange`.

## Save and Sync Flow

### Detail route save loop

- Route hydration still owns `title`, `bodyHtml`, and `attachments`.
- On external note snapshot changes, the editor updates via `setContent(normalizedHtml, { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } })`.
- On editor updates, exported HTML is normalized and passed through the existing autosave debounce.

### Sync invariants

- `LocalNote.bodyHtml` stays the source used by `updateNote()`, `prepareRemoteNoteHtml()`, and merge baselines.
- Three-way merge stays HTML-based.
- All three merge inputs (`base`, `local`, `remote`) are canonicalized before diff-match-patch merge.
- Attachment diff behavior remains unchanged: upload additions, delete removals, keep unchanged attachments.

## Testing Strategy

- Add canonical HTML round-trip tests that cover:
  - stored HTML -> hydrated editor HTML -> stored HTML
  - remote HTML -> stored HTML -> remote HTML
  - supported marks and lists surviving normalization
- Add Tiptap-specific editor tests or helper-level tests to prove:
  - block image insertion exports the expected canonical figure HTML
  - supported HTML imports without dropping required structure
- Keep full-project verification through test, lint, typecheck, and build.
