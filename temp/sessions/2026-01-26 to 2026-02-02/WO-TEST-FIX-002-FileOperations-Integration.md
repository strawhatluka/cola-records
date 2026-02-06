# ORCHESTRATOR WORK ORDER #002
## Type: IMPLEMENTATION
## Fix File Operations Integration Tests

---

## MISSION OBJECTIVE

Fix 5 failing integration tests in `tests/integration/file-operations.test.tsx` by adding proper react-window mocking and comprehensive IPC setup. All source code functionality exists and is fully implemented - tests only fail due to missing test infrastructure.

**Implementation Goal:** All 5 integration tests passing with proper component rendering and interaction support
**Based On:** JUNO Audit Report - JUNO-AUDIT-FileOperations-Integration-20260126-162052.md

**Audit Findings:**
- Root Cause: Missing react-window mock prevents FileTreePanel from rendering
- Component Status: WORKING - All source code fully implements expected functionality
- Test Status: NEEDS_UPDATE - Tests need proper mocking infrastructure
- Fix Complexity: LOW - 25-line mock + IPC setup improvements

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/integration/file-operations.test.tsx
    changes: Add react-window mock, fix IPC mocking, add store initialization
    risk: LOW

Supporting_Files:
  - None - All fixes isolated to test file
```

### Changes Required

#### Change Set 1: Add react-window Mock
**Files:** tests/integration/file-operations.test.tsx
**Current State:** No react-window mock, comment incorrectly claims global mock exists
**Target State:** Proper react-window mock that renders all items for testing
**Implementation:**
```typescript
// Add after line 31 (after comment about react-window)
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

  return {
    List: MockList,
  };
});
```

#### Change Set 2: Fix IPC Mocking
**Files:** tests/integration/file-operations.test.tsx
**Current State:** beforeEach uses mockResolvedValueOnce, missing git:status, fs:watch-directory, gitignore:is-ignored
**Target State:** Comprehensive mockImplementation covering all IPC channels
**Implementation:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();

  // Setup default IPC mock implementation
  mockInvokeIPC.mockImplementation((channel: string, ...args: any[]) => {
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

  // Reset stores
  useCodeEditorStore.setState({
    openFiles: new Map(),
    activeFilePath: null,
    modifiedFiles: new Set(),
    loading: false,
  });

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

#### Change Set 3: Update Test-Specific IPC Mocks
**Files:** tests/integration/file-operations.test.tsx
**Current State:** Tests use mockResolvedValueOnce for file tree data
**Target State:** Each test overrides mockImplementation with specific channel responses
**Pattern to Apply:**
```typescript
// In each test, replace mockInvokeIPC.mockResolvedValueOnce([...])
// With:
mockInvokeIPC.mockImplementation((channel: string) => {
  if (channel === 'fs:read-directory') {
    return Promise.resolve([
      { name: 'src', path: '/test/repo/src', type: 'directory', children: [] }
    ]);
  }
  if (channel === 'git:status') {
    return Promise.resolve({ files: [] });
  }
  if (channel === 'fs:watch-directory' || channel === 'fs:unwatch-directory') {
    return Promise.resolve();
  }
  if (channel === 'gitignore:is-ignored') {
    return Promise.resolve(false);
  }
  if (channel === 'fs:read-file') {
    return Promise.resolve({ content: '', encoding: 'utf-8' });
  }
  return Promise.reject(new Error(`Unexpected IPC channel: ${channel}`));
});
```

#### Change Set 4: Fix IPC Channel Name Mismatches (if needed)
**Files:** tests/integration/file-operations.test.tsx
**Current State:** Test expects fs:rename and fs:delete
**Target State:** Align with actual IPC channels from main process
**Verification Required:**
- Source code uses: fs:rename-file, fs:delete-file
- Main process handlers confirmed: fs:rename-file, fs:delete-file
- Test expectations need updating to match source code

**Implementation:**
```typescript
// Test 2 - Rename (line 168)
expect(mockInvokeIPC).toHaveBeenCalledWith(
  'fs:rename-file',  // Changed from 'fs:rename'
  '/test/repo/oldName.ts',
  '/test/repo/newName.ts'
);

