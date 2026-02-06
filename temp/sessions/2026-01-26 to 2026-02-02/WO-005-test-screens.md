# ORCHESTRATOR WORK ORDER #005
## Type: IMPLEMENTATION
## Test Coverage — Screen Components

---

## MISSION OBJECTIVE

Implement test coverage for all 4 screen-level components. Screens compose feature components (tested in WO-004) and layout components (tested in WO-003).

**Implementation Goal:** 4 new test files, all passing
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 3
**Depends On:** WO-003 (Layout), WO-004 (Feature components)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/renderer/screens/DashboardScreen.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/screens/SettingsScreen.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/screens/ContributionsScreen.test.tsx
    changes: New test file
    risk: MEDIUM

  - path: tests/renderer/screens/IssueDiscoveryScreen.test.tsx
    changes: New test file
    risk: MEDIUM
```

### Source Files Under Test
- `src/renderer/screens/DashboardScreen.tsx` (54 lines)
- `src/renderer/screens/SettingsScreen.tsx` (28 lines)
- `src/renderer/screens/ContributionsScreen.tsx` (61 lines)
- `src/renderer/screens/IssueDiscoveryScreen.tsx` (67 lines)

---

## IMPLEMENTATION APPROACH

### Step 1: All Screens (Parallel — all independent)
- [ ] Task 3.1: DashboardScreen.test.tsx — Renders layout, dashboard content, navigation
- [ ] Task 3.2: SettingsScreen.test.tsx — Renders layout, SettingsForm child
- [ ] Task 3.3: ContributionsScreen.test.tsx — Renders layout, contribution list, store integration
- [ ] Task 3.4: IssueDiscoveryScreen.test.tsx — Renders layout, issue discovery flow, store integration

### Step 2: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions

---

## KEY TEST SCENARIOS

### DashboardScreen
- Renders within Layout wrapper
- Shows dashboard content/statistics
- Navigation links work

### ContributionsScreen
- Renders ContributionList
- Loads contributions from store/IPC on mount
- Handles empty state
- "New Contribution" action

### IssueDiscoveryScreen
- Renders issue discovery UI
- Repository search/selection
- Issue list display
- Loading and error states

---

## MOCK PATTERNS

Mock child components to isolate screen testing:
```typescript
vi.mock('path/to/components/layout/Layout', () => ({
  Layout: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));

vi.mock('path/to/components/contributions/ContributionList', () => ({
  ContributionList: () => <div data-testid="contribution-list">ContributionList</div>,
}));
```

---

## DELIVERABLE REQUIREMENTS

**Filename:** `SCREENS-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 4 new test files created and passing
- [ ] Each screen renders its expected child components
- [ ] Store integrations tested
- [ ] No regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ GIT OPERATIONS FORBIDDEN — Only LUKA has permission.

### DO:
- [ ] Mock child components to isolate screen behavior
- [ ] Test screen-level routing/navigation
- [ ] Test loading and error states

### DO NOT:
- [ ] Test child component internals (covered by WO-003/004)
- [ ] Modify source files
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** FOCUSED
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Router mocking for navigation tests
- Store initialization on screen mount

**Mitigation:**
- Mock router at module level
- Use selector-compatible store mocks
