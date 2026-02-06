# ORCHESTRATOR WORK ORDER #MIGRATE-002.3
## Type: IMPLEMENTATION
## Test Infrastructure Remediation - Achieve 100% JUNO Score

---

## MISSION OBJECTIVE

Fix test infrastructure to achieve 100/100 JUNO score by resolving Vitest module resolution failures and TypeScript test errors. This is the final 17% of WO-MIGRATE-002.1 completion.

**Implementation Goal:** All 46 tests passing with ≥80% coverage
**Based On:** JUNO Audit WO-MIGRATE-002.2-RE-AUDIT-20260125.md (identified test infrastructure as blocking 100% completion)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/__tests__/setup.ts
    changes: Fix IPC client module mocking
    risk: MEDIUM

  - path: src/__tests__/hooks/useContributionWorkflow.test.ts
    changes: Fix TypeScript errors (11 errors)
    risk: LOW

  - path: src/main/ipc/channels.ts
    changes: Add openIssues property to GitHubRepository interface
    risk: LOW

Supporting_Files:
  - vitest.config.ts - Verify configuration
  - package.json - Verify test scripts
```

### Changes Required

#### Change Set 1: Fix Vitest Module Resolution
**Files:** src/__tests__/setup.ts
**Current State:** All 6 test files fail with "No test suite found in file"
**Target State:** Vitest successfully loads and discovers all test suites
**Root Cause:** IPC client module cannot be imported during test initialization

**Implementation Options:**

**Option A: Hoist vi.mock() calls**
```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// MUST be at top level, BEFORE any imports that use IPC
vi.mock('../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => () => {}),
  },
}));
```

**Option B: Use __mocks__ directory**
```
src/
  __mocks__/
    renderer/
      ipc/
        client.ts  <- Manual mock file
