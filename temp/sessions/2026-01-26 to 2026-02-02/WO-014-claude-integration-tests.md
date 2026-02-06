# ORCHESTRATOR WORK ORDER #014
## Type: IMPLEMENTATION
## Claude Integration Test Suite

---

## MISSION OBJECTIVE

Implement comprehensive test coverage for all Claude container integration code across the Cola Records application. This includes the Zustand store, all UI components, backend service, settings form updates, and IDE initialization hook updates.

**Implementation Goal:** ~162 new test cases across 5 new test files + 2 updated test files, achieving ≥80% coverage on all Claude-related source files.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-tests-plan.md`

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Test_Files:
  - path: tests/renderer/stores/useClaudeStore.test.ts
    tests: ~40 cases
    risk: MEDIUM

  - path: tests/renderer/components/ide/claude/ClaudeMessage.test.tsx
    tests: ~18 cases
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx
    tests: ~15 cases
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudePanel.test.tsx
    tests: ~22 cases
    risk: MEDIUM

  - path: tests/main/services/claude-container.service.test.ts
    tests: ~45 cases
    risk: HIGH
```

### Files to Update
```yaml
Existing_Test_Files:
  - path: tests/renderer/components/settings/SettingsForm.test.tsx
    changes: Add ~16 test cases for Claude AI settings card
    risk: LOW

  - path: tests/renderer/hooks/useIDEInitialization.test.ts
    changes: Add ~6 test cases for Claude container startup integration
    risk: LOW
```

