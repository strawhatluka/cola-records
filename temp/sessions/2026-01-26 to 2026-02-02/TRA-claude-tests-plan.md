# TRA Implementation Plan — Claude Integration Tests

**Date:** 2026-01-31
**Scope:** Comprehensive test suite for all Claude container integration code
**Scale:** Large (7 source files, 6 new test files, ~200+ test cases)
**Stop Points:** 4 (requirements, design, plan, final)

---

## Task Inventory

### Task 1: useClaudeStore.test.ts (Zustand Store)
- **ID:** T1
- **File:** `tests/renderer/stores/useClaudeStore.test.ts`
- **Dependencies:** None
- **Complexity:** 7/10 (async IPC, streaming, state management)
- **Test Cases (~40):**
  - **Default State (5):** Initial values for messages, loading, containerReady, containerStarting, error, projectPath
  - **startContainer (8):** Sets containerStarting, calls IPC claude:start, polls health, sets containerReady on success, adds system message, clears messages on project switch, handles auth error, handles health timeout
  - **stopContainer (4):** Calls IPC claude:stop, resets containerReady, resets projectPath, handles stop error
  - **sendMessage (10):** Adds user message, adds streaming assistant message, sets loading, listens for stream-chunk events, appends content chunks, marks done on final chunk, unsubscribes listener, handles query error, removes empty assistant on error, sets error state
  - **checkHealth (3):** Calls IPC claude:health, sets containerReady true/false, handles error
  - **clearMessages (2):** Empties messages array, preserves other state
  - **reset (2):** Resets all state to defaults, clears messages
  - **Project Switching (3):** Clears messages when projectPath changes, preserves messages for same project, handles null initial path
  - **Edge Cases (3):** Concurrent sends, rapid start/stop, empty prompt

### Task 2: ClaudeMessage.test.tsx (Message Component)
- **ID:** T2
- **File:** `tests/renderer/components/ide/claude/ClaudeMessage.test.tsx`
- **Dependencies:** None
- **Complexity:** 4/10 (rendering, markdown)
- **Test Cases (~18):**
  - **User Messages (4):** Renders content, right-aligned styling, plain text (no markdown), displays timestamp
  - **Assistant Messages (6):** Renders content, left-aligned styling, renders markdown via ReactMarkdown, code blocks rendered, links rendered, streaming cursor shown when streaming=true
  - **System Messages (4):** Renders content, centered styling, muted/small text, no markdown rendering
  - **Streaming (2):** Shows blinking cursor during streaming, hides cursor when streaming=false
  - **Edge Cases (2):** Empty content, very long content

### Task 3: ClaudeInputArea.test.tsx (Input Component)
- **ID:** T3
- **File:** `tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx`
- **Dependencies:** None
- **Complexity:** 4/10 (user interactions, keyboard events)
- **Test Cases (~15):**
  - **Rendering (3):** Renders textarea, renders send button, shows placeholder
  - **Text Input (3):** Updates value on type, auto-resizes height, clears after send
  - **Send Behavior (4):** Calls onSend on Enter, does not send on Shift+Enter (newline), does not send empty input, send button triggers onSend
  - **Disabled State (3):** Disables textarea when disabled, disables send button when disabled, disables send button when empty
  - **Focus (2):** Auto-focuses on mount, custom placeholder text

### Task 4: ClaudePanel.test.tsx (Panel Component)
- **ID:** T4
- **File:** `tests/renderer/components/ide/claude/ClaudePanel.test.tsx`
- **Dependencies:** None (mocks useClaudeStore)
- **Complexity:** 6/10 (store integration, status indicators, auto-scroll)
- **Test Cases (~22):**
  - **Rendering (4):** Renders header with "Claude" label, renders status indicator, renders clear button, renders input area
  - **Status Indicators (5):** Red dot when offline, yellow pulse when containerStarting, blue pulse when loading, green dot when containerReady, correct status text
  - **Message List (4):** Renders messages from store, shows empty state when no messages, auto-scrolls on new messages, renders error message
  - **User Interactions (4):** Sends message via input, clears messages on clear button click, disables input when loading, disables input when container not ready
  - **Error Display (3):** Shows error from store, styles error message, dismisses error
  - **Integration (2):** Displays system message on container ready, handles multiple messages

### Task 5: SettingsForm Claude Fields (Update Existing Tests)
- **ID:** T5
- **File:** `tests/renderer/components/settings/SettingsForm.test.tsx` (update)
- **Dependencies:** None
- **Complexity:** 3/10 (follows existing patterns)
- **Test Cases (~16, new additions):**
  - **Claude Section Rendering (4):** Renders "Claude AI" card, renders card description mentioning priority, renders OAuth Token input, renders API Key input
  - **OAuth Token Field (3):** Password type input, placeholder text, updates on type
  - **API Key Field (3):** Password type input, placeholder text "sk-ant-xxxxxxxxxxxx", updates on type
  - **Save with Claude Fields (3):** Includes claudeOAuthToken in save, includes claudeApiKey in save, saves empty as undefined
  - **Props Sync (2):** Syncs claudeApiKey from settings, syncs claudeOAuthToken from settings
  - **Edge Cases (1):** Handles settings without Claude fields (backward compat)

### Task 6: useIDEInitialization Claude Integration (Update Existing Tests)
- **ID:** T6
- **File:** `tests/renderer/hooks/useIDEInitialization.test.ts` (update)
- **Dependencies:** None
- **Complexity:** 3/10 (follows existing patterns)
- **Test Cases (~6, new additions):**
  - **Claude Container Start (3):** Calls startContainer with localPath, does not fail IDE init if container fails, logs warning on container failure
  - **Execution Order (2):** startContainer called after terminal session, startContainer called last in sequence
  - **Re-initialization (1):** Starts new container when switching contributions

