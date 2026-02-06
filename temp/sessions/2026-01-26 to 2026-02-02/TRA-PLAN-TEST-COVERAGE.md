# TRA Implementation Plan: Comprehensive Test Coverage

**Plan ID:** TRA-PLAN-003
**Date:** 2026-01-29
**Scale:** Large (45+ test files, 8 priority tiers)
**Stop Points:** 4 (requirements, design, plan, final)
**BAS Gates:** lint, build, test after each work order phase

---

## Strategic Overview

**Objective:** Achieve 100% module test coverage across 45 untested modules
**Current State:** 20/62 modules tested (32%)
**Target State:** 62/62 modules tested (100%)
**Approach:** 6 work order phases, grouped by dependency & complexity

---

## Phase Structure

### Phase 1 (WO-003): Foundation — Shared, Layout, Utilities
**Scope:** 8 test files | Complexity: Low (2-3)
**Rationale:** These are leaf components with no child dependencies. Testing them first establishes patterns reused by all later phases.

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 1.1 | `StatusBadge.tsx` | 32 | 1 | None |
| 1.2 | `ThemeToggle.tsx` | ~30 | 2 | useSettingsStore |
| 1.3 | `ErrorBoundary.tsx` | ~50 | 2 | None |
| 1.4 | `FileIcon.tsx` | ~50 | 1 | None (pure) |
| 1.5 | `GitStatusBadge.tsx` | ~30 | 1 | None (pure) |
| 1.6 | `AppBar.tsx` | 18 | 2 | Router |
| 1.7 | `Sidebar.tsx` | 89 | 3 | Router, Screen type |
| 1.8 | `Layout.tsx` | 47 | 2 | AppBar, Sidebar |

**BAS Gate:** lint + build + test after completion
**Parallelizable:** [1.1, 1.2, 1.3, 1.4, 1.5] then [1.6, 1.7] then [1.8]

---

### Phase 2 (WO-004): Feature Components — Contributions & Issues
**Scope:** 10 test files | Complexity: Medium (3-5)
**Rationale:** User-facing feature components. Moderate store/IPC mocking needed.

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 2.1 | `IssueCard.tsx` | 51 | 2 | Props only |
| 2.2 | `IssueList.tsx` | 65 | 3 | react-window, IssueCard |
| 2.3 | `IssueDetailModal.tsx` | 101 | 4 | IPC, contribution store |
| 2.4 | `issues/SearchPanel.tsx` | 151 | 4 | IPC, stores |
| 2.5 | `RepositoryFileTree.tsx` | 160 | 5 | IPC, tree parsing |
| 2.6 | `ContributionCard.tsx` | 196 | 5 | IPC, stores, PR sync |
| 2.7 | `ContributionList.tsx` | 55 | 3 | ContributionCard |
| 2.8 | `ContributionWorkflowModal.tsx` | 144 | 5 | IPC, multi-step workflow |
| 2.9 | `SettingsForm.tsx` | 197 | 5 | IPC, stores, token validation |
| 2.10 | `KeyboardShortcutsHelp.tsx` | ~60 | 2 | Props only |

**BAS Gate:** lint + build + test after completion
**Parallelizable:** [2.1, 2.10] then [2.2, 2.3, 2.4, 2.5] then [2.6, 2.7, 2.8, 2.9]

---

### Phase 3 (WO-005): Screens
**Scope:** 4 test files | Complexity: Medium (4-5)
**Rationale:** Screen components compose feature components (tested in Phase 2). Requires router mocking.

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 3.1 | `DashboardScreen.tsx` | 54 | 3 | Layout, stores |
| 3.2 | `SettingsScreen.tsx` | 28 | 2 | Layout, SettingsForm |
| 3.3 | `ContributionsScreen.tsx` | 61 | 4 | Layout, ContributionList, stores |
| 3.4 | `IssueDiscoveryScreen.tsx` | 67 | 5 | Layout, IssueList, stores |

**BAS Gate:** lint + build + test after completion
**Parallelizable:** [3.1, 3.2, 3.3, 3.4] (all independent)

---

### Phase 4 (WO-006): IDE Components — Simple
**Scope:** 9 test files | Complexity: Medium (3-5)
**Rationale:** Simpler IDE components that don't require complex mocking. EditorTab, GitPanel, etc.

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 4.1 | `EditorTab.tsx` | 138 | 3 | Props + callbacks |
| 4.2 | `IDEStatusBar.tsx` | 90 | 3 | Stores (selectors) |
| 4.3 | `IDEInitializer.tsx` | 78 | 4 | IPC, stores |
| 4.4 | `GitStatusSummary.tsx` | ~60 | 2 | Props only |
| 4.5 | `GitQuickActions.tsx` | ~80 | 3 | IPC, stores |
| 4.6 | `BranchPicker.tsx` | ~80 | 4 | IPC, stores |
| 4.7 | `GitCommitDialog.tsx` | ~100 | 4 | IPC, stores |
| 4.8 | `GitDiffViewer.tsx` | ~120 | 4 | IPC, stores |
| 4.9 | `GitPanel.tsx` | 92 | 3 | Child git components |

**BAS Gate:** lint + build + test after completion
**Parallelizable:** [4.1, 4.2, 4.4] then [4.3, 4.5, 4.6, 4.7, 4.8] then [4.9]

---

