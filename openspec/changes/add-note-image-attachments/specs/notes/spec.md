# Notes Requirements

## ADDED Requirements

### Requirement: Note Image Attachment Persistence

The note model MUST persist image attachments locally so pasted or uploaded images remain available after reload and offline use.

#### Scenario: Reload preserves note images

- **GIVEN** a user added one or more images to a note
- **WHEN** the page reloads while the device is offline
- **THEN** the note still shows the saved image previews from local storage

### Requirement: Note Editor Image Workflow

The note editor MUST let users add image attachments from clipboard paste or file selection, preview them, remove them, and copy them back to the clipboard when the browser allows it.

#### Scenario: Pasting a screenshot into a note

- **GIVEN** a note detail page is open
- **AND** the system clipboard contains an image
- **WHEN** the user pastes into the note editor
- **THEN** the image is attached to the note
- **AND** the preview grid updates without waiting for remote sync

#### Scenario: Copying an existing image attachment

- **GIVEN** a note has an image attachment preview
- **WHEN** the user activates the copy image action
- **THEN** the app attempts to write the image to the clipboard
- **AND** the app reports if the current browser blocks image clipboard writes

### Requirement: Synced Inline Image Attachments

The note sync flow MUST synchronize image attachments with the Microsoft Notes backend using inline Outlook message attachments referenced from the note HTML body.

#### Scenario: Sync pushes local images to Microsoft

- **GIVEN** a locally edited note has one or more image attachments
- **WHEN** sync runs successfully with a valid Microsoft token
- **THEN** the remote note body references the images by `cid:`
- **AND** the remote message stores matching inline image attachments

#### Scenario: Remote create rollback prevents duplicates

- **GIVEN** a local note is being created remotely with image attachments
- **WHEN** message creation succeeds but one attachment upload fails
- **THEN** the remote message is deleted before the operation fails
- **AND** the local pending create remains retryable without creating duplicate remote notes
