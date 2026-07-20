# Proposal: Optimize Note Layout, Color, and Microsoft Sync

## Summary

Improve the note collection and Microsoft Notes integration by removing visual gaps from variable-height cards, preserving all seven modern Sticky Notes colors, reusing unchanged image attachments, and replacing the limited message pull with account-scoped Microsoft Graph delta synchronization.

## Why This Change

The previous implementation had four related quality problems:

1. Row-based note cards inherited the tallest card height and left large empty regions below shorter cards.
2. The app originally understood only the five classic Outlook `PidLidNoteColor` values, while current Microsoft Sticky Notes data uses a seven-value modern note facet with different numeric codes.
3. Refreshing or pulling a note could request unchanged attachment metadata and image bytes again.
4. The notes pull was capped at the first 100 messages and could not distinguish a no-change refresh from a full collection fetch.

These behaviors made the interface look unfinished, lost remote color fidelity, and caused avoidable Graph traffic.

## Goals

- Render variable-height note cards as a dense masonry flow without row-height gaps.
- Represent Microsoft Sticky Notes colors exactly as white, yellow, green, pink, purple, blue, and charcoal.
- Keep note color selection accessible through labels, radio semantics, keyboard navigation, and a checked state.
- Persist color locally and synchronize changes without waiting for the body autosave timer.
- Reuse unchanged image attachment bytes from IndexedDB.
- Use Microsoft Graph message delta to complete the initial snapshot and perform efficient incremental refreshes.
- Preserve the last valid delta cursor and cached images whenever hydration fails.
- Keep all sync state and discovery caches isolated by Microsoft `homeAccountId`.

## Non-Goals

- Custom note colors or user-defined palettes.
- Color filtering or card-level quick recoloring.
- A global dark theme; charcoal is a Microsoft note color, not an application theme.
- Changing Microsoft To Do synchronization.
- Replacing the Outlook Notes message backend with an unavailable or preview-only Notes endpoint.

## Scope

### Note Collection

- Use CSS multi-column flow for masonry layout.
- Prevent a note card from breaking across columns.
- Preserve responsive column counts and card ordering.

### Microsoft Note Colors

- Add `purple` and `charcoal` to the existing local color model.
- Read modern `IOpenTypedFacet.Com_Microsoft_Note` JSON metadata before the classic property.
- Map modern values exactly: `0 white`, `1 yellow`, `2 green`, `3 pink`, `4 purple`, `5 blue`, `6 charcoal`.
- Keep the classic five-value `PidLidNoteColor` property as an interoperability fallback.
- Write color changes to modern facet metadata and the classic property when possible.
- Rehydrate previously approximated local colors through a versioned full delta snapshot.

### Attachment Reuse

- Persist the remote attachment hydration version with each note.
- Reuse local base64 content when the note `changeKey` and attachment identity remain compatible.
- Download only new or changed images.
- Keep existing local images if a hydration round fails.

### Delta Synchronization

- Follow every initial `@odata.nextLink` until a final `@odata.deltaLink` is returned.
- Use the saved delta link directly on later syncs.
- Apply additions, updates, and `@removed` deletions by remote ID.
- Save a new cursor only after all pages, detail hydration, and attachment hydration succeed.
- Rebuild a full snapshot after an invalid or expired delta token without clearing local data first.

## Constraints

- Continue using the Microsoft Graph v1.0 message APIs and the existing `Mail.ReadWrite` delegated scope.
- Do not expand legacy extended properties on the delta endpoint because affected mailboxes return HTTP 400.
- Query modern color facet metadata and QuickNote rich HTML separately because a combined OR-filtered expansion is not reliable across Microsoft accounts.
- Do not request `contentId` in the attachment collection `$select` for mailboxes where Graph rejects that projection.
- Preserve local-first behavior and offline queue semantics.

## Delivered Outcomes

- Variable-height cards flow without row gaps.
- Live account verification imported 14 notes with exact modern color semantics, including independent purple and charcoal notes.
- A second no-change notes refresh performs one empty delta request and zero note-detail, attachment-list, or image-binary requests.
- Color updates write immediately to IndexedDB and remain stable after another incremental sync.
