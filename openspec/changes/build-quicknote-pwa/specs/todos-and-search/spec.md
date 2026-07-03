## ADDED Requirements

### Requirement: Todo List and Task Management
The system shall provide a lightweight todo experience backed by Microsoft To Do data and local caching.

#### Scenario: Todo collection display
When the user opens the todos page, the system shall show available todo items in a list-oriented layout rather than a board or table.

#### Scenario: Create task
When the user adds a task, the system shall let the user create a task with a title and an optional due date.

#### Scenario: Update task
When the user edits a task title, toggles completion, or changes its due date, the system shall persist the change locally and prepare it for remote synchronization.

#### Scenario: Delete task
When the user deletes a task, the system shall remove it from active display and mark the deletion for remote synchronization.

#### Scenario: Task completion styling
When a task is completed, the system shall visually distinguish it with muted text and a completed-state treatment.

### Requirement: Todo Filtering
The system shall help the user focus on the current slice of work through simple todo filters.

#### Scenario: Filter today
When the user selects `今天`, the system shall show only tasks relevant to the current day according to each task's stored due date.

#### Scenario: Filter all
When the user selects `全部`, the system shall show all non-deleted tasks from the active local data set.

#### Scenario: Filter completed
When the user selects `已完成`, the system shall show only completed tasks.

### Requirement: Offline Local Search
The system shall provide offline-capable search across notes and todos using local storage only.

#### Scenario: Search notes
When the user searches for text that exists in note titles or note bodies, the system shall return matching notes from local data.

#### Scenario: Search todos
When the user searches for text that exists in todo titles, the system shall return matching todos from local data.

#### Scenario: Grouped search results
When search results are present, the system shall group them into `笔记` and `待办`.

#### Scenario: Empty search state
When no local result matches the query, the system shall show a simple empty state rather than a remote error.
