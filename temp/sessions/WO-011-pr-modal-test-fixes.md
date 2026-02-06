# ORCHESTRATOR WORK ORDER #011
## Type: IMPLEMENTATION
## PullRequestDetailModal Test Fixes and Merge/Close PR Test Coverage

---

## MISSION OBJECTIVE

Fix 23 failing tests in `PullRequestDetailModal.test.tsx` caused by the new required `githubUsername` prop, and add comprehensive test coverage for the newly implemented `mergePullRequest` and `closePullRequest` functionality in both backend service and frontend component.

**Implementation Goal:** All tests passing with new test cases covering merge/close PR functionality
**Based On:** JUNO Codebase Audit (2026-02-05) and TRA Implementation Plan TRA-2026-02-05-001

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/renderer/components/pull-requests/PullRequestDetailModal.test.tsx
    changes: Add githubUsername prop to all 23 render calls, add merge/close IPC mocks, add 12 new test cases
    risk: LOW

  - path: tests/main/services/github-rest.service.test.ts
    changes: Add mock functions for pulls.merge and pulls.update, add 8 new test cases
    risk: LOW

Supporting_Files:
  - None - test-only changes
```

### Changes Required

#### Change Set 1: Fix Existing Test Render Calls
**Files:** `tests/renderer/components/pull-requests/PullRequestDetailModal.test.tsx`
**Current State:** 23 render calls missing required `githubUsername` prop
**Target State:** All render calls include `githubUsername="testuser"` prop
**Implementation:**
```tsx
// Before
<PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />

// After
<PullRequestDetailModal pr={basePR} owner="org" repo="repo" githubUsername="testuser" onClose={vi.fn()} />
```

#### Change Set 2: Update Mock IPC Handler
**Files:** `tests/renderer/components/pull-requests/PullRequestDetailModal.test.tsx`
**Current State:** `setupMockIPC` doesn't handle merge/close channels
**Target State:** Add handlers for `github:merge-pull-request` and `github:close-pull-request`
**Implementation:**
```typescript
case 'github:merge-pull-request':
  return { sha: 'abc123', merged: true, message: 'Pull Request successfully merged' };
case 'github:close-pull-request':
  return { number: 1, state: 'closed' };
```

#### Change Set 3: Add Backend Mock Functions
**Files:** `tests/main/services/github-rest.service.test.ts`
**Current State:** No mocks for `pulls.merge` or `pulls.update`
**Target State:** Add mock functions and include in MockOctokit
**Implementation:**
```typescript
const mockPullsMerge = vi.fn();
const mockPullsUpdate = vi.fn();

