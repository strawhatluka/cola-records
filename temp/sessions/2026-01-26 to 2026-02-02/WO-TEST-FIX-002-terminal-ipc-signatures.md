# Work Order: WO-TEST-FIX-002

**Title:** Fix Terminal IPC Signature Regressions
**Type:** Implementation (Test Updates)
**Priority:** High (REGRESSION)
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 1-2 hours

---

## Mission Objective

Fix 6 terminal tests failing due to IPC signature changes. Tests expect `terminal:spawn({cwd: "/test/repo"})` but implementation now uses `terminal:spawn(sessionId, "/test/repo")`. This is a REGRESSION from recent code changes that modified the IPC call pattern.

---

## Context

### Current State
- **Passing Tests:** 467
- **Failing Tests:** 6 terminal execution integration tests
- **Root Cause:** IPC signature mismatch between tests and implementation

### Error Pattern
```
Expected IPC call: terminal:spawn({cwd: "/test/repo"})
Actual IPC call: terminal:spawn(sessionId, "/test/repo")
```

### When This Changed
Recent modifications to `useTerminalStore.ts` changed how terminal sessions are created, requiring a `sessionId` parameter to be passed first.

---

## Affected Tests (6 Total)

### tests/integration/terminal-execution.test.tsx
1. ✗ should execute command and capture output
2. ✗ should handle command with error output
3. ✗ should handle interactive prompts (y/n)
4. ✗ should handle Ctrl+C to cancel running process
5. ✗ should preserve command history and allow navigation
6. ✗ should handle tab completion

---

## Implementation Plan

### Phase 1: Understand Current IPC Signature (15 minutes)

**Tasks:**
1. Read `src/renderer/stores/useTerminalStore.ts` to see how `terminal:spawn` is called
2. Identify the exact parameters: `(sessionId: string, cwd: string)`
3. Document the change from old signature to new signature

**Deliverable:** Clear documentation of IPC signature change

---

### Phase 2: Update Test Mocks (30 minutes)

**Approach:**
Update all 6 tests to expect the correct IPC call signature:

```typescript
// BEFORE (broken):
vi.mocked(ipc.invoke).mockResolvedValueOnce(undefined);
// Test expects: terminal:spawn({cwd: "/test/repo"})

// AFTER (fixed):
vi.mocked(ipc.invoke).mockImplementation(async (channel, ...args) => {
  if (channel === 'terminal:spawn') {
    const [sessionId, cwd] = args;
    // Handle with correct parameters
    return undefined;
  }
});
```

**Files to Modify:**
- `tests/integration/terminal-execution.test.tsx`

**BAS Quality Gates:**
- ✓ Phase 1: Linting
- ✓ Phase 2: Structure validation
- ✓ Phase 3: Build validation
- ✓ Phase 4: Testing (6 tests pass)
- ✓ Phase 5: Coverage check
- ✓ Phase 6: Final review

---

### Phase 3: Verification (15 minutes)

**Tasks:**
1. Run terminal execution tests: `npm run test -- terminal-execution.test.tsx`
2. Verify all 6 tests pass
3. Verify no regressions in other terminal tests
4. Update test count baseline

---

## Affected Files

**Tests (Primary):**
- `tests/integration/terminal-execution.test.tsx` - All 6 test mocks need updating

**Reference (Read-only):**
- `src/renderer/stores/useTerminalStore.ts` - To verify IPC signature

---

## Acceptance Criteria

### Must Have
- [ ] All 6 terminal execution tests pass
- [ ] IPC mocks use correct signature: `terminal:spawn(sessionId, cwd)`
- [ ] No regressions in other tests
- [ ] Test count increases by 6

### Should Have
- [ ] Clear comments explaining IPC signature
- [ ] Consistent mock pattern across all 6 tests

### Nice to Have
- [ ] Helper function to reduce mock duplication
- [ ] Type-safe IPC mocking pattern

---

## Testing Strategy

### Unit Tests
```bash
npm run test -- tests/integration/terminal-execution.test.tsx
```

**Expected Output:**
```
✓ should execute command and capture output
✓ should handle command with error output
✓ should handle interactive prompts (y/n)
✓ should handle Ctrl+C to cancel running process
✓ should preserve command history and allow navigation
✓ should handle tab completion

Tests:  6 passed, 6 total
```

### Integration Verification
```bash
npm run test
```

**Expected Output:**
```
Tests:  473+ passing (6 more), 473 total
```

---

## Risk Assessment

### Low Risk
- **Simple test updates** - Only changing mock expectations
- **No production code changes** - Tests adapt to existing implementation

### Mitigation
- Verify IPC signature before making changes
- Test incrementally (one test at a time if needed)

---

## Success Metrics

**Before:** 467 passing, 6 terminal execution tests failing
**After:** 473+ passing, 0 terminal execution regressions

**Quality:** All BAS gates pass
**Timeline:** Complete within 1-2 hours

---

## Related Work Orders

- **Depends On:** None (can run in parallel with WO-TEST-FIX-001)
- **Blocks:** None
- **Related:** WO-TEST-FIX-001 (Terminal store), WO-TEST-FIX-003 (Monaco)

---

## Notes

### Implementation Notes
The IPC signature change was necessary to support multiple terminal sessions. Each session needs a unique ID for proper routing.

---

## After Completion

1. Update test count baseline
2. Document IPC signature in codebase comments
3. Run BAS validation
4. Archive work order

---

**Status Updates:**

- [ ] Phase 1: Understand IPC Signature - Not Started
- [ ] Phase 2: Update Test Mocks - Not Started
- [ ] Phase 3: Verification - Not Started
- [ ] BAS Quality Gate - Not Started
- [ ] Work Order Complete - Not Started
