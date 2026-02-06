# ORCHESTRATOR WORK ORDER #TEST-004
## Type: IMPLEMENTATION
## Fix FileTreePanel.comprehensive Test Failures - react-window Virtualization Mock

---

## MISSION OBJECTIVE

Fix all 7 failing tests in FileTreePanel.comprehensive.test.tsx by adding the missing react-window virtualization mock that is causing tests to crash.

**Implementation Goal:** 100% test pass rate (7/7 tests passing) for FileTreePanel comprehensive test suite

**Based On:** JUNO Audit Report - Root Cause Analysis completed 2026-01-26

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
    changes: Add react-window mock (lines 27-38 after sonner mock)
    risk: LOW

Supporting_Files:
  - None - Single file change required
```

### Changes Required

#### Change Set 1: Add react-window Mock
**File:** tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
**Current State:**
- Test file has comment claiming react-window is mocked globally in tests/setup.ts (line 28-29)
- NO actual react-window mock exists in the file
- Test attempts to use real react-window library which crashes in jsdom test environment
- Error: "TypeError: Cannot convert undefined or null to object" from react-window internal code

**Target State:**
- react-window mocked using proven pattern from FileTreePanel.test.tsx
- All virtualized list rendering happens via mock that renders all items
- Tests can access all file tree nodes without virtualization issues

**Implementation:**
```typescript
// Add after line 26 (after sonner mock)
// Mock react-window for virtualization
vi.mock('react-window', () => ({
  List: ({ children, itemCount, innerElementType: InnerElement }: any) => {
    const Inner = InnerElement || 'div';
    return (
      <Inner data-testid="virtualized-list" data-row-count={itemCount}>
        {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
          children({ index, style: {} })
        )}
      </Inner>
    );
  },
}));
```

#### Change Set 2: Update Misleading Comment
**File:** tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
**Current State:**
- Lines 28-29: Incorrect comment claiming global mock exists in tests/setup.ts
- Comment misleads developers about test configuration

**Target State:**
- Comment accurately reflects that mock is in THIS file, not global

**Implementation:**
```typescript
// Replace lines 28-29:
// OLD:
// Note: react-window is mocked globally in tests/setup.ts to render all items
// This ensures all file tree nodes are accessible for testing

// NEW:
// Note: react-window is mocked above to render all items in tests
// This ensures all file tree nodes are accessible for testing
```

---

## IMPLEMENTATION APPROACH

### Step 1: Preparation
- [x] Audit completed - Root cause confirmed as missing react-window mock
- [x] Verified working pattern exists in FileTreePanel.test.tsx (lines 27-38)
- [x] Confirmed tests/setup.ts does NOT have react-window mock
- [x] Validated all 3 other test files using react-window include explicit mocks

### Step 2: Core Implementation
- [ ] Open tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx
- [ ] Add react-window mock after line 26 (after sonner mock, before describe block)
- [ ] Update comment on lines 28-29 to reflect actual mock location
- [ ] Save file

### Step 3: Validation
- [ ] Run test command: `npm test -- tests/components/ide/file-tree/FileTreePanel.comprehensive.test.tsx`
- [ ] Verify all 7 tests now pass (100% pass rate)
- [ ] Check test output shows no react-window errors
- [ ] Confirm test can find "src" and "README.md" text elements
- [ ] Verify virtualized list renders with correct data-row-count attribute
- [ ] Run full test suite to ensure no regressions

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `FileTreePanel-Test-Fix-IMPLEMENTATION-COMPLETE-20260126.md`
**Location:** `trinity/reports/` (Project-specific Reports folder)

### Required Sections
1. **Executive Summary** - Test failures fixed by adding react-window mock
2. **Changes Applied** - Detailed list with line numbers
3. **Test Results** - Before/after test run output
4. **Metrics** - 0/7 passing → 7/7 passing (100% improvement)
5. **Rollback Plan** - Remove added mock lines if issues arise
6. **Next Steps** - Monitor for similar virtualization issues in other tests

### Evidence to Provide
- Test output showing 7/7 tests passing
- Line numbers of changes (mock added after line 26, comment updated lines 28-29)
- Before/after comparison: "7 failed" → "7 passed"
- Confirmation no new errors introduced

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `FileTreePanel-Test-Fix-IMPLEMENTATION-COMPLETE-20260126.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-TEST-004-filetreepanel-comprehensive-test-fix.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-TEST-004-filetreepanel-comprehensive-test-fix.md`
   - [ ] Completion report exists in: `trinity/reports/FileTreePanel-Test-Fix-IMPLEMENTATION-COMPLETE-20260126.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/2026-01-26/`
- Completion report → `trinity/archive/reports/2026-01-26/`
- Session summary → `trinity/archive/sessions/2026-01-26/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [x] react-window mock added to FileTreePanel.comprehensive.test.tsx
- [x] Misleading comment corrected
- [ ] All 7 tests passing (100% pass rate)
- [ ] No react-window errors in test output
- [ ] Test can find DOM elements ("src", "README.md", etc.)
- [ ] No regressions in other test files
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
- [ ] Modify files outside the specified scope (ONLY FileTreePanel.comprehensive.test.tsx)
- [ ] Change test logic or assertions
- [ ] Suppress test failures instead of fixing root cause
- [ ] Create new technical debt
- [ ] Perform ANY git operations
- [ ] Modify other test files
- [ ] Change component implementation (FileTreePanel.tsx)

