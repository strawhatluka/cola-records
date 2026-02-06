# ORCHESTRATOR WORK ORDER #MIGRATE-002.4
## Type: IMPLEMENTATION
## Test Infrastructure Complete Remediation - Achieve 100/100 JUNO Score

---

## MISSION OBJECTIVE

Complete test infrastructure remediation to achieve 100/100 JUNO score by fixing the RepositoryFileTree.test.tsx anti-pattern and resolving all TypeScript test errors. This is the final 5% to reach perfect completion.

**Implementation Goal:** All 47 tests passing with ≥80% coverage, 0 TypeScript errors
**Based On:** JUNO Audit WO-MIGRATE-002.3 (identified RepositoryFileTree.test.tsx dynamic require() anti-pattern as blocker)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/__tests__/components/RepositoryFileTree.test.tsx
    changes: Refactor from dynamic require() to top-level imports
    risk: MEDIUM

  - path: src/__tests__/hooks/useContributionWorkflow.test.ts
    changes: Fix 11 TypeScript errors (mock signatures, unused vars)
    risk: LOW

Supporting_Files:
  - src/main/ipc/channels.ts - May need defaultBranch property
  - vitest.config.ts - Verify configuration optimal
```

### Changes Required

#### Change Set 1: Fix RepositoryFileTree.test.tsx Anti-Pattern
**Files:** src/__tests__/components/RepositoryFileTree.test.tsx
**Current State:** All 10 tests use dynamic `require()` inside test functions
**Target State:** Top-level imports with hoisted vi.mock()
**Impact:** Fixes 10 failing tests (21.3% of total)

**Current Pattern (BROKEN):**
```typescript
// ❌ ANTI-PATTERN - Dynamic require bypasses vi.mock() hoisting
it('should show loading state initially', () => {
  const { ipc } = require('../../renderer/ipc/client');
  vi.mocked(ipc.invoke).mockResolvedValue([]);
  // Test fails: "Cannot find module '../../renderer/ipc/client'"
});
```

**Target Pattern (CORRECT):**
```typescript
// ✅ CORRECT - Hoisted mock at module top
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RepositoryFileTree } from '../../renderer/components/issues/RepositoryFileTree';

// Mock MUST be at top level, before any imports that use it
vi.mock('../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => () => {}),
  },
}));

// NOW import the mocked module
import { ipc } from '../../renderer/ipc/client';

describe('RepositoryFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(ipc.invoke).mockResolvedValue([]);
    render(<RepositoryFileTree repository="owner/repo" />);
    // Test now works!
  });
});
```

**Implementation Steps:**
1. Add `vi.mock('../../renderer/ipc/client')` at top of file
2. Add `import { ipc }` AFTER the mock
3. Remove ALL `const { ipc } = require(...)` lines from test functions
4. Keep `vi.mocked(ipc.invoke)` calls as-is (they work with top-level import)
5. Verify all 10 tests pass

#### Change Set 2: Fix TypeScript Test Errors
**Files:** src/__tests__/hooks/useContributionWorkflow.test.ts
**Current State:** 11 TypeScript errors
**Target State:** 0 TypeScript errors

**Error 1: defaultBranch property (7 occurrences)**
```typescript
// Current (ERROR):
const mockFork: GitHubRepository = {
  defaultBranch: 'main', // ❌ Property doesn't exist
};

// Option A: Add to interface (if production supports it)
export interface GitHubRepository {
  defaultBranch?: string;
}

// Option B: Remove from mocks (if not needed)
const mockFork: GitHubRepository = {
  // Remove defaultBranch property
};
```

**Error 2: Mock function signatures (3 occurrences)**
```typescript
// Current (ERROR):
vi.mocked(ipc.invoke).mockImplementation(async (channel: string) => {
  // ❌ Type mismatch: expects (...args) not (channel)
});

// Fixed:
vi.mocked(ipc.invoke).mockImplementation(async (...args: any[]) => {
  const [channel] = args;
  if (channel === 'github:fork-repository') return mockFork;
});
```

**Error 3: Unused variable (1 occurrence)**
```typescript
// Current (WARNING):
const mockContribution = { ... }; // ❌ Never used