```

**Option C: Fix actual IPC client to not crash in test env**
```typescript
// src/renderer/ipc/client.ts
// Add defensive check
if (typeof window === 'undefined' || !window.electronAPI) {
  // Return mock in test environment
}
```

#### Change Set 2: Fix TypeScript Test Errors
**Files:** src/__tests__/hooks/useContributionWorkflow.test.ts, src/main/ipc/channels.ts
**Current State:** 11 TypeScript errors in test file
**Target State:** 0 TypeScript errors

**Errors to Fix:**

1. **Missing openIssues property (7 occurrences)**
```typescript
// src/main/ipc/channels.ts
export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues?: number;  // ADD THIS
}
```

2. **Mock function signature mismatch (3 occurrences)**
```typescript
// Lines 170, 395, 437 - Current (WRONG):
vi.mocked(ipc.invoke).mockImplementation(async (channel: string) => {

// Fixed:
vi.mocked(ipc.invoke).mockImplementation(async (...args: any[]) => {
  const [channel] = args;  // Extract channel from args
```

3. **Unused variable (1 occurrence)**
```typescript
// Line 99 - Remove this:
const mockContribution = { ... };  // Never used
```

#### Change Set 3: Verify Test Coverage
**Files:** All test files
**Current State:** Cannot measure (tests don't run)
**Target State:** ≥80% coverage verified

**Implementation:**
```bash
# After fixes, run:
npm run test:run        # Verify all tests pass
npm run test:coverage   # Verify ≥80% coverage
```

---

## IMPLEMENTATION APPROACH

### Step 1: Investigate Root Cause (30 min)
- [ ] Read vitest.config.ts to understand current setup
- [ ] Check if __mocks__ directory approach is already used
- [ ] Determine why IPC client import fails
- [ ] Decide on fix approach (Option A, B, or C)

### Step 2: Fix Test Module Resolution (1 hour)
- [ ] Implement chosen fix approach
- [ ] Clear vitest cache: `rm -rf node_modules/.vite`
- [ ] Run tests: `npm run test:run`
- [ ] Verify test discovery works (6/6 test files loaded)
- [ ] Document which approach worked

### Step 3: Fix TypeScript Errors (30 min)
- [ ] Add `openIssues?: number` to GitHubRepository interface
- [ ] Fix all 3 mock function signatures to use `...args: any[]`
- [ ] Remove unused `mockContribution` variable
- [ ] Run `npx tsc --noEmit` to verify 0 errors

### Step 4: Verify All Tests Pass (15 min)
- [ ] Run `npm run test:run`
- [ ] Verify 46/46 tests passing
- [ ] Check for any flaky tests
- [ ] Document any remaining failures

### Step 5: Verify Coverage (15 min)
- [ ] Run `npm run test:coverage`
- [ ] Verify overall coverage ≥80%
- [ ] Check if any critical files have low coverage
- [ ] Document coverage results

### Step 6: JUNO Re-Audit (15 min)
- [ ] Launch JUNO audit
- [ ] Verify 100/100 score
- [ ] If not 100%, identify remaining gaps
- [ ] Iterate until 100% achieved

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TEST-INFRASTRUCTURE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Test infrastructure fix summary
2. **Root Cause Analysis** - Why tests were failing
3. **Fix Implementation** - Which approach was used and why
4. **Test Results** - All tests passing evidence
5. **Coverage Report** - ≥80% coverage verification
6. **JUNO Score** - 100/100 achievement
7. **Next Steps** - Any follow-up work

### Evidence to Provide
- Test output showing 46/46 passing
- Coverage report showing ≥80%
- TypeScript compilation 0 errors (including tests)
- JUNO audit showing 100/100
- Before/after comparison

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `TEST-INFRASTRUCTURE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit report generated (100/100 score)
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-002.3-test-infrastructure-fix.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-002.3-test-infrastructure-fix.md`
   - [ ] Completion report exists in: `trinity/reports/TEST-INFRASTRUCTURE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit exists in: `trinity/reports/WO-MIGRATE-002.3-FINAL-AUDIT-[TIMESTAMP].md`
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
- [ ] All 6 test files successfully discovered by Vitest
- [ ] All 46 tests passing (0 failures)
- [ ] Test coverage ≥80%
- [ ] TypeScript compilation 0 errors (including test files)
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
- [ ] Modify production code (only test files and interfaces)
- [ ] Skip test verification steps
- [ ] Accept test failures as "acceptable"
- [ ] Simplify or reduce test coverage
- [ ] Skip JUNO audit

### DO:
- [ ] Fix test infrastructure completely
- [ ] Verify every test passes
- [ ] Measure and document coverage
- [ ] Iterate with JUNO until 100%
- [ ] Document root cause thoroughly

---

## ROLLBACK STRATEGY

If issues arise:
1. **Test setup broken:** Revert src/__tests__/setup.ts
2. **Interface change breaks production:** Revert src/main/ipc/channels.ts
3. **Complete rollback:** Restore from WO-002.2 completion state

**Critical Files Backup:**
- src/__tests__/setup.ts
- src/main/ipc/channels.ts
- All test files in src/__tests__/

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit WO-MIGRATE-002.2-RE-AUDIT-20260125.md

**Key Findings:**
- Test infrastructure completely broken since WO-002.1
- "No test suite found" error indicates module import failure
- 11 TypeScript errors in test files
- Cannot verify claimed 82.45% coverage from previous session

**Root Causes Being Fixed:**
1. IPC client module resolution failure in test environment
2. Missing `openIssues` property in GitHubRepository interface
3. Mock function type signatures incompatible with IPC client types
4. Unused mock variables causing compilation errors

**Expected Impact:**
- JUNO score: 83% → 100%
- Test coverage: UNKNOWN → ≥80% verified
- Production confidence: MEDIUM → HIGH
- Development velocity: BLOCKED → UNBLOCKED

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** FOCUSED
**Completeness Required:** 100% - All tests must pass, ≥80% coverage verified
**Risk Level:** MEDIUM
**Risk Factors:**
- Vitest/Electron integration is complex
- Module mocking can be fragile
- Interface changes could break production code
- Test infrastructure affects all future development

**Mitigation:**
- Try simplest fix first (hoist mocks)
- Verify production code still compiles after interface changes
- Run full test suite multiple times to check for flakes
- Document which fix approach worked for future reference

---

**Remember:** This is the final 17% to achieve 100% JUNO score. Focus on getting tests working correctly, not quickly. Verify coverage thoroughly. Iterate with JUNO until perfect score. Report all changes to LUKA for git operations.
