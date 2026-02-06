# ORCHESTRATOR WORK ORDER #036
## Type: IMPLEMENTATION
## Test Coverage Gap Closure — WO-028 through WO-035 Features

---

## MISSION OBJECTIVE

Close all test coverage gaps identified by JUNO audit (`AUDIT-JUNO-WO028-WO035-2026-01-31.md`) for features implemented in WO-028 through WO-035. Extend 11 existing test files with ~55 new test cases covering untested features: checkpoint batching, store event handlers, settings CRUD, advanced tool rendering, multimodal input, resizable panels, container service extensions, diff wiring, custom commands, and panel features.

**Implementation Goal:** Raise estimated test coverage from ~65-70% to ≥80% for Claude Box features
**Based On:** JUNO Audit `trinity/reports/AUDIT-JUNO-WO028-WO035-2026-01-31.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/main/services/checkpoint.service.test.ts
    changes: Add createBatchCheckpoint() tests (4 cases)
    risk: LOW

  - path: tests/renderer/stores/useClaudeStore.test.ts
    changes: Add subagent_start, subagent_result, hook_result event handler tests (4 cases)
    risk: LOW

  - path: tests/renderer/components/settings/SettingsForm.test.tsx
    changes: Add MCP CRUD, Hooks CRUD, web search toggle, custom commands, extended thinking, system prompt, max tokens, reset to defaults tests (8+ cases)
    risk: MEDIUM

  - path: tests/renderer/components/ide/claude/ClaudeToolCall.test.tsx
    changes: Add BashOutput ANSI, WebSearchOutput, SubAgent, Hook rendering, icon/summary tests (10 cases)
    risk: MEDIUM

  - path: tests/renderer/components/ide/claude/ClaudeMessage.test.tsx
    changes: Add clickable file paths, copy button, token badge tests (6 cases)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx
    changes: Add image paste, drag-drop, attach button, thumbnail tests (9 cases)
    risk: MEDIUM

  - path: tests/renderer/components/ide/IDELayout.test.tsx
    changes: Add resizable panel, localStorage persistence tests (5 cases)
    risk: MEDIUM

  - path: tests/main/services/claude-container.service.test.ts
    changes: Add model/thinking params, rollback, Docker path, checkpoint batching tests (9 cases)
    risk: MEDIUM

Supporting_Files:
  - tests/renderer/components/ide/claude/ClaudeDiff.test.tsx - accept/reject callback tests (3 cases)
  - tests/renderer/components/ide/claude/ClaudeSlashCommands.test.tsx - custom command merging tests (3 cases)
  - tests/renderer/components/ide/claude/ClaudePanel.test.tsx - file drop, permission mode tests (2 cases)
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Quick Wins (T-029, T-030, T-031) — Parallelizable

These three tasks have no dependencies and can be implemented in any order.

#### T-029: Checkpoint Batch Tests
**File:** `tests/main/services/checkpoint.service.test.ts`
**Action:** EXTEND — add `describe('createBatchCheckpoint')` block

Tests to add:
- [ ] Deduplicates files (`['a.ts', 'b.ts', 'a.ts']` → 2 unique files)
- [ ] Generates single-file label: `Before editing filename.ts`
- [ ] Generates multi-file label: `Before editing 3 files`
- [ ] Delegates to createCheckpoint with type `'auto'`

**Pattern:** Follow existing `createCheckpoint` describe block. Mock `getCheckpointById` return, assert `createCheckpoint` call args.

#### T-030: Store Event Handler Tests
**File:** `tests/renderer/stores/useClaudeStore.test.ts`
**Action:** EXTEND — add `describe('stream event handlers')` block

Tests to add:
- [ ] `subagent_start` chunk creates SubAgent tool message with running status
- [ ] `subagent_result` chunk updates matching SubAgent message to complete
- [ ] `hook_result` chunk creates Hook:toolName message with timing and output
- [ ] Permission mode transitions (normal → plan → auto) update store state

**Pattern:** Follow existing stream-chunk test pattern. Simulate store state, call the handler or simulate event via `mockOn` callback, assert `getState().messages`.

#### T-031: Settings Form CRUD Tests
**File:** `tests/renderer/components/settings/SettingsForm.test.tsx`
**Action:** EXTEND — add describe blocks for each new settings section

Tests to add:
- [ ] MCP Servers: renders "Add MCP Server" button; click adds server entry; edit name/command/args fields; toggle enabled; remove server
- [ ] Hooks: renders "Add Hook" button; click adds hook entry; select pre/post timing; edit tool pattern/command; toggle enabled; remove hook
- [ ] Web Search: renders toggle; click toggles enabled/disabled
- [ ] Custom Commands: renders "Add Command" button; add/edit/remove commands
- [ ] Extended Thinking: renders toggle; syncs with settings prop
- [ ] System Prompt: renders textarea; handles text input
- [ ] Max Tokens: renders number input; validates range
- [ ] Reset to Defaults: calls confirm, resets all fields

**Pattern:** Follow existing SettingsForm test pattern: `render(<SettingsForm settings={mockSettings} onUpdate={mockOnUpdate} />)`, use `userEvent.setup()`, query by text/role.

---

### Phase 2: Component Rendering (T-032, T-033, T-034, T-035) — Parallelizable

#### T-032: ClaudeToolCall Advanced Rendering Tests
**File:** `tests/renderer/components/ide/claude/ClaudeToolCall.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] BashOutput renders ANSI color codes (bold, red, green sequences)
- [ ] BashOutput shows exit code badge when present
- [ ] WebSearchOutput renders URLs as clickable `<a>` links with `target="_blank"`
- [ ] WebSearchOutput renders non-URL lines as plain text
- [ ] SubAgent result renders in CodeBlock
- [ ] Hook:* result renders in `<pre>` element
- [ ] `getToolIcon` returns correct icon for WebSearch, SubAgent, Hook:*
- [ ] `getToolSummary` returns correct summaries for WebSearch, SubAgent, Hook:*

