# ORCHESTRATOR WORK ORDER #002
## Type: IMPLEMENTATION
## File Operations Integration Tests - Complete Fix (Tests + Missing Features)

---

## MISSION OBJECTIVE

Fix 5 failing integration tests in `tests/integration/file-operations.test.tsx` by:
1. **Adding missing test infrastructure** (mocks) where tests are incorrectly configured
2. **Implementing missing source code functionality** where tests expect features that don't exist
3. **Fixing IPC channel name mismatches** in test expectations

**Implementation Goal:** All 5 integration tests passing. Tests 1-3 and 5 pass completely. Test 4 requires implementing Save As functionality.

**Based On:** JUNO Audit Report - JUNO-AUDIT-FileOperations-Integration-20260126-192445.md

**JUNO Findings:**
- **Tests need fixing:** Missing react-window, ContextMenu, Dialog mocks; incorrect IPC channel names
- **Source code needs implementation:**
  - Save As functionality (Test 4)
  - Editor tab update when file renamed (Test 2)
  - Editor tab close when file deleted (Test 3)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/integration/file-operations.test.tsx
    changes: Add mocks, fix IPC channels, add store resets
    risk: LOW

  - path: src/renderer/stores/useCodeEditorStore.ts
    changes: Add renameFile() and closeFile() methods for editor integration
    risk: MEDIUM

  - path: src/renderer/components/ide/file-tree/FileTreeNode.tsx
    changes: Call editor store methods after rename/delete operations
    risk: LOW

  - path: src/renderer/components/ide/editor/CodeEditorPanel.tsx
    changes: Implement Save As dialog and keyboard shortcut
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/ide/editor/SaveAsDialog.tsx - NEW FILE (Save As dialog component)
```

---

## PART 1: FIX TEST INFRASTRUCTURE

### Change Set 1: Add react-window Mock
**File:** tests/integration/file-operations.test.tsx
**Lines:** After line 29
**Implementation:**
```typescript
// Mock react-window for virtualization
vi.mock('react-window', () => {
  const React = require('react');

  const MockList = ({ children, itemCount, innerElementType: InnerElement }: any) => {
    const Inner = InnerElement || 'div';
    const items = Array.from({ length: Math.min(itemCount, 100) }).map((_, index) =>
      children({ index, style: {} })
    );
    return (
      <Inner data-testid="virtualized-list" data-row-count={itemCount}>
        {items}
      </Inner>
    );
  };

  MockList.displayName = 'MockList';

  return { List: MockList };
});
```

### Change Set 2: Add ContextMenu and Dialog Mocks
**File:** tests/integration/file-operations.test.tsx
**Lines:** After line 29 (before react-window mock)
**Implementation:**
```typescript
// Mock ContextMenu components
vi.mock('@renderer/components/ui/ContextMenu', () => ({
  ContextMenu: ({ children }: any) => <>{children}</>,
  ContextMenuTrigger: ({ children }: any) => <>{children}</>,
  ContextMenuContent: ({ children }: any) => <div role="menu">{children}</div>,
  ContextMenuItem: ({ children, onClick }: any) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  ContextMenuSeparator: () => null,
}));

