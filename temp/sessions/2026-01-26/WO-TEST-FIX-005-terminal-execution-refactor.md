# Work Order: WO-TEST-FIX-005

**Title:** Refactor Terminal Execution Tests for Character-by-Character Input
**Type:** Investigation + Implementation (Test Refactor)
**Priority:** Medium
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 2-3 hours

---

## Mission Objective

Refactor 6 terminal execution integration tests to match the new character-by-character terminal implementation. Tests currently expect batch `terminal:input` calls but the implementation now uses individual `terminal:write` calls per character via XTermWrapper.

---

## Context

### Current State
- **Passing Tests:** 2/8 terminal execution tests (long-running process, directory navigation)
- **Failing Tests:** 6/8 tests (command execution, error output, prompts, Ctrl+C, history, tab completion)
- **Root Cause:** Terminal implementation changed from batch input to character-by-character writes

### Discovery from WO-TEST-FIX-002

KIL Agent discovered the work order identified the WRONG problem:

**Original Assumption (WO-TEST-FIX-002):**
- Tests fail due to `terminal:spawn` signature change
- Fix: Update mocks from `terminal:spawn({cwd})` to `terminal:spawn(sessionId, cwd)`

**Actual Problem:**
- `terminal:spawn` signature WAS updated (2 tests now pass)
- Real issue: Terminal input mechanism changed completely
- XTermWrapper now calls `terminal:write(sessionId, char)` for each character instead of `terminal:input(sessionId, command)`

---

## Error Pattern

### Test Expectations (OLD Implementation)
```typescript
// Test expects single batch call:
await userEvent.type(input, 'npm test{enter}');
expect(mockInvoke).toHaveBeenCalledWith('terminal:input', sessionId, 'npm test\n');
```

### Actual Implementation (NEW - XTermWrapper)
```typescript
// XTermWrapper calls terminal:write per character:
terminal:write(sessionId, 'n')
terminal:write(sessionId, 'p')
terminal:write(sessionId, 'm')
terminal:write(sessionId, ' ')
terminal:write(sessionId, 't')
// ... etc
```

**File:** `src/renderer/components/ide/terminal/XTermWrapper.tsx:86`

---

## Affected Tests (6 Total)

### tests/integration/terminal-execution.test.tsx
1. ✗ should execute command and capture output
2. ✗ should handle command with error output
3. ✗ should handle interactive prompts (y/n)
4. ✗ should handle Ctrl+C to cancel running process
5. ✗ should preserve command history and allow navigation
6. ✗ should handle tab completion

### Passing Tests (Not Affected)
- ✓ should handle long-running process with streaming output
- ✓ should navigate directories using cd command

---

## Additional Issues Identified

### Issue 1: Missing CSS Class
**Test Expectation:** `.terminal-error` CSS class for error styling
**Actual Implementation:** Class may not exist in XTermWrapper or TerminalPanel
**Impact:** 1 test (error output handling)

### Issue 2: Missing IPC Channel
**Test Expectation:** `terminal:autocomplete` IPC channel for tab completion
**Actual Implementation:** May not be implemented in main process
**Impact:** 1 test (tab completion)

---

## Implementation Plan

### Phase 1: Investigation (45 minutes)

**Tasks:**
1. Read `src/renderer/components/ide/terminal/XTermWrapper.tsx` completely
2. Identify how user input is handled (line 86 and surrounding context)
3. Search for `terminal:input` vs `terminal:write` IPC channel usage
4. Verify if `.terminal-error` CSS class exists
5. Verify if `terminal:autocomplete` IPC channel exists
6. Document the complete input flow: User types → XTermWrapper → IPC → Main process

**Deliverable:** Technical specification document of current terminal architecture

---

### Phase 2: Design Refactor Approach (30 minutes)

**Option A: Update Tests to Match Implementation (Recommended)**
- Change test assertions to expect multiple `terminal:write` calls
- Mock IPC to accumulate characters and simulate command execution
- Test the actual character-by-character flow

**Option B: Update Implementation to Support Batch Input**
- Add `terminal:input` IPC channel that accepts full commands
- Update XTermWrapper to support batch mode for testing
- Maintain backward compatibility

**Option C: Skip Tests and Document**
- Mark 6 tests as `.skip` with detailed explanation
- Document that terminal input should be tested via E2E (Playwright)
- Create lightweight smoke tests for basic terminal rendering

**Recommendation:** Option A - Update tests to match implementation

**Rationale:**
- Tests should validate actual user flow (character-by-character)
- Changing implementation for testing is anti-pattern
- E2E tests should complement, not replace unit/integration tests

---

### Phase 3: Implementation (60 minutes)

**Approach A Implementation:**

```typescript
// Helper to simulate typing character-by-character
const simulateTyping = async (input: HTMLElement, text: string) => {
  for (const char of text) {
    await userEvent.type(input, char);
    // Verify each character triggers terminal:write
  }
};

// Updated test pattern:
it('should execute command and capture output', async () => {
  const { getByRole } = render(<TerminalPanel />);
  const input = getByRole('textbox');

  // Set up mock to accumulate characters
  let commandBuffer = '';
  mockInvoke.mockImplementation(async (channel, sessionId, char) => {
    if (channel === 'terminal:write') {
      commandBuffer += char;
      if (char === '\n') {
        // Simulate command execution
        return { output: 'Command executed' };
      }
    }
  });

  await simulateTyping(input, 'npm test');
  await userEvent.keyboard('{Enter}');

  // Verify character-by-character calls
  expect(mockInvoke).toHaveBeenCalledWith('terminal:write', expect.any(String), 'n');
  expect(mockInvoke).toHaveBeenCalledWith('terminal:write', expect.any(String), 'p');
  // ... etc

  // Verify final output
  expect(screen.getByText('Command executed')).toBeInTheDocument();
});
```

