## ADDED Requirements

### Requirement: Queue-Backed Local-First Sync
The system shall synchronize notes and todos through a queue-backed local-first model that tolerates offline edits.

#### Scenario: Offline local mutation
When the user creates, updates, or deletes a note or todo while offline, the system shall update local data immediately and record a pending operation for later replay.

#### Scenario: Pending replay on reconnect
When network connectivity returns and pending operations exist, the system shall replay pending operations in creation order before pulling fresh remote data.

#### Scenario: Pending replay on manual sync
When the user manually triggers sync while pending operations exist, the system shall attempt replay before reporting sync completion.

#### Scenario: Failed replay retention
When a pending operation fails to synchronize, the system shall preserve the pending item together with retry metadata and readable error information.

### Requirement: User-Visible Sync Status
The system shall provide visible sync state and service-specific failure messaging.

#### Scenario: Global sync state
When sync state changes, the system shall represent `未登录`, `同步中`, `已同步`, `离线`, and `同步失败` in user-visible UI.

#### Scenario: Notes sync failure messaging
When the Outlook Notes sync flow fails, the system shall display `便签同步失败，可稍后重试`.

#### Scenario: Todo sync failure messaging
When the Microsoft To Do sync flow fails, the system shall display `待办同步失败，可稍后重试`.

#### Scenario: Last sync persistence
When a sync completes successfully, the system shall update the stored last-sync time for later display in settings.

### Requirement: Installable Offline PWA Shell
The system shall behave as an installable PWA that can reopen the application shell offline and render locally cached content.

#### Scenario: Install metadata
When a compatible browser evaluates the app manifest, the system shall identify as `QuickNote` with short name `轻记`, standalone display mode, and the specified theme and background colors.

#### Scenario: Offline shell boot
When the user refreshes the app while offline, the system shall still load the application shell instead of a network failure page.

#### Scenario: Offline local content
When the app shell loads offline and local notes or todos exist, the system shall render the locally cached items from IndexedDB.

#### Scenario: Sensitive caching boundary
When authentication or Graph requests occur, the system shall avoid caching access tokens and Graph auth request results in the service worker cache.
