# Work Order: WO-TEST-FIX-001-COMPLETE

**Title:** Complete Terminal Store Session Creation Tests
**Type:** Implementation (Test Fix)
**Priority:** High (REGRESSION)
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 30 minutes

---

## Mission Objective

Apply comprehensive test pattern to fix 10 TerminalPanel tests failing due to vi.spyOn() persistence and IPC mock issues. Tests pass individually but fail when run together due to mock contamination.

---

## Context

### Current State
- **Passing Tests:** 467 baseline + 9 from other work orders = 476
- **Failing Tests:** 10 TerminalPanel tests (tests 5-16)
- **Root Cause:** Test 4 mocks createSession() without restore, breaking all subsequent tests

### Error Pattern
```
Error: expected 0 to be 1 // Object.is equality

DOM shows: "No terminal sessions"
Expected: Terminal session created and rendered
```

### Why Tests Fail
1. **Test 4** (line 104-112) uses `vi.spyOn()` to mock `createSession()`:
   ```typescript
   vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(() => '');
   ```
2. This spy **persists across all subsequent tests** (not restored)
3. Tests 1-4 pass (run BEFORE the spy is set)
4. Tests 5-16 fail (run AFTER the spy, so createSession returns empty string)

### Additional Issue
The test file mocks `window.electronAPI` in `beforeEach`, but the store imports from `@renderer/ipc/client` which reads window at runtime. This timing issue causes sessions not to be created properly.

---

## Investigation Findings

**Tests That Pass (4):**
1. ✓ should create initial terminal session on mount (runs first, works)
2. ✓ should render terminal tab (runs second, works)
3. ✓ should render new terminal button (runs third, works)
4. ✓ should show empty state when no sessions exist (SETS THE SPY)

**Tests That Fail (10):**
5. ✗ should create new terminal when new button is clicked (spy active)
6. ✗ should switch between terminal sessions (spy active)
7. ✗ should close terminal tab (spy active)
8. ✗ should show only active terminal content (spy active)
9. ✗ should clear terminal when clear button is clicked (spy active)
10. ✗ should restart terminal when restart button is clicked (spy active)
11. ✗ should have role="tab" for terminal tabs (spy active)
12. ✗ should set aria-selected on active tab (spy active)
13. ✗ should highlight active tab (spy active)
14. ✗ should show working directory in tab title (spy active)

---

## Implementation Plan

### Phase 1: Apply Comprehensive Test Pattern (20 minutes)

**Task 1: Add vi.hoisted() IPC Mock**

Add BEFORE all vi.mock() calls (after imports, line 6):

```typescript
// Mock IPC - using vi.hoisted() to avoid TDZ violations
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));
```

**Task 2: Update beforeEach Hook**

Replace the beforeEach (lines 50-79) with:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks(); // ADD THIS - Restores all spies before each test

  // Reset IPC mock to return resolved promise
  mockInvoke.mockResolvedValue(undefined);

  // Mock matchMedia for xterm.js
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Reset store state
  useTerminalStore.setState({
    sessions: new Map(),
    activeSessionId: null,
  });
});
```

**Task 3: Remove afterEach Hook (OPTIONAL)**

The comprehensive test doesn't have afterEach cleanup. Remove lines 82-87 if tests still fail:

```typescript
afterEach(() => {
  const { sessions } = useTerminalStore.getState();
  sessions.forEach((_, id) => {
    useTerminalStore.getState().closeSession(id);
  });
});
```

**Rationale:** Calling `closeSession()` triggers IPC calls which may interfere with test cleanup.

---

### Phase 2: Verification (10 minutes)

**Tasks:**
1. Run TerminalPanel tests: `npm test -- tests/components/ide/terminal/TerminalPanel.test.tsx`
2. Verify all 16 tests pass
3. Verify no test interference (tests pass together AND individually)
4. Update test count baseline

**Expected Output:**
```
✓ should create initial terminal session on mount
✓ should render terminal tab
✓ should render new terminal button
✓ should show empty state when no sessions exist
✓ should create new terminal when new button is clicked
✓ should switch between terminal sessions
✓ should close terminal tab
✓ should show only active terminal content
✓ should clear terminal when clear button is clicked
✓ should restart terminal when restart button is clicked
✓ should have role="tab" for terminal tabs
✓ should set aria-selected on active tab
✓ should have aria-label on buttons
✓ should highlight active tab
✓ should show working directory in tab title
✓ should use provided defaultCwd