// In MockOctokit.pulls:
merge: mockPullsMerge,
update: mockPullsUpdate,
```

#### Change Set 4: Backend Tests for mergePullRequest
**Files:** `tests/main/services/github-rest.service.test.ts`
**Test Cases:**
1. Successful merge with 'merge' method returns sha and merged status
2. Successful merge with 'squash' method
3. Successful merge with 'rebase' method
4. Optional commitTitle and commitMessage params passed correctly
5. Throws on API error with proper message

#### Change Set 5: Backend Tests for closePullRequest
**Files:** `tests/main/services/github-rest.service.test.ts`
**Test Cases:**
1. Successful close returns number and state
2. Calls pulls.update with state: 'closed'
3. Throws on API error with proper message

#### Change Set 6: Frontend Tests for Merge Button
**Files:** `tests/renderer/components/pull-requests/PullRequestDetailModal.test.tsx`
**Test Cases:**
1. Merge button visible for open PRs
2. Merge button hidden for closed PRs
3. Merge button hidden for merged PRs
4. Clicking merge calls `github:merge-pull-request` IPC
5. Merge dropdown shows three options
6. Successful merge calls onRefresh and onClose
7. Merge error displays error message

#### Change Set 7: Frontend Tests for Close Button
**Files:** `tests/renderer/components/pull-requests/PullRequestDetailModal.test.tsx`
**Test Cases:**
1. Close button visible for open PRs
2. Close button hidden for closed/merged PRs
3. Clicking close calls `github:close-pull-request` IPC
4. Successful close calls onRefresh and onClose
5. Close error displays error message

---

## IMPLEMENTATION APPROACH

### Step 1: Fix Existing Tests (Task 1)
- [ ] Update all 23 render calls with `githubUsername="testuser"` prop
- [ ] Update `setupMockIPC` to handle new IPC channels
- [ ] Run tests to verify 23 tests now pass

### Step 2: Add Backend Mocks (Task 2)
- [ ] Add `mockPullsMerge` and `mockPullsUpdate` vi.fn()
- [ ] Add to MockOctokit.pulls object
- [ ] Verify no lint errors

### Step 3: Add Backend Tests (Tasks 3-4)
- [ ] Add `describe('mergePullRequest')` block with 5 test cases
- [ ] Add `describe('closePullRequest')` block with 3 test cases
- [ ] Run backend tests to verify all pass

### Step 4: Add Frontend Tests (Tasks 5-6)
- [ ] Add `describe('merge and close actions')` block
- [ ] Add merge button visibility tests
- [ ] Add merge button interaction tests
- [ ] Add close button visibility tests
- [ ] Add close button interaction tests
- [ ] Run frontend tests to verify all pass

### Step 5: Validation (Task 7)
- [ ] Run full test suite: `npm test`
- [ ] Verify 0 failing tests
- [ ] Check coverage maintained at ≥80%

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TEST-IMPLEMENTATION-COMPLETE-2026-02-05.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Tests fixed and new coverage added
2. **Changes Applied** - List of all test file changes
3. **Test Results** - Full test suite output
4. **Metrics** - Before/after test counts, coverage
5. **Rollback Plan** - Revert test file changes
6. **Next Steps** - None expected

### Evidence to Provide
- Test run output showing all tests pass
- Coverage report showing ≥80% maintained
- Count of tests: before (X failing), after (0 failing, +20 new)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `TEST-IMPLEMENTATION-COMPLETE-2026-02-05.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-011-pr-modal-test-fixes.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-011-pr-modal-test-fixes.md`
   - [ ] Completion report exists in: `trinity/reports/TEST-IMPLEMENTATION-COMPLETE-2026-02-05.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 23 previously failing tests pass
- [ ] 8 new backend tests added and passing (mergePullRequest: 5, closePullRequest: 3)
- [ ] 12 new frontend tests added and passing (merge: 7, close: 5)
- [ ] Total new tests: ~20
- [ ] Test coverage maintained at ≥80%
- [ ] No regressions in existing tests
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
LUKA will handle ALL git operations (add, commit, push, etc.)

### Do NOT:
- [ ] Modify source files (only test files)
- [ ] Change component functionality
- [ ] Skip test cases
- [ ] Create flaky tests
- [ ] Perform ANY git operations

### DO:
- [ ] Follow existing test patterns
- [ ] Use proper async/await with waitFor
- [ ] Use userEvent for interactions
- [ ] Mock all external dependencies
- [ ] Test both success and error paths

---

## ROLLBACK STRATEGY

If issues arise:
1. Revert test file changes to previous state
2. Run `npm test` to verify original 23 failures return
3. Investigate implementation approach

**Critical Files Backup:** None needed - version control handles this

---

## CONTEXT FROM AUDIT

**Source:** JUNO Codebase Audit 2026-02-05
**Key Findings:**
- 23 tests failing due to missing `githubUsername` prop in PullRequestDetailModal
- `mergePullRequest` and `closePullRequest` backend methods have 0% test coverage
- Frontend merge/close UI has 0% test coverage

**Root Causes Being Fixed:**
1. Component prop interface changed without updating tests
2. New functionality added without accompanying tests

**Expected Impact:**
- 23 issues resolved
- ~20 new test cases added
- 100% coverage for merge/close PR functionality

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100% - All specified tests must pass
**Risk Level:** LOW
**Risk Factors:**
- Radix UI dropdown mocking may be complex
- Async test timing

**Mitigation:**
- Simplify dropdown tests to verify IPC calls rather than full interaction
- Use proper waitFor patterns for async operations

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
