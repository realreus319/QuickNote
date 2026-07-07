# Explore Brief

## Rejected Approaches

- Keep `textarea + markdown preview + attachment panel`
  - Rejected because the same note content is rendered multiple times, formatting semantics are split across markdown and HTML, and inline images cannot live naturally in the body flow.
- Keep markdown as the source of truth and embed hidden raw markdown inside remote HTML
  - Rejected because the user explicitly wants a single HTML rich-text renderer, not a markdown-first editor model.
- Replace the whole sync pipeline with CRDT or collaborative editor infra
  - Rejected because the app is still single-user and the Graph backend only accepts whole-field body updates.

## Final Mapping Tables

### Local note fields

- `title`: note title
- `content`: plain-text excerpt derived from HTML for cards, search, and sharing
- `bodyHtml`: canonical local rich HTML
- `lastSyncedTitle`: last remote-synced title baseline
- `lastSyncedBodyHtml`: last remote-synced HTML baseline
- `remoteChangeKey`: latest remote message version token
- `attachments[]`: inline image binary store keyed by local attachment id

### Editor commands

- `bold`
- `italic`
- `strikeThrough`
- `insertUnorderedList`
- `insertOrderedList`
- `insertParagraph`
- `insertLineBreak`
- `insertInlineImage`

### Shell behavior

- `/notes`: list shell with bottom bar and floating add button
- `/notes/$noteId`: full-screen detail page without bottom bar or outer card container

## Key Data Flows

- Note card click -> optional `document.startViewTransition()` -> route navigation -> full-screen detail page
- Rich editor input -> normalized stored HTML -> plain-text excerpt derivation -> local Dexie update -> pending queue
- Sync update -> fetch remote note + `changeKey` -> three-way merge against `lastSynced*` baselines -> PATCH changed fields only -> attachment diff upload/delete -> baseline refresh
- Remote pull -> remote HTML + inline attachments -> convert `cid:` image references to local asset references -> Dexie write

## Open Questions

- Whether remote HTML from Outlook may inject wrapper tags that need normalization before merge
- Whether mobile browsers used by the user fully support `View Transition API`; fallback remains route navigation without animation
