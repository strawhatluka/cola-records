# Work Order: WO-TEST-FIX-003

**Title:** Fix Monaco Editor Performance Test Timeouts
**Type:** Investigation + Implementation
**Priority:** Medium
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 3-4 hours

---

## Mission Objective

Fix 8 Monaco editor performance tests that timeout waiting for `.monaco-editor` element. Tests are stuck at "Loading editor..." state - Monaco initialization never completes in test environment. Requires Monaco mock infrastructure or proper async initialization.

---

## Context

### Current State
- **Passing Tests:** 467
- **Failing Tests:** 8 Monaco performance tests (all timing out at 1000ms+)
- **Root Cause:** Monaco Editor not initializing in jsdom test environment

### Error Pattern
```
Error: Timed out waiting for element: .monaco-editor
Expected: .monaco-editor element to exist
Actual: DOM shows "Loading editor..." message
```

### Technical Challenge
Monaco Editor is a complex async library that:
1. Dynamically loads web workers
2. Requires browser APIs not available in jsdom
3. Has significant initialization overhead
4. Uses canvas rendering for editor surface

---

## Affected Tests (8 Total)

### tests/performance/monaco-loading.test.tsx
1. ✗ should load Monaco editor initially in under 500ms
2. ✗ should open subsequent files in under 100ms
3. ✗ should handle large file (1MB) in under 1000ms
4. ✗ should handle rapid file switching (<50ms per switch)
5. ✗ should handle syntax highlighting for large files efficiently
6. ✗ should maintain responsive typing with IntelliSense (<100ms latency)
7. ✗ should efficiently handle multiple tabs (10+ open files)
8. ✗ should handle file save operations efficiently (<200ms)

---

## Implementation Plan

### Phase 1: Investigation (60 minutes)

**Objective:** Understand Monaco initialization and determine best fix approach

**Tasks:**
1. Read `src/renderer/components/ide/editor/MonacoEditor.tsx`
2. Identify what causes "Loading editor..." state
3. Research Monaco testing strategies:
   - Official Monaco testing docs
   - Community solutions for jsdom
   - Mock vs real Monaco in tests
4. Analyze if tests should:
   - Mock Monaco completely
   - Use real Monaco with proper setup
   - Restructure to test different aspects

**Deliverable:** Decision document on approach

**Possible Approaches:**

**Option A: Mock Monaco Editor (Fastest)**
```typescript
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: any) => (
    <div className="monaco-editor" data-testid="monaco-mock">
      <textarea value={value} onChange={(e) => onChange?.(e.target.value)} />
    </div>
  ),
  loader: { init: vi.fn() },
}));
```
- **Pros:** Simple, fast tests
- **Cons:** Not testing real Monaco behavior

**Option B: Stub Monaco Initialization (Medium)**
```typescript
// Override Monaco's beforeMount to skip async loading
const mockBeforeMount = (monaco: any) => {
  // Configure Monaco synchronously
  return monaco;
};
```
- **Pros:** Tests real component, faster init
- **Cons:** Still partial mocking

**Option C: Use Real Monaco with Patience (Slowest)**
```typescript
// Increase timeouts and wait for actual Monaco
await waitFor(() => {
  expect(screen.getByClassName('monaco-editor')).toBeInTheDocument();
}, { timeout: 5000 });
```
- **Pros:** True end-to-end testing
- **Cons:** Slow, may not work in jsdom

---

### Phase 2: Implementation (90 minutes)

**Based on Phase 1 decision, implement chosen approach**

**If Option A (Recommended):**
1. Create Monaco mock in `tests/__mocks__/@monaco-editor-react.tsx`
2. Mock exposes `.monaco-editor` class immediately
3. Mock supports basic value/onChange props
4. Update all 8 tests to work with mock

**If Option B:**
1. Create Monaco test utilities in `tests/utils/monaco.ts`
2. Stub loader.init() to resolve immediately
3. Skip worker initialization
4. Update tests to use utilities

**If Option C:**
1. Increase test timeouts to 5000ms
2. Add proper async waits in tests
3. May require `@monaco-editor/react` peer deps
4. Configure jsdom with more browser APIs