### Source Files Under Test
```yaml
Source_Files:
  - src/renderer/stores/useClaudeStore.ts
  - src/renderer/components/ide/claude/ClaudeMessage.tsx
  - src/renderer/components/ide/claude/ClaudeInputArea.tsx
  - src/renderer/components/ide/claude/ClaudePanel.tsx
  - src/renderer/components/settings/SettingsForm.tsx
  - src/renderer/hooks/useIDEInitialization.ts
  - src/main/services/claude-container.service.ts
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Independent Tests (T1, T2, T3, T7 — Parallel-capable)

#### Task T1: useClaudeStore.test.ts (~40 cases, complexity 7/10)
- [ ] Default state tests (5): Initial values for messages, loading, containerReady, containerStarting, error, projectPath
- [ ] startContainer tests (8): Sets containerStarting, calls IPC claude:start, polls health, sets containerReady on success, adds system message, clears messages on project switch, handles auth error, handles health timeout
- [ ] stopContainer tests (4): Calls IPC claude:stop, resets containerReady, resets projectPath, handles stop error
- [ ] sendMessage tests (10): Adds user message, adds streaming assistant message, sets loading, listens for stream-chunk events, appends content chunks, marks done on final chunk, unsubscribes listener, handles query error, removes empty assistant on error, sets error state
- [ ] checkHealth tests (3): Calls IPC claude:health, sets containerReady true/false, handles error
- [ ] clearMessages tests (2): Empties messages array, preserves other state
- [ ] reset tests (2): Resets all state to defaults, clears messages
- [ ] Project switching tests (3): Clears messages when projectPath changes, preserves for same project, handles null initial path
- [ ] Edge cases (3): Concurrent sends, rapid start/stop, empty prompt

**Mocking Strategy:**
- Mock `ipc.invoke` and `ipc.on` from `src/renderer/ipc/client`
- Use `act()` for state updates
- Test streaming by simulating `claude:stream-chunk` callback

#### Task T2: ClaudeMessage.test.tsx (~18 cases, complexity 4/10)
- [ ] User message tests (4): Renders content, right-aligned styling, plain text (no markdown), displays timestamp
- [ ] Assistant message tests (6): Renders content, left-aligned styling, renders markdown via ReactMarkdown, code blocks rendered, links rendered, streaming cursor shown when streaming=true
- [ ] System message tests (4): Renders content, centered styling, muted/small text, no markdown rendering
- [ ] Streaming tests (2): Shows blinking cursor during streaming, hides cursor when streaming=false
- [ ] Edge cases (2): Empty content, very long content

**Mocking Strategy:**
- Mock `react-markdown` as passthrough (renders children as text)
- Use `@testing-library/react` render/screen

#### Task T3: ClaudeInputArea.test.tsx (~15 cases, complexity 4/10)
- [ ] Rendering tests (3): Renders textarea, renders send button, shows placeholder
- [ ] Text input tests (3): Updates value on type, auto-resizes height, clears after send
- [ ] Send behavior tests (4): Calls onSend on Enter, does not send on Shift+Enter (newline), does not send empty input, send button triggers onSend
- [ ] Disabled state tests (3): Disables textarea when disabled, disables send button when disabled, disables send button when empty
- [ ] Focus tests (2): Auto-focuses on mount, custom placeholder text

**Mocking Strategy:**
- Use `userEvent` for keyboard interactions (Enter, Shift+Enter)
- Use `@testing-library/react` render/screen

#### Task T7: claude-container.service.test.ts (~45 cases, complexity 8/10)
- [ ] Constructor & setup tests (3): Creates singleton, setMainWindow stores reference, initial state not running
- [ ] ensureDockerAvailable tests (3): Succeeds when docker version works, throws when docker not found, passes shell:true option
- [ ] ensureImageBuilt tests (5): Skips build when image exists, builds from correct path, uses app.getAppPath(), quotes paths with spaces, throws on build failure
- [ ] start() tests (12): Throws without auth, checks Docker availability, builds image if needed, removes existing container, generates API key, runs container with correct args, passes OAuth token env var, passes API key env var, polls health, sets containerRunning, emits status change, blocks concurrent starts
- [ ] stop() tests (4): Stops container, removes container, resets state, ignores errors on missing container
- [ ] isRunning() tests (3): Returns true when running, returns false when stopped, returns false on error
- [ ] query() tests (8): Makes POST to /query, sends prompt as JSON, includes API key header, parses NDJSON text chunks, emits stream-chunk events, handles done signal, handles error response, handles HTTP error status
- [ ] healthCheck() tests (5): Returns ready on 200 + healthy, returns not ready on unhealthy, returns unreachable on connection error, returns timeout on slow response, parses JSON response
- [ ] getStatus() tests (2): Returns current running state, returns current projectPath

**Mocking Strategy:**
- Mock `child_process.execFile` via `vi.mock`
- Mock `http.request` for health check and query tests
- Mock `electron.app.getAppPath()` and `BrowserWindow`
- Test NDJSON parsing by simulating chunked HTTP responses

### Phase 2: Dependent/Update Tests (T4, T5, T6)

#### Task T4: ClaudePanel.test.tsx (~22 cases, complexity 6/10)
- [ ] Rendering tests (4): Renders header with "Claude" label, renders status indicator, renders clear button, renders input area
- [ ] Status indicator tests (5): Red dot when offline, yellow pulse when containerStarting, blue pulse when loading, green dot when containerReady, correct status text
- [ ] Message list tests (4): Renders messages from store, shows empty state when no messages, auto-scrolls on new messages, renders error message
- [ ] User interaction tests (4): Sends message via input, clears messages on clear button click, disables input when loading, disables input when container not ready
- [ ] Error display tests (3): Shows error from store, styles error message, dismisses error
- [ ] Integration tests (2): Displays system message on container ready, handles multiple messages

**Mocking Strategy:**
- Mock `useClaudeStore` (uses patterns from T1)
- Use `@testing-library/react` render/screen/waitFor

#### Task T5: SettingsForm.test.tsx Updates (~16 new cases, complexity 3/10)
- [ ] Claude section rendering tests (4): Renders "Claude AI" card, renders card description mentioning priority, renders OAuth Token input, renders API Key input
- [ ] OAuth Token field tests (3): Password type input, placeholder text, updates on type
- [ ] API Key field tests (3): Password type input, placeholder "sk-ant-xxxxxxxxxxxx", updates on type
- [ ] Save with Claude fields tests (3): Includes claudeOAuthToken in save, includes claudeApiKey in save, saves empty as undefined
- [ ] Props sync tests (2): Syncs claudeApiKey from settings, syncs claudeOAuthToken from settings
- [ ] Edge case (1): Handles settings without Claude fields (backward compat)

**Mocking Strategy:**
- Follow existing SettingsForm.test.tsx patterns exactly (same mocks, same render approach)
- Add Claude fields to `mockSettings` default object

#### Task T6: useIDEInitialization.test.ts Updates (~6 new cases, complexity 3/10)
- [ ] Claude container start tests (3): Calls startContainer with localPath, does not fail IDE init if container fails, logs warning on container failure
- [ ] Execution order tests (2): startContainer called after terminal session, startContainer called last in sequence
- [ ] Re-initialization test (1): Starts new container when switching contributions

**Mocking Strategy:**
- Add `mockStartContainer` to existing mock setup
- Follow existing pattern (mock store, test call order)

### Phase 3: Quality Gate (BAS)
- [ ] Run full test suite — all tests pass
- [ ] Verify ≥80% coverage on Claude files
- [ ] Lint passes
- [ ] Build passes

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CLAUDE-TESTS-IMPLEMENTATION-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - Test suite coverage achieved
2. **Changes Applied** - Files created/updated with test counts
3. **Test Results** - All tests passing confirmation
4. **Metrics** - Coverage percentages for Claude files
5. **Next Steps** - Any follow-up items

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] Follow format: `CLAUDE-TESTS-IMPLEMENTATION-COMPLETE.md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] Work order already in `trinity/sessions/` (created here directly)

