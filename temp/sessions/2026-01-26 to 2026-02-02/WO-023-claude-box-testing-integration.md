# ORCHESTRATOR WORK ORDER #023
## Type: IMPLEMENTATION
## Claude Box — Testing & Integration

---

## MISSION OBJECTIVE

Create comprehensive unit tests for all new components and features introduced in WO-020 through WO-022, plus a full integration test for the updated ClaudePanel. This phase ensures test coverage for ClaudeDiff, file search/@-mentions, abort/cancel flow, new slash commands, and the complete panel integration.

**Implementation Goal:** Dedicated unit tests for 9 previously untested components + all new WO-020/021/022 features, plus updated integration tests.
**Based On:** JUNO Audit `trinity/reports/AUDIT-WO-015-019-2026-01-31.md` (test coverage gaps), TRA Plan `trinity/sessions/TRA-claude-box-gap-closure-plan.md`
**Depends On:** WO-020, WO-021, WO-022 (all implementation phases must be complete)

---

## IMPLEMENTATION SCOPE

### Files to Create/Modify
```yaml
New_Test_Files:
  - path: tests/renderer/components/ide/claude/ClaudeDiff.test.tsx
    changes: Unit tests for ClaudeDiff component (rendering, diff display, accept/reject, collapsible sections)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeSlashCommands.test.tsx
    changes: Unit tests for slash commands (all 7 commands, filtering, keyboard navigation, selection)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeToolCall.test.tsx
    changes: Unit tests for tool call display (5 tool types, expand/collapse, status icons, diff integration)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeThinking.test.tsx
    changes: Unit tests for thinking blocks (expand/collapse, streaming indicator)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeSpinner.test.tsx
    changes: Unit tests for spinner (random messages, animation)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudePermission.test.tsx
    changes: Unit tests for permission prompt (allow/deny, details expand, responded state)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeContextBar.test.tsx
    changes: Unit tests for context bar (4 modes, context percent, model display, thinking toggle)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeConversationHistory.test.tsx
    changes: Unit tests for conversation history (search, grouping, select, delete, outside click close)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeCostDisplay.test.tsx
    changes: Unit tests for cost display (token formatting, color-coded context)
    risk: LOW

Modified_Test_Files:
  - path: tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx
    changes: Add tests for @-mention file search, line range parsing, historyIndex as prop, onAbort stop button
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeMessage.test.tsx
    changes: Add tests for retry button, per-message token badge, tool_use routing, thinking routing
    risk: LOW

  - path: tests/renderer/stores/useClaudeStore.test.ts
    changes: Add tests for activeToolCalls, historyIndex, selectedModel, extendedThinking, acceptEdits mode, abortQuery, retryLastMessage, compactConversation
    risk: MEDIUM

  - path: tests/main/services/claude-container.service.test.ts
    changes: Add tests for abort(), compact(), model parameter passing, thinking parameter
    risk: MEDIUM

  - path: tests/renderer/components/ide/claude/ClaudePanel.test.tsx
    changes: Update integration tests for all new features: cancel button, model display, thinking toggle, new shortcuts, @-mention wiring, new slash commands
    risk: MEDIUM
```

---

## TASK BREAKDOWN

### T22: Unit Tests — ClaudeDiff
**Complexity:** 3
**Files NEW:** `tests/renderer/components/ide/claude/ClaudeDiff.test.tsx`
**Test Cases:**
- [ ] Renders diff header with filename
- [ ] Shows added lines with green background
- [ ] Shows removed lines with red background
- [ ] Shows unchanged lines normally
- [ ] Collapses large unchanged sections
- [ ] Accept button calls onAcceptHunk with correct index
- [ ] Reject button calls onRejectHunk with correct index
- [ ] Buttons disabled after responding
- [ ] Scrollable container for large diffs
- [ ] Handles empty diff gracefully

### T23: Unit Tests — File Search + @-mention Integration
**Complexity:** 3
**Files NEW:** (tests within existing files)
**Files Modified:** `ClaudeInputArea.test.tsx`
**Test Cases:**
- [ ] @-mention popup appears when typing @
- [ ] File results displayed from onFileMention callback
- [ ] Selecting a file inserts @filename into input
- [ ] @file#L5-L10 syntax recognized (no popup, just inline)
- [ ] Line range format validated
- [ ] onFileMention not called when prop is undefined

### T24: Unit Tests — Abort/Cancel Flow
**Complexity:** 3
**Files Modified:** `claude-container.service.test.ts`, `useClaudeStore.test.ts`
**Test Cases:**
- [ ] abortQuery action sets loading to false
- [ ] abortQuery marks streaming messages as non-streaming
- [ ] abort() destroys active HTTP request
- [ ] abort() is no-op when no active request
- [ ] Cancel button renders when loading
- [ ] Cancel button hidden when not loading
- [ ] Click on cancel calls abortQuery