// Test 3 - Delete (line 242)
expect(mockInvokeIPC).toHaveBeenCalledWith(
  'fs:delete-file',  // Changed from 'fs:delete'
  '/test/repo/toDelete.ts'
);
```

---

## IMPLEMENTATION APPROACH

### Step 1: Add react-window Mock
- [ ] Add react-window mock after line 31 in file-operations.test.tsx
- [ ] Verify mock renders all items (itemCount limit: 100)
- [ ] Ensure MockList has displayName for React DevTools
- [ ] Verify mock uses innerElementType for custom wrapper

### Step 2: Fix beforeEach IPC Mocking
- [ ] Import useFileTreeStore at top of file
- [ ] Replace mockResolvedValueOnce pattern with mockImplementation
- [ ] Add support for git:status, fs:watch-directory, fs:unwatch-directory, gitignore:is-ignored
- [ ] Add useFileTreeStore.setState() to reset store
- [ ] Include all store properties (rootPath, root, fileTree, expandedPaths, etc.)

### Step 3: Update Test 1 - Create File
- [ ] Update IPC mock to use mockImplementation pattern
- [ ] Add fs:read-directory response with src directory
- [ ] Add fs:create-file mock response
- [ ] Ensure tree refresh IPC call returns updated tree
- [ ] Verify test can find "src" node in DOM

### Step 4: Update Test 2 - Rename File
- [ ] Update IPC mock to use mockImplementation pattern
- [ ] Change expected IPC call from fs:rename to fs:rename-file
- [ ] Add fs:read-file mock for opening file
- [ ] Ensure rename operation triggers tree refresh

### Step 5: Update Test 3 - Delete File
- [ ] Update IPC mock to use mockImplementation pattern
- [ ] Change expected IPC call from fs:delete to fs:delete-file
- [ ] Add fs:read-file mock for opening file
- [ ] Verify editor tab closes after deletion

### Step 6: Update Test 4 - Save As (Investigation Required)
- [ ] Verify Save As functionality exists in CodeEditorPanel
- [ ] Check for Ctrl+Shift+S keyboard shortcut handler
- [ ] If functionality missing: Skip test with .skip() and document
- [ ] If functionality exists: Update test mocks accordingly

### Step 7: Update Test 5 - Concurrent Edits
- [ ] Update IPC mock to use mockImplementation pattern
- [ ] Add fs:read-file mocks for both files
- [ ] Verify tab switching functionality exists
- [ ] Verify save functionality with keyboard shortcuts

### Step 8: Run Tests and Validate
- [ ] Run integration tests: npm test -- tests/integration/file-operations.test.tsx
- [ ] Verify all 5 tests pass (or 4 if Save As is skipped)
- [ ] Check test output for unexpected IPC calls
- [ ] Ensure no console errors during test execution

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `FILE-OPERATIONS-INTEGRATION-FIX-COMPLETE-20260126.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was fixed and results
2. **Changes Applied** - All code changes with line numbers
3. **Test Results** - Before/after test output
4. **IPC Channel Alignment** - Documented channel name corrections
5. **Skipped Tests** - Any tests skipped with justification
6. **Next Steps** - Follow-up work needed (if any)

### Evidence to Provide
- Test output showing 5/5 passing (or 4/5 if Save As skipped)
- Specific line numbers for all changes
- Before/after comparison of test failures
- IPC mock coverage verification

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] react-window mock added and functional
- [ ] beforeEach sets up comprehensive IPC mocking
- [ ] useFileTreeStore reset in beforeEach
- [ ] All tests use mockImplementation pattern
- [ ] IPC channel names aligned with source code (fs:rename-file, fs:delete-file)
- [ ] Tests 1-3 passing reliably
- [ ] Test 4 (Save As) passing or properly skipped with documentation
- [ ] Test 5 (Concurrent Edits) passing or properly skipped with documentation
- [ ] No console errors during test execution
- [ ] Implementation report submitted to trinity/reports/

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add** - FORBIDDEN - Only LUKA has permission
- [ ] **git commit** - FORBIDDEN - Only LUKA has permission
- [ ] **git push** - FORBIDDEN - Only LUKA has permission
- [ ] **git pull** - FORBIDDEN - Only LUKA has permission
- [ ] **git merge** - FORBIDDEN - Only LUKA has permission
- [ ] **git checkout -b** - FORBIDDEN - Only LUKA has permission
- [ ] **git branch** - FORBIDDEN - Only LUKA has permission
- [ ] **git tag** - FORBIDDEN - Only LUKA has permission
- [ ] **git rebase** - FORBIDDEN - Only LUKA has permission
- [ ] **git reset** - FORBIDDEN - Only LUKA has permission
- [ ] **git revert** - FORBIDDEN - Only LUKA has permission
- [ ] **git stash** - FORBIDDEN - Only LUKA has permission
- [ ] **Any git operation that modifies repository state**

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Test thoroughly in local environment
3. Report completion to LUKA with summary of changes
4. LUKA will handle ALL git operations (add, commit, push, etc.)

