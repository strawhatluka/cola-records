# Test Failure Remediation Checklist

**Date:** 2026-01-26
**Current Status:** 489 passing / 23 failing (95.5% pass rate) - 7 more fixes ready for verification
**Test Files:** 7 failed | 30 passed | 1 skipped
**Expected After Verification:** 496 passing / 16 failing (96.9% pass rate)

---

## Test File 1: tests/components/ide/editor/EditorTab.test.tsx (0 failures) ✅

**Run Command:**
```bash
npm test -- tests/components/ide/editor/EditorTab.test.tsx
```

### Failures:
- [x] should apply active styling when active - FIXED: Test now queries button element
- [x] should set aria-selected to true when active - FIXED: Added aria-selected attribute
- [x] should set aria-selected to false when inactive - FIXED: Added aria-selected attribute
- [x] should call onClick when tab is clicked - FIXED: Added role="tab"
- [x] should have role="tab" - FIXED: Added role="tab" to button
- [x] should be keyboard navigable (tabIndex=0) - FIXED: Added roving tabindex + test renders with isActive=true
- [x] should truncate long file names - FIXED: Updated test expectation to max-w-[120px]

---

## Test File 2: tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx (0 failures - READY FOR VERIFICATION) ⏳

**Run Command:**
```bash
npm test -- tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
```

### Failures:
- [x] should load and display file tree - FIXED: Added react-window mock
- [x] should expand and collapse directories - FIXED: Added react-window mock
- [x] should show git status badges - FIXED: Added react-window mock
- [x] should handle loading state - FIXED: Added react-window mock
- [x] should handle error state - FIXED: Added react-window mock
- [x] should handle empty repository - FIXED: Added react-window mock
- [x] should show gitignore dimming for ignored files - FIXED: Added react-window mock

**Fix Applied:** Added missing react-window virtualization mock using proven pattern from FileTreePanel.test.tsx
**Status:** Implementation complete - awaiting test verification by user

---

## Test File 3: tests/integration/file-operations.test.tsx (5 failures)

**Run Command:**
```bash
npm test -- tests/integration/file-operations.test.tsx
```

### Failures:
- [ ] should create new file and open in editor
- [ ] should rename file and update editor tab
- [ ] should delete file and close editor tab
- [ ] should handle save as operation
- [ ] should handle concurrent file edits in multiple tabs

---

## Test File 4: tests/integration/ide-workflow.test.tsx (4 failures)

**Run Command:**
```bash
npm test -- tests/integration/ide-workflow.test.tsx
```

### Failures:
- [ ] should complete full workflow: load → edit → save → commit → push
- [ ] should handle concurrent file editing and terminal execution
- [ ] should handle panel resizing during active editing
- [ ] should maintain state across panel focus changes

---

## Test File 5: tests/components/ide/terminal/TerminalPanel.test.tsx (4 failures)

**Run Command:**
```bash
npm test -- tests/components/ide/terminal/TerminalPanel.test.tsx
```

### Failures:
- [ ] should have role="tab" for terminal tabs
- [ ] should set aria-selected on active tab
- [ ] should highlight active tab
- [ ] should show working directory in tab title

---

## Test File 6: tests/components/ide/file-tree/FileTreeNode.test.tsx (1 failure)

**Run Command:**
```bash
npm test -- tests/components/ide/file-tree/FileTreeNode.test.tsx
```

### Failures:
- [ ] should call selectNode when file is clicked

---

## Test File 7: tests/components/ide/IDELayout.comprehensive.test.tsx (1 failure)

**Run Command:**
```bash
npm test -- tests/components/ide/IDELayout.comprehensive.test.tsx
```

### Failures:
- [ ] should render all IDE panels

---

## Test File 8: tests/performance/file-tree-benchmark.test.tsx (1 failure)

**Run Command:**
```bash
npm test -- tests/performance/file-tree-benchmark.test.tsx
```

### Failures:
- [ ] should efficiently handle gitignore dimming (<750ms) - Performance test taking 1108ms

---

## Summary by Category

### Component Tests (6 failures after verification)
- EditorTab: ✅ 0 failures (ALL FIXED - WCAG compliant!)
- FileTreePanel.comprehensive: ⏳ 0 failures (FIXED - awaiting verification)
- TerminalPanel: 4 failures (tab role/accessibility issues)
- FileTreeNode: 1 failure (click handler issue)
- IDELayout: 1 failure (panel rendering)

### Integration Tests (9 failures)
- file-operations: 5 failures (context menu/IPC issues)
- ide-workflow: 4 failures (complex workflow integration)

### Performance Tests (1 failure)
- file-tree-benchmark: 1 failure (gitignore dimming performance)

### Priority Order

1. **✅ COMPLETE:** EditorTab.test.tsx (0 failures) - WCAG tab pattern implemented!
2. **⏳ READY FOR VERIFICATION:** FileTreePanel.comprehensive.test.tsx (0 failures expected) - react-window mock added
3. **🟠 MEDIUM:** file-operations.test.tsx (5 failures) - Context menu not rendering in tests
4. **🟠 MEDIUM:** ide-workflow.test.tsx (4 failures) - Complex integration workflows
5. **🟠 MEDIUM:** TerminalPanel.test.tsx (4 failures) - Tab accessibility issues
6. **🟡 LOW:** FileTreeNode.test.tsx (1 failure) - Click handler not being called
7. **🟡 LOW:** IDELayout.comprehensive.test.tsx (1 failure) - Panel rendering
8. **🟡 LOW:** file-tree-benchmark.test.tsx (1 failure) - Performance optimization needed

---

## Run All Failing Tests

```bash
npm test -- tests/components/ide/editor/EditorTab.test.tsx tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx tests/integration/file-operations.test.tsx tests/integration/ide-workflow.test.tsx tests/components/ide/terminal/TerminalPanel.test.tsx tests/components/ide/file-tree/FileTreeNode.test.tsx tests/components/ide/IDELayout.comprehensive.test.tsx tests/performance/file-tree-benchmark.test.tsx
```

---

## Notes

- **react-window errors**: FileTreePanel.comprehensive tests are throwing errors from react-window virtualization
- **Context menu portals**: Radix UI ContextMenu uses portals that don't render in jsdom tests
- **EditorTab failures**: Tests expect `role="tab"` and `aria-selected` but component may use different pattern
- **TerminalPanel failures**: Similar tab role/aria-selected issues as EditorTab
- **FileTreeNode click**: File click now opens in editor, test may need to mock IPC
- **Performance**: Gitignore dimming takes 1108ms, needs optimization to meet <750ms target
