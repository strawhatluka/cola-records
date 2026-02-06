# ORCHESTRATOR WORK ORDER #020
## Type: IMPLEMENTATION
## Claude Box — Store & Backend Foundations

---

## MISSION OBJECTIVE

Implement 7 foundational state management and backend enhancements to close critical gaps between the Claude Box and the VS Code Claude Code extension. This phase establishes the state infrastructure (activeToolCalls, historyIndex, selectedModel, extendedThinking), adds the missing `acceptEdits` permission mode, and builds abort/cancel IPC + UI.

**Implementation Goal:** All 7 gaps (GAP-04, 05, 06, 07, 08, 21, 22, 16) resolved with updated store, IPC channels, backend service, and UI button.
**Based On:** JUNO Gap Analysis `trinity/reports/GAP-ANALYSIS-ClaudeBox-vs-Extension-2026-01-31.md`, TRA Plan `trinity/sessions/TRA-claude-box-gap-closure-plan.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/stores/useClaudeStore.ts
    changes: Add activeToolCalls Map, historyIndex, selectedModel, extendedThinkingEnabled, abortQuery action, setHistoryIndex action, setModel action, toggleExtendedThinking action, update permissionMode type to include acceptEdits
    risk: HIGH

  - path: src/main/services/claude-container.service.ts
    changes: Add abort() method with activeRequest tracking, accept model + thinking params in query()
    risk: HIGH

  - path: src/main/ipc/channels.ts
    changes: Add ClaudeModelId type, claude:abort channel, update permissionMode type
    risk: MEDIUM

  - path: src/main/index.ts
    changes: Add claude:abort IPC handler, update claude:query to forward model
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/ide/claude/ClaudeContextBar.tsx — Add acceptEdits mode button
  - src/renderer/components/ide/claude/ClaudeInputArea.tsx — Remove local historyIndex useState, accept props from store; add onAbort prop for stop button
  - src/renderer/components/ide/claude/ClaudePanel.tsx — Pass historyIndex/onHistoryIndexChange, add cancel button when loading
  - tests/renderer/stores/useClaudeStore.test.ts — Tests for all new state/actions
  - tests/renderer/components/ide/claude/ClaudePanel.test.tsx — Test cancel button
  - tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx — Update for new props
  - tests/main/services/claude-container.service.test.ts — Test abort behavior
```

---

## TASK BREAKDOWN

### T1: `activeToolCalls` Map in Store (GAP-05)
**Complexity:** 2
**Files:** `useClaudeStore.ts`, `useClaudeStore.test.ts`
**Changes:**
- Add `activeToolCalls: Map<string, { toolName: string; toolInput: Record<string, unknown>; status: 'running' | 'complete' | 'error' }>` to state
- In `sendMessage` switch case `tool_use`: add entry to activeToolCalls with status `running`
- In `tool_result` case: update matching entry to `complete`
- Clear in `clearMessages()` and `reset()`

**Acceptance Criteria:**
- [ ] `activeToolCalls` Map exists in store
- [ ] Populated on `tool_use`, updated on `tool_result`
- [ ] Cleared on `clearMessages()` and `reset()`
- [ ] Tests pass

### T2: `historyIndex` Moved to Store (GAP-06)
**Complexity:** 2
**Files:** `useClaudeStore.ts`, `ClaudeInputArea.tsx`, `ClaudePanel.tsx`, tests
**Changes:**
- Add `historyIndex: number` (default -1) to store state
- Add `setHistoryIndex: (index: number) => void` action
- Remove `const [historyIndex, setHistoryIndex] = useState(-1)` from ClaudeInputArea
- Accept `historyIndex` and `onHistoryIndexChange` as props in ClaudeInputArea
- Pass from ClaudePanel via store selectors

**Acceptance Criteria:**
- [ ] historyIndex in Zustand store, not component local state
- [ ] Up/Down navigation still works identically
- [ ] Tests updated and pass

### T3: `selectedModel` State + IPC (GAP-07, GAP-21)
**Complexity:** 4
**Files:** `channels.ts`, `useClaudeStore.ts`, `claude-container.service.ts`, `index.ts`, tests
**Changes:**
- Add `ClaudeModelId = 'sonnet' | 'opus' | 'haiku'` type to channels.ts
- Add `selectedModel: ClaudeModelId` (default `'sonnet'`) and `setModel` action to store
- Pass `selectedModel` in `sendMessage` via `ipc.invoke('claude:query', prompt, model)`
- Update `claude:query` IPC handler to accept and forward model
- Update `query()` method in service to include model in HTTP body

**Acceptance Criteria:**
- [ ] Model stored in Zustand state
- [ ] Model forwarded through IPC to container HTTP request body
- [ ] Default is `'sonnet'`
- [ ] Tests pass

### T4: `extendedThinkingEnabled` Toggle (GAP-08)
**Complexity:** 2
**Files:** `useClaudeStore.ts`, `claude-container.service.ts`, tests
**Changes:**
- Add `extendedThinkingEnabled: boolean` (default `true`) to store state
- Add `toggleExtendedThinking` action
- Pass thinking flag in `sendMessage` query body alongside model
- Service includes `thinking: true/false` in container HTTP body

**Acceptance Criteria:**
- [ ] Boolean toggle in store
- [ ] Passed in query request to container
- [ ] Tests pass