**BAS Quality Gates:**
- ✓ Phase 1: Linting
- ✓ Phase 2: Structure validation
- ✓ Phase 3: Build validation
- ✓ Phase 4: Testing (8 tests pass or properly skipped)
- ✓ Phase 5: Coverage check
- ✓ Phase 6: Final review

---

### Phase 3: Verification (30 minutes)

**Tasks:**
1. Run Monaco tests: `npm run test -- monaco-loading.test.tsx`
2. Verify tests pass within acceptable time (<1000ms each)
3. Verify tests provide meaningful assertions
4. Document approach for future reference

---

## Affected Files

**Tests (Primary):**
- `tests/performance/monaco-loading.test.tsx` - 8 performance tests

**Mocks (If Option A):**
- `tests/__mocks__/@monaco-editor-react.tsx` - New mock file

**Utilities (If Option B):**
- `tests/utils/monaco.ts` - New utility file

**Component (Reference):**
- `src/renderer/components/ide/editor/MonacoEditor.tsx` - Read to understand initialization

---

## Acceptance Criteria

### Must Have
- [ ] All 8 Monaco tests complete without timing out
- [ ] Tests run in reasonable time (<1000ms each preferred)
- [ ] Tests provide meaningful performance validation
- [ ] Solution documented for future maintenance

### Should Have
- [ ] Mock/utility is reusable for other Monaco tests
- [ ] Performance baselines established
- [ ] Clear comments explaining test strategy

### Nice to Have
- [ ] Performance metrics captured and logged
- [ ] Comparison with real Monaco performance (if mocked)
- [ ] Integration test with real Monaco (optional)

---

## Alternative: Skip Tests

**If investigation determines tests are invalid:**

Tests may be testing the wrong thing. Performance tests in a mocked environment don't reflect real-world performance.

**Consider:**
- Mark tests as `.skip` with explanation
- Document that Monaco performance should be tested in E2E environment
- Create separate smoke tests for Monaco functionality (not performance)

---

## Testing Strategy

### Performance Tests (If Mock Approach)
```bash
npm run test -- tests/performance/monaco-loading.test.tsx
```

**Expected Output:**
```
✓ should load Monaco editor initially in under 500ms (250ms)
✓ should open subsequent files in under 100ms (45ms)
✓ should handle large file (1MB) in under 1000ms (120ms)
✓ should handle rapid file switching (<50ms per switch) (30ms)
✓ should handle syntax highlighting for large files efficiently (200ms)
✓ should maintain responsive typing with IntelliSense (<100ms latency) (50ms)
✓ should efficiently handle multiple tabs (10+ open files) (180ms)
✓ should handle file save operations efficiently (<200ms) (80ms)

Tests:  8 passed, 8 total
Time:   ~1s
```

---

## Risk Assessment

### High Risk
- **Mock may not reflect reality** - Performance tests with mocks may give false confidence
- **Real Monaco may be incompatible with jsdom** - May need actual browser

### Medium Risk
- **Worker threads in tests** - Monaco uses workers which jsdom doesn't support

### Mitigation
- Document limitations of chosen approach
- Consider E2E tests for true Monaco performance validation
- Set realistic performance expectations for test environment

---

## Success Metrics

**Before:** 467 passing, 8 Monaco tests timing out
**After:** 475+ passing OR 8 tests properly skipped with documentation

**Quality:** All BAS gates pass
**Timeline:** Complete within 3-4 hours

---

## Related Work Orders

- **Independent:** Can run in parallel with WO-TEST-FIX-001 and WO-TEST-FIX-002
- **Blocks:** None
- **Follow-up:** Potential E2E Monaco performance tests in Playwright/Cypress

---

## Notes

### Decision Log
*(To be filled during Phase 1)*

### Implementation Notes
*(To be filled during Phase 2)*

---

## After Completion

1. Document Monaco testing approach in README or docs
2. Update test count baseline
3. Run BAS validation
4. Consider follow-up work order for E2E performance testing
5. Archive work order

---

**Status Updates:**

- [ ] Phase 1: Investigation & Decision - Not Started
- [ ] Phase 2: Implementation - Not Started
- [ ] Phase 3: Verification - Not Started
- [ ] BAS Quality Gate - Not Started
- [ ] Work Order Complete - Not Started