**Step 3: Verify File Locations** ✅
   - [ ] This work order file exists in: `trinity/sessions/WO-014-claude-integration-tests.md`
   - [ ] Completion report exists after implementation

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 7 tasks implemented (T1-T7)
- [ ] ~162 new test cases written
- [ ] All tests pass (user runs `npm test`)
- [ ] ≥80% coverage on Claude source files
- [ ] Existing tests not broken
- [ ] Code follows existing test patterns in the codebase

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS

- **NO git operations** — Only LUKA has permission
- **NO running tests** — User runs tests on their end
- **Read file before editing** — No parallel file edits, sequential only
- **Follow existing patterns** — Match mock strategies and test structure from existing test files
- **No sed commands** — Use Read + Edit tools only

### DO:
- [ ] Follow existing test patterns (see SettingsForm.test.tsx, useIDEInitialization.test.ts)
- [ ] Use vitest + @testing-library/react + userEvent
- [ ] Mock IPC client for renderer tests
- [ ] Mock child_process + http for service tests
- [ ] Use descriptive test names matching the TRA plan
- [ ] Group tests with nested describe blocks

---

## IMPLEMENTATION SEQUENCE

```
Phase 1 — Independent Tests (Sequential execution, parallel-capable tasks)
├── T1: useClaudeStore.test.ts (40 cases)
├── T2: ClaudeMessage.test.tsx (18 cases)
├── T3: ClaudeInputArea.test.tsx (15 cases)
└── T7: claude-container.service.test.ts (45 cases)

Phase 2 — Dependent/Update Tests
├── T4: ClaudePanel.test.tsx (22 cases)
├── T5: SettingsForm.test.tsx updates (16 cases)
└── T6: useIDEInitialization.test.ts updates (6 cases)

Phase 3 — BAS Quality Gate
└── User runs full test suite, verifies coverage
```

---

## CONTEXT FROM TRA PLAN

**Source Plan:** `trinity/sessions/TRA-claude-tests-plan.md`
**Total New Tests:** ~162 cases across 5 new files + 2 updated files
**Complexity Range:** 3/10 to 8/10
**Highest Risk:** T7 (claude-container.service.test.ts) — child_process mocking, HTTP mocking, Docker CLI, NDJSON streaming

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All ~162 test cases must be implemented
**Risk Level:** MEDIUM
**Risk Factors:**
- T7 requires complex mocking (child_process, http, electron)
- NDJSON streaming simulation needs careful chunked response mocking
- Store tests need proper async/act() handling for streaming state

**Mitigation:**
- Follow existing mock patterns from the codebase
- Test streaming incrementally (single chunk → multiple chunks → error)
- Use act() consistently for all state-changing operations

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
