# Notes Requirements

## ADDED Requirements

### Requirement: Tiptap-Based Note Detail Editing

The application MUST use Tiptap as the editing engine for the note detail body instead of the custom `contentEditable` implementation.

#### Scenario: Detail page uses Tiptap transactions instead of direct DOM mutation

- **GIVEN** a user opens a note detail page
- **WHEN** they edit the note body
- **THEN** the editor updates through Tiptap state and commands
- **AND** the app does not rely on `document.execCommand()` or manual `innerHTML` mutation as the primary editing engine

### Requirement: Canonical HTML Source of Truth

The application MUST continue to persist notes as canonical HTML strings in `LocalNote.bodyHtml`.

#### Scenario: Saving a note exports canonical HTML

- **GIVEN** a user edits a note body in Tiptap
- **WHEN** the note autosaves locally
- **THEN** the saved body is normalized into the application's canonical HTML subset
- **AND** no additional persisted JSON source of truth is required

### Requirement: Common Microsoft Notes Formatting Preservation

The application MUST preserve the approved common formatting subset across local editing and Microsoft Notes sync.

#### Scenario: Common formatting round-trips without loss

- **GIVEN** a note body contains paragraphs, bold, italic, underline, strike, lists, links, blockquotes, hard breaks, and block images
- **WHEN** the note is loaded into the detail editor and later synchronized
- **THEN** those supported structures remain semantically intact after the round trip

### Requirement: Block Image Compatibility

The application MUST treat note images as block images that remain compatible with the existing attachment store and Microsoft Notes `cid:` mapping.

#### Scenario: Local attachment renders as a block image

- **GIVEN** a local note attachment is inserted into the body
- **WHEN** the note is exported from the editor
- **THEN** the body stores the image as a canonical block figure with an attachment-backed image reference

#### Scenario: Remote Microsoft image hydrates back into a local block image

- **GIVEN** Microsoft Notes returns note HTML with `cid:` image references and matching attachments
- **WHEN** the note is pulled into local storage
- **THEN** the app restores those images as block image nodes backed by local attachments

### Requirement: Canonicalized Merge Inputs

The note sync flow MUST normalize HTML before comparing or merging local and remote note bodies.

#### Scenario: Equivalent editor rewrites do not create false conflicts

- **GIVEN** local and remote bodies differ only by equivalent HTML normalization output
- **WHEN** sync compares or merges those note bodies
- **THEN** the app treats them as equivalent content instead of generating a needless conflict or full-body overwrite
