# Test Failure Remediation Checklist

**Date:** 2026-01-26
**Current Status:** 488 passing / 24 failing (92% pass rate)
**Test Files:** 6 failed | 31 passed | 1 skipped

---

## Test File 1: tests/integration/file-operations.test.tsx (5 failures)

**Run Command:**
```bash
npm test -- tests/integration/file-operations.test.tsx
```

### Failures:
- [x] should create new file and open in editor - FIXED: Added "New File" context menu + file opening on click
- [x] should rename file and update editor tab - FIXED: Files now open in editor when clicked
- [x] should delete file and close editor tab - FIXED: Files now open in editor when clicked
- [ ] should handle save as operation - Still needs "Save As" dialog
- [x] should handle concurrent file edits in multiple tabs - FIXED: Files now open in editor when clicked

---

## Test File 2: tests/integration/ide-workflow.test.tsx (4 failures)

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

## Test File 3: tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx (2 failures)

**Run Command:**
```bash
npm test -- tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
```

### Failures:
- [ ] should expand and collapse directories
- [ ] should handle loading state

---

## Test File 4: tests/components/ide/IDELayout.comprehensive.test.tsx (1 failure)

**Run Command:**
```bash
npm test -- tests/components/ide/IDELayout.comprehensive.test.tsx
```

### Failures:
- [ ] should render all IDE panels

---

## Test File 5: tests/components/ide/editor/EditorTab.test.tsx (7 failures)

**Run Command:**
```bash
npm test -- tests/components/ide/editor/EditorTab.test.tsx
```

### Failures:
- [ ] Active state: should apply active styling when active
- [ ] Active state: should set aria-selected to true when active
- [ ] Active state: should set aria-selected to false when inactive
- [ ] Click interactions: should call onClick when tab is clicked
- [ ] Accessibility: should have role="tab"
- [ ] Accessibility: should be keyboard navigable (tabIndex=0)
- [ ] Truncation: should truncate long file names

---

## Test File 6: tests/components/ide/terminal/TerminalPanel.test.tsx (5 failures)

**Run Command:**
```bash
npm test -- tests/components/ide/terminal/TerminalPanel.test.tsx
```

### Failures:
- [ ] Multi-session management: should close terminal tab
- [ ] Accessibility: should have role="tab" for terminal tabs
- [ ] Accessibility: should set aria-selected on active tab
- [ ] Styling and UI: should highlight active tab
- [ ] Styling and UI: should show working directory in tab title

---

## Summary by Category

### Integration Tests (9 failures)
- File operations: 5 failures
- IDE workflow: 4 failures

### Component Tests (15 failures)
- EditorTab: 7 failures (likely caused by earlier refactor to fix accessibility)
- TerminalPanel: 5 failures (mix of state and accessibility issues)
- FileTreePanel: 2 failures (virtualization related)
- IDELayout: 1 failure

### Priority Order

1. **🔴 HIGH:** EditorTab.test.tsx (7 failures) - Recent accessibility refactor may have broken tests
2. **🟠 MEDIUM:** TerminalPanel.test.tsx (5 failures) - Tab role/accessibility issues
3. **🟠 MEDIUM:** file-operations.test.tsx (5 failures) - Integration issues
4. **🟡 LOW:** ide-workflow.test.tsx (4 failures) - Complex integration tests
5. **🟡 LOW:** FileTreePanel.comprehensive.test.tsx (2 failures) - Virtualization issues
6. **🟡 LOW:** IDELayout.comprehensive.test.tsx (1 failure) - Single render issue

---

## Run All Failing Tests

```bash
npm test -- tests/integration/file-operations.test.tsx tests/integration/ide-workflow.test.tsx tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx tests/components/ide/IDELayout.comprehensive.test.tsx tests/components/ide/editor/EditorTab.test.tsx tests/components/ide/terminal/TerminalPanel.test.tsx
```

---

## Notes

- EditorTab failures likely stem from recent accessibility fix that changed tabs from ARIA tabs to button-based tabs with aria-pressed
- TerminalPanel failures appear to be similar - expecting role="tab" but may have been changed
- Integration tests may need updated queries or better virtualization handling
- FileTreePanel virtualization should be working with global mock - needs investigation