// Fixed: Remove it
```

#### Change Set 3: Verify Coverage
**Files:** All test files
**Current State:** Cannot measure (10 tests failing)
**Target State:** ≥80% coverage verified

**Implementation:**
```bash
npm run test:coverage
# Expected: Overall coverage ≥80%
# If below 80%, identify uncovered files and add tests
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Fix RepositoryFileTree.test.tsx (1-2 hours)

**Step 1.1: Analyze Current File Structure**
- [ ] Read entire RepositoryFileTree.test.tsx
- [ ] Identify all 10 test functions using `require()`
- [ ] Document current mock patterns
- [ ] Verify test expectations are correct

**Step 1.2: Add Hoisted Mock**
- [ ] Add `vi.mock('../../renderer/ipc/client')` at file top
- [ ] Add `import { ipc }` AFTER mock declaration
- [ ] Keep all other imports unchanged

**Step 1.3: Remove Dynamic Requires**
- [ ] Remove `const { ipc } = require(...)` from test 1
- [ ] Remove `const { ipc } = require(...)` from test 2
- [ ] Remove from all 10 tests (systematic approach)
- [ ] Keep `vi.mocked(ipc.invoke)` calls intact

**Step 1.4: Verify Each Test**
- [ ] Run tests after every 2-3 test fixes
- [ ] Verify no new failures introduced
- [ ] Check error messages if any fail
- [ ] Iterate until all 10 pass

### Phase 2: Fix TypeScript Test Errors (30-60 min)

**Step 2.1: Decide on defaultBranch Approach**
- [ ] Check if GitHubRepository in production has defaultBranch
- [ ] If YES: Add `defaultBranch?: string` to interface
- [ ] If NO: Remove from all test mocks (7 locations)

**Step 2.2: Fix Mock Function Signatures**
- [ ] Change `(channel: string)` to `(...args: any[])`
- [ ] Update function body to use `const [channel] = args`
- [ ] Fix all 3 occurrences
- [ ] Run `npx tsc --noEmit` to verify

**Step 2.3: Remove Unused Variables**
- [ ] Remove `mockContribution` declaration
- [ ] Run `npx tsc --noEmit` to verify 0 errors

### Phase 3: Verify All Tests Pass (15 min)

**Step 3.1: Run Full Test Suite**
- [ ] Clear vitest cache: `rm -rf node_modules/.vite`
- [ ] Run `npm run test:run`
- [ ] Verify 47/47 tests passing
- [ ] Check for any flaky tests (run 2-3 times)

**Step 3.2: Check Individual Test Files**
- [ ] Verify 6/6 test files discovered
- [ ] Verify no "No test suite found" errors
- [ ] Document any remaining issues

### Phase 4: Verify Coverage (15-30 min)

**Step 4.1: Run Coverage Report**
- [ ] Run `npm run test:coverage`
- [ ] Check overall coverage percentage
- [ ] Identify files below 80% threshold
- [ ] Verify critical files have good coverage

**Step 4.2: Document Coverage Results**
- [ ] Create coverage summary table
- [ ] Highlight any low-coverage areas
- [ ] Recommend follow-up work if needed
- [ ] Accept if overall ≥80%

### Phase 5: JUNO Re-Audit (15 min)

**Step 5.1: Launch JUNO Audit**
- [ ] Execute JUNO audit
- [ ] Verify 100/100 score
- [ ] Review all phase completions
- [ ] Check for any warnings

**Step 5.2: If Not 100%, Iterate**
- [ ] Identify remaining gaps
- [ ] Fix issues
- [ ] Re-audit
- [ ] Repeat until 100/100 achieved

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TEST-INFRASTRUCTURE-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - 95% → 100% achievement
2. **RepositoryFileTree.test.tsx Refactoring** - Before/after patterns
3. **TypeScript Error Fixes** - All 11 errors resolved
4. **Test Results** - 47/47 passing evidence
5. **Coverage Report** - ≥80% verification with details
6. **JUNO Score** - 100/100 achievement proof
7. **Next Steps** - Recommendations for maintenance

### Evidence to Provide
- Test output showing 47/47 passing
- Coverage report showing ≥80% (with file-level breakdown)
- TypeScript compilation 0 errors (ALL files, including tests)
- JUNO audit showing 100/100
- Before/after code samples for RepositoryFileTree.test.tsx

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `TEST-INFRASTRUCTURE-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit report generated (100/100 score)
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-002.4-test-infrastructure-complete.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-002.4-test-infrastructure-complete.md`
   - [ ] Completion report exists in: `trinity/reports/TEST-INFRASTRUCTURE-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit exists in: `trinity/reports/WO-MIGRATE-002.4-FINAL-AUDIT-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report → `trinity/archive/reports/YYYY-MM-DD/`
