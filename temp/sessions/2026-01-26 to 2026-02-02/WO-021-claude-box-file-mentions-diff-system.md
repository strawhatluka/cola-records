# ORCHESTRATOR WORK ORDER #021
## Type: IMPLEMENTATION
## Claude Box — File Mentions & Diff System

---

## MISSION OBJECTIVE

Implement 7 features covering file mention infrastructure (@-mentions with IPC-backed search), inline diff display (ClaudeDiff component with accept/reject), message retry, and per-message token counts. This phase closes GAP-09, 10, 11, 12, 13, 17, 18.

**Implementation Goal:** Fully functional @-mentions with file search, inline diff viewer for Edit tool results, message retry capability, and token usage per message.
**Based On:** JUNO Gap Analysis `trinity/reports/GAP-ANALYSIS-ClaudeBox-vs-Extension-2026-01-31.md`, TRA Plan `trinity/sessions/TRA-claude-box-gap-closure-plan.md`
**Depends On:** WO-020 (Phase 1 foundations must be complete)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/claude/ClaudeDiff.tsx
    changes: NEW FILE — Unified diff renderer with syntax highlighting, line numbers, add/remove coloring, collapsible unchanged sections
    risk: HIGH

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Add retryLastMessage action, parse @file#L references in sendMessage
    risk: MEDIUM

  - path: src/main/ipc/channels.ts
    changes: Add claude:search-files channel
    risk: LOW

  - path: src/main/index.ts
    changes: Implement claude:search-files handler with fuzzy file matching
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/ide/claude/ClaudePanel.tsx — Wire up onFileMention prop with IPC callback
  - src/renderer/components/ide/claude/ClaudeInputArea.tsx — Update @ regex for line range syntax
  - src/renderer/components/ide/claude/ClaudeToolCall.tsx — Render ClaudeDiff for Edit tool results
  - src/renderer/components/ide/claude/ClaudeMessage.tsx — Add retry button, per-message token badge
  - package.json — Add `diff` npm package
  - tests/renderer/components/ide/claude/ClaudePanel.test.tsx — Test onFileMention wiring
  - tests/renderer/stores/useClaudeStore.test.ts — Test retryLastMessage action
