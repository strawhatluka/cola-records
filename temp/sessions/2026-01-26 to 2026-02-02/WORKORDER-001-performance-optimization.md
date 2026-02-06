# Work Order: WORKORDER-001 - Application Performance Optimization

**Status**: Approved for Implementation
**Priority**: P1
**Scale**: Large (6+ files)
**Created**: 2026-01-29
**Investigation**: INV-PERF-001 (static analysis complete; profiling deferred - implementing confirmed bottlenecks)
**Stop Points**: 4 (requirements, design, plan, final)

---

## TRA Implementation Plan

### Strategic Overview

The implementation is structured in 3 batches ordered by ROI. Batch A (Quick Wins) addresses the highest-impact issues with minimal code changes. Batch B (Architecture) tackles structural improvements. Batch C (Polish) handles low-severity optimizations.

Each task runs through BAS quality gates: lint, build, test, coverage.

---

## Implementation Sequence

```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Wrap FileTreeNode in React.memo",
      "file": "src/renderer/components/ide/file-tree/FileTreeNode.tsx",
      "dependencies": [],
      "complexity": 2,
      "estimatedTime": "15min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 2,
      "description": "Wrap IssueCard in React.memo",
      "file": "src/renderer/components/issues/IssueCard.tsx",
      "dependencies": [],
      "complexity": 1,
      "estimatedTime": "10min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 3,
      "description": "Wrap ContributionCard in React.memo",
      "file": "src/renderer/components/contributions/ContributionCard.tsx",
      "dependencies": [],
      "complexity": 2,
      "estimatedTime": "15min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 4,
      "description": "Refactor FileTreePanel Zustand selectors to fine-grained",
      "file": "src/renderer/components/ide/file-tree/FileTreePanel.tsx",
      "dependencies": [],
      "complexity": 4,
      "estimatedTime": "30min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 5,
      "description": "Refactor CodeEditorPanel Zustand selectors to fine-grained",
      "file": "src/renderer/components/ide/editor/CodeEditorPanel.tsx",
      "dependencies": [],
      "complexity": 4,
      "estimatedTime": "30min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 6,
      "description": "Refactor GitPanel Zustand selectors to fine-grained",
      "file": "src/renderer/components/ide/git/GitPanel.tsx",
      "dependencies": [],
      "complexity": 3,
      "estimatedTime": "20min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 7,
      "description": "Implement react-window virtualization in FileTreePanel",
      "file": "src/renderer/components/ide/file-tree/FileTreePanel.tsx",
      "dependencies": [1, 4],
      "complexity": 6,
      "estimatedTime": "60min",
      "batch": "A",
      "basGates": ["lint", "build", "test", "coverage"]
    },
    {
      "id": 8,
      "description": "Extract constant style objects and memoize inline handlers in FileTreePanel",
      "file": "src/renderer/components/ide/file-tree/FileTreePanel.tsx",
      "dependencies": [7],
      "complexity": 3,
      "estimatedTime": "20min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 9,
      "description": "Memoize onViewDetails handler in IssueList",
      "file": "src/renderer/components/issues/IssueList.tsx",
      "dependencies": [2],
      "complexity": 2,
      "estimatedTime": "15min",
      "batch": "A",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 10,
      "description": "Implement react-window virtualization in IssueList",
      "file": "src/renderer/components/issues/IssueList.tsx",
      "dependencies": [2, 9],
      "complexity": 5,
      "estimatedTime": "45min",
      "batch": "B",
      "basGates": ["lint", "build", "test", "coverage"]
    },
    {
      "id": 11,
      "description": "Lazy-load MonacoEditor via React.lazy + Suspense",
      "file": "src/renderer/components/ide/editor/CodeEditorPanel.tsx",
      "dependencies": [5],
      "complexity": 4,
      "estimatedTime": "30min",
      "batch": "B",
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": 12,
      "description": "Optimize git status tree walk in useFileTreeStore",
      "file": "src/renderer/stores/useFileTreeStore.ts",
      "dependencies": [],
      "complexity": 6,
      "estimatedTime": "45min",
      "batch": "B",
      "basGates": ["lint", "build", "test", "coverage"]
    },
    {
      "id": 13,
      "description": "Add Vite code splitting config with manualChunks",
      "file": "vite.config.ts",
      "dependencies": [11],
      "complexity": 4,
      "estimatedTime": "30min",
      "batch": "C",
      "basGates": ["lint", "build"]
    },
    {
      "id": 14,
      "description": "Run full test suite and verify no regressions",
      "file": "tests/",
      "dependencies": [1,2,3,4,5,6,7,8,9,10,11,12,13],
      "complexity": 2,
      "estimatedTime": "15min",
      "batch": "Final",
      "basGates": ["lint", "build", "test", "coverage"]
    }
  ],
  "sequence": [
    [1, 2, 3, 4, 5, 6, 12],
    [7, 9, 11],
    [8, 10, 13],
    [14]
  ],
  "parallelizable": [
    [1, 2, 3],
    [4, 5, 6],
    [7, 9, 11, 12],
    [8, 10, 13]
  ],
  "stopPoints": ["after Batch A (tasks 1-9)", "after Batch B (tasks 10-12)", "after Batch C (task 13)", "final validation (task 14)"],
  "totalEstimate": "5.5 hours"
}
```

