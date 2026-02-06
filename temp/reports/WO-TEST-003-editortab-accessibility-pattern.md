# Work Order: WO-TEST-003

**Title:** Fix EditorTab Test Failures - Implement WCAG Tab Pattern
**Type:** Bug / Accessibility Violation
**Priority:** CRITICAL
**Status:** OPEN
**Created:** 2026-01-26
**Created By:** JUNO (Quality Auditor)
**Assigned To:** [Pending Assignment]
**Estimated Effort:** 2 hours (immediate fixes + keyboard navigation)

---

## Problem Statement

EditorTab component has 7 failing tests due to incorrect ARIA accessibility pattern implementation. Component uses `aria-pressed` button pattern instead of the required WCAG `role="tab"` with `aria-selected` pattern for tab interfaces.

**Impact:**
- ❌ WCAG 2.1 Level A violation (Section 508 non-compliant)
- ❌ Screen readers announce "pressed button" instead of "selected tab"
- ❌ Keyboard navigation incomplete (no arrow key support)
- ❌ All accessibility audit tests failing
- ❌ Legal compliance risk (ADA, EU Accessibility Act)

**Test Results:** 0/7 passing (100% failure rate)

---

## Root Cause

Component implements **toggle button pattern** (aria-pressed) when it should implement **WCAG tab pattern** (role="tab", aria-selected). Tests correctly expect WCAG-compliant implementation.

**Current Implementation (WRONG):**
```tsx
<div role="group">
  <button aria-pressed={isActive}>Tab Content</button>
</div>
```

**Required Implementation (CORRECT):**
```tsx
<div role="tablist">
  <button role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}>
    Tab Content
  </button>
</div>
```

---

## Failed Tests

### 1. "should apply active styling when active" ❌
- **Issue:** Test queries wrong DOM element (container vs button)
- **Fix:** Verify active styling applied to role="tab" element

### 2. "should set aria-selected to true when active" ❌
- **Issue:** Component uses `aria-pressed` instead of `aria-selected`
- **Fix:** Change to `aria-selected={isActive}`

### 3. "should set aria-selected to false when inactive" ❌
- **Issue:** Same as #2 - wrong ARIA attribute
- **Fix:** Change to `aria-selected={isActive}`

### 4. "should call onClick when tab is clicked" ❌
- **Issue:** Test queries `role="tab"` which doesn't exist
- **Fix:** Add `role="tab"` to button

### 5. "should have role='tab'" ❌
- **Issue:** No explicit role on button element
- **Fix:** Add `role="tab"` attribute

### 6. "should be keyboard navigable (tabIndex=0)" ❌
- **Issue:** No tabIndex management
- **Fix:** Add roving tabindex pattern `tabIndex={isActive ? 0 : -1}`

### 7. "should truncate long file names" ❌
- **Issue:** Test expects `max-w-[200px]` but component uses `max-w-[120px]`
- **Fix:** Update test expectation to `max-w-[120px]` (design decision - correct)

---

## Specification

### Required Changes

#### 1. EditorTabBar.tsx (Parent Component)
**File:** `src/renderer/components/ide/editor/EditorTabBar.tsx`

**Change:**
```tsx
// Line 12-15: Add role="tablist"
<div
  role="tablist"  // ✅ ADD THIS
  className="flex overflow-x-auto border-b bg-background scrollbar-thin"
  aria-label="Open files"
>
```

**Effort:** 1 line change, 5 minutes

---

#### 2. EditorTab.tsx (Tab Component)
**File:** `src/renderer/components/ide/editor/EditorTab.tsx`

**Changes:**
```tsx
// Lines 18-26: Update button attributes
<button
  role="tab"                      // ✅ ADD: WCAG tab role
  tabIndex={isActive ? 0 : -1}    // ✅ ADD: Roving tabindex
  aria-selected={isActive}        // ✅ CHANGE: From aria-pressed
  aria-label={fileName}
  className={cn(
    'flex items-center gap-2 pl-3 pr-1 py-2 hover:bg-accent text-sm select-none',
    isActive && 'bg-accent border-b-2 border-b-primary'
  )}
  onClick={onClick}
>
```

**Remove:** Line 24 `aria-pressed={isActive}`
**Add:** Lines as shown above
**Effort:** 3 line changes, 10 minutes

---

#### 3. EditorTab.test.tsx (Test Fix)
**File:** `tests/components/ide/editor/EditorTab.test.tsx`

**Change:**
```tsx
// Line 329: Update max-width expectation
expect(fileNameEl.className).toContain('max-w-[120px]');  // Changed from [200px]
```

**Effort:** 1 line change, 5 minutes

---

## Implementation Checklist

### Phase 1: Immediate Fixes (30 minutes)
- [ ] Update EditorTabBar.tsx - Add `role="tablist"`
- [ ] Update EditorTab.tsx - Add `role="tab"`
- [ ] Update EditorTab.tsx - Change `aria-pressed` to `aria-selected`
- [ ] Update EditorTab.tsx - Add roving `tabIndex` pattern
- [ ] Update EditorTab.test.tsx - Fix max-w expectation
- [ ] Run test suite: `npm test EditorTab.test.tsx`
- [ ] Verify all 7 tests passing

### Phase 2: Keyboard Navigation (60 minutes - FUTURE)
- [ ] Implement arrow left/right navigation in EditorTabBar
- [ ] Implement Home/End key support
- [ ] Add keyboard navigation tests
- [ ] Update accessibility documentation