Tests:  16 passed, 16 total
```

---

## Affected Files

**Tests (Primary):**
- `tests/components/ide/terminal/TerminalPanel.test.tsx` - Add IPC mock, update beforeEach, optionally remove afterEach

**Reference (Read-only):**
- `tests/components/ide/terminal/TerminalPanel.comprehensive.test.tsx` - Working pattern to copy from

---

## Acceptance Criteria

### Must Have
- [ ] All 16 TerminalPanel tests pass
- [ ] Tests pass when run together (no interference)
- [ ] Tests pass when run individually
- [ ] Test count increases from 476 to 486 passing

### Should Have
- [ ] IPC mock uses vi.hoisted() pattern (matches comprehensive test)
- [ ] beforeEach includes vi.restoreAllMocks()
- [ ] No lingering spies between tests

### Nice to Have
- [ ] Document why vi.hoisted() is necessary (TDZ violations)
- [ ] Add comment explaining spy.mockRestore() if keeping test 4's spy

---

## Testing Strategy

### Unit Tests
```bash
npm test -- tests/components/ide/terminal/TerminalPanel.test.tsx
```

**Verification Steps:**
1. Run all 16 tests together → All pass
2. Run test 4 individually → Passes
3. Run test 5 individually → Passes (previously failed due to spy)
4. Run tests 4+5 together → Both pass (no interference)

---

## Risk Assessment

### Low Risk
- **Simple pattern application** - Copy from working comprehensive test
- **Well-understood issue** - Root cause clearly identified
- **No production code changes** - Only test file modifications

### Mitigation
- Comprehensive test already proves the pattern works
- Changes are isolated to test file
- Easy to revert if needed

---

## Success Metrics

**Before:** 476 passing, 10 TerminalPanel tests failing
**After:** 486 passing, 0 TerminalPanel test failures

**Quality:** All tests pass together and individually
**Timeline:** Complete within 30 minutes

---

## Implementation Diff

### Before (Broken):
```typescript
// Line 36-45: Mock in beforeEach (WRONG - timing issue)
beforeEach(() => {
  vi.clearAllMocks();

  // Mock electronAPI
  global.window = global.window || ({} as any);
  (global.window as any).electronAPI = {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()),
  };
  // ...
});

// Line 104-112: Spy not restored (CAUSES REGRESSION)
it('should show empty state when no sessions exist', () => {
  vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(() => '');
  // ... assertions ...
  // SPY PERSISTS!
});
```

### After (Fixed):
```typescript
// Lines 6-17: IPC mock with vi.hoisted() (CORRECT)
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));

// Updated beforeEach
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks(); // ADDED - Restores spies

  mockInvoke.mockResolvedValue(undefined); // ADDED - Reset mock
  // ... rest of setup (no window.electronAPI mock)
});

// Test 4 - spy auto-restored by vi.restoreAllMocks()
it('should show empty state when no sessions exist', () => {
  vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(() => '');
  // ... assertions ...
  // Spy automatically restored before next test!
});
```

---

## Related Work Orders

- **Follows:** WO-TEST-FIX-002 (Terminal IPC signatures) - Superseded by WO-TEST-FIX-005
- **Follows:** WO-TEST-FIX-003 (Monaco performance) - Complete (+8 tests)
- **Follows:** WO-TEST-FIX-004 (FileTreeNode style) - Complete (+1 test)
- **Follows:** WO-TEST-FIX-005 (Terminal execution) - Complete (6 skipped with docs)
- **Blocks:** Final test count verification (should reach 486 passing)

---

## Notes

### Why vi.hoisted() is Required

Vitest hoists `vi.mock()` calls to the top of the file before imports. When you reference a variable inside `vi.mock()`, you get a Temporal Dead Zone (TDZ) error:

```typescript
// BROKEN:
const mockInvoke = vi.fn();
vi.mock('@renderer/ipc/client', () => ({
  ipc: { invoke: mockInvoke } // ReferenceError: Cannot access before initialization
}));
```

**Solution:** Use `vi.hoisted()` to hoist the variable declaration too:

```typescript
// FIXED:
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock('@renderer/ipc/client', () => ({
  ipc: { invoke: mockInvoke } // ✓ Works! Variable hoisted before mock
}));
```

### Why vi.restoreAllMocks() is Required

`vi.spyOn()` replaces a method but persists across tests unless restored:

```typescript
it('test 1', () => {
  vi.spyOn(obj, 'method').mockImplementation(() => 'fake');
  // Spy stays active!
});

it('test 2', () => {
  obj.method(); // Still returns 'fake' instead of real implementation
});
```

**Solution:** Add `vi.restoreAllMocks()` in `beforeEach()` to auto-restore all spies.

---

## After Completion

1. Update test count baseline: 486 passing
2. Run full test suite to verify no regressions
3. Document pattern in knowledge base for future test files
4. Archive work order
5. Celebrate fixing all test regressions! 🎉

---

**Status Updates:**

- [ ] Phase 1: Apply Comprehensive Test Pattern - Not Started
- [ ] Phase 2: Verification - Not Started
- [ ] All 16 tests passing - Not Started
- [ ] Work Order Complete - Not Started
