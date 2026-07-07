# Implementation Plan

- [x] 1. Refactor note storage around canonical rich HTML
  - Add note baseline fields and HTML normalization helpers
  - Keep cards and search driven by plain-text excerpts derived from HTML
  - _Requirement: Canonical Rich HTML Note Body_

- [x] 2. Replace detail page editing with a full-screen rich HTML editor
  - Remove duplicated edit/preview rendering
  - Insert images inline at the current body position
  - Hide shell chrome on the detail route and add card/detail transitions
  - _Requirement: Full-Screen Note Detail, Inline Note Images, Card-To-Detail Transition_

- [x] 3. Upgrade note sync to version-aware merge and attachment diff
  - Track `changeKey` and last-synced baselines
  - Merge changed title/body fields before PATCH when remote changed
  - Diff attachment additions and deletions instead of full replacement
  - _Requirement: Version-Aware Note Merge, Differential Inline Image Sync_

- [x] 4. Verify and document the new behavior
  - Add regression tests
  - Update README and change tasks
  - Run test, typecheck, lint, and build verification
  - _Requirement: Canonical Rich HTML Note Body, Version-Aware Note Merge, Card-To-Detail Transition_