### T5: `acceptEdits` Permission Mode (GAP-04)
**Complexity:** 3
**Files:** `useClaudeStore.ts`, `ClaudeContextBar.tsx`, tests
**Changes:**
- Change `permissionMode` type from `'normal' | 'plan' | 'auto'` to `'normal' | 'plan' | 'acceptEdits' | 'auto'`
- In permission listener, for `acceptEdits` mode: auto-approve if `toolName` is Read, Edit, Write, Glob, or Grep; prompt for Bash and other tools
- Add 4th button to ClaudeContextBar MODE_LABELS: `{ value: 'acceptEdits', label: 'Accept Edits' }`

**Acceptance Criteria:**
- [ ] 4 permission modes in type and UI
- [ ] `acceptEdits` auto-approves file ops, prompts for Bash
- [ ] Context bar renders 4 mode buttons
- [ ] Tests pass

### T6: Abort/Cancel IPC Channel (GAP-22)
**Complexity:** 5
**Files:** `channels.ts`, `claude-container.service.ts`, `index.ts`, `useClaudeStore.ts`, tests
**Changes:**
- Add `'claude:abort': () => void` to IpcChannels
- In service: add `private activeRequest: http.ClientRequest | null = null`, set in `query()`, destroy in `abort()`
- Add `abort()` method: destroys activeRequest, clears state
- Add IPC handler in index.ts
- Add `abortQuery` action in store: calls `ipc.invoke('claude:abort')`, sets `loading: false`, marks streaming messages as `streaming: false`

**Acceptance Criteria:**
- [ ] `claude:abort` channel defined and handled
- [ ] Active HTTP request tracked and destroyable
- [ ] Store action resets loading state
- [ ] Tests pass

### T7: Interrupt/Cancel UI Button (GAP-16)
**Complexity:** 3
**Depends on:** T6
**Files:** `ClaudePanel.tsx`, `ClaudeInputArea.tsx`, `ClaudePanel.test.tsx`
**Changes:**
- In ClaudeInputArea: accept `onAbort` prop, when `disabled && onAbort`, show red stop button (Square icon) instead of send button
- In ClaudePanel: pass `onAbort={abortQuery}` to ClaudeInputArea when loading
- Add test for cancel button visibility and click

**Acceptance Criteria:**
- [ ] Stop button appears when loading
- [ ] Click triggers abortQuery
- [ ] Reverts to send button when not loading
- [ ] Tests pass

---

## IMPLEMENTATION APPROACH

### Step 1: Store State Additions (T1, T2, T3, T4, T5)
- [ ] Add all new state fields and actions to useClaudeStore.ts
- [ ] Update permissionMode type across channels.ts and store
- [ ] Update ClaudeContextBar for 4 modes
- [ ] Update ClaudeInputArea to accept historyIndex as prop
- [ ] Update ClaudePanel to pass new props
- [ ] Write/update tests for each

### Step 2: Backend Abort Infrastructure (T6)
- [ ] Add claude:abort channel to channels.ts
- [ ] Add activeRequest tracking to service
- [ ] Implement abort() method
- [ ] Add IPC handler
- [ ] Add abortQuery to store
- [ ] Write tests

### Step 3: Cancel UI (T7)
- [ ] Add onAbort prop to ClaudeInputArea
- [ ] Show stop button when loading
- [ ] Wire up in ClaudePanel
- [ ] Write tests

### Step 4: Validation
- [ ] All tests pass
- [ ] No regressions in existing functionality
- [ ] Backward compatibility maintained

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE1-STORE-BACKEND-FOUNDATIONS-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Changes Applied (per task)
3. Test Results
4. Files Changed inventory
5. Next Steps (Phase 2 readiness)

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] Follow format: `PHASE1-STORE-BACKEND-FOUNDATIONS-COMPLETE.md`

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-020-claude-box-store-backend-foundations.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-020-claude-box-store-backend-foundations.md`
   - [ ] Completion report exists in: `trinity/sessions/PHASE1-STORE-BACKEND-FOUNDATIONS-COMPLETE.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

---

## SUCCESS CRITERIA

- [ ] All 7 tasks (T1-T7) implemented
- [ ] All new state fields exist in store
- [ ] acceptEdits permission mode works correctly
- [ ] Abort/cancel IPC channel operational
- [ ] Cancel button renders and functions in UI
- [ ] All existing tests still pass
- [ ] New tests written and passing
- [ ] Code follows existing patterns (Zustand, Tailwind, Vitest)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission for git add, commit, push, pull, merge, checkout, branch, tag, rebase, reset, revert, stash.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install (edit package.json, LUKA runs npm install)
- [ ] Modify files outside the specified scope

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially (no parallel edits)
- [ ] Follow existing code patterns
- [ ] Maintain Claude Orange theme consistency

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Store changes affect all components consuming Claude state
- Abort mechanism requires careful HTTP request lifecycle management
- Permission mode change affects security-sensitive approval flow

**Mitigation:**
- Individual store selectors minimize re-render blast radius
- Track activeRequest as nullable ref, null-check before destroy
- Default permissionMode stays `normal` — no behavioral change unless user switches

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Gap Analysis (2026-01-31)
**Key Findings:** 23 gaps between Claude Box and VS Code extension; 7 foundational gaps addressed here
**Root Causes:** Original TRA plan (WO-015-019) focused on UI parity but deferred state infrastructure
**Expected Impact:** 7 gaps closed, foundation ready for Phase 2-4

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
