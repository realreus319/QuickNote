## ADDED Requirements

### Requirement: Local-First Note Collection
The system shall let authenticated users browse and manage notes through a local-first notes collection that remains readable offline.

#### Scenario: Notes list presentation
When the user opens the notes page, the system shall display notes in a memo-style card collection with title, excerpt, and updated date.

#### Scenario: Offline notes reading
When the device is offline and note records already exist locally, the system shall render those local notes without requiring a remote response.

#### Scenario: Empty notes state
When no notes are available locally or remotely, the system shall show a concise empty state rather than an error or blank page.

### Requirement: Note Creation and Editing
The system shall support note creation and editing with a distraction-free editor.

#### Scenario: Create note
When the user triggers the add-note action, the system shall create a new editable note and allow the user to enter a title and content immediately.

#### Scenario: Editor presentation
When a note is opened, the system shall show a clean note editor with a title input, note metadata, and a plain-text content editor without Markdown or rich-text toolbars.

#### Scenario: Local autosave
When the user changes a note title or body, the system shall save the changes locally without requiring a manual save button.

#### Scenario: Delete note
When the user deletes a note, the system shall remove it from the visible collection and mark it for sync according to local-first sync rules.

### Requirement: Note Organization and Discovery
The system shall support lightweight note organization features without depending on advanced remote note taxonomy.

#### Scenario: Pin note
When the user pins or unpins a note, the system shall persist that preference locally and reflect it in the note collection.

#### Scenario: Local tags
When the user assigns or updates note tags, the system shall store those tags locally even if the remote note API does not provide equivalent tag fields.

#### Scenario: Notes category chips
When the notes page renders, the system shall provide lightweight category chips that include `全部`, `通话笔记`, `未分类`, `工作`, and `个人`.