### Task 7: claude-container.service.test.ts (Backend Service)
- **ID:** T7
- **File:** `tests/main/services/claude-container.service.test.ts`
- **Dependencies:** None
- **Complexity:** 8/10 (child_process mocking, HTTP mocking, Docker CLI, streaming)
- **Test Cases (~45):**
  - **Constructor & Setup (3):** Creates singleton, setMainWindow stores reference, initial state not running
  - **ensureDockerAvailable (3):** Succeeds when docker version works, throws when docker not found, passes shell:true option
  - **ensureImageBuilt (5):** Skips build when image exists, builds from correct path, uses app.getAppPath(), quotes paths with spaces, throws on build failure
  - **start() (12):** Throws without auth, checks Docker availability, builds image if needed, removes existing container, generates API key, runs container with correct args, passes OAuth token env var, passes API key env var, polls health, sets containerRunning, emits status change, blocks concurrent starts
  - **stop() (4):** Stops container, removes container, resets state, ignores errors on missing container
  - **isRunning() (3):** Returns true when running, returns false when stopped, returns false on error
  - **query() (8):** Makes POST to /query, sends prompt as JSON, includes API key header, parses NDJSON text chunks, emits stream-chunk events, handles done signal, handles error response, handles HTTP error status
  - **healthCheck() (5):** Returns ready on 200 + healthy, returns not ready on unhealthy, returns unreachable on connection error, returns timeout on slow response, parses JSON response
  - **getStatus() (2):** Returns current running state, returns current projectPath

---

## Implementation Sequence

```
Phase 1 — Independent Tests (Parallel)
├── T1: useClaudeStore.test.ts
├── T2: ClaudeMessage.test.tsx
├── T3: ClaudeInputArea.test.tsx
└── T7: claude-container.service.test.ts

Phase 2 — Dependent Tests (Parallel)
├── T4: ClaudePanel.test.tsx (needs store mock pattern from T1)
├── T5: SettingsForm updates (independent)
└── T6: useIDEInitialization updates (independent)

Phase 3 — BAS Quality Gate
└── Run full test suite, verify ≥80% coverage on Claude files
```

### Dependency Graph

```
T1 (Store)  ──┐
T2 (Message) ─┤── T4 (Panel) uses mock patterns from T1
T3 (Input)  ──┘
T5 (Settings) ── independent
T6 (IDE Init) ── independent
T7 (Service) ── independent
```

### Parallelization

| Phase | Parallel Tasks | Bottleneck |
|-------|---------------|------------|
| 1     | T1, T2, T3, T7 | T7 (most complex) |
| 2     | T4, T5, T6 | T4 (most tests) |
| 3     | BAS gate | Sequential |

---

## TRA Handoff JSON

```json
{
  "tasks": [
    {
      "id": "T1",
      "description": "useClaudeStore.test.ts - Zustand store tests (40 cases)",
      "dependencies": [],
      "complexity": 7,
      "basGates": ["lint", "build", "test", "coverage"]
    },
    {
      "id": "T2",
      "description": "ClaudeMessage.test.tsx - Message component tests (18 cases)",
      "dependencies": [],
      "complexity": 4,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "T3",
      "description": "ClaudeInputArea.test.tsx - Input component tests (15 cases)",
      "dependencies": [],
      "complexity": 4,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "T4",
      "description": "ClaudePanel.test.tsx - Panel component tests (22 cases)",
      "dependencies": ["T1"],
      "complexity": 6,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "T5",
      "description": "SettingsForm.test.tsx - Add Claude field tests (16 cases)",
      "dependencies": [],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "T6",
      "description": "useIDEInitialization.test.ts - Add Claude container tests (6 cases)",
      "dependencies": [],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "T7",
      "description": "claude-container.service.test.ts - Backend service tests (45 cases)",
      "dependencies": [],
      "complexity": 8,
      "basGates": ["lint", "build", "test", "coverage"]
    }
  ],
  "sequence": ["T1", "T2", "T3", "T7", "T4", "T5", "T6"],
  "parallelizable": [["T1", "T2", "T3", "T7"], ["T4", "T5", "T6"]],
  "stopPoints": ["requirements", "design", "plan", "final"],
  "totalTests": "~162 new test cases across 5 new files + 2 updated files"
}
```

---

## Key Mocking Strategies

### Store Tests (T1)
- Mock `ipc.invoke` and `ipc.on` from `src/renderer/ipc/client`
- Use `act()` for state updates
- Test streaming by simulating `claude:stream-chunk` callback

### Component Tests (T2, T3, T4)
- Mock `react-markdown` as passthrough (renders children as text)
- Mock `useClaudeStore` for ClaudePanel
- Use `userEvent` for keyboard interactions (Enter, Shift+Enter)
- Use `@testing-library/react` render/screen/waitFor

### Service Tests (T7)
- Mock `child_process.execFile` via `vi.mock`
- Mock `http.request` for health check and query tests
- Mock `electron.app.getAppPath()` and `BrowserWindow`
- Test NDJSON parsing by simulating chunked HTTP responses

### Settings Tests (T5)
- Follow existing pattern exactly (same mocks, same render approach)
- Add Claude fields to `mockSettings` default object

### IDE Init Tests (T6)
- Add `mockStartContainer` to existing mock setup
- Follow existing pattern (mock store, test call order)
