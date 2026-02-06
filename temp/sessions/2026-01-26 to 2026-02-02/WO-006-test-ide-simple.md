# ORCHESTRATOR WORK ORDER #006
## Type: IMPLEMENTATION
## Test Coverage — IDE Components (Simple)

---

## MISSION OBJECTIVE

Implement test coverage for 9 simpler IDE components: EditorTab, IDEStatusBar, IDEInitializer, and all Git sub-components (GitStatusSummary, GitQuickActions, BranchPicker, GitCommitDialog, GitDiffViewer, GitPanel).

**Implementation Goal:** 9 new test files, all passing
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 4
**Depends On:** WO-003 (Foundation mock patterns)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/renderer/components/ide/editor/EditorTab.test.tsx
    changes: New test file — memoized tab component
    risk: LOW

  - path: tests/renderer/components/ide/IDEStatusBar.test.tsx
    changes: New test file — memoized status bar
    risk: LOW

  - path: tests/renderer/components/ide/IDEInitializer.test.tsx
    changes: New test file — initialization logic
    risk: MEDIUM

  - path: tests/renderer/components/ide/git/GitStatusSummary.test.tsx
    changes: New test file — status display
    risk: LOW

  - path: tests/renderer/components/ide/git/GitQuickActions.test.tsx
    changes: New test file — action buttons + IPC
    risk: MEDIUM

  - path: tests/renderer/components/ide/git/BranchPicker.test.tsx
    changes: New test file — branch selection + IPC
    risk: MEDIUM

  - path: tests/renderer/components/ide/git/GitCommitDialog.test.tsx
    changes: New test file — form + IPC
    risk: MEDIUM

  - path: tests/renderer/components/ide/git/GitDiffViewer.test.tsx
    changes: New test file — diff display + IPC
    risk: MEDIUM

  - path: tests/renderer/components/ide/git/GitPanel.test.tsx
    changes: New test file — composition of git sub-components
    risk: LOW
```

### Source Files Under Test
- `src/renderer/components/ide/editor/EditorTab.tsx` (138 lines)
- `src/renderer/components/ide/IDEStatusBar.tsx` (90 lines)
- `src/renderer/components/ide/IDEInitializer.tsx` (78 lines)
- `src/renderer/components/ide/git/GitStatusSummary.tsx` (~60 lines)
- `src/renderer/components/ide/git/GitQuickActions.tsx` (~80 lines)
- `src/renderer/components/ide/git/BranchPicker.tsx` (~80 lines)
- `src/renderer/components/ide/git/GitCommitDialog.tsx` (~100 lines)
- `src/renderer/components/ide/git/GitDiffViewer.tsx` (~120 lines)
- `src/renderer/components/ide/git/GitPanel.tsx` (92 lines)

---

## IMPLEMENTATION APPROACH

### Step 1: Props-only / Simple Store Components (Parallel)
- [ ] Task 4.1: EditorTab.test.tsx — Tab render, active state, close button, modified indicator
- [ ] Task 4.2: IDEStatusBar.test.tsx — File info display, branch name, modified count
- [ ] Task 4.4: GitStatusSummary.test.tsx — Status counts render for each type

### Step 2: IPC-dependent Components (Parallel)
- [ ] Task 4.3: IDEInitializer.test.tsx — Init sequence, loading state, error handling
- [ ] Task 4.5: GitQuickActions.test.tsx — Stage, unstage, discard actions
- [ ] Task 4.6: BranchPicker.test.tsx — Branch list fetch, selection, create new
- [ ] Task 4.7: GitCommitDialog.test.tsx — Message input, commit action, validation
- [ ] Task 4.8: GitDiffViewer.test.tsx — Diff content display, file selection

### Step 3: Composition Component
- [ ] Task 4.9: GitPanel.test.tsx — Renders child git components, passes repoPath

### Step 4: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions

---

## KEY TEST SCENARIOS

### EditorTab
- Renders file name from path
- Shows modified indicator (dot) when isModified
- Highlights when active
- Close button click calls onClose
- Tab click calls onClick
- Shows file extension icon

### IDEStatusBar
- Shows active file language
- Shows branch name
- Shows modified file count
- Handles no active file gracefully

### GitCommitDialog
- Renders commit message input
- Disables commit when message empty
- Calls IPC git:commit on submit
- Shows error on commit failure
- Clears message after successful commit

---

## DELIVERABLE REQUIREMENTS

**Filename:** `IDE-SIMPLE-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 9 new test files created and passing
- [ ] Store selectors tested with selector-compatible mocks
- [ ] IPC interactions tested (success + error paths)
- [ ] No regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ GIT OPERATIONS FORBIDDEN — Only LUKA has permission.

### DO:
- [ ] Follow EditorTabBar.test.tsx and IDEAppBar.test.tsx patterns exactly
- [ ] Mock child components when testing GitPanel composition
- [ ] Test disabled/enabled button states
- [ ] Test form validation

### DO NOT:
- [ ] Modify source files
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Git component IPC interactions may have complex response shapes
- IDEInitializer has async initialization sequence

**Mitigation:**
- Read source files to determine exact IPC channel names and response shapes
- Use waitFor for async initialization testing