### Phase 5 (WO-007): IDE Components — Complex + Store Gaps
**Scope:** 7 test files | Complexity: High (5-7)
**Rationale:** Complex IDE panels and store function gaps. These require extensive mocking (IPC, stores, DOM APIs).

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 5.1 | `SearchPanel.tsx` (IDE) | 316 | 5 | IPC, stores, debounce |
| 5.2 | `ResizablePanelGroup.tsx` | ~100 | 4 | DOM resize |
| 5.3 | `FileTreeNode.tsx` | ~200 | 6 | 3 stores, context menus |
| 5.4 | `FileTreePanel.tsx` | 533 | 7 | react-window, stores, IPC |
| 5.5 | `CodeEditorPanel.tsx` | 315 | 7 | Monaco mock, stores, IPC |
| 5.6 | `TerminalPanel.tsx` | 250 | 6 | XTerm mock, stores |
| 5.7 | `IDELayout.tsx` | 119 | 5 | All IDE child components |
| 5.8 | `useFileTreeStore` gaps | ~50 | 3 | warmGitIgnoreCache, addNode, removeNode |
| 5.9 | `useKeyboardShortcuts` full | 45 | 3 | DOM keyboard events |

**BAS Gate:** lint + build + test after completion
**Parallelizable:** [5.1, 5.2, 5.8, 5.9] then [5.3, 5.5, 5.6] then [5.4, 5.7]

---

### Phase 6 (WO-008): Backend Services
**Scope:** 4 test files | Complexity: Medium-High (4-7)
**Rationale:** Backend services require different mocking (Node APIs, external packages).

| Task | File | Lines | Complexity | Dependencies |
|------|------|-------|------------|--------------|
| 6.1 | `environment.service.ts` | 198 | 4 | Node fs, path |
| 6.2 | `filewatcher.service.ts` | 149 | 5 | chokidar mock |
| 6.3 | `secure-storage.service.ts` | 146 | 5 | electron safeStorage |
| 6.4 | `github-rest.service.ts` | 431 | 7 | Octokit mock, 16+ methods |

**BAS Gate:** lint + build + test (full suite) after completion
**Parallelizable:** [6.1, 6.2, 6.3] then [6.4]

---

## Implementation Sequence

```
Phase 1 (WO-003) ─── Foundation (8 tests)
       │
Phase 2 (WO-004) ─── Feature Components (10 tests)
       │
Phase 3 (WO-005) ─── Screens (4 tests)
       │
Phase 4 (WO-006) ─── IDE Simple (9 tests)
       │
Phase 5 (WO-007) ─── IDE Complex + Store/Hook Gaps (9 tests)
       │
Phase 6 (WO-008) ─── Backend Services (4 tests)
       │
    ✅ FINAL BAS GATE ─── Full test suite, coverage report
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Monaco Editor mocking | High | Mock at module level, test behavior not internals |
| XTerm mocking | High | Mock terminal wrapper, test session management |
| react-window v2 virtualization | Medium | Mock FixedSizeList, test item rendering |
| Complex store interactions (3+ stores) | Medium | Use selector-compatible mock pattern established in codebase |
| IPC channel mocking consistency | Low | Reuse existing ipc mock pattern |

---

## Quality Gates

Each phase must pass before the next begins:
1. **Lint:** `npx eslint` passes (auto-fix enabled)
2. **Build:** `npm run build` succeeds
3. **Test:** `npx vitest run` — all tests pass (0 failures)
4. **Coverage:** Target ≥80% of new test files

---

## TRA Handoff JSON

```json
{
  "planId": "TRA-PLAN-003",
  "scale": "large",
  "totalTasks": 44,
  "phases": [
    {
      "id": "WO-003",
      "name": "Foundation",
      "tasks": 8,
      "complexity": "low",
      "dependencies": []
    },
    {
      "id": "WO-004",
      "name": "Feature Components",
      "tasks": 10,
      "complexity": "medium",
      "dependencies": ["WO-003"]
    },
    {
      "id": "WO-005",
      "name": "Screens",
      "tasks": 4,
      "complexity": "medium",
      "dependencies": ["WO-004"]
    },
    {
      "id": "WO-006",
      "name": "IDE Simple",
      "tasks": 9,
      "complexity": "medium",
      "dependencies": ["WO-003"]
    },
    {
      "id": "WO-007",
      "name": "IDE Complex + Gaps",
      "tasks": 9,
      "complexity": "high",
      "dependencies": ["WO-006"]
    },
    {
      "id": "WO-008",
      "name": "Backend Services",
      "tasks": 4,
      "complexity": "medium-high",
      "dependencies": []
    }
  ],
  "parallelizable": [
    ["WO-003", "WO-008"],
    ["WO-004", "WO-006"]
  ],
  "stopPoints": ["after-WO-003", "after-WO-005", "after-WO-007", "final"],
  "basGates": ["lint", "build", "test"]
}
```

---

## Mock Pattern Reference

All tests should use the established selector-compatible mock pattern:

```typescript
// Zustand store mock
vi.mock('path/to/store', () => ({
  useStoreName: (selector?: (state: any) => any) => {
    const state = { /* mock state */ };
    return selector ? selector(state) : state;
  },
}));

// IPC mock
vi.mock('path/to/ipc/client', () => ({
  ipc: { invoke: vi.fn() },
}));
```
