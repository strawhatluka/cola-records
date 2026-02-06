# ORCHESTRATOR WORK ORDER #009
## Type: IMPLEMENTATION
## TODO Resolution & File Watcher Audit

---

## MISSION OBJECTIVE

Resolve all 6 TODO items in the codebase, audit the file watcher integration to ensure correctness, and write comprehensive tests for all changes.

**Implementation Goal:** Zero remaining TODOs in `src/`, fully functional file watcher integration, rollback logic, success feedback, cursor position tracking, and search-to-line navigation—all covered by tests.
**Based On:** TODO audit conducted 2026-01-30 identifying 6 unresolved TODOs across 5 source files.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/hooks/useIDEInitialization.ts
    changes: Audit file watcher integration, fix or remove stale TODOs #1 & #2
    risk: LOW

  - path: src/renderer/hooks/useContributionWorkflow.ts
    changes: Implement rollback logic (TODO #3)
    risk: MEDIUM

  - path: src/renderer/screens/IssueDiscoveryScreen.tsx
    changes: Add success toast after workflow completion (TODO #4)
    risk: LOW

  - path: src/renderer/stores/useCodeEditorStore.ts
    changes: Add cursorPosition state + setCursorPosition action + pendingRevealLine + openFile lineNumber param
    risk: MEDIUM

  - path: src/renderer/components/ide/editor/MonacoEditor.tsx
    changes: Wire onDidChangeCursorPosition event, implement revealLine on pendingRevealLine change
    risk: MEDIUM

  - path: src/renderer/components/ide/editor/CodeEditorPanel.tsx
    changes: Pass cursor position callback and line number through to MonacoEditor
    risk: LOW

  - path: src/renderer/components/ide/IDEStatusBar.tsx
    changes: Read cursor position from store instead of hardcoded values (TODO #5)
    risk: LOW

  - path: src/renderer/components/ide/search/SearchPanel.tsx
    changes: Pass line number to openFile when clicking search results (TODO #6)
    risk: LOW

Supporting_Files:
  - tests/renderer/hooks/useIDEInitialization.test.ts - Add/update file watcher tests
  - tests/renderer/hooks/useContributionWorkflow.test.ts - Add rollback logic tests
  - tests/renderer/screens/IssueDiscoveryScreen.test.tsx - Add workflow complete toast test
  - tests/renderer/stores/useCodeEditorStore.test.ts - Add cursor position & line nav tests
  - tests/renderer/components/ide/IDEStatusBar.test.tsx - Update cursor display tests
```

### Changes Required

#### Change Set 1: File Watcher Audit (TODOs #1 & #2)
**Files:** `src/renderer/hooks/useIDEInitialization.ts`
**Current State:** Commented-out file watcher code with wrong channel names (`file-watcher:watch` vs `fs:watch-directory`). FileTreePanel.tsx already calls `fs:watch-directory` independently.
**Target State:** Remove stale TODO comments and commented code. FileTreePanel already handles file watching correctly with dedup protection in FileWatcherService. No duplicate watcher needed in initialization.
**Implementation:**
```typescript
// Remove lines 57-58 (TODO + commented ipc.invoke)
// Remove lines 71-72 (TODO + commented ipc.invoke)
// The file watcher is already correctly managed by FileTreePanel.tsx
```

#### Change Set 2: Rollback Logic (TODO #3)
**Files:** `src/renderer/hooks/useContributionWorkflow.ts`
**Current State:** Empty `rollback()` function called on workflow error.
**Target State:** Rollback function that cleans up partially cloned repository directory.
**Implementation:**
```typescript
// Track localPath via ref so rollback can access it
const localPathRef = useRef<string | null>(null);

const rollback = async () => {
  // Delete partially cloned repository if it exists
  if (localPathRef.current) {
    try {
      const exists = await ipc.invoke('fs:directory-exists', localPathRef.current);
      if (exists) {
        await ipc.invoke('fs:delete-directory', localPathRef.current);
      }
    } catch {
      // Best-effort cleanup - don't throw during rollback
    }
    localPathRef.current = null;
  }
  // Note: No database cleanup needed - createContribution is the last step,
  // so if workflow fails before it, no DB entry exists to clean up.
};

// In startWorkflow, set localPathRef.current = localPath after computing it
```

#### Change Set 3: Success Toast (TODO #4)
**Files:** `src/renderer/screens/IssueDiscoveryScreen.tsx`
**Current State:** `handleWorkflowComplete` clears modal but gives no user feedback. `contribution` parameter is unused.
**Target State:** Show success toast with repository name after workflow completion.
**Implementation:**
```typescript
import { toast } from 'sonner';

const handleWorkflowComplete = (contribution: Contribution) => {
  setWorkflowIssue(null);
  const repoName = contribution.repositoryUrl.split('/').pop()?.replace('.git', '') || 'repository';
  toast.success(`Successfully set up contribution for ${repoName}`);
};
```

#### Change Set 4: Cursor Position Tracking (TODO #5)
**Files:** `useCodeEditorStore.ts`, `MonacoEditor.tsx`, `CodeEditorPanel.tsx`, `IDEStatusBar.tsx`
**Current State:** `cursorLine` and `cursorColumn` hardcoded to 1 in IDEStatusBar.
**Target State:** Live cursor position from Monaco editor displayed in status bar.
**Implementation:**
```typescript
// useCodeEditorStore.ts - Add to state interface:
cursorPosition: { line: number; column: number };
setCursorPosition: (line: number, column: number) => void;

// MonacoEditor.tsx - Add prop and wire event:
interface MonacoEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string | undefined) => void;
  onCursorPositionChange?: (line: number, column: number) => void;
}
// In handleEditorMount:
editor.onDidChangeCursorPosition((e) => {
  onCursorPositionChange?.(e.position.lineNumber, e.position.column);
});

// CodeEditorPanel.tsx - Pass setCursorPosition to MonacoEditor
// IDEStatusBar.tsx - Read from store instead of hardcoded values
```

#### Change Set 5: Search-to-Line Navigation (TODO #6)
**Files:** `useCodeEditorStore.ts`, `MonacoEditor.tsx`, `CodeEditorPanel.tsx`, `SearchPanel.tsx`
**Current State:** Search results open file but don't navigate to the matching line. Shows toast workaround.
**Target State:** Clicking search result opens file and scrolls to the matching line.
**Implementation:**
```typescript
// useCodeEditorStore.ts - Add:
pendingRevealLine: number | null;
setPendingRevealLine: (line: number | null) => void;
// Modify openFile to accept optional lineNumber param:
openFile: (path: string, content?: string, lineNumber?: number) => Promise<void>;
// After opening, set pendingRevealLine if lineNumber provided

// MonacoEditor.tsx - Add prop:
revealLine?: number | null;
// useEffect to call editor.revealLineInCenter() and editor.setPosition()

// SearchPanel.tsx - Pass line number:
await openFile(result.file, undefined, result.line);
// Remove toast.info workaround
```

#### Change Set 6: Tests for All 6 Items
**Files:** Test files listed in Supporting_Files
**Current State:** No tests for file watcher integration in useIDEInitialization, no rollback tests, no toast verification, no cursor position tests, no line navigation tests.
**Target State:** Comprehensive test coverage for all 6 resolved TODOs.

---

## IMPLEMENTATION APPROACH

### Phase 1: Independent Fixes (Tasks 1, 2, 3 - Parallelizable)

#### Step 1: File Watcher Audit (TODO #1 & #2)
- [ ] Read useIDEInitialization.ts current state
- [ ] Verify FileTreePanel.tsx already handles file watching correctly
- [ ] Remove stale TODO comments and commented-out code from useIDEInitialization.ts
- [ ] Verify no duplicate watcher initialization exists

#### Step 2: Rollback Logic (TODO #3)
- [ ] Add useRef import and localPathRef to useContributionWorkflow.ts
- [ ] Implement rollback function with fs:directory-exists and fs:delete-directory
- [ ] Set localPathRef.current during startWorkflow after localPath is computed
- [ ] Clear localPathRef.current on successful completion

#### Step 3: Success Toast (TODO #4)
- [ ] Add toast import to IssueDiscoveryScreen.tsx
- [ ] Implement handleWorkflowComplete with success toast
- [ ] Extract repo name from contribution.repositoryUrl

### Phase 2: Cursor Position Tracking (Task 4)

#### Step 4: Store Extension
- [ ] Add cursorPosition state to useCodeEditorStore interface
- [ ] Add setCursorPosition action
- [ ] Initialize cursorPosition to { line: 1, column: 1 }

#### Step 5: MonacoEditor Wiring
- [ ] Add onCursorPositionChange prop to MonacoEditor
- [ ] Wire editor.onDidChangeCursorPosition in handleEditorMount
- [ ] Call onCursorPositionChange callback with position data

#### Step 6: CodeEditorPanel Integration
- [ ] Pass setCursorPosition from store to MonacoEditor as onCursorPositionChange

#### Step 7: IDEStatusBar Update
- [ ] Replace hardcoded cursorLine/cursorColumn with store values
- [ ] Remove TODO comment

### Phase 3: Search-to-Line Navigation (Task 5, depends on Phase 2)

#### Step 8: Store Extension for Line Navigation
- [ ] Add pendingRevealLine state to useCodeEditorStore
- [ ] Add setPendingRevealLine action
- [ ] Modify openFile signature to accept optional lineNumber parameter
- [ ] Set pendingRevealLine after file opens successfully

#### Step 9: MonacoEditor Line Reveal
- [ ] Add revealLine prop to MonacoEditor
- [ ] Add useEffect that calls editor.revealLineInCenter() when revealLine changes
- [ ] Call editor.setPosition() to place cursor at the line
- [ ] Clear pendingRevealLine after revealing (via onRevealComplete callback or store action)

#### Step 10: SearchPanel Integration
- [ ] Update handleResultClick to pass result.line to openFile
- [ ] Remove toast.info workaround
- [ ] Remove TODO comment

### Phase 4: Testing (Task 6, after all implementation)

#### Step 11: Write Tests
- [ ] Update useIDEInitialization.test.ts - verify no file watcher calls (removed)
- [ ] Update useContributionWorkflow.test.ts - test rollback cleans up directory
- [ ] Update IssueDiscoveryScreen.test.tsx - test success toast appears
- [ ] Update useCodeEditorStore.test.ts - test setCursorPosition and pendingRevealLine
- [ ] Update IDEStatusBar.test.tsx - test cursor position display from store
- [ ] Verify all existing tests still pass

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TODO-RESOLUTION-IMPLEMENTATION-COMPLETE-20260130.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - All 6 TODOs resolved
2. **Changes Applied** - Detailed list with file paths and line numbers
3. **Test Results** - All tests passing, new test counts
4. **Metrics** - TODOs before (6) vs after (0)
5. **Rollback Plan** - Revert individual changes per phase
6. **Next Steps** - Monitor cursor position performance with large files

### Evidence to Provide
- File diff statistics
- Specific line numbers for critical changes
- Test output showing all tests pass
- Zero TODOs remaining in src/ (grep verification)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] Follow format: `TODO-RESOLUTION-IMPLEMENTATION-COMPLETE-20260130.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-009-todo-resolution-and-filewatcher-audit.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-009-todo-resolution-and-filewatcher-audit.md`
   - [ ] Completion report exists in: `trinity/sessions/TODO-RESOLUTION-IMPLEMENTATION-COMPLETE-20260130.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/`
   - [ ] Next session starts with empty sessions/ folder

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 6 TODO comments removed from source code
- [ ] File watcher integration audited and confirmed correct (FileTreePanel handles it)
- [ ] Rollback logic implemented and tested
- [ ] Success toast shown after workflow completion
- [ ] Cursor position tracked live from Monaco editor
- [ ] Search results navigate to matching line in editor
- [ ] All new functionality has test coverage
- [ ] All existing tests still pass
- [ ] `grep -r "TODO" src/` returns zero results

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations.

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Test thoroughly in local environment
3. Report completion to LUKA with summary of changes
4. LUKA will handle ALL git operations (add, commit, push, etc.)

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond the requirements
- [ ] Suppress warnings instead of fixing issues
- [ ] Create new technical debt
- [ ] Perform ANY git operations
- [ ] Run tests (LUKA will run tests on their system)

### DO:
- [ ] Follow existing code patterns
- [ ] Maintain consistent style
- [ ] Add appropriate error handling
- [ ] Consider edge cases
- [ ] Read each file before editing (sequential, not parallel)

---

## ROLLBACK STRATEGY

If issues arise:
1. **Phase 1 rollback:** Restore original TODO comments (git revert individual files)
2. **Phase 2 rollback:** Remove cursorPosition from store, revert MonacoEditor/CodeEditorPanel/IDEStatusBar
3. **Phase 3 rollback:** Remove pendingRevealLine from store, revert SearchPanel toast workaround
4. **Phase 4 rollback:** Delete new test assertions

**Critical Files Backup:** All files listed in Critical_Files above

---

## CONTEXT FROM TODO AUDIT

**Source Investigation:** Manual TODO audit conducted 2026-01-30
**Key Findings:**
- TODOs #1 & #2: File watcher infrastructure fully exists, FileTreePanel.tsx already uses it correctly. TODOs are stale.
- TODO #3: Rollback function called on error but is empty. IPC channels for cleanup exist (fs:directory-exists, fs:delete-directory).
- TODO #4: Simple missing toast notification after successful workflow.
- TODO #5: Cursor position tracking requires wiring Monaco editor event through store to status bar.
- TODO #6: Line navigation requires extending openFile with lineNumber param and adding revealLine to Monaco.
**Root Causes Being Fixed:** Incomplete feature implementations left as TODOs during initial development
**Expected Impact:** 6 TODOs resolved, improved UX (cursor tracking, search navigation, workflow feedback, error recovery)

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** MEDIUM
**Risk Factors:**
- Phase 2 & 3 modify shared files (store, MonacoEditor, CodeEditorPanel) - must be sequential
- Monaco editor ref timing for cursor events
- Rollback race condition during error handling

**Mitigation:**
- Sequential implementation of Phase 2 before Phase 3
- Use onMount callback for Monaco cursor events (editor ref is stable at that point)
- Track rollback state with ref to prevent double-cleanup

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
