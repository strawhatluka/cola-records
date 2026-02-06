# Work Order: WO-TEST-FIX-004

**Title:** Fix FileTreeNode Custom Style Application
**Type:** Implementation (Bug Fix)
**Priority:** Low
**Status:** Ready
**Created:** 2026-01-26
**Estimated Effort:** 30 minutes - 1 hour

---

## Mission Objective

Fix 1 test where custom `style` prop is not applied to FileTreeNode. Test expects `backgroundColor: 'red'` and `paddingLeft: 8px` but styles don't apply correctly. This is a component implementation bug affecting style prop composition.

---

## Context

### Current State
- **Passing Tests:** 467
- **Failing Tests:** 1 FileTreeNode style test
- **Impact:** Low (cosmetic issue, no functional impact)

### Error Pattern
```
Test: should apply custom style
Expected: style={{ backgroundColor: 'red', paddingLeft: '8px' }}
Actual: Custom styles not reflected in computed styles
```

### Previous Attempts
KIL Agent 1 previously tried to fix this by removing Tailwind `px-2` class that conflicted with inline `paddingLeft`. However, the test is still failing.

---

## Affected Test (1 Total)

### tests/components/ide/file-tree/FileTreeNode.test.tsx
1. ✗ should apply custom style

---

## Implementation Plan

### Phase 1: Diagnosis (15 minutes)

**Tasks:**
1. Read the failing test at line 86 in test-results.txt
2. Read `src/renderer/components/ide/file-tree/FileTreeNode.tsx`
3. Understand how `style` prop is currently handled
4. Identify why custom styles aren't applying

**Common Issues:**
- Style prop merged incorrectly (order matters)
- Tailwind classes overriding inline styles
- CSS specificity issues
- React synthetic event style timing

**Deliverable:** Root cause identified

---

### Phase 2: Fix Implementation (20 minutes)

**Current Implementation Analysis:**

The component likely has something like:
```typescript
<div
  style={{
    paddingLeft: `${depth * 16}px`,
    opacity: node.isGitIgnored ? 0.4 : 1,
    ...style, // Custom styles might be here
  }}
>
```

**Problem:** If custom styles come before computed styles, computed values override custom values.

**Solution:** Ensure custom styles come AFTER computed styles:

```typescript
const nodeStyle: React.CSSProperties = {
  paddingLeft: `${depth * 16}px`,
  opacity: node.isGitIgnored ? 0.4 : 1,
  ...(style || {}), // Custom styles LAST so they take precedence
};

<div style={nodeStyle}>
```

**Alternative Solution (if Tailwind classes are the issue):**
```typescript
// Remove conflicting Tailwind classes when custom styles present
const className = cn(
  'flex items-center gap-2 py-1 rounded-md cursor-pointer',
  // Conditionally apply px-2 only if no custom paddingLeft
  !style?.paddingLeft && 'px-2',
  node.isActive && 'bg-accent',
  'hover:bg-muted',
);
```

**BAS Quality Gates:**
- ✓ Phase 1: Linting
- ✓ Phase 2: Structure validation
- ✓ Phase 3: Build validation
- ✓ Phase 4: Testing (1 test passes)
- ✓ Phase 5: Coverage check
- ✓ Phase 6: Final review

---

### Phase 3: Verification (10 minutes)

**Tasks:**
1. Run test: `npm run test -- FileTreeNode.test.tsx`
2. Verify "should apply custom style" passes
3. Verify no regressions in other FileTreeNode tests
4. Visual verification in Storybook/dev environment (optional)

---

## Affected Files

**Component (Primary):**
- `src/renderer/components/ide/file-tree/FileTreeNode.tsx` - Style prop handling

**Tests (Validation):**
- `tests/components/ide/file-tree/FileTreeNode.test.tsx` - 1 failing test

---

## Acceptance Criteria

### Must Have
- [ ] Test "should apply custom style" passes
- [ ] Custom `backgroundColor` applies correctly
- [ ] Custom `paddingLeft` applies correctly
- [ ] No regressions in other FileTreeNode tests

### Should Have
- [ ] Clear comment explaining style precedence
- [ ] Consistent pattern for style merging

### Nice to Have
- [ ] Storybook story demonstrating custom styles
- [ ] Additional tests for edge cases (empty style, undefined)

---

## Testing Strategy

### Unit Test
```bash
npm run test -- tests/components/ide/file-tree/FileTreeNode.test.tsx
```

**Expected Output:**
```
✓ should render file node
✓ should render directory node
✓ should apply depth indentation
✓ should apply custom style          ← This should now pass
✓ should highlight when selected
... (other tests)

Tests:  23 passed, 23 total
```

### Visual Test (Optional)
```bash
npm run dev
```

Navigate to file tree and verify custom styles can be applied programmatically.

---

## Risk Assessment

### Low Risk
- **Isolated component fix** - Single component, single prop
- **Simple style merging** - Well-understood React pattern
- **Comprehensive tests** - 23 tests verify no regressions

### Mitigation
- Verify all 23 FileTreeNode tests pass
- Check Tailwind classes don't conflict
- Test in actual application UI

---

## Success Metrics

**Before:** 467 passing, 1 FileTreeNode style test failing
**After:** 468 passing, 0 FileTreeNode style failures

**Quality:** All BAS gates pass
**Timeline:** Complete within 30 minutes - 1 hour

---

## Related Work Orders

- **Independent:** Can run in parallel with all other work orders
- **Blocks:** None
- **Low Priority:** Can be deferred if higher priority work orders need attention

---

## Notes

### Previous Fix Attempt
KIL Agent 1 removed `px-2` Tailwind class to prevent conflict with inline `paddingLeft`. Test still fails, suggesting issue is with style prop composition, not Tailwind conflict.

### Implementation Notes
*(To be filled during implementation)*

---

## After Completion

1. Update test count baseline (+1)
2. Run BAS validation
3. Optional: Add Storybook story for custom styles
4. Archive work order

---

**Status Updates:**

- [ ] Phase 1: Diagnosis - Not Started
- [ ] Phase 2: Fix Implementation - Not Started
- [ ] Phase 3: Verification - Not Started
- [ ] BAS Quality Gate - Not Started
- [ ] Work Order Complete - Not Started
