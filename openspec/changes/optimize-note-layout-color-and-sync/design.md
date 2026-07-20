# Design: Optimized Note Layout, Color, and Delta Sync

## Overview

The change keeps QuickNote local-first while making remote synchronization version-aware at both the collection and attachment levels. Microsoft Graph delta supplies the collection change set, regular message detail requests hydrate fields that delta cannot safely expand, and IndexedDB remains the render-time source of truth.

## Masonry Note Collection

`NoteMasonry` uses responsive CSS multi-column layout rather than a row-aligned grid. Each card is an inline block with `break-inside: avoid`, full column width, and bottom spacing.

This preserves source ordering while allowing the next card in a column to begin immediately after the previous card, independent of neighboring card height.

## Seven-Color Note Model

### Local Domain

`NoteColor` contains:

- `white`
- `yellow`
- `green`
- `pink`
- `purple`
- `blue`
- `charcoal`

`LocalNote.color` is required. `lastSyncedColor` is the merge baseline. Missing or invalid legacy values migrate to yellow.

### Remote Sources

Modern Microsoft Sticky Notes stores a JSON string in:

```text
String {E550B918-9859-47B9-8095-97E4E72F1926} Name IOpenTypedFacet.Com_Microsoft_Note
```

The JSON `color` field is authoritative and maps one-to-one to the seven local values:

| Modern value | Local color |
| --- | --- |
| 0 | white |
| 1 | yellow |
| 2 | green |
| 3 | pink |
| 4 | purple |
| 5 | blue |
| 6 | charcoal |

Classic Outlook stores `PidLidNoteColor` as:

```text
Integer {0006200E-0000-0000-C000-000000000046} Id 0x8B00
```

The classic property supports only blue, green, pink, yellow, and white. It is read only when the modern facet is missing or malformed. When a modern note changes color, the implementation updates the facet color, its modification timestamp and type metadata, and the classic property for backward compatibility.

For classic-only notes, purple and charcoal have no lossless `PidLidNoteColor` representation; their classic fallback is pink and white respectively. Modern facet metadata remains the source of truth whenever it exists.

### Merge Precedence

- If local color still equals `lastSyncedColor`, accept the remote color.
- If local color changed relative to the baseline, preserve local color and push it during queued synchronization.
- Color changes write to IndexedDB and the operation queue immediately rather than sharing the body editor debounce.

### Visual Tokens

Each color defines OKLCH paper, accent, ink, muted text, placeholder, and picker-identification tokens.

- Note surfaces use low-chroma paper colors for long-form readability.
- Picker swatches use stronger Microsoft-like identification colors.
- Charcoal uses a dark paper surface with light ink and muted text that remains readable.
- The menu exposes a visible color name and checked radio item so color is not the only selection signal.

## Graph-Compatible Detail Hydration

The delta endpoint requests only standard message fields. A changed entry that lacks required fields is supplemented by regular message requests.

Detail hydration uses separate expansions:

1. Full standard note fields plus the modern Sticky Notes facet.
2. QuickNote canonical rich HTML.
3. The classic color property only when the modern facet is absent.

The separation avoids the HTTP 400 behavior observed when delta or a single OR-filtered expansion requests multiple legacy properties.

## Account-Scoped Delta State

The cursor key includes a schema version and `homeAccountId`:

```text
notesDeltaLink:v3:{homeAccountId}
```

The version forces one safe full rehydration after the seven-color model is introduced. Notes folder discovery promises and delta links are also account-isolated.

### Initial Snapshot

1. Discover the Notes messages path for the active account.
2. Request `/messages/delta` with standard note fields.
3. Follow every `@odata.nextLink`.
4. Hydrate changed notes and their required attachments.
5. Upsert the completed change set by remote ID.
6. Reconcile local remote-backed notes missing from the complete snapshot.
7. Save the final `@odata.deltaLink`.

Snapshot reconciliation never deletes local-only notes.

### Incremental Pull

1. Request the saved delta link directly.
2. Upsert additions and changes.
3. Delete local remote-backed records represented by `@removed`.
4. Save the new delta link only after the entire round succeeds.

A no-change response contains an empty `value` array and a replacement delta link, so it requires one Notes request and no note hydration.

### Invalid Cursor Recovery

HTTP 410 and recognized invalid-delta responses clear only the affected account cursor and trigger a full rebuild. Existing local data remains visible until the replacement snapshot completes successfully.

## Attachment Reuse

The note records the `changeKey` used for successful attachment hydration. If a later pull has the same remote version, the local attachment array is reused without listing or downloading attachments.

When the note version changes:

1. List attachment metadata without the Graph-incompatible `contentId` projection.
2. Compare remote ID, name, size, MIME type, inline state, and body CID references against cached attachments.
3. Reuse compatible base64 bytes.
4. Fetch details or binary content only for new or changed images.
5. Preserve body order when remapping attachments into stored canonical HTML.

If any required attachment hydration fails, the delta round fails, cached images remain intact, and the cursor does not advance.

## Failure and Retry Invariants

- The old delta cursor remains valid until the whole new round commits.
- Full-snapshot cleanup occurs only after all pages succeed.
- Attachment failures cannot replace cached images with an empty set.
- Replaying the same delta page is idempotent because notes are upserted by remote ID.
- To Do synchronization remains independent and unchanged.

## Verification Strategy

- Layout source test verifies columns and `break-inside` behavior.
- Color tests cover all seven modern values, classic fallback, invalid values, local precedence, and Graph payloads.
- Delta tests cover multi-page snapshots over 100 items, empty incremental pulls, additions, updates, deletions, account isolation, invalid token rebuild, and cursor atomicity.
- Attachment tests verify unchanged image bytes are reused and color/title-only changes do not redownload images.
- Live verification checks exact local color distribution and a second no-change network round.