### T25: Unit Tests — New Slash Commands + Leaf Components
**Complexity:** 2
**Files NEW:** `ClaudeSlashCommands.test.tsx`, `ClaudeToolCall.test.tsx`, `ClaudeThinking.test.tsx`, `ClaudeSpinner.test.tsx`, `ClaudePermission.test.tsx`, `ClaudeContextBar.test.tsx`, `ClaudeConversationHistory.test.tsx`, `ClaudeCostDisplay.test.tsx`
**Test Cases for SlashCommands:**
- [ ] Renders all 7 commands (clear, cost, new, history, compact, model, config)
- [ ] Filters commands based on input
- [ ] Keyboard Up/Down navigation changes selection
- [ ] Enter selects current command
- [ ] Escape closes menu
- [ ] Click selects command
- [ ] Empty filter shows all commands

**Test Cases for other leaf components (per component):**
- [ ] Renders with required props
- [ ] Interactive elements respond to clicks
- [ ] Conditional rendering works (expand/collapse, hover states)
- [ ] Accessibility attributes present (aria-labels)

### T26: Integration Test — Full Panel with All New Features
**Complexity:** 4
**Files Modified:** `ClaudePanel.test.tsx`
**Test Cases:**
- [ ] Cancel button appears during loading, calls abortQuery
- [ ] Model name displayed in context bar
- [ ] Thinking toggle visible in context bar
- [ ] 4 permission mode buttons in context bar (Normal, Plan, Accept Edits, Auto)
- [ ] /compact, /model, /config appear when slash menu triggered
- [ ] Cmd+N creates new conversation
- [ ] onFileMention passed to ClaudeInputArea
- [ ] Retry button on last assistant message (via mock)
- [ ] Token badge on assistant messages with usage data (via mock)
- [ ] All existing tests still pass (regression check)

---

## IMPLEMENTATION APPROACH

### Step 1: New Leaf Component Tests (T25 partial)
- [ ] Create test files for all 9 leaf components from WO-015-019 that had no dedicated tests
- [ ] Each test file follows existing patterns (vi.mock, render, screen, userEvent)
- [ ] Mock child dependencies as needed

### Step 2: ClaudeDiff Tests (T22)
- [ ] Mock `diff` npm package
- [ ] Test rendering, accept/reject, collapsible sections

### Step 3: @-mention + File Search Tests (T23)
- [ ] Update ClaudeInputArea tests for new props
- [ ] Test @-mention popup behavior with mock onFileMention

### Step 4: Abort/Cancel Tests (T24)
- [ ] Update store tests for abortQuery
- [ ] Update service tests for abort()

### Step 5: Slash Command Tests (T25 remainder)
- [ ] Test all 7 commands in SlashCommands component

### Step 6: Integration Tests (T26)
- [ ] Update ClaudePanel test mocks for all new store fields and components
- [ ] Add integration test cases for new features

### Step 7: Validation
- [ ] All new tests pass
- [ ] All existing tests still pass
- [ ] No mocking issues or import errors

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE4-TESTING-INTEGRATION-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Test Files Created (count + list)
3. Test Files Modified (count + list)
4. Test Case Count (total new tests)
5. Coverage Summary
6. Any Test Gaps Remaining

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-023-claude-box-testing-integration.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-023-claude-box-testing-integration.md`

---

## SUCCESS CRITERIA

- [ ] All 5 tasks (T22-T26) implemented
- [ ] 9 new test files created for leaf components
- [ ] 5 existing test files updated
- [ ] ClaudeDiff has 10+ test cases
- [ ] All slash commands tested
- [ ] Abort/cancel flow tested end-to-end
- [ ] @-mention integration tested
- [ ] ClaudePanel integration tests cover all new features
- [ ] Zero test regressions
- [ ] All tests pass (LUKA runs final verification)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Modify source files (this WO is tests only)

### DO:
- [ ] Read source files to understand component APIs before writing tests
- [ ] Follow existing test patterns (vi.mock, render, screen, userEvent)
- [ ] Mock all external dependencies (IPC, child components)
- [ ] Use data-testid for component identification in integration tests

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Mock complexity for deeply nested component trees
- Potential import path issues with new files
- Integration test may need many mocks

**Mitigation:**
- Follow existing mock patterns from ClaudePanel.test.tsx
- Use relative paths consistent with project structure
- Build integration mocks incrementally

---

**Remember:** This is a test-only work order. Do not modify source files. Report all changes to LUKA for git operations.
