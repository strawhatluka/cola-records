# Work Order: WO-TEST-FIX-001

**Title:** Fix Terminal Store Session Creation Regressions
**Type:** Investigation + Implementation
**Priority:** High (REGRESSION)
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 2-3 hours

---

## Mission Objective

Fix 10 terminal panel tests failing due to `useTerminalStore.createSession()` not properly adding sessions to the Map. Tests show "expected 1 to be 3" errors indicating sessions aren't being created. This is a REGRESSION from recent KIL Agent changes.

---

## Context

### Current State
- **Passing Tests:** 467 (down from 475 before KIL Agent changes)
- **Skipped Tests:** 8
- **Failing Tests:** ~25 remaining
- **Regression Impact:** 10 TerminalPanel tests broke after recent fixes

### Error Pattern
```
Error: expected 1 to be 3 // Object.is equality
- Expected: 3
+ Received: 1
```

Tests expect multiple sessions but only 1 session exists (the initial session).

### Root Cause Analysis Needed
Previous KIL Agent 2 modified `useTerminalStore.ts` with the following logic:
```typescript
createSession: (cwd: string) => {
  const isFirstSession = newSessions.size === 0;
  // Only set as active if first session
  isActive: isFirstSession,
  activeSessionId: isFirstSession ? sessionId : state.activeSessionId,
}
```

**Hypothesis:** The `isFirstSession` check may be preventing subsequent sessions from being added to the Map.

---

## Affected Tests (10 Total)

### TerminalPanel.test.tsx
1. ✗ should create new terminal when new button is clicked
2. ✗ should switch between terminal sessions
3. ✗ should close terminal tab
4. ✗ should show only active terminal content
5. ✗ should clear terminal when clear button is clicked
6. ✗ should restart terminal when restart button is clicked
7. ✗ should have role="tab" for terminal tabs
8. ✗ should set aria-selected on active tab
9. ✗ should highlight active tab
10. ✗ should show working directory in tab title

---

## Implementation Plan

### Phase 1: Investigation (30 minutes)
**Objective:** Identify exact cause of session creation failure

**Tasks:**
1. Read current `useTerminalStore.ts` implementation
2. Compare with git history to see what changed
3. Read failing test at line numbers in test-results.txt
4. Verify the store state during test execution
5. Identify if issue is:
   - Sessions not being added to Map
   - Sessions being added but count not updating
   - IPC mock not being called
   - Store selector not re-rendering

**Deliverable:** Root cause documented in findings section

---

### Phase 2: Fix Implementation (60 minutes)
**Objective:** Restore session creation functionality

**Approach A: If sessions aren't being added to Map**
```typescript
// Fix: Ensure newSessions includes new session
const newSessions = new Map(state.sessions);
newSessions.set(sessionId, {
  id: sessionId,
  cwd,
  isActive: isFirstSession,
});

set({ sessions: newSessions });
```

**Approach B: If IPC mock issue**
- Verify `terminal:spawn` IPC call is mocked in tests
- Ensure mock returns sessionId that store expects

**Approach C: If state update issue**
- Check if Zustand set() is called correctly
- Verify no race conditions in async IPC calls

**BAS Quality Gates:**
- ✓ Phase 1: Linting (ESLint auto-fix)
- ✓ Phase 2: Structure validation
- ✓ Phase 3: Build validation (`npm run build`)
- ✓ Phase 4: Testing (all 10 tests pass)
- ✓ Phase 5: Coverage check
- ✓ Phase 6: Final review

---

### Phase 3: Verification (30 minutes)
**Objective:** Ensure all 10 tests pass and no new regressions

**Tasks:**
1. Run test suite: `npm run test`
2. Verify test count increases from 467 to ~477
3. Verify no new test failures introduced
4. Check that 8 skipped tests remain skipped (Monaco/Terminal execution)
5. Document what was broken and how it was fixed

---

## Affected Files

**Store (Primary):**
- `src/renderer/stores/useTerminalStore.ts` - Session creation logic

**Tests (Validation):**
- `tests/components/ide/terminal/TerminalPanel.test.tsx` - 10 failing tests
- `tests/components/ide/terminal/TerminalPanel.comprehensive.test.tsx` - May also be affected

**Dependencies:**
- `src/renderer/ipc/client.ts` - IPC communication

---

## Acceptance Criteria

### Must Have
- [ ] All 10 TerminalPanel tests pass
- [ ] `createSession()` properly adds sessions to Map
- [ ] Session count increments correctly (1 → 2 → 3)
- [ ] No regressions in other terminal tests
- [ ] Test count reaches ~477 passing

### Should Have
- [ ] Root cause documented in findings
- [ ] Git commit shows only necessary changes
- [ ] Code comments explain the fix

### Nice to Have
- [ ] Additional tests to prevent future regressions
- [ ] Performance check for session creation

---

## Testing Strategy

### Unit Tests
```bash
npm run test -- tests/components/ide/terminal/TerminalPanel.test.tsx
```

**Expected Output:**
```
✓ should create new terminal when new button is clicked
✓ should switch between terminal sessions
✓ should close terminal tab
✓ should show only active terminal content
✓ should clear terminal when clear button is clicked
✓ should restart terminal when restart button is clicked
✓ should have role="tab" for terminal tabs
✓ should set aria-selected on active tab
✓ should highlight active tab
✓ should show working directory in tab title

Tests:  10 passed, 10 total
```

### Integration Verification
```bash
npm run test
```

**Expected Output:**
```
Tests:  477 passed (10 more), 8 skipped, 477 total
```

---

## Risk Assessment

### High Risk
- **Zustand state management complexity** - Easy to introduce subtle bugs
- **Multiple session interactions** - Close, switch, create order matters

### Medium Risk
- **IPC mock timing** - Async operations may need proper awaiting

### Low Risk
- **Component rendering** - Tests already verify component behavior

### Mitigation
- Keep changes minimal and focused
- Test each change incrementally
- Verify git diff before committing

---

## Success Metrics

**Before:** 467 passing, 10 terminal tests failing
**After:** 477+ passing, 0 terminal panel regressions

**Quality:** All BAS gates pass
**Timeline:** Complete within 2-3 hours

---

## Related Work Orders

- **Follows:** WO-KIL-AGENT-2 (introduced regression)
- **Blocks:** None
- **Related:** WO-TEST-FIX-002 (Terminal IPC signatures), WO-TEST-FIX-003 (Monaco performance)

---

## Notes

### Investigation Findings
*(To be filled during Phase 1)*

### Implementation Notes
*(To be filled during Phase 2)*

### Lessons Learned
*(To be filled after completion)*

---

## After Completion

1. **Update session notes:** Document what broke and why
2. **Run BAS validation:** Ensure all 6 quality gates pass
3. **Create follow-up:** If root cause reveals systemic issues
4. **Update test count:** Record new baseline (477 passing)
5. **Archive work order:** Move to `trinity/work-orders/completed/`

---

**Status Updates:**

- [ ] Phase 1: Investigation - Not Started
- [ ] Phase 2: Implementation - Not Started
- [ ] Phase 3: Verification - Not Started
- [ ] BAS Quality Gate - Not Started
- [ ] Work Order Complete - Not Started
