# WORKORDER-002: IDE Performance Optimization Phase 2

**Created:** 2026-01-29
**Scale:** Large
**Status:** Ready for Execution
**Priority:** High
**Estimated Time:** ~5 hours sequential / ~1.5 hours parallel + verification

---

## Objective

Eliminate development screen lag by fixing re-render cascades across 8 IDE components. JUNO audit found 10/14 major components lack React.memo, 12/14 have inline functions causing child re-renders, and the critical FileTreeNode has React.memo defeated by destructured store access.

## Background

WORKORDER-001 introduced React.memo, virtualization, and lazy loading. This phase targets the remaining performance bottlenecks discovered by JUNO audit: primarily store access patterns that defeat memoization and missing React.memo wrappers.

---

## Tasks

### Task 1: FileTreeNode.tsx - Fix Store Selectors
**Complexity:** 4/10 | **File:** `src/renderer/components/ide/file-tree/FileTreeNode.tsx`

Convert 3 destructured store accesses (lines 37-39) to individual selectors:
- `useFileTreeStore()` destructures 7 values -> 7 individual selectors
- `useCodeEditorStore()` destructures 5 values -> 5 individual selectors
- `useIDEStore()` destructures 6 values -> 6 individual selectors

Already has React.memo - no wrapper needed.

### Task 2: EditorTab.tsx - Full Optimization
**Complexity:** 5/10 | **File:** `src/renderer/components/ide/editor/EditorTab.tsx`

- Add React.memo wrapper
- Convert `{ gitStatus, rootPath }` destructure (line 16) to 2 individual selectors
- Wrap git status calculation (lines 19-41) in useMemo
- Wrap getGitStatusColor and getGitStatusBadge in useMemo

### Task 3: EditorTabBar.tsx - Full Optimization
**Complexity:** 3/10 | **File:** `src/renderer/components/ide/editor/EditorTabBar.tsx`

- Add React.memo wrapper
- Convert `{ openFiles, activeFilePath, switchToTab, closeFile }` (line 5) to 4 individual selectors
- Wrap `Array.from(openFiles.values())` (line 17) in useMemo

### Task 4: IDEAppBar.tsx - Full Optimization
**Complexity:** 4/10 | **File:** `src/renderer/components/ide/IDEAppBar.tsx`

- Add React.memo wrapper
- Convert `{ saveAllFiles, modifiedFiles }` (line 16) to 2 individual selectors
- useMemo for repoName (line 19) and hasUnsavedChanges (line 21)
- useCallback for handleGoBack and handleSaveAll

### Task 5: IDEStatusBar.tsx - Full Optimization
**Complexity:** 4/10 | **File:** `src/renderer/components/ide/IDEStatusBar.tsx`

- Add React.memo wrapper
- Convert destructured store accesses (lines 44-45) to individual selectors
- useMemo for modifiedCount and language calculations
- Note: getLanguageName is already defined outside component

### Task 6: TerminalPanel.tsx - Add Memoization
**Complexity:** 3/10 | **File:** `src/renderer/components/ide/terminal/TerminalPanel.tsx`

- Add React.memo wrapper
- Already has individual selectors (lines 18-24)
- useMemo for sessionArray conversion (line 42)
- useCallback for handleNewTerminal and handleCloseTerminal

### Task 7: SearchPanel.tsx - Add Memoization
**Complexity:** 4/10 | **File:** `src/renderer/components/ide/search/SearchPanel.tsx`

- Add React.memo wrapper
- useCallback for handleSearch, handleResultClick, toggleFileExpanded
- useMemo for totalResults and totalFiles with [results] dep

### Task 8: FileTreePanel.tsx - Add React.memo
**Complexity:** 2/10 | **File:** `src/renderer/components/ide/file-tree/FileTreePanel.tsx`

- Add React.memo wrapper only
- Already well-optimized with individual selectors, useMemo, useCallback

### Task 9: Integration Verification
**Complexity:** 2/10 | **Dependencies:** Tasks 1-8

- Run full test suite (`npm test`)
- Verify TypeScript compilation (`npx tsc --noEmit`)
- Confirm no regressions in IDE functionality

---

## Execution Order

```
Phase 1 (Parallel - all independent):
  Task 1: FileTreeNode selectors
  Task 2: EditorTab optimization
  Task 3: EditorTabBar optimization
  Task 4: IDEAppBar optimization
  Task 5: IDEStatusBar optimization
  Task 6: TerminalPanel memoization
  Task 7: SearchPanel memoization
  Task 8: FileTreePanel memo wrapper

Phase 2 (Sequential - depends on Phase 1):
  Task 9: Integration verification
```

## Risk Assessment

**Medium Risk:**
- Task 1: 13 selectors to convert in 814-line file - verify no missed references
- Task 2: Git status useMemo dependency arrays must be correct
- Task 7: Debounced search effect depends on handleSearch closure

**Mitigations:**
- Each task isolated to single file with no cross-dependencies
- TypeScript compiler catches broken selector references
- Existing tests validate behavioral correctness

## Success Criteria

- All 8 components use individual Zustand selectors (no destructured store objects)
- All 8 components wrapped in React.memo (or confirmed wrapped)
- All expensive computations wrapped in useMemo/useCallback
- All tests pass
- TypeScript compilation succeeds
- No visual regressions in IDE screen

## Files Modified

| # | File | Changes |
|---|------|---------|
| 1 | `src/renderer/components/ide/file-tree/FileTreeNode.tsx` | Store selectors |
| 2 | `src/renderer/components/ide/editor/EditorTab.tsx` | memo + selectors + useMemo |
| 3 | `src/renderer/components/ide/editor/EditorTabBar.tsx` | memo + selectors + useMemo |
| 4 | `src/renderer/components/ide/IDEAppBar.tsx` | memo + selectors + useMemo + useCallback |
| 5 | `src/renderer/components/ide/IDEStatusBar.tsx` | memo + selectors + useMemo |
| 6 | `src/renderer/components/ide/terminal/TerminalPanel.tsx` | memo + useMemo + useCallback |
| 7 | `src/renderer/components/ide/search/SearchPanel.tsx` | memo + useCallback + useMemo |
| 8 | `src/renderer/components/ide/file-tree/FileTreePanel.tsx` | memo wrapper |
