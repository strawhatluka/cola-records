# ORCHESTRATOR WORK ORDER #004
## Type: IMPLEMENTATION
## Test Coverage — Feature Components (Contributions, Issues, Settings)

---

## MISSION OBJECTIVE

Implement test coverage for 10 feature-level components across Contributions, Issues, Settings, and shared UI. These components have moderate complexity with store interactions and IPC calls.

**Implementation Goal:** 10 new test files, all passing
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 2
**Depends On:** WO-003 (Foundation tests establish mock patterns)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/renderer/components/issues/IssueCard.test.tsx
    changes: New test file — props-only component
    risk: LOW

  - path: tests/renderer/components/issues/IssueList.test.tsx
    changes: New test file — react-window virtualized list
    risk: MEDIUM

  - path: tests/renderer/components/issues/IssueDetailModal.test.tsx
    changes: New test file — IPC + stores
    risk: MEDIUM

  - path: tests/renderer/components/issues/SearchPanel.test.tsx
    changes: New test file — IPC + stores + search logic
    risk: MEDIUM

  - path: tests/renderer/components/issues/RepositoryFileTree.test.tsx
    changes: New test file — IPC + tree parsing
    risk: MEDIUM

  - path: tests/renderer/components/contributions/ContributionCard.test.tsx
    changes: New test file — IPC + stores + PR sync
    risk: MEDIUM

  - path: tests/renderer/components/contributions/ContributionList.test.tsx
    changes: New test file — list rendering
    risk: LOW

  - path: tests/renderer/components/contributions/ContributionWorkflowModal.test.tsx
    changes: New test file — multi-step workflow
    risk: MEDIUM

  - path: tests/renderer/components/settings/SettingsForm.test.tsx
    changes: New test file — IPC + token validation + theme
    risk: MEDIUM

  - path: tests/renderer/components/ide/KeyboardShortcutsHelp.test.tsx
    changes: New test file — props-only
    risk: LOW
```

### Source Files Under Test
- `src/renderer/components/issues/IssueCard.tsx` (51 lines)
- `src/renderer/components/issues/IssueList.tsx` (65 lines)
- `src/renderer/components/issues/IssueDetailModal.tsx` (101 lines)
- `src/renderer/components/issues/SearchPanel.tsx` (151 lines)
- `src/renderer/components/issues/RepositoryFileTree.tsx` (160 lines)
- `src/renderer/components/contributions/ContributionCard.tsx` (196 lines)
- `src/renderer/components/contributions/ContributionList.tsx` (55 lines)
- `src/renderer/components/contributions/ContributionWorkflowModal.tsx` (144 lines)
- `src/renderer/components/settings/SettingsForm.tsx` (197 lines)
- `src/renderer/components/ide/KeyboardShortcutsHelp.tsx` (~60 lines)

---

## IMPLEMENTATION APPROACH

### Step 1: Simple Components (Parallel)
- [ ] Task 2.1: IssueCard.test.tsx — Render with props, click handler
- [ ] Task 2.10: KeyboardShortcutsHelp.test.tsx — Render shortcut list

### Step 2: Medium Components (Parallel)
- [ ] Task 2.2: IssueList.test.tsx — Virtualized list render, item selection
- [ ] Task 2.3: IssueDetailModal.test.tsx — Modal open/close, IPC data fetch
- [ ] Task 2.4: issues/SearchPanel.test.tsx — Search input, results display, IPC
- [ ] Task 2.5: RepositoryFileTree.test.tsx — Tree parsing, node expansion, IPC

### Step 3: Complex Components (Parallel)
- [ ] Task 2.6: ContributionCard.test.tsx — Status display, branch fetch, PR sync, delete
- [ ] Task 2.7: ContributionList.test.tsx — List render, empty state
- [ ] Task 2.8: ContributionWorkflowModal.test.tsx — Multi-step flow, validation
- [ ] Task 2.9: SettingsForm.test.tsx — Form fields, token validation, theme, save

### Step 4: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions

---

## KEY TEST SCENARIOS

### ContributionCard (highest complexity)
- Renders contribution status badge
- Shows repository name and branch
- Handles "Open IDE" click
- Handles delete with confirmation
- Shows PR sync status
- Error states for failed operations

### SettingsForm (highest complexity)
- Renders all setting groups
- GitHub token validation (valid/invalid)
- Theme selection
- Save button state (enabled/disabled)
- Error handling for save failures

### IssueDetailModal
- Opens with issue data
- Displays issue title, body, labels
- "Start Contributing" action
- Close modal behavior

---

## MOCK PATTERNS

```typescript
// IPC mock
vi.mock('path/to/ipc/client', () => ({
  ipc: { invoke: vi.fn() },
}));

// Per-test IPC responses
vi.mocked(ipc.invoke).mockResolvedValue({ /* response */ });

// Store mock (selector-compatible)
vi.mock('path/to/store', () => ({
  useStoreName: (selector?: (state: any) => any) => {
    const state = { /* mock state */ };
    return selector ? selector(state) : state;
  },
}));
```

---

## DELIVERABLE REQUIREMENTS

**Filename:** `FEATURE-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Verify file locations
**Step 4:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 10 new test files created and passing
- [ ] IPC interactions tested (success + error paths)
- [ ] Store interactions use selector-compatible mocks
- [ ] User interactions tested with userEvent
- [ ] No regressions in existing test suite

---

## CONSTRAINTS & GUIDELINES

### ⚠️ GIT OPERATIONS FORBIDDEN — Only LUKA has permission.

### DO:
- [ ] Mock react-window for virtualized lists
- [ ] Test both success and error paths for IPC calls
- [ ] Test modal open/close behavior
- [ ] Test form validation states

### DO NOT:
- [ ] Modify source files
- [ ] Test internal implementation details
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- react-window mocking for IssueList
- Multi-step workflow testing for ContributionWorkflowModal
- Token validation async flow in SettingsForm

**Mitigation:**
- Mock react-window FixedSizeList at module level
- Test each workflow step independently
- Use mockResolvedValue/mockRejectedValue for async paths