### Do NOT:
- [ ] Modify source code files (only test files)
- [ ] Change component functionality
- [ ] Add new dependencies
- [ ] Modify global test setup (tests/setup.ts)
- [ ] Perform ANY git operations

### DO:
- [ ] Follow existing test patterns from FileTreePanel.comprehensive.test.tsx
- [ ] Maintain consistent mock structure
- [ ] Add helpful comments explaining mock purpose
- [ ] Document any skipped tests with clear justification
- [ ] Test changes thoroughly before reporting
- [ ] Provide clear summary of all changes made
- [ ] List specific line numbers for all modifications

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify Issue:** Run tests and capture error output
2. **Revert Change:** Use git to restore file-operations.test.tsx to previous state (LUKA only)
3. **Verify Rollback:** Confirm tests are back to original state (5 failing)
4. **Re-investigate:** Review audit report and identify different approach

**Critical Files Backup:** None needed - git handles rollback

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit Report - JUNO-AUDIT-FileOperations-Integration-20260126-162052.md
**Key Findings:**
- All source code functionality fully implemented and working
- Context menus, file operations, dialogs all exist in FileTreeNode component
- IPC handlers confirmed in main process (fs:rename-file, fs:delete-file)
- Tests fail only due to missing react-window mock and incomplete IPC setup
- No missing functionality in codebase

**Root Causes Being Fixed:**
1. Missing react-window mock prevents FileTreePanel rendering
2. Incomplete IPC mocking causes component mount failures
3. Store state not reset between tests causes cross-contamination
4. IPC channel name mismatches (fs:rename vs fs:rename-file)

**Expected Impact:** 5 integration tests passing, enabling file operations workflow validation

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** FOCUSED
**Completeness Required:** 100% - All 5 tests must pass or be properly documented
**Risk Level:** LOW
**Risk Factors:**
- Isolated to test file only (no source code changes)
- Pattern already proven in FileTreePanel.comprehensive.test.tsx
- All IPC channels documented in audit report

**Mitigation:**
- Use proven react-window mock pattern from other tests
- Test each change incrementally
- Verify no unexpected IPC calls with comprehensive error handling

---

## INVESTIGATION ARTIFACTS

**Audit Report:** trinity/reports/JUNO-AUDIT-FileOperations-Integration-20260126-162052.md

**Key Evidence:**
- Source code audit confirmed all functionality exists
- IPC channel names verified in src/main/index.ts
- react-window mock pattern from FileTreePanel.comprehensive.test.tsx
- Store structure from useFileTreeStore.ts

**Reference Tests:**
- tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx (react-window mock pattern)
- tests/components/ide/file-tree/FileTreePanel.test.tsx (store reset pattern)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `FILE-OPERATIONS-INTEGRATION-FIX-COMPLETE-20260126.md`
   - [ ] Include all required sections listed above
   - [ ] Include test output showing pass/fail results

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-TEST-FIX-002-FileOperations-Integration.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-TEST-FIX-002-FileOperations-Integration.md`
   - [ ] Completion report exists in: `trinity/reports/FILE-OPERATIONS-INTEGRATION-FIX-COMPLETE-20260126.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report → `trinity/archive/reports/YYYY-MM-DD/`
- JUNO audit report → `trinity/archive/reports/YYYY-MM-DD/`
- Session summary → `trinity/archive/sessions/YYYY-MM-DD/`

---

**Remember:** Make changes systematically, test frequently, and maintain test quality throughout the implementation. Report all changes to LUKA for git operations.
