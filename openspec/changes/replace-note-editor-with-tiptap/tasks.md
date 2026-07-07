# Implementation Plan

- [ ] 1. Create the Tiptap editor integration and dependency set
  - Add Tiptap 3.27.2 packages and remove the old markdown preview dependencies that are no longer needed
  - Replace the custom `contentEditable` note editor shell with an isolated Tiptap component
  - _Requirement: Tiptap-Based Note Detail Editing_

- [ ] 2. Introduce canonical Tiptap HTML normalization
  - Normalize stored, hydrated, and remote note HTML into one supported subset
  - Keep `LocalNote.bodyHtml` as the only persisted note body source
  - _Requirement: Canonical HTML Source of Truth, Common Microsoft Notes Formatting Preservation_

- [ ] 3. Rebuild image editing on top of a block image node
  - Insert pasted, dropped, and selected files as block images tied to the existing attachment store
  - Preserve the current Microsoft Notes `cid:` attachment mapping
  - _Requirement: Block Image Compatibility_

- [ ] 4. Harden sync and merge behavior for canonical HTML
  - Canonicalize merge inputs before diff-match-patch comparisons
  - Keep attachment diff semantics unchanged while avoiding false body conflicts
  - _Requirement: Canonicalized Merge Inputs_

- [ ] 5. Verify the Tiptap replacement end to end
  - Add regression tests for supported formatting and image round trips
  - Run `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`
  - _Requirement: Tiptap-Based Note Detail Editing, Common Microsoft Notes Formatting Preservation, Block Image Compatibility_
