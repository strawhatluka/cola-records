# ORCHESTRATOR WORK ORDER #007
## Type: IMPLEMENTATION
## Test Coverage — IDE Complex Components + Store/Hook Gaps

---

## MISSION OBJECTIVE

Implement test coverage for the most complex IDE components (SearchPanel, FileTreeNode, FileTreePanel, CodeEditorPanel, TerminalPanel, IDELayout, ResizablePanelGroup) and fill store/hook test gaps (useFileTreeStore functions, useKeyboardShortcuts).

**Implementation Goal:** 9 new test files, all passing
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 5
**Depends On:** WO-006 (Simple IDE component tests)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/renderer/components/ide/search/SearchPanel.test.tsx
    changes: New test file — search + debounce + IPC
    risk: MEDIUM

  - path: tests/renderer/components/ide/ResizablePanelGroup.test.tsx
    changes: New test file — DOM resize
    risk: MEDIUM

  - path: tests/renderer/components/ide/file-tree/FileTreeNode.test.tsx
    changes: New test file — 3 stores, context menus
    risk: HIGH

  - path: tests/renderer/components/ide/file-tree/FileTreePanel.test.tsx
    changes: New test file — react-window, stores, IPC
    risk: HIGH

  - path: tests/renderer/components/ide/editor/CodeEditorPanel.test.tsx
    changes: New test file — Monaco mock, stores, IPC
    risk: HIGH

  - path: tests/renderer/components/ide/terminal/TerminalPanel.test.tsx
    changes: New test file — XTerm mock, stores
    risk: HIGH

  - path: tests/renderer/components/ide/IDELayout.test.tsx
    changes: New test file — composition of all IDE panels
    risk: MEDIUM

  - path: tests/renderer/stores/useFileTreeStore.gaps.test.ts
    changes: New test file — warmGitIgnoreCache, addNode, removeNode
    risk: LOW

  - path: tests/renderer/hooks/useKeyboardShortcuts.full.test.ts
    changes: New/extended test file — full coverage
    risk: LOW
```

### Source Files Under Test
- `src/renderer/components/ide/search/SearchPanel.tsx` (316 lines)
- `src/renderer/components/ide/ResizablePanelGroup.tsx` (~100 lines)
- `src/renderer/components/ide/file-tree/FileTreeNode.tsx` (~200 lines)
- `src/renderer/components/ide/file-tree/FileTreePanel.tsx` (533 lines)
- `src/renderer/components/ide/editor/CodeEditorPanel.tsx` (315 lines)
- `src/renderer/components/ide/terminal/TerminalPanel.tsx` (250 lines)
- `src/renderer/components/ide/IDELayout.tsx` (119 lines)
- `src/renderer/stores/useFileTreeStore.ts` (specific functions)
- `src/renderer/hooks/useKeyboardShortcuts.ts` (45 lines)

---

## IMPLEMENTATION APPROACH

### Step 1: Store/Hook Gaps + Simple (Parallel)
- [ ] Task 5.1: SearchPanel.test.tsx — Search input, debounce, results display, IPC
- [ ] Task 5.2: ResizablePanelGroup.test.tsx — Resize handle, panel visibility
- [ ] Task 5.8: useFileTreeStore.gaps.test.ts — warmGitIgnoreCache, addNode, removeNode
- [ ] Task 5.9: useKeyboardShortcuts.full.test.ts — All shortcut bindings, handler calls

### Step 2: Complex Components (Parallel)
- [ ] Task 5.3: FileTreeNode.test.tsx — File/dir render, expand/collapse, context menu, 3 store interactions
- [ ] Task 5.5: CodeEditorPanel.test.tsx — Editor render, file switching, Monaco mock
- [ ] Task 5.6: TerminalPanel.test.tsx — Session create/close, XTerm mock, tab switching

### Step 3: Highest Complexity + Composition
- [ ] Task 5.4: FileTreePanel.test.tsx — Virtualized tree, file operations, search, clipboard
- [ ] Task 5.7: IDELayout.test.tsx — Panel composition, sidebar switching, resize

### Step 4: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions

---

## KEY TEST SCENARIOS

### SearchPanel (316 lines)
- Search input triggers debounced IPC call
- Results grouped by file
- File expand/collapse toggle
- Result click opens file
- Match case / whole word / regex toggles
- Include/exclude pattern inputs
- Clear button resets state
- Loading state during search
- Error handling for failed search

### FileTreeNode (3 stores — ~200 lines)
- File node renders name and icon
- Directory node renders expand/collapse chevron
- Click on file calls selectNode + openFile
- Click on directory calls toggleNode
- Context menu: copy, cut, paste, delete, rename
- Git status indicator display
- Gitignore dimming

### CodeEditorPanel (315 lines)
- Renders Monaco editor for code files
- Switches viewer type based on file extension (image, markdown, PDF)
- Active file content passed to editor
- File save triggers IPC
- Unsupported file type shows fallback viewer

### TerminalPanel (250 lines)
- Creates new terminal session
- Shows terminal tabs
- Switches between sessions
- Closes terminal session
- Session persistence

### FileTreePanel (533 lines — HIGHEST COMPLEXITY)
- Renders virtualized file tree
- Tree item click expands/collapses
- File selection opens in editor
- New file/folder creation
- Drag and drop (if supported)
- Search/filter functionality
- Git status badges on tree items

---

## COMPLEX MOCK STRATEGIES

### Monaco Editor Mock
```typescript
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      data-language={language}
    />
  ),
}));
```

### XTerm Mock
```typescript
vi.mock('xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
  })),
}));
```

### react-window Mock
```typescript
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemData }: any) => (
    <div data-testid="virtual-list">
      {Array.from({ length: Math.min(itemCount, 10) }, (_, i) =>
        children({ index: i, style: {}, data: itemData })
      )}
    </div>
  ),
}));
```

---

## DELIVERABLE REQUIREMENTS

**Filename:** `IDE-COMPLEX-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 9 new test files created and passing
- [ ] Complex mocks (Monaco, XTerm, react-window) working correctly
- [ ] 3-store interaction tested for FileTreeNode
- [ ] Store function gaps covered (warmGitIgnoreCache, addNode, removeNode)
- [ ] No regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ GIT OPERATIONS FORBIDDEN — Only LUKA has permission.

### DO:
- [ ] Read source files thoroughly before writing tests — these are complex
- [ ] Mock external libraries (Monaco, XTerm, react-window) at module level
- [ ] Test behavior, not implementation details
- [ ] Use act() for state updates, waitFor for async operations
- [ ] Test context menu interactions where applicable

### DO NOT:
- [ ] Modify source files
- [ ] Test Monaco/XTerm internals
- [ ] Create integration tests (unit tests only)
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** HIGH
**Risk Factors:**
- Monaco Editor mocking complexity
- XTerm terminal mocking
- react-window v2 API differences
- FileTreeNode uses 3 different stores (18 selectors)
- FileTreePanel is 533 lines with multiple subsystems

**Mitigation:**
- Mock at module level, test behavior not library internals
- Use selector-compatible mock pattern for all 3 stores
- Break FileTreePanel tests into logical describe blocks
- Test each context menu action independently
