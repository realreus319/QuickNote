## ADDED Requirements

### Requirement: Microsoft Account Session Gate
The system shall provide Microsoft consumer account sign-in and sign-out for QuickNote without requiring a backend secret.

#### Scenario: Signed-out landing page
When the user opens the app without an authenticated Microsoft session, the system shall display a concise login page showing the app name `QuickNote`, the subtitle `轻量便签与待办，同步到你的 Microsoft 账户`, and a primary action to connect a Microsoft account.

#### Scenario: Successful login redirect
When Microsoft authentication completes successfully, the system shall restore the app session and route the user into the authenticated application experience.

#### Scenario: Signed-out remote protection
While the user is not authenticated, the system shall prevent remote sync requests and shall keep previously cached local content readable.

#### Scenario: Sign-out cleanup
When the user signs out, the system shall clear active auth session state from the app shell and shall return the user to the signed-out landing experience without deleting IndexedDB note and todo content automatically.

### Requirement: Responsive Memo-Style Application Shell
The system shall present a memo-style application shell optimized for mobile first and adapted for desktop without resembling an enterprise dashboard.

#### Scenario: Mobile primary navigation
When the viewport is mobile-sized, the system shall show a fixed bottom navigation with entries for `笔记`, `待办`, `搜索`, and `设置`.

#### Scenario: Desktop primary navigation
When the viewport is desktop-sized, the system shall replace the bottom navigation with a slim side navigation rail while keeping the same primary destinations.

#### Scenario: Notes-first visual language
When authenticated pages render, the system shall use a light memo-style presentation with quiet backgrounds, large whitespace, warm yellow accent actions, restrained dividers, and simple typography.

#### Scenario: Route coverage
When the user navigates within the app, the system shall support the routes `/`, `/notes`, `/notes/$noteId`, `/todos`, `/search`, `/sync`, `/settings`, and `/auth/callback`.

### Requirement: Settings Visibility
The system shall expose operational status and account controls in settings using consumer-friendly language.

#### Scenario: Settings status summary
When the user opens settings, the system shall show Microsoft account connection state, last sync time, current network state, and local cache counts.

#### Scenario: Settings actions
When the user opens settings, the system shall provide actions for manual sync, clearing local cache, and signing out.

#### Scenario: Notes sync permission caveat
When the settings page is shown, the system shall display a concise note that notes sync uses the Outlook Notes folder and requires `Mail.ReadWrite`.