---

## Phase 1: Setup (Batch A - Quick Wins)

**Objective**: Eliminate the highest-impact rendering bottlenecks with minimal code changes.
**Stop Point**: After Phase 1 completion - validate perceived lag improvement.

### Task Group 1.1: React.memo on List Items (Parallel)

These 3 tasks have zero dependencies and can execute in parallel.

#### Task 1: React.memo on FileTreeNode
- **File**: `src/renderer/components/ide/file-tree/FileTreeNode.tsx`
- **Complexity**: 2/10
- **Change**: Wrap default export in `React.memo()`. The component receives `node: FileNode`, `depth: number`, `style: CSSProperties` - all suitable for shallow comparison.
- **Pattern**:
  ```typescript
  export const FileTreeNode = React.memo(function FileTreeNode({ node, depth, style }: FileTreeNodeProps) {
    // existing component body unchanged
  });
  ```
- **Risk**: Low. If any prop comparison needs customization, add comparator function.
- **Test**: Existing FileTreeNode tests must pass. Verify in app that expand/collapse still works.

#### Task 2: React.memo on IssueCard
- **File**: `src/renderer/components/issues/IssueCard.tsx`
- **Complexity**: 1/10
- **Change**: Wrap export in `React.memo()`. Props are `issue: GitHubIssue` (stable object), `onViewDetails: () => void` (needs stable ref from parent), `style?: CSSProperties`.
- **Note**: This only helps if parent memoizes `onViewDetails` - see Task 9.
- **Test**: Existing IssueCard tests must pass.

#### Task 3: React.memo on ContributionCard
- **File**: `src/renderer/components/contributions/ContributionCard.tsx`
- **Complexity**: 2/10
- **Change**: Wrap export in `React.memo()`. Has internal state (`syncing`, `branches`, `loadingBranches`) which is fine - memo prevents re-renders from parent, internal state still triggers re-renders.
- **Test**: Existing ContributionCard tests must pass.

### Task Group 1.2: Zustand Selector Refactoring (Parallel)

These 3 tasks have zero dependencies on each other.

#### Task 4: FileTreePanel Fine-Grained Selectors
- **File**: `src/renderer/components/ide/file-tree/FileTreePanel.tsx`
- **Complexity**: 4/10
- **Current** (line 66-70):
  ```typescript
  const { fileTree, expandedPaths, loading, error, loadTree, addNode, removeNode } = useFileTreeStore();
  const { fetchStatus } = useGitStore();
  const { openFile, renameFile } = useCodeEditorStore();
  const { clipboard, setClipboard } = useIDEStore();
  ```
