# Notes Requirements

## ADDED Requirements

### Requirement: Canonical Rich HTML Note Body

The application MUST treat a note's rich HTML body as the single editable source of truth for the detail page.

#### Scenario: Detail page does not duplicate the same note body

- **GIVEN** a note detail page is open
- **WHEN** the user edits the note body
- **THEN** the page shows one editable rich body instead of separate duplicated edit and preview blocks

### Requirement: Inline Note Images

The detail editor MUST render inserted images inline at their body positions and preserve those positions across reload and sync.

#### Scenario: Pasted image appears at the current cursor position

- **GIVEN** the cursor is inside a note body
- **WHEN** the user pastes an image
- **THEN** the image appears inline at that position in the note body

### Requirement: Full-Screen Note Detail

The detail route MUST render as a dedicated full-screen page without the list-route bottom bar or outer card container.

#### Scenario: Detail route hides list shell chrome

- **GIVEN** a user opens `/notes/{noteId}`
- **WHEN** the detail page renders
- **THEN** the bottom navigation is not shown
- **AND** the note body is not wrapped inside the list-style memo card container

### Requirement: Card-To-Detail Transition

The application MUST animate note card entry and exit into the detail page when the browser supports view transitions.

#### Scenario: Card expands into detail page

- **GIVEN** a browser supports the View Transition API
- **WHEN** the user opens a note from the list
- **THEN** the note card transitions into the detail page instead of jumping abruptly

### Requirement: Version-Aware Note Merge

The note sync flow MUST use last-synced baselines and remote version tokens to avoid blunt overwrites when remote edits also occurred.

#### Scenario: Local edits merge onto a newer remote note

- **GIVEN** a local note has unsynced changes
- **AND** the remote note `changeKey` changed since the last successful sync
- **WHEN** sync runs
- **THEN** the app attempts a three-way merge using the last synced note as the base
- **AND** it only updates the changed title and body fields if the merge succeeds

#### Scenario: Merge failure avoids silent overwrite

- **GIVEN** local and remote edits overlap so the merge cannot be applied safely
- **WHEN** sync runs
- **THEN** the note remains pending or conflict-marked locally
- **AND** the app does not overwrite the newer remote note body blindly

### Requirement: Differential Inline Image Sync

The note sync flow MUST synchronize inline images by diffing attachment additions and deletions instead of replacing every attachment on each update.

#### Scenario: Reordering images changes only the body html

- **GIVEN** a note keeps the same inline images but changes their order in the body
- **WHEN** sync runs
- **THEN** the app updates the body html
- **AND** it does not re-upload unchanged images