```

---

## TASK BREAKDOWN

### T8: File Search IPC Handler (GAP-11)
**Complexity:** 4
**Files:** `channels.ts`, `index.ts`
**Changes:**
- Add `'claude:search-files': (projectPath: string, query: string) => string[]` to IpcChannels
- Implement handler: recursive file walk using existing fs:read-directory logic, fuzzy match against query, respect .gitignore, return top 20 results sorted by relevance

**Acceptance Criteria:**
- [ ] IPC channel returns file paths matching fuzzy query
- [ ] Limited to 20 results, sorted by relevance
- [ ] Respects .gitignore (uses existing gitignore service)
- [ ] Returns relative paths from project root

### T9: Wire Up `onFileMention` in ClaudePanel (GAP-09)
**Complexity:** 3
**Depends on:** T8
**Files:** `ClaudePanel.tsx`
**Changes:**
- Add `handleFileMention` callback: `async (query: string) => ipc.invoke('claude:search-files', projectPath, query)`
- Pass as `onFileMention` prop to ClaudeInputArea
- Import ipc client if not already available (use store's projectPath)

**Acceptance Criteria:**
- [ ] `onFileMention` prop passed from ClaudePanel to ClaudeInputArea
- [ ] Typing `@` triggers file search via IPC
- [ ] Results appear in existing mention popup
- [ ] Selecting a file inserts `@filename` into input

### T10: Line Range @-mention Support (GAP-10)
**Complexity:** 4
**Depends on:** T9
**Files:** `ClaudeInputArea.tsx`, `useClaudeStore.ts`
**Changes:**
- Update `@` regex in ClaudeInputArea from `/@(\S*)$/` to `/@([^@\s]*(?:#L\d+(?:-L?\d+)?)?)$/` to capture `@file#L5-L10` or `@file#L5`
- In `sendMessage` in store: before sending prompt, scan for `@file#Lstart-Lend` patterns, resolve via `ipc.invoke('fs:read-file', path)`, extract lines, prepend as context block
- Format: `\n--- @file#L5-L10 ---\n{lines}\n---\n\n{original prompt}`

**Acceptance Criteria:**
- [ ] `@file#L5-L10` syntax recognized in input
- [ ] File content for specified line range fetched and prepended to prompt
- [ ] Graceful fallback (warning in message) if file not found
- [ ] Basic `@file` (without line range) still works

### T11: `ClaudeDiff` Component (GAP-12)
**Complexity:** 7
**Files NEW:** `ClaudeDiff.tsx`
**Files Modified:** `package.json`, `ClaudeToolCall.tsx`
**Changes:**
- Create `ClaudeDiff` component that renders a unified diff view:
  - Props: `oldCode: string`, `newCode: string`, `filename: string`, `language?: string`
  - Uses `diff` npm package to compute unified diff
  - Renders with line numbers, green bg for additions, red bg for removals
  - Collapsible unchanged sections (show first/last 3 lines of unchanged blocks)
  - Claude Orange accent for the diff header
  - Scrollable container with max-height
- Add `diff` to package.json dependencies (user runs npm install)
- In ClaudeToolCall: when toolName is 'Edit' and toolResult contains diff-parseable data, render ClaudeDiff instead of raw CodeBlock

**Acceptance Criteria:**
- [ ] Renders unified diff with green/red line highlighting
- [ ] Line numbers on both sides
- [ ] Unchanged sections collapsible
- [ ] Scrollable for large diffs
- [ ] Integrated into ClaudeToolCall for Edit results

### T12: Accept/Reject Diff Hunks (GAP-13)
**Complexity:** 6
**Depends on:** T11
**Files:** `ClaudeDiff.tsx`, `ClaudeToolCall.tsx`
**Changes:**
- Add `onAcceptHunk?: (hunkIndex: number) => void` and `onRejectHunk?: (hunkIndex: number) => void` props to ClaudeDiff
- Render Accept (checkmark) / Reject (X) buttons on each hunk header
- After action: grey out hunk with "Accepted" or "Rejected" label
- In ClaudeToolCall: pass callbacks that send approval/rejection via permission IPC

**Acceptance Criteria:**
- [ ] Each diff hunk has Accept/Reject buttons
- [ ] Visual feedback after action (greyed out + status label)
- [ ] Buttons disabled after responding
- [ ] Callbacks propagated to parent

### T13: Message Retry Button (GAP-17)
**Complexity:** 3
**Files:** `useClaudeStore.ts`, `ClaudeMessage.tsx`, tests
**Changes:**
- Add `retryLastMessage` action to store:
  1. Find last user message
  2. Remove all messages after (and including) the last assistant response
  3. Re-call `sendMessage` with last user message content
- In ClaudeMessage: for the last assistant message (non-streaming), show a retry (RotateCcw) icon button on hover
- Pass `isLast` and `onRetry` props or use store directly

**Acceptance Criteria:**
- [ ] Retry button visible on hover of last assistant message
- [ ] Only shows when not loading
- [ ] Clicking removes last response and resends
- [ ] Tests pass for retryLastMessage action

### T14: Per-Message Token Count Display (GAP-18)
**Complexity:** 2
**Files:** `ClaudeMessage.tsx`
**Changes:**
- For assistant messages where `usageInputTokens` or `usageOutputTokens` is set (> 0), render a small token badge on hover
- Format: `↑{inputTokens} ↓{outputTokens}` in a subtle tooltip or badge
- Position: bottom-right of message, only on hover
- Style: `text-[10px]` with `claude.textDim` color

**Acceptance Criteria:**
- [ ] Token badge shows on hover for assistant messages with usage data
- [ ] Does not show for messages without usage data
- [ ] Format: "↑123 ↓456"
- [ ] Non-intrusive styling

---

## IMPLEMENTATION APPROACH

### Step 1: File Search Infrastructure (T8, T9)
- [ ] Add IPC channel and implement fuzzy file search handler
- [ ] Wire onFileMention from ClaudePanel to ClaudeInputArea
- [ ] Verify @-mention popup works with real file results

### Step 2: Line Range Support (T10)
- [ ] Update regex in ClaudeInputArea
- [ ] Add file content resolution in sendMessage
- [ ] Test with various @file#L patterns

### Step 3: Diff System (T11, T12)
- [ ] Add `diff` to package.json (user runs npm install)
- [ ] Create ClaudeDiff component
- [ ] Integrate into ClaudeToolCall for Edit results
- [ ] Add accept/reject hunk buttons

### Step 4: Message Actions (T13, T14)
- [ ] Add retryLastMessage to store
- [ ] Add retry button to ClaudeMessage
- [ ] Add per-message token display
- [ ] Write tests

### Step 5: Validation
- [ ] All tests pass
- [ ] No regressions
- [ ] @-mentions work end-to-end
- [ ] Diffs render correctly for Edit tool calls

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE2-FILE-MENTIONS-DIFF-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Changes Applied (per task)
3. Test Results
4. Files Changed inventory
5. Next Steps (Phase 3 readiness)

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   ```bash
   mv trinity/work-orders/WO-021-claude-box-file-mentions-diff-system.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-021-claude-box-file-mentions-diff-system.md`

---

## SUCCESS CRITERIA

- [ ] All 7 tasks (T8-T14) implemented
- [ ] @-mentions work end-to-end with IPC file search
- [ ] Line range @file#L5-L10 syntax works
- [ ] ClaudeDiff renders unified diffs with syntax highlighting
- [ ] Accept/Reject buttons on diff hunks
- [ ] Retry button on last assistant message
- [ ] Token badges on assistant messages
- [ ] All tests pass

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install (edit package.json, LUKA runs npm install)

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially (no parallel edits)
- [ ] Follow existing code patterns (Claude Orange theme, Zustand, Tailwind)

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** HIGH
**Risk Factors:**
- ClaudeDiff is the most complex new component (7 complexity)
- File search must handle large project trees efficiently
- @-mention line range parsing requires careful regex work
- diff npm package adds external dependency

**Mitigation:**
- Limit file search to 20 results with debounce
- Use existing fs:read-directory infrastructure for file walking
- Test regex patterns thoroughly with edge cases
- diff package is well-maintained, minimal dep footprint

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