- **Refactored**:
  ```typescript
  const fileTree = useFileTreeStore((s) => s.fileTree);
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const loading = useFileTreeStore((s) => s.loading);
  const error = useFileTreeStore((s) => s.error);
  const loadTree = useFileTreeStore((s) => s.loadTree);
  const addNode = useFileTreeStore((s) => s.addNode);
  const removeNode = useFileTreeStore((s) => s.removeNode);
  const fetchStatus = useGitStore((s) => s.fetchStatus);
  const openFile = useCodeEditorStore((s) => s.openFile);
  const renameFile = useCodeEditorStore((s) => s.renameFile);
  const clipboard = useIDEStore((s) => s.clipboard);
  const setClipboard = useIDEStore((s) => s.setClipboard);
  ```
- **Impact**: Prevents re-render when unrelated store state changes (e.g., git branches, editor settings).
- **Test**: Existing tests must pass. Verify file tree operations still work.

#### Task 5: CodeEditorPanel Fine-Grained Selectors
- **File**: `src/renderer/components/ide/editor/CodeEditorPanel.tsx`
- **Complexity**: 4/10
- **Current** (line 17-28): Destructures 10 properties from `useCodeEditorStore()`.
- **Refactored**: Individual `useCodeEditorStore((s) => s.propertyName)` for each.
- **Note**: For `openFiles` (Map) and `modifiedFiles` (Set), reference equality changes on every mutation. Use `useShallow` if needed, or select derived values instead.
- **Test**: Existing tests must pass.

#### Task 6: GitPanel Fine-Grained Selectors
- **File**: `src/renderer/components/ide/git/GitPanel.tsx`
- **Complexity**: 3/10
- **Current** (line ~20): Destructures `status`, `currentBranch`, `fetchStatus`, `fetchBranches` from `useGitStore()`.
- **Refactored**: Individual selectors.
- **Test**: Existing tests must pass.

### Task Group 1.3: File Tree Virtualization (Depends on Tasks 1, 4)

#### Task 7: Implement react-window in FileTreePanel
- **File**: `src/renderer/components/ide/file-tree/FileTreePanel.tsx`
- **Complexity**: 6/10
- **Current** (line 427-434): `flattenedNodes.map()` renders all nodes. `react-window` `List` is imported (line 2) but unused.
- **Change**: Replace `.map()` with `<List>` component:
  ```typescript
  const ROW_HEIGHT = 28;

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const { node, depth } = flattenedNodes[index];
    return <FileTreeNode key={node.path} node={node} depth={depth} style={style} />;
  }, [flattenedNodes]);

  // In render:
  <List
    height={availableHeight}
    itemCount={flattenedNodes.length}
    itemSize={ROW_HEIGHT}
    width="100%"
  >
    {Row}
  </List>
  ```
- **Considerations**:
  - Need to calculate `availableHeight` from container (use `useRef` + `ResizeObserver` or pass `height` prop)
  - FileTreePanel already receives `height` prop (line 33, defaults to 800)
  - Keyboard navigation must still work (arrow keys, enter to expand)
  - New file creation input row needs special handling (currently rendered above the map)
- **Risk**: Medium. Keyboard nav and scroll-to-selected may need adjustment.
- **Test**: Existing FileTree tests must pass. Manual verification of: expand/collapse, context menu, keyboard nav, scroll position preservation.

#### Task 8: Extract Constant Styles and Memoize Handlers
- **File**: `src/renderer/components/ide/file-tree/FileTreePanel.tsx`
- **Complexity**: 3/10
- **Change**: Extract `{ height: 28 }` to module-level constant. Memoize callback props passed to FileTreeNode.
- **Depends on**: Task 7 (virtualization changes the rendering approach, so style handling changes too).

### Task Group 1.4: IssueList Handler Memoization

