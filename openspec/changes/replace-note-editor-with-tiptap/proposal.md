# Proposal: Replace the Note Detail Editor with Tiptap

## Summary

Replace the custom `contentEditable` note detail editor with Tiptap 3.27.2 while keeping HTML as the only persisted note body source. The new editor must preserve the current Microsoft Notes sync model, including inline image attachment mapping, remote HTML pull, and remote HTML push.

## Why This Change

The current note detail editor depends on manual DOM mutation, `execCommand`, and direct `innerHTML` synchronization. That approach has already produced unstable text selection behavior on mobile, formatting regressions, and repeated HTML edge cases. Tiptap provides a maintained ProseMirror-based editing core that can own selection, transactions, parsing, and formatting while still allowing the app to persist HTML.

## Goals

- Replace the note detail editor engine with the current Tiptap release.
- Keep `bodyHtml` as the only persisted note body source.
- Preserve common Microsoft Notes formatting across local editing and remote sync.
- Preserve the current attachment store and `cid:`-based Microsoft Notes image synchronization.
- Normalize note HTML into a stable canonical subset so editor output does not create meaningless sync diffs.

## Non-Goals

- Real-time collaboration
- Markdown as a storage source of truth
- Captioned images
- Arbitrary Microsoft-private HTML preservation outside the approved common formatting set

## In Scope

- Tiptap dependency integration
- Tiptap-based note detail editor implementation
- Canonical HTML normalization for supported rich text
- Block image node support wired to the current local attachment store
- Sync normalization updates needed to keep Graph HTML round-trip stable
- Regression tests for the supported formatting and image paths

## Risks

- Tiptap drops unsupported HTML outside its schema.
- Naive editor output changes could create false-positive note diffs and merge conflicts.
- Image node parsing must remain compatible with both local asset refs and remote `cid:` refs.

## Mitigations

- Limit the supported HTML set explicitly and normalize all note bodies into that canonical subset before persistence and before sync comparisons.
- Keep the existing Graph API shape and attachment diff logic intact.
- Add regression tests for local HTML, remote HTML, and image round trips before replacing the editor UI.
