# Sync and PWA Requirements

## ADDED Requirements

### Requirement: Complete Account-Scoped Notes Delta

The Notes sync flow MUST use a delta cursor isolated by Microsoft `homeAccountId` for complete initial and incremental synchronization.

#### Scenario: Initial sync follows more than 100 notes

- **GIVEN** the Notes folder contains more than one Graph delta page
- **WHEN** an account runs its initial sync
- **THEN** the app follows every `@odata.nextLink`
- **AND** imports all returned notes before saving the final `@odata.deltaLink`

#### Scenario: Account cursors remain isolated

- **GIVEN** two Microsoft accounts have synchronized on the same device
- **WHEN** either account starts a later pull
- **THEN** it uses only the delta cursor stored for its own `homeAccountId`

#### Scenario: Incremental deletion removes the remote-backed note

- **GIVEN** a saved delta link returns an `@removed` entry
- **WHEN** the delta round commits
- **THEN** the corresponding local remote-backed note is deleted by remote ID
- **AND** unrelated local-only notes remain intact

### Requirement: Atomic Delta Cursor Advancement

The Notes sync flow MUST save a replacement delta link only after every page and required note or attachment hydration succeeds.

#### Scenario: Hydration failure does not advance the cursor

- **GIVEN** the current delta link returns one or more changes
- **WHEN** note detail or attachment hydration fails
- **THEN** the app preserves the previous delta link
- **AND** does not apply a partial full-snapshot cleanup
- **AND** a later retry can replay the same delta changes idempotently

### Requirement: Invalid Delta Recovery

The Notes sync flow MUST recover from an invalid or expired delta token by rebuilding a complete snapshot without clearing visible local data first.

#### Scenario: HTTP 410 triggers a safe rebuild

- **GIVEN** the saved account delta link returns HTTP 410
- **WHEN** synchronization handles the error
- **THEN** it clears only that account's cursor
- **AND** requests a new initial delta snapshot
- **AND** keeps existing local notes until the replacement snapshot completes

### Requirement: Graph-Compatible Changed-Note Hydration

Changed notes MUST be hydrated through Graph request shapes supported by the active mailbox.

#### Scenario: Delta omits legacy extended properties

- **GIVEN** the delta response contains only standard message fields
- **WHEN** the app hydrates a changed note
- **THEN** it requests modern color facet metadata and QuickNote rich HTML through regular message detail requests
- **AND** it does not expand legacy extended properties on the delta endpoint

#### Scenario: Modern facet is unavailable

- **GIVEN** a message detail response has no modern note facet
- **WHEN** color hydration continues
- **THEN** the app performs the classic color property fallback request
- **AND** defaults to yellow only when no valid modern or classic color exists

### Requirement: No-Change Notes Refresh Efficiency

A no-change Notes refresh MUST avoid note detail and attachment work.

#### Scenario: Saved delta link returns no changes

- **GIVEN** the account has a valid saved delta link
- **WHEN** Graph returns an empty delta page with a replacement delta link
- **THEN** Notes sync performs one delta request
- **AND** performs zero note-detail requests
- **AND** performs zero attachment-list, attachment-detail, or image-binary requests