**BAS Quality Gates:**
- ✓ Phase 1: Linting
- ✓ Phase 2: Structure validation
- ✓ Phase 3: Build validation
- ✓ Phase 4: Testing (6 tests pass)
- ✓ Phase 5: Coverage check
- ✓ Phase 6: Final review

---

### Phase 4: Handle Missing Features (30 minutes)

**Task 1: Error Styling**
- Search for `.terminal-error` class in codebase
- If missing: Add class to XTermWrapper or create issue for future work
- Update test to match actual error rendering

**Task 2: Tab Completion**
- Search for `terminal:autocomplete` IPC handler
- If missing: Either implement basic autocomplete OR mark test as `.skip` with TODO
- Document limitation if skipping

---

### Phase 5: Verification (15 minutes)

**Tasks:**
1. Run terminal execution tests: `npm test -- terminal-execution.test.tsx`
2. Verify 6 previously failing tests now pass (8/8 total)
3. Verify no regressions in other terminal tests
4. Update test count baseline

---

## Affected Files

**Tests (Primary):**
- `tests/integration/terminal-execution.test.tsx` - 6 tests need refactoring

**Reference (Read-only):**
- `src/renderer/components/ide/terminal/XTermWrapper.tsx` - Character-by-character input logic
- `src/renderer/components/ide/terminal/TerminalPanel.tsx` - Terminal UI and error rendering
- `src/main/ipc/handlers/terminal.ts` - IPC handlers for terminal:write vs terminal:input

**Potential New Files:**
- `tests/utils/terminal-helpers.ts` - Reusable helper functions for simulating typing

---

## Acceptance Criteria

### Must Have
- [ ] All 6 failing terminal execution tests pass OR properly skipped with documentation
- [ ] Tests validate character-by-character input flow (if Option A)
- [ ] No regressions in 2 currently passing tests
- [ ] Test count increases by 6 (473→479 if WO-001 completed first)

### Should Have
- [ ] Reusable helper functions for terminal input simulation
- [ ] Clear documentation of terminal architecture
- [ ] Consistent test patterns across all 8 tests

### Nice to Have
- [ ] Tab completion implementation (if missing)
- [ ] Error styling CSS class (if missing)
- [ ] E2E test recommendations documented

---

## Testing Strategy

### Unit Tests
```bash
npm test -- tests/integration/terminal-execution.test.tsx
```

**Expected Output:**
```
✓ should execute command and capture output
✓ should handle command with error output
✓ should handle interactive prompts (y/n)
✓ should handle Ctrl+C to cancel running process
✓ should preserve command history and allow navigation
✓ should handle tab completion (or marked .skip)
✓ should handle long-running process with streaming output
✓ should navigate directories using cd command

Tests:  8 passed (or 7 passed, 1 skipped), 8 total
```

---

## Risk Assessment

### Medium Risk
- **Architectural Understanding** - Need deep understanding of XTermWrapper flow
- **Character-by-Character Complexity** - Tests may become verbose with many assertions

### Low Risk
- **Well-Isolated Tests** - Integration tests don't affect other test suites
- **Clear Error Messages** - Easy to debug if approach doesn't work

### Mitigation
- Thorough investigation phase before implementation
- Create helper functions to reduce test complexity
- Option C (skip tests) as fallback if implementation proves too complex

---

## Success Metrics

**Before:** 467 passing (2/8 terminal execution tests pass)
**After:** 473+ passing (8/8 terminal execution tests pass OR 7/8 with 1 skipped)

**Quality:** All BAS gates pass
**Timeline:** Complete within 2-3 hours

---

## Related Work Orders

- **Supersedes:** WO-TEST-FIX-002 (discovered actual root cause)
- **Depends On:** None (independent)
- **Blocks:** None
- **Related:** WO-TEST-FIX-001 (Terminal store sessions)

---

## Notes

### Discovery from WO-TEST-FIX-002

KIL Agent completed WO-TEST-FIX-002's stated objective (update `terminal:spawn` signature) but discovered the work order was scoped incorrectly. This work order addresses the ACTUAL issues preventing 6 tests from passing.

**Credit:** KIL Agent's investigation phase identified:
1. Character-by-character input change
2. Missing `.terminal-error` CSS class
3. Potentially missing `terminal:autocomplete` IPC channel

### Implementation Notes
*(To be filled during implementation)*

---

## After Completion

1. Update WO-TEST-FIX-002 status to "Superseded by WO-TEST-FIX-005"
2. Update test count baseline
3. Run BAS validation
4. Document terminal architecture in knowledge base
5. Archive both work orders

---

**Status Updates:**

- [ ] Phase 1: Investigation - Not Started
- [ ] Phase 2: Design Refactor Approach - Not Started
- [ ] Phase 3: Implementation - Not Started
- [ ] Phase 4: Handle Missing Features - Not Started
- [ ] Phase 5: Verification - Not Started
- [ ] BAS Quality Gate - Not Started
- [ ] Work Order Complete - Not Started