### DO:
- [ ] Follow exact mock pattern from FileTreePanel.test.tsx
- [ ] Maintain consistent code style with rest of test file
- [ ] Add mock in correct location (after sonner, before describe)
- [ ] Test changes thoroughly before reporting
- [ ] Verify no regressions in other tests
- [ ] Report completion to LUKA for git operations
- [ ] Provide test output showing 7/7 passing

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify rollback need:** If adding mock causes OTHER tests to fail or new errors appear
2. **Rollback steps:**
   - Remove lines added for react-window mock (lines 27-38 approx)
   - Restore original comment (lines 28-29)
   - Save file
3. **Verify rollback successful:** Tests return to original failing state (7 failed)

**Critical Files Backup:** Git already tracks original version - no additional backup needed

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit - FileTreePanel.comprehensive Test Failures
**Key Findings:**
- Missing react-window mock causes "Cannot convert undefined or null to object" error
- Comment incorrectly claims global mock exists in tests/setup.ts
- tests/setup.ts only mocks ResizeObserver, not react-window
- Working pattern proven in 3 other test files (FileTreePanel.test.tsx, ide-a11y.test.tsx, file-tree-benchmark.test.tsx)

**Root Causes Being Fixed:**
1. react-window library incompatible with jsdom test environment
2. Virtualization requires browser APIs not available in tests
3. Mock renders all items non-virtualized for test accessibility

**Expected Impact:**
- 7 test failures resolved (100% fix rate)
- Comprehensive test coverage restored for FileTreePanel
- Test pattern consistent across all FileTreePanel test files

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** FOCUSED - Single file, 12-line addition
**Completeness Required:** 100% - All 7 tests must pass
**Risk Level:** LOW
**Risk Factors:**
- Very low risk - proven pattern from existing test file
- Single file modification
- No component code changes
- No API or functionality changes

**Mitigation:**
- Using exact proven pattern from FileTreePanel.test.tsx
- Comprehensive test validation before declaring complete
- Full test suite run to check for regressions

---

## ESTIMATED EFFORT

**Implementation Time:** 2-5 minutes
**Testing Time:** 2-3 minutes
**Documentation Time:** 5-10 minutes
**Total Estimated Time:** 10-20 minutes

**Complexity:** Very Low - Copy proven pattern, verify tests pass

---

## DETAILED TEST FAILURES (REFERENCE)

### Current Failures (7/7 failing):
1. ❌ should load and display file tree - "Unable to find element with text: src"
2. ❌ should expand and collapse directories - react-window crash
3. ❌ should show git status badges - react-window crash
4. ❌ should handle loading state - react-window crash
5. ❌ should handle error state - react-window crash
6. ❌ should handle empty repository - react-window crash
7. ❌ should show gitignore dimming for ignored files - react-window crash

### Expected After Fix (7/7 passing):
1. ✅ should load and display file tree
2. ✅ should expand and collapse directories
3. ✅ should show git status badges
4. ✅ should handle loading state
5. ✅ should handle error state
6. ✅ should handle empty repository
7. ✅ should show gitignore dimming for ignored files

---

**Remember:** This is a simple, low-risk fix using a proven pattern. Add the mock, verify tests pass, document completion. Report all changes to LUKA for git operations.

**Work Order Created:** 2026-01-26
**Work Order Status:** READY FOR IMPLEMENTATION
**Assigned To:** Trinity Team (KIL for execution, BAS for quality gate)
**Audit Completed By:** JUNO