#### Task 9: Memoize onViewDetails in IssueList
- **File**: `src/renderer/components/issues/IssueList.tsx`
- **Complexity**: 2/10
- **Current** (line 38): `onViewDetails={() => onIssueSelect(issue)}` creates new function per issue per render.
- **Change**: Use `useCallback` at IssueList level and pass `issue` as a data attribute, or refactor IssueCard to accept `issue` + `onSelect` and handle the call internally.
- **Preferred approach** (simpler):
  ```typescript
  // IssueCard already receives `issue` - change its onClick to call onViewDetails(issue) internally
  // Then IssueList passes a stable onIssueSelect reference
  ```
- **Test**: Existing tests must pass.

---

## Phase 2: Core (Batch B - Architecture)

**Stop Point**: After Phase 2 completion - run full test suite, verify app stability.

#### Task 10: Virtualize IssueList with react-window
- **File**: `src/renderer/components/issues/IssueList.tsx`
- **Complexity**: 5/10
- **Change**: Replace `issues.map()` with `<FixedSizeList>` from react-window. Each IssueCard currently renders as a Card with variable content (labels, dates). Use fixed row height estimate (~120px) or `VariableSizeList`.
- **Depends on**: Task 2 (React.memo on IssueCard), Task 9 (stable handler refs).
- **Test**: Existing IssueList tests must pass. Verify scrolling behavior and item selection.

#### Task 11: Lazy-Load Monaco Editor
- **File**: `src/renderer/components/ide/editor/CodeEditorPanel.tsx`
- **Complexity**: 4/10
- **Current** (line 6): `import { MonacoEditor } from './MonacoEditor';` - eager import.
- **Change**:
  ```typescript
  const MonacoEditor = React.lazy(() => import('./MonacoEditor').then(m => ({ default: m.MonacoEditor })));

  // In render, wrap with Suspense:
  <Suspense fallback={<EditorSkeleton />}>
    <MonacoEditor ... />
  </Suspense>
  ```
- **Also lazy-load**: DiffEditor, PdfViewer, ImageViewer, MarkdownViewer (all imported at top).
- **Depends on**: Task 5 (selectors refactored first to avoid compound changes).
- **Test**: Existing tests must pass. Verify editor loads correctly after navigation.

#### Task 12: Optimize Git Status Tree Walk
- **File**: `src/renderer/stores/useFileTreeStore.ts`
- **Complexity**: 6/10
- **Current** (lines 107-200): `updateGitStatus` does O(n*m) recursive traversal then spreads entire tree.
- **Optimization**:
  - Build a `Map<path, status>` from git status (already done)
  - Walk tree once, setting status via path lookup (O(n) instead of O(n*m))
  - Use `immer` or careful mutation to avoid full tree spread
  - Consider batching status updates (debounce if called rapidly)
- **Test**: Existing useFileTreeStore tests must pass. Add test for status update performance with 100+ files.

---

## Phase 3: Finalize (Batch C - Polish)

**Stop Point**: After Phase 3 - final BAS quality gate.

#### Task 13: Vite Code Splitting Configuration
- **File**: `vite.config.ts`
- **Complexity**: 4/10
- **Change**: Add `build.rollupOptions.output.manualChunks` to split Monaco, react-pdf, and vendor chunks:
  ```typescript
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['@monaco-editor/react', 'monaco-editor'],
          vendor: ['react', 'react-dom', 'zustand'],
          pdf: ['react-pdf', 'pdfjs-dist'],
        }
      }
    }
  }
  ```
- **Depends on**: Task 11 (lazy loading makes splitting effective).
- **Test**: Run `npm run build` and verify bundle produces separate chunks. Run `npm run make` to verify Electron packaging.

#### Task 14: Final Validation
- **Dependencies**: All prior tasks.
- **Actions**:
  1. Run full test suite (`npm test`)
  2. Verify 80%+ coverage maintained
  3. Launch app and verify all 5 screens load without errors
  4. Test file tree with large repo (500+ files)
  5. Test issue list with 50+ results
  6. Test editor open/close/switch
  7. Document any remaining performance observations

---

## Parallelization Plan