- JUNO reports → `trinity/archive/reports/YYYY-MM-DD/`
- Session summary → `trinity/archive/sessions/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 47 tests passing (100% pass rate)
- [ ] All 6 test files discovered by Vitest
- [ ] Test coverage ≥80% verified
- [ ] TypeScript compilation 0 errors (including ALL test files)
- [ ] JUNO audit score: 100/100
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
- [ ] **Any git operation that modifies repository state**

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Test thoroughly in local environment
3. Report completion to LUKA with summary of changes
4. LUKA will handle ALL git operations (add, commit, push, etc.)

### Do NOT:
- [ ] Change test logic or expectations
- [ ] Skip any failing tests
- [ ] Accept coverage below 80%
- [ ] Simplify tests to make them pass
- [ ] Skip JUNO audit

### DO:
- [ ] Follow established test patterns from passing tests
- [ ] Verify each change incrementally
- [ ] Run tests frequently during refactoring
- [ ] Document any unexpected issues
- [ ] Iterate with JUNO until 100%

---

## ROLLBACK STRATEGY

If issues arise:
1. **RepositoryFileTree.test.tsx broken:** Revert to WO-002.3 state
2. **TypeScript errors introduced:** Revert interface changes
3. **Tests regress:** Restore from last passing state

**Rollback Commands:**
```bash
# Revert specific file
git checkout HEAD -- src/__tests__/components/RepositoryFileTree.test.tsx

# Revert all test changes
git checkout HEAD -- src/__tests__/
```

**Critical Files Backup:**
- src/__tests__/components/RepositoryFileTree.test.tsx
- src/__tests__/hooks/useContributionWorkflow.test.ts
- src/main/ipc/channels.ts

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit WO-MIGRATE-002.3

**Key Findings:**
- 10/47 tests failing in RepositoryFileTree.test.tsx (21.3%)
- Root cause: Dynamic `require()` inside test functions bypasses vi.mock() hoisting
- 11 TypeScript errors in useContributionWorkflow.test.ts
- 95/100 JUNO score achieved (5% from perfect)

**Root Causes Being Fixed:**
1. Dynamic require() anti-pattern in RepositoryFileTree.test.tsx
2. Missing defaultBranch property in GitHubRepository interface OR unnecessary in mocks
3. Mock function type signature mismatches
4. Unused mock variables

**Expected Impact:**
- JUNO score: 95% → 100%
- Test pass rate: 78.7% (37/47) → 100% (47/47)
- Test coverage: UNKNOWN → ≥80% verified
- Production confidence: HIGH → VERY HIGH

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** FOCUSED (1 file refactor + TypeScript fixes)
**Completeness Required:** 100% - Perfect JUNO score is the goal
**Risk Level:** MEDIUM
**Risk Factors:**
- Refactoring tests can break existing functionality
- Type changes might affect production code
- Must maintain 100% pass rate throughout

**Mitigation:**
- Test each change immediately after making it
- Keep changes small and incremental
- Verify no regressions after each test fix
- Run full test suite frequently (after every 2-3 changes)
- Document any unexpected behavior

---

## EXPECTED OUTCOME

### Final State
- ✅ 47/47 tests passing (100%)
- ✅ 6/6 test files discovered
- ✅ Test coverage ≥80%
- ✅ TypeScript: 0 errors (production + tests)
- ✅ JUNO score: 100/100

### Evidence of Completion
```bash
# All tests passing
npm run test:run
# Test Files:  6 passed (6)
# Tests:       47 passed (47)

# TypeScript clean
npx tsc --noEmit
# No errors

# Coverage verified
npm run test:coverage
# All Files: 82.45% (or higher)

# JUNO perfect score
/trinity-orchestrate @WO-MIGRATE-002.4
# JUNO: 100/100 ✅
```

---

**Remember:** This is the final push to 100/100. Focus on systematic refactoring, test frequently, verify incrementally. The goal is perfection - take the time needed to achieve it. Report all changes to LUKA for git operations.