### Phase 3: Full WCAG Compliance (30 minutes - FUTURE)
- [ ] Add `aria-controls` linking tabs to content panel
- [ ] Update CodeEditorPanel with `role="tabpanel"`
- [ ] Manual screen reader testing (NVDA/JAWS)
- [ ] Cross-browser accessibility audit

---

## Testing Requirements

### Unit Tests
```bash
npm test tests/components/ide/editor/EditorTab.test.tsx
```
**Expected:** 7/7 tests passing

### Accessibility Tests
```bash
npm test tests/accessibility/ide-a11y.test.tsx
```
**Expected:** Tab-related assertions passing

### Manual Testing
- [ ] Screen reader testing (NVDA on Windows, JAWS)
- [ ] Keyboard navigation (Tab, Arrow keys, Home/End)
- [ ] Visual inspection (active state visible)
- [ ] Cross-browser testing (Chrome, Firefox, Edge)

---

## Acceptance Criteria

### Must Have (Phase 1)
- ✅ All 7 EditorTab tests passing
- ✅ Component uses `role="tab"` and `aria-selected`
- ✅ Parent uses `role="tablist"`
- ✅ Roving tabindex implemented (`tabIndex={isActive ? 0 : -1}`)
- ✅ No console errors or warnings
- ✅ Accessibility audit tests passing

### Should Have (Phase 2 - Future)
- ⚠️ Arrow key navigation between tabs
- ⚠️ Home/End key support
- ⚠️ Keyboard navigation tests

### Could Have (Phase 3 - Future)
- ⚠️ aria-controls linking tabs to panels
- ⚠️ Screen reader testing documentation

---

## Risk Assessment

**Risk Level:** LOW

**Risks:**
- Minimal code changes reduce regression risk
- Pattern well-documented in WCAG standards
- Similar pattern already used in FileTreeNode.tsx (reference implementation)

**Mitigation:**
- Run full test suite after changes
- Manual accessibility testing
- Code review by DRA (Code Reviewer)

---

## References

### W3C/WCAG Documentation
- WCAG 2.1 - 4.1.2 Name, Role, Value (Level A)
- W3C ARIA Authoring Practices - Tab Pattern
- MDN Web Docs - ARIA: tab role

### Project Files
- **Source:** `src/renderer/components/ide/editor/EditorTab.tsx`
- **Parent:** `src/renderer/components/ide/editor/EditorTabBar.tsx`
- **Tests:** `tests/components/ide/editor/EditorTab.test.tsx`
- **Accessibility Tests:** `tests/accessibility/ide-a11y.test.tsx`
- **Audit Report:** `trinity/reports/audit-editortab-20260126.md`

### Related Components (Reference Implementations)
- `src/renderer/components/ide/file-tree/FileTreeNode.tsx` (uses `aria-selected` correctly)
- `src/renderer/components/ide/terminal/TerminalPanel.tsx.bak` (has correct tab pattern)

---

## Implementation Notes

### Why Fix Component (Not Tests)?

1. **Tests are correct** - They expect WCAG-compliant tab pattern
2. **Component violates WCAG 2.1 Level A** - Legal compliance issue
3. **Industry standard** - All major IDEs (VSCode, JetBrains) use proper tab pattern
4. **Accessibility audit enforces** - tests/accessibility/ide-a11y.test.tsx expects this pattern
5. **Screen reader compatibility** - Current implementation confuses assistive technology

### aria-pressed vs aria-selected

**aria-pressed:**
- ✅ Correct for: Toggle buttons (mute, play/pause, bold formatting)
- ❌ Incorrect for: Tab selection, radio groups, option lists

**aria-selected:**
- ✅ Correct for: Tabs, listbox options, tree items, grid rows
- ❌ Incorrect for: Toggle buttons, checkboxes

**EditorTab is a tab interface** → Must use `aria-selected`

---

## Success Metrics

### Quantitative
- Test pass rate: 0% → 100% (7/7 passing)
- WCAG compliance: Level None → Level A
- Accessibility audit score: 0% → 100% (tab-related tests)

### Qualitative
- Screen readers announce "selected tab" instead of "pressed button"
- Keyboard users can navigate tabs with Tab key
- Foundation laid for full keyboard navigation (arrow keys)
- Code aligned with industry accessibility standards

---

## Follow-Up Work Orders

### Future Enhancements
- **WO-A11Y-001:** Implement full keyboard navigation (arrow keys, Home/End)
- **WO-A11Y-002:** Add aria-controls linking tabs to content panels
- **WO-A11Y-003:** Comprehensive screen reader testing and documentation

---

## Trinity Agent Assignments

**Recommended Workflow:**

1. **KIL (Task Executor)** - Implement code changes
2. **BAS (Quality Gate)** - Run 6-phase quality validation
3. **DRA (Code Reviewer)** - Review accessibility implementation
4. **APO (Documentation)** - Update ARCHITECTURE.md with accessibility patterns
5. **JUNO (Auditor)** - Verify compliance and close work order

---

## Estimated Timeline

**Phase 1 (This Work Order):**
- Implementation: 30 minutes
- Testing: 15 minutes
- Review: 15 minutes
- **Total: 1 hour**

**Future Phases:**
- Phase 2 (Keyboard Nav): 60 minutes
- Phase 3 (Full WCAG): 30 minutes
- **Total Future: 1.5 hours**

---

**Work Order Status:** READY FOR ASSIGNMENT
**Priority:** CRITICAL - WCAG Violation
**Blocking:** Accessibility compliance, screen reader support
**Trinity Version:** 2.1.0
**Created By:** JUNO (Quality Auditor)
**Date:** 2026-01-26