```
Phase 1 - Wave 1 (Parallel, no dependencies):
├── Task 1: React.memo FileTreeNode       (15min)
├── Task 2: React.memo IssueCard          (10min)
├── Task 3: React.memo ContributionCard   (15min)
├── Task 4: Selectors FileTreePanel       (30min)
├── Task 5: Selectors CodeEditorPanel     (30min)
├── Task 6: Selectors GitPanel            (20min)
└── Task 12: Optimize git status walk     (45min)
Bottleneck: 45min

Phase 1 - Wave 2 (Parallel, depend on Wave 1):
├── Task 7: Virtualize FileTreePanel      (60min) [needs 1, 4]
├── Task 9: Memoize IssueList handlers    (15min) [needs 2]
└── Task 11: Lazy-load Monaco             (30min) [needs 5]
Bottleneck: 60min

Phase 2 - Wave 3 (Parallel, depend on Wave 2):
├── Task 8: Extract styles/handlers       (20min) [needs 7]
├── Task 10: Virtualize IssueList         (45min) [needs 2, 9]
└── Task 13: Vite code splitting          (30min) [needs 11]
Bottleneck: 45min

Phase 3 - Wave 4 (Sequential):
└── Task 14: Final validation             (15min) [needs all]

Total (sequential): 5.5 hours
Total (parallel):   ~2.75 hours
Speedup: 50%
```

---

## BAS Quality Gates Per Task

| Task | Lint | Build | Test | Coverage |
|------|------|-------|------|----------|
| 1-3 (React.memo) | Yes | Yes | Yes | No (trivial) |
| 4-6 (Selectors) | Yes | Yes | Yes | No (refactor) |
| 7 (Virtualize tree) | Yes | Yes | Yes | Yes |
| 8 (Styles/handlers) | Yes | Yes | Yes | No (trivial) |
| 9 (Memoize handler) | Yes | Yes | Yes | No (trivial) |
| 10 (Virtualize issues) | Yes | Yes | Yes | Yes |
| 11 (Lazy Monaco) | Yes | Yes | Yes | No (loading) |
| 12 (Git status opt) | Yes | Yes | Yes | Yes |
| 13 (Vite splitting) | Yes | Yes | No (config) | No |
| 14 (Final) | Yes | Yes | Yes | Yes |

---

## Risk Mitigation

| Risk | Mitigation | Fallback |
|------|-----------|----------|
| Virtualization breaks keyboard nav | Test arrow keys, Home/End, Enter after Task 7 | Revert to .map() with limit of 200 visible nodes |
| React.memo blocks needed re-renders | Use custom comparator on affected component | Remove memo from that component |
| Zustand selectors break component | Full test suite runs after each selector change | Revert to destructuring for that component |
| Monaco lazy-load flickers | Add proper Suspense fallback with skeleton | Keep eager import, add code splitting only |
| Vite splitting breaks Electron | Test `npm run make` after config change | Revert vite.config.ts |

---

## Expected Outcomes

| Metric | Before | After (Expected) |
|--------|--------|-------------------|
| File tree render (500 files) | All DOM nodes | ~25 visible (react-window) |
| FileTreeNode re-renders per parent update | 100% of nodes | Only changed nodes (React.memo) |
| CodeEditorPanel re-renders | On any store change | Only on consumed state changes |
| Issue list render (100 issues) | All DOM nodes | ~8 visible (react-window) |
| Monaco bundle | Eager loaded | Lazy loaded on first editor open |
| Git status update | O(n*m) tree walk | O(n) path lookup |

---

## References

- Investigation Plan: `trinity/investigations/plans/PLAN-application-performance-optimization.md`
- Architecture: `trinity/knowledge-base/ARCHITECTURE.md`
- Technical Debt: `trinity/knowledge-base/Technical-Debt.md`
- Known Patterns: `trinity/knowledge-base/ISSUES.md`

---

**Work Order Status**: Ready for Implementation
**Assigned Agent**: KIL (Task Executor) with BAS (Quality Gate)
**Approval**: Required before starting Task 7 (virtualization) and Task 12 (store optimization)
**Created By**: TRA (Work Planner)
**Date**: 2026-01-29