**Pattern:** Render `<ClaudeToolCall>` with toolName/toolInput/toolResult props, query for rendered elements. For ANSI, provide known escape sequences like `\x1b[1m\x1b[31mERROR\x1b[0m` and verify styled output.

#### T-033: ClaudeMessage Feature Tests
**File:** `tests/renderer/components/ide/claude/ClaudeMessage.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] File path in message text renders as clickable button (TextWithFileLinks)
- [ ] Clicking file path calls openFile with correct path
- [ ] Copy button visible on assistant messages
- [ ] Copy button copies content to clipboard (mock `navigator.clipboard.writeText`)
- [ ] Token badge always visible on last assistant message (`isLastAssistant` prop)
- [ ] Token badge hidden when not last assistant message

**Pattern:** Render `<ClaudeMessage>` with content containing file paths like `src/index.ts:42`, query for button elements, simulate clicks.

#### T-034: ClaudeInputArea Multimodal Tests
**File:** `tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] Paste event with image clipboard item triggers attachment handler
- [ ] Paste converts image to ClaudeAttachment with base64 data
- [ ] Attach button (paperclip) renders
- [ ] File input accepts `image/*` types
- [ ] dragOver event shows drop zone overlay (ring-2 border)
- [ ] dragLeave event hides drop zone
- [ ] Drop image file converts to attachment
- [ ] Drop text file calls onFileDrop callback
- [ ] Attachment thumbnails render for added images

**Pattern:** Create mock `ClipboardEvent` with `DataTransfer` containing image file. Create mock `DragEvent` with `DataTransfer`. Use `fireEvent.paste()`, `fireEvent.dragOver()`, `fireEvent.drop()`.

#### T-035: IDELayout Resize Panel Tests
**File:** `tests/renderer/components/ide/IDELayout.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] Loads panel width from localStorage on mount (stored value: '500')
- [ ] Falls back to default 420px when no stored value
- [ ] Ignores invalid localStorage values (NaN, out of range)
- [ ] Resize handle div renders with `cursor: col-resize` style
- [ ] Panel width constrained between 300-800px

**Pattern:** Set `localStorage.setItem('claude-panel-width', '500')` before render, verify grid template column. For resize, simulate mousedown/mousemove/mouseup on handle div.

---

### Phase 3: Backend & Extensions (T-036, T-037, T-038, T-039) — Parallelizable

#### T-036: Claude Container Service Extension Tests
**File:** `tests/main/services/claude-container.service.test.ts`
**Action:** EXTEND

Tests to add:
- [ ] `query()` includes `model` parameter in request body
- [ ] `query()` includes `thinking` parameter in request body
- [ ] `rollback()` sends POST to container `/rollback` with conversationId
- [ ] `rollback()` handles error response gracefully
- [ ] `ensureImageBuilt()` uses `process.resourcesPath` when `app.isPackaged` is true
- [ ] `ensureImageBuilt()` uses `app.getAppPath()` when not packaged
- [ ] `pendingCheckpointFiles` accumulates on tool_use events for Edit/Write
- [ ] Batch checkpoint created on query end when pending files exist
- [ ] `pendingCheckpointFiles` cleared after batch creation

**Pattern:** Follow existing test pattern with `vi.hoisted()` mocks for child_process, http. Mock `app.isPackaged` property. For checkpoint tests, simulate NDJSON event sequence via mock HTTP response stream.

#### T-037: ClaudeDiff Accept/Reject Wiring Tests
**File:** `tests/renderer/components/ide/claude/ClaudeDiff.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] Accept button calls `onAcceptHunk` callback when clicked
- [ ] Reject button calls `onRejectHunk` callback when clicked
- [ ] Both buttons hidden after action taken (undefined callbacks)

