# ORCHESTRATOR WORK ORDER #003
## Type: IMPLEMENTATION
## Test Coverage — Foundation (Shared, Layout, Utilities)

---

## MISSION OBJECTIVE

Implement test coverage for 8 foundational modules: shared components, layout components, and utility components. These are leaf-level components with minimal dependencies, establishing test patterns reused by all subsequent phases.

**Implementation Goal:** 8 new test files, all passing, covering StatusBadge, ThemeToggle, ErrorBoundary, FileIcon, GitStatusBadge, AppBar, Sidebar, Layout
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 1

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/renderer/components/contributions/StatusBadge.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/shared/ThemeToggle.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/shared/ErrorBoundary.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/ide/file-tree/FileIcon.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/ide/file-tree/GitStatusBadge.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/layout/AppBar.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/layout/Sidebar.test.tsx
    changes: New test file
    risk: LOW

  - path: tests/renderer/components/layout/Layout.test.tsx
    changes: New test file
    risk: LOW
```

### Source Files Under Test
- `src/renderer/components/contributions/StatusBadge.tsx` (32 lines)
- `src/renderer/components/shared/ThemeToggle.tsx` (~30 lines)
- `src/renderer/components/shared/ErrorBoundary.tsx` (~50 lines)
- `src/renderer/components/ide/file-tree/FileIcon.tsx` (~50 lines)
- `src/renderer/components/ide/file-tree/GitStatusBadge.tsx` (~30 lines)
- `src/renderer/components/layout/AppBar.tsx` (18 lines)
- `src/renderer/components/layout/Sidebar.tsx` (89 lines)
- `src/renderer/components/layout/Layout.tsx` (47 lines)

---

## IMPLEMENTATION APPROACH

### Step 1: Pure/Simple Components (Parallel)
- [ ] Task 1.1: StatusBadge.test.tsx — Test all status variants render correctly
- [ ] Task 1.2: ThemeToggle.test.tsx — Test toggle state, store interaction
- [ ] Task 1.3: ErrorBoundary.test.tsx — Test error catching, fallback render
- [ ] Task 1.4: FileIcon.test.tsx — Test icon selection by file extension
- [ ] Task 1.5: GitStatusBadge.test.tsx — Test badge render for each git status (M, A, D, C, U)

### Step 2: Layout Components (Sequential — Layout depends on AppBar/Sidebar)
- [ ] Task 1.6: AppBar.test.tsx — Test render, navigation
- [ ] Task 1.7: Sidebar.test.tsx — Test menu items, active state, navigation
- [ ] Task 1.8: Layout.test.tsx — Test composition of AppBar + Sidebar + children

### Step 3: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions in existing 334+ tests

---

## MOCK PATTERNS

Use selector-compatible Zustand mock for any store:
```typescript
vi.mock('path/to/store', () => ({
  useStoreName: (selector?: (state: any) => any) => {
    const state = { /* mock state */ };
    return selector ? selector(state) : state;
  },
}));
```

Mock child components when testing Layout:
```typescript
vi.mock('path/to/AppBar', () => ({
  AppBar: () => <div data-testid="app-bar">AppBar</div>,
}));
```

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `FOUNDATION-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** — 8 test files created
2. **Changes Applied** — List of all new test files
3. **Test Results** — vitest output showing all pass
4. **Next Steps** — Proceed to WO-004

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Verify file locations
**Step 4:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 8 new test files created and passing
- [ ] Each component's key behaviors covered (render, interactions, edge cases)
- [ ] No regressions in existing test suite
- [ ] All tests use established mock patterns

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL git operations are FORBIDDEN. Only LUKA has permission for git operations.

### DO:
- [ ] Follow existing test patterns from IDEAppBar.test.tsx and EditorTabBar.test.tsx
- [ ] Use selector-compatible store mocks
- [ ] Test accessibility attributes where present
- [ ] Cover error states and edge cases

### DO NOT:
- [ ] Modify source files
- [ ] Add unnecessary dependencies
- [ ] Create overly complex test setups
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** FOCUSED
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Router mocking needed for Layout/Sidebar
- Store mocking for ThemeToggle

**Mitigation:**
- Use established mock patterns from existing tests
- Mock router at module level