// Mock Dialog components
vi.mock('@renderer/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
```

### Change Set 3: Add FileTreeStore Import and Reset
**File:** tests/integration/file-operations.test.tsx
**Line 6:** Add import
**Lines 35-44:** Replace beforeEach
**Implementation:**
```typescript
// Line 6:
import { useFileTreeStore } from '@renderer/stores/useFileTreeStore';

// Replace entire beforeEach (lines 35-44):
beforeEach(() => {
  vi.clearAllMocks();

  // Setup default IPC mock implementation
  mockInvokeIPC.mockImplementation((channel: string) => {
    if (channel === 'git:status') {
      return Promise.resolve({ files: [] });
    }
    if (channel === 'fs:watch-directory' || channel === 'fs:unwatch-directory') {
      return Promise.resolve();
    }
    if (channel === 'gitignore:is-ignored') {
      return Promise.resolve(false);
    }
    return Promise.reject(new Error(`Unexpected IPC channel: ${channel}`));
  });

  // Reset CodeEditorStore
  useCodeEditorStore.setState({
    openFiles: new Map(),
    activeFilePath: null,
    modifiedFiles: new Set(),
    loading: false,
  });

  // Reset FileTreeStore
  useFileTreeStore.setState({
    rootPath: null,
    root: null,
    fileTree: [],
    expandedPaths: new Set(),
    selectedPath: null,
    gitStatus: null,
    gitIgnoreCache: new Map(),
    loading: false,
    error: null,
    expandedDirs: new Set(),
    selectedFile: null,
  });
});
```

### Change Set 4: Update All Tests to Use mockImplementation
**File:** tests/integration/file-operations.test.tsx
**Tests:** 1, 2, 3, 4, 5 (NOT the skipped test 6)
**Pattern:** Replace all `mockInvokeIPC.mockResolvedValueOnce([...])` with comprehensive mockImplementation

**Example for Test 1 (line 49):**
```typescript
mockInvokeIPC.mockImplementation((channel: string) => {
  if (channel === 'fs:read-directory') {
    return Promise.resolve([
      { name: 'src', path: '/test/repo/src', type: 'directory', children: [] }
    ]);
  }
  if (channel === 'git:status') return Promise.resolve({ files: [] });
  if (channel === 'fs:watch-directory' || channel === 'fs:unwatch-directory') return Promise.resolve();
  if (channel === 'gitignore:is-ignored') return Promise.resolve(false);
  return Promise.reject(new Error(`Unexpected IPC channel: ${channel}`));
});
```

**Apply same pattern to Tests 2, 3, 4, 5 with their specific fs:read-directory responses**

### Change Set 5: Fix IPC Channel Names
**File:** tests/integration/file-operations.test.tsx

**Test 2 - Line 269:** Change `'fs:rename'` → `'fs:rename-file'`
**Test 3 - Line 356:** Change `'fs:delete'` → `'fs:delete-file'`

---

## PART 2: IMPLEMENT MISSING SOURCE CODE FUNCTIONALITY

### Change Set 6: Add Editor Integration Methods to CodeEditorStore
**File:** src/renderer/stores/useCodeEditorStore.ts
**Location:** Add new methods in the store actions

**Add these methods after `closeAllFiles()` (around line 300):**
```typescript
  /**
   * Rename a file in the editor (update file path in openFiles map)
   */
  renameFile: (oldPath: string, newPath: string) => {
    set((state) => {
      const openFiles = new Map(state.openFiles);
      const fileData = openFiles.get(oldPath);

      if (fileData) {
        // Remove old path
        openFiles.delete(oldPath);
        // Add new path with same content
        openFiles.set(newPath, fileData);

        // Update active file path if it was the renamed file
        const newActiveFilePath = state.activeFilePath === oldPath ? newPath : state.activeFilePath;

        // Update modified files set
        const modifiedFiles = new Set(state.modifiedFiles);
        if (modifiedFiles.has(oldPath)) {
          modifiedFiles.delete(oldPath);
          modifiedFiles.add(newPath);
        }

        return { openFiles, activeFilePath: newActiveFilePath, modifiedFiles };
      }

      return state;
    });
  },

  /**
   * Close a specific file from the editor
   */
  closeFile: (filePath: string) => {
    set((state) => {
      const openFiles = new Map(state.openFiles);
      openFiles.delete(filePath);

      // Remove from modified files
      const modifiedFiles = new Set(state.modifiedFiles);
      modifiedFiles.delete(filePath);

      // If the active file was closed, set active to another file or null
      let newActiveFilePath = state.activeFilePath;
      if (state.activeFilePath === filePath) {
        const remainingFiles = Array.from(openFiles.keys());
        newActiveFilePath = remainingFiles.length > 0 ? remainingFiles[remainingFiles.length - 1] : null;
      }

      return { openFiles, activeFilePath: newActiveFilePath, modifiedFiles };
    });
  },
```

**Update TypeScript interface (around line 50):**
```typescript
interface CodeEditorStore {
  // ... existing properties ...

  // Add these method signatures:
  renameFile: (oldPath: string, newPath: string) => void;
  closeFile: (filePath: string) => void;
}
```

### Change Set 7: Integrate Editor Methods in FileTreeNode Rename
**File:** src/renderer/components/ide/file-tree/FileTreeNode.tsx
**Location:** In `confirmRename()` function (around line 164)

**After successful rename (after line 189):**
```typescript
  const confirmRename = async () => {
    // ... existing validation code ...

    setIsRenaming(true);
    try {
      // Extract directory path
      const pathParts = node.path.split(/[/\\]/);
      pathParts.pop(); // Remove old filename
      const dirPath = pathParts.join('/');
      const newPath = `${dirPath}/${newName}`;

      await ipc.invoke('fs:rename-file', node.path, newPath);

      // Reload the tree to reflect changes
      const repoPath = node.path.split(/[/\\]/)[0]; // Get root path
      await loadTree(repoPath);

      toast.success(`Renamed to ${newName}`);
      setRenameDialogOpen(false);

      // **ADD THIS:** Update editor tabs if file was open
      const { renameFile } = useCodeEditorStore.getState();
      renameFile(node.path, newPath);

    } catch (error) {
      toast.error(`Failed to rename: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRenaming(false);
    }
  };
```

### Change Set 8: Integrate Editor Methods in FileTreeNode Delete
**File:** src/renderer/components/ide/file-tree/FileTreeNode.tsx
**Location:** In `confirmDelete()` function (around line 198)

**After successful delete (after line 206):**
```typescript
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await ipc.invoke('fs:delete-file', node.path);

      // Remove from tree
      removeNode(node.path);

      toast.success(`Deleted ${node.name}`);
      setDeleteDialogOpen(false);

      // **ADD THIS:** Close file in editor if it was open
      const { closeFile } = useCodeEditorStore.getState();
      closeFile(node.path);

    } catch (error) {
      toast.error(`Failed to delete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };
```

### Change Set 9: Implement Save As Feature
**File:** src/renderer/components/ide/editor/SaveAsDialog.tsx (NEW FILE)
**Implementation:**
```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilePath: string;
  onSaveAs: (newPath: string) => Promise<void>;
}

export function SaveAsDialog({ open, onOpenChange, currentFilePath, onSaveAs }: SaveAsDialogProps) {
  const [newPath, setNewPath] = useState(currentFilePath);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newPath.trim()) return;

    setIsSaving(true);
    try {
      await onSaveAs(newPath);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save As</DialogTitle>
          <DialogDescription>
            Enter a new file path to save a copy
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="File path..."
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Change Set 10: Add Save As to CodeEditorPanel
**File:** src/renderer/components/ide/editor/CodeEditorPanel.tsx
**Location:** Import and integrate SaveAsDialog

**Add imports (top of file):**
```typescript
import { SaveAsDialog } from './SaveAsDialog';
import { ipc } from '../../../ipc/client';
```

**Add state (after existing state declarations around line 15):**
```typescript
const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
```

**Add Save As handler (after existing handlers around line 40):**
```typescript
const handleSaveAs = async (newPath: string) => {
  if (!activeFilePath) return;

  const fileData = openFiles.get(activeFilePath);
  if (!fileData) return;

  try {
    await ipc.invoke('fs:write-file', newPath, fileData.content);

    // Open the new file in editor
    openFile(newPath, fileData.content);

    toast.success(`Saved as ${newPath}`);
  } catch (error) {
    toast.error(`Failed to save: ${error}`);
    throw error;
  }
};
```

**Add keyboard shortcut (in useEffect around line 60):**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Existing Ctrl+S handler...

    // Add Ctrl+Shift+S for Save As
    if (e.ctrlKey && e.shiftKey && e.key === 's') {
      e.preventDefault();
      setSaveAsDialogOpen(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* dependencies */]);
```

**Add dialog to JSX (before closing tag):**
```typescript
<SaveAsDialog
  open={saveAsDialogOpen}
  onOpenChange={setSaveAsDialogOpen}
  currentFilePath={activeFilePath || ''}
  onSaveAs={handleSaveAs}
/>
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Fix Test Infrastructure (20 minutes)
- [ ] Add react-window mock
- [ ] Add ContextMenu mock
- [ ] Add Dialog mock
- [ ] Add FileTreeStore import and reset
- [ ] Update all 5 tests to use mockImplementation
- [ ] Fix IPC channel names in tests 2 and 3
- [ ] Run tests - Tests 1 and 5 should pass, Tests 2-4 will still fail (expected)

### Phase 2: Implement Editor Integration (20 minutes)
- [ ] Add `renameFile()` method to CodeEditorStore
- [ ] Add `closeFile()` method to CodeEditorStore
- [ ] Update TypeScript interface
- [ ] Call `renameFile()` in FileTreeNode confirmRename
- [ ] Call `closeFile()` in FileTreeNode confirmDelete
- [ ] Run tests - Tests 1, 2, 3, 5 should pass, Test 4 will still fail (expected)

### Phase 3: Implement Save As Feature (30 minutes)
- [ ] Create SaveAsDialog component
- [ ] Add SaveAsDialog to CodeEditorPanel
- [ ] Implement handleSaveAs handler
- [ ] Add Ctrl+Shift+S keyboard shortcut
- [ ] Run tests - All 5 tests should pass

### Phase 4: Validation (10 minutes)
- [ ] Run full test suite
- [ ] Verify all 5 integration tests pass
- [ ] Verify no regressions in other tests
- [ ] Create completion report

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `FILE-OPERATIONS-COMPLETE-IMPLEMENTATION-20260126.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Tests fixed vs functionality implemented
   - All 5 tests now passing
   - New features added (Save As, editor integration)

2. **Part 1: Test Fixes**
   - All mocks added with line numbers
   - IPC channel fixes
   - Before/after test results

3. **Part 2: Source Code Implementation**
   - Editor integration methods added
   - Save As feature implemented
   - Code snippets with file:line references

4. **Test Results**
   - Test output showing 5/5 passing
   - Comparison to baseline (5/5 failing)

5. **New Features Documented**
   - renameFile() method usage
   - closeFile() method usage
   - Save As dialog (Ctrl+Shift+S)

6. **Next Steps**
   - None - all functionality complete

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All test mocks added (react-window, ContextMenu, Dialog)
- [ ] FileTreeStore reset in beforeEach
- [ ] All 5 tests use mockImplementation pattern
- [ ] IPC channel names fixed
- [ ] renameFile() method implemented in CodeEditorStore
- [ ] closeFile() method implemented in CodeEditorStore
- [ ] Editor integration added to FileTreeNode
- [ ] SaveAsDialog component created
- [ ] Save As integrated into CodeEditorPanel
- [ ] Ctrl+Shift+S keyboard shortcut working
- [ ] **ALL 5 integration tests PASSING**
- [ ] No regressions in other tests
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED:**
- [ ] **NO git operations** - Only LUKA has permission

**CORRECT WORKFLOW:**
1. Make all local file changes
2. Test thoroughly
3. Report completion to LUKA
4. LUKA handles git operations

### DO NOT:
- [ ] Skip any change sets
- [ ] Implement partial solutions
- [ ] Modify files outside scope

### DO:
- [ ] Follow existing code patterns
- [ ] Test incrementally after each phase
- [ ] Document all changes with line numbers
- [ ] Verify tests pass before moving to next phase

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify Issue:** Capture error output
2. **Revert Changes:** Use git (LUKA only)
3. **Verify Rollback:** Confirm baseline state
4. **Re-investigate:** Review audit and retry

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO-AUDIT-FileOperations-Integration-20260126-192445.md

**Key Findings:**
- Tests need mocks (react-window, ContextMenu, Dialog)
- Tests need IPC channel name fixes (fs:rename → fs:rename-file, fs:delete → fs:delete-file)
- Source code missing editor integration (rename/delete don't update tabs)
- Source code missing Save As feature (Ctrl+Shift+S does nothing)

**Root Causes Being Fixed:**
1. Missing test infrastructure → Add mocks
2. Incorrect IPC channel names → Fix expectations
3. Missing editor integration → Implement renameFile() and closeFile()
4. Missing Save As → Implement SaveAsDialog and keyboard shortcut

**Expected Impact:** 5/5 integration tests passing, 2 new editor features implemented

---

## SCOPE & RISK ASSESSMENT

**IMPORTANT:** Take as much time as needed for 100% completion.

**Implementation Scope:** STANDARD (test file + 5 source files)
**Completeness Required:** 100% - All tests must pass, all features must work
**Risk Level:** MEDIUM
**Risk Factors:**
- Source code changes required (not just tests)
- Editor state management changes
- New component creation

**Mitigation:**
- Test incrementally after each phase
- Follow proven patterns from existing code
- Verify no regressions after each change

---

## ✅ AFTER COMPLETION

**Step 1: Create Completion Report** ✅
   - [ ] Report in `trinity/reports/FILE-OPERATIONS-COMPLETE-IMPLEMENTATION-20260126.md`

**Step 2: 🚨 MOVE THIS WORK ORDER 🚨** ✅
   ```bash
   mv trinity/work-orders/WO-TEST-FIX-002-FileOperations-Complete.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] Work order in `trinity/sessions/`
   - [ ] Report in `trinity/reports/`

---

✅ **WORK ORDER READY FOR EXECUTION**

**Estimated Time:** 80 minutes (20 test fixes + 20 editor + 30 Save As + 10 validation)
**Priority:** HIGH
**Agent Assignment:** KIL (Task Executor) + BAS (Quality Gates)