**Pattern:** Render with `onAcceptHunk` and `onRejectHunk` mock functions, click buttons, verify calls.

#### T-038: ClaudeSlashCommands Custom Command Tests
**File:** `tests/renderer/components/ide/claude/ClaudeSlashCommands.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] Custom commands appear in list after built-in commands
- [ ] Custom commands filterable by prefix (e.g. `/my` matches `/mycmd`)
- [ ] Selecting custom command returns its prompt text

**Pattern:** Pass `customCommands` prop with test commands, verify they render and are selectable.

#### T-039: ClaudePanel Extension Tests
**File:** `tests/renderer/components/ide/claude/ClaudePanel.test.tsx`
**Action:** EXTEND

Tests to add:
- [ ] File drop events on panel forward to input area
- [ ] Permission mode indicator renders current mode text

**Pattern:** Follow existing ClaudePanel test mocking pattern, trigger drop events, verify forwarding.

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `WO-036-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-2026-01-31.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Tests added, coverage improvement
2. **Changes Applied** - Per-file test additions with counts
3. **Test Results** - All tests pass (LUKA runs tests)
4. **Metrics** - Before: ~65-70%, After: ≥80% (estimated)
5. **Rollback Plan** - Revert test file changes only (no production code modified)
6. **Next Steps** - Container server.ts integration tests (future WO)

### Evidence to Provide
- Number of new test cases per file
- Total test count before/after
- List of all test descriptions added

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `WO-036-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-036-test-coverage-gap-closure.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-036-test-coverage-gap-closure.md`
   - [ ] Completion report exists in: `trinity/reports/WO-036-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 11 test files have been extended with specified test cases
- [ ] ~55 new test cases added across all files
- [ ] All new tests follow existing patterns (vi.hoisted, userEvent, describe/test)
- [ ] No regressions introduced to existing tests
- [ ] Tests pass (LUKA runs tests)
- [ ] Implementation report submitted to `trinity/reports/`

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, pull, merge, etc.

### CRITICAL RESTRICTIONS - TEST EXECUTION FORBIDDEN

Do NOT run `npm test` or `vitest`. Only LUKA runs tests.

### Do NOT:
- [ ] Modify any production source files (this WO is test-only)
- [ ] Create new test files (extend existing ones only)
- [ ] Change existing test assertions
- [ ] Perform ANY git operations
- [ ] Run tests (LUKA handles this)

### DO:
- [ ] Follow existing test patterns in each file
- [ ] Use `vi.hoisted()` for mock declarations
- [ ] Use `userEvent.setup()` for interaction tests
- [ ] Use `describe/test` nesting for organization
- [ ] Use `data-testid` attributes where child components are mocked
- [ ] Clear mocks in `beforeEach` blocks

---

## ROLLBACK STRATEGY

If issues arise:
1. Only test files were modified — no production code changes
2. Revert individual test file changes using git (LUKA only)
3. Each task is independent — partial rollback is safe

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit `AUDIT-JUNO-WO028-WO035-2026-01-31.md`
**Key Findings:** 28/28 features implemented correctly, but ~30-35% of new features lack test coverage
**Root Causes:** Features were implemented across WO-028 to WO-035 without corresponding test updates
**Expected Impact:** ~55 new test cases closing all identified coverage gaps

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified test cases must be implemented
**Risk Level:** LOW
**Risk Factors:**
- DataTransfer/ClipboardEvent mocking may be brittle in JSDOM
- ANSI escape sequence rendering depends on component internals

**Mitigation:**
- Use minimal mock interfaces matching only required API surface
- Test ANSI by asserting output text content, not specific styled spans

---

## TRA PLAN REFERENCE

```json
{
  "phases": {
    "phase1_quick_wins": ["T-029", "T-030", "T-031"],
    "phase2_component_rendering": ["T-032", "T-033", "T-034", "T-035"],
    "phase3_backend_and_extensions": ["T-036", "T-037", "T-038", "T-039"]
  },
  "parallelizable": [
    ["T-029", "T-030", "T-031"],
    ["T-032", "T-033", "T-034", "T-035"],
    ["T-036", "T-037", "T-038", "T-039"]
  ],
  "totalTasks": 11,
  "totalTestCases": "~55",
  "averageComplexity": 4.5
}
```

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
