# Notes Requirements

## ADDED Requirements

### Requirement: Dense Variable-Height Note Layout

The note collection MUST place variable-height cards in a dense masonry flow without reserving the height of the tallest neighboring card.

#### Scenario: A tall image card does not create a row gap

- **GIVEN** one note card is substantially taller than adjacent text-only cards
- **WHEN** the note collection renders at a multi-column viewport
- **THEN** the next card in each column begins after the preceding card in that column
- **AND** no empty row-height region is reserved below shorter neighboring cards

#### Scenario: A card remains intact inside one column

- **GIVEN** a note card contains a title, excerpt, metadata, and optional image
- **WHEN** the masonry flow positions the card
- **THEN** the card is not split across columns

### Requirement: Microsoft Seven-Color Notes

The application MUST preserve the seven modern Microsoft Sticky Notes colors as distinct local and remote values.

#### Scenario: Modern remote colors import without approximation

- **GIVEN** Microsoft facet metadata contains a color value from 0 through 6
- **WHEN** the note is hydrated
- **THEN** the app maps the value respectively to white, yellow, green, pink, purple, blue, or charcoal
- **AND** purple is not converted to pink
- **AND** charcoal is not converted to white

#### Scenario: Color picker exposes all Microsoft colors

- **GIVEN** a note detail page is open
- **WHEN** the user opens the color picker
- **THEN** it shows yellow, green, pink, purple, blue, white, and charcoal options
- **AND** the current color has a visible name and checked radio state
- **AND** the menu remains keyboard navigable

#### Scenario: Charcoal remains readable

- **GIVEN** a note uses the charcoal color
- **WHEN** the card or detail page renders
- **THEN** the surface uses a dark charcoal paper color
- **AND** titles, body text, metadata, focus, and controls retain readable contrast

#### Scenario: Classic Outlook color remains compatible

- **GIVEN** a note does not contain modern Sticky Notes facet metadata
- **WHEN** the app reads its classic `PidLidNoteColor` value
- **THEN** it maps the classic blue, green, pink, yellow, or white value correctly

### Requirement: Immediate Offline Color Mutation

Changing note color MUST update local storage and the pending sync queue immediately without waiting for the body editor autosave debounce.

#### Scenario: Offline color change survives reload

- **GIVEN** the device is offline and a note is open
- **WHEN** the user changes its color
- **THEN** the new color is written to IndexedDB immediately
- **AND** a pending update operation is retained for later replay
- **AND** reloading the page still shows the selected color

#### Scenario: Local color change wins over a newer remote color

- **GIVEN** the local color differs from `lastSyncedColor`
- **AND** the remote note also changed color
- **WHEN** synchronization merges the note
- **THEN** the explicitly changed local color is preserved and pushed

### Requirement: Cached Note Attachment Reuse

The application MUST reuse locally persisted image content when the remote attachment version and identity have not changed.

#### Scenario: Reload does not redownload unchanged images

- **GIVEN** a remote note image is already hydrated in IndexedDB
- **AND** the note has the same remote `changeKey`
- **WHEN** the app refreshes and synchronizes
- **THEN** it reuses the local base64 image
- **AND** it does not request the attachment collection, attachment detail, or image binary

#### Scenario: A color-only change keeps cached images

- **GIVEN** a note has one or more synchronized inline images
- **WHEN** only its color changes
- **THEN** the app updates color metadata
- **AND** it does not redownload or reupload unchanged images

#### Scenario: Attachment hydration failure preserves existing images

- **GIVEN** cached images exist for a note
- **WHEN** a required remote attachment request fails
- **THEN** the existing local images remain available
- **AND** the failed sync round does not commit an empty replacement attachment set
