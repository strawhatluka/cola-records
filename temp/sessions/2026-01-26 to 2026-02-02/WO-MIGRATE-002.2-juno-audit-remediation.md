# ORCHESTRATOR WORK ORDER #MIGRATE-002.2
## Type: IMPLEMENTATION
## JUNO Audit Remediation - Complete WO-MIGRATE-002.1

---

## MISSION OBJECTIVE

Complete the remaining 42% of WO-MIGRATE-002.1 deliverables identified by JUNO audit as incomplete or non-functional. Current state: 58/100 completion score with critical failures in testing infrastructure, accessibility features, and UI polish.

**Implementation Goal:** Achieve 100% completion score on JUNO re-audit by fixing all identified gaps
**Based On:** JUNO Audit Report WO-MIGRATE-002.1-AUDIT-20260125-083013.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/__tests__/setup.ts
    changes: Fix test module resolution for IPC client
    risk: MEDIUM

  - path: src/renderer/components/ui/Progress.tsx
    changes: Add aria-valuenow attribute for accessibility
    risk: LOW

  - path: src/renderer/App.tsx
    changes: Fix Toaster positioning (move inside ThemeProvider)
    risk: LOW

  - path: src/renderer/components/ui/Skeleton.tsx
    changes: Create loading skeleton component
    risk: LOW

  - path: src/renderer/screens/IssueDiscoveryScreen.tsx
    changes: Replace "Loading..." text with Skeleton component
    risk: LOW

  - path: src/renderer/screens/DashboardScreen.tsx
    changes: Add keyboard shortcuts (Ctrl+K, Esc, Ctrl+,)
    risk: MEDIUM

Supporting_Files:
  - src/__tests__/hooks/useContributionWorkflow.test.ts - Fix mock syntax
  - src/__tests__/components/Progress.test.tsx - Update assertions for aria-valuenow
  - src/main/ipc/channels.ts - Add openIssues to GitHubRepository type (if needed)
```

### Changes Required

#### Change Set 1: Test Infrastructure Fixes
**Files:** src/__tests__/setup.ts, all test files
**Current State:** All 6 test files fail with "No test suite found" error
**Target State:** Test suite discovery works, tests pass
**Implementation:**
```typescript
// Option 1: Global mock in setup.ts (if no conflicts)
vi.mock('../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => () => {}),
  },
}));

// Option 2: Hoisted mocks in individual test files
vi.mock('../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));
```

#### Change Set 2: Accessibility - Progress ARIA
**Files:** src/renderer/components/ui/Progress.tsx
**Current State:** Missing aria-valuenow attribute
**Target State:** Proper ARIA attributes for screen readers
**Implementation:**
```tsx
<ProgressPrimitive.Root
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={100}
  // ... existing props
>
```

#### Change Set 3: Accessibility - Keyboard Shortcuts
**Files:** src/renderer/App.tsx or new src/renderer/hooks/useKeyboardShortcuts.ts
**Current State:** No keyboard shortcuts implemented
**Target State:** Ctrl+K (search), Esc (close modals), Ctrl+, (settings)
**Implementation:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      // Focus search input
    }
    if (e.key === 'Escape') {
      // Close active modal
    }
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      // Navigate to settings
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

#### Change Set 4: UI Polish - Loading Skeletons
**Files:** src/renderer/components/ui/Skeleton.tsx (new), IssueDiscoveryScreen.tsx, DashboardScreen.tsx
**Current State:** Plain "Loading..." text
**Target State:** Animated skeleton components
**Implementation:**
```tsx
// Skeleton.tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// Usage in screens
{isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
) : (
  <IssueList issues={issues} />
)}
```

#### Change Set 5: UI Polish - Toaster Positioning
**Files:** src/renderer/App.tsx
**Current State:** Toaster outside ThemeProvider (breaks dark mode)
**Target State:** Toaster inside ThemeProvider
**Implementation:**
```tsx
return (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system">
      <Layout currentScreen={currentScreen} onScreenChange={setCurrentScreen}>
        {renderScreen()}
      </Layout>
      <Toaster /> {/* Move inside ThemeProvider */}
    </ThemeProvider>
  </ErrorBoundary>
);
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Test Infrastructure (2-3 hours)
- [ ] Identify root cause of "No test suite found" error
- [ ] Try global mock in setup.ts first
- [ ] If conflicts, use hoisted mocks in individual files
- [ ] Verify test discovery: `npm run test:run`
- [ ] Fix any TypeScript errors in test files
- [ ] Confirm all tests pass

### Phase 2: Accessibility - ARIA (1 hour)
- [ ] Add aria-valuenow to Progress component
- [ ] Update Progress tests to verify ARIA attributes
- [ ] Run accessibility audit (manual or axe-core)
- [ ] Verify screen reader compatibility

### Phase 3: Accessibility - Keyboard Shortcuts (2-3 hours)
- [ ] Create useKeyboardShortcuts hook or add to App.tsx
- [ ] Implement Ctrl+K for search focus
- [ ] Implement Esc for modal close
- [ ] Implement Ctrl+, for settings navigation
- [ ] Test all shortcuts in running app
- [ ] Document shortcuts in UI (tooltip or help modal)

### Phase 4: UI Polish - Skeletons (2 hours)
- [ ] Create Skeleton component with animation
- [ ] Replace "Loading..." in IssueDiscoveryScreen
- [ ] Replace "Loading..." in DashboardScreen
- [ ] Replace "Loading..." in ContributionsScreen
- [ ] Verify animations work in both light/dark modes

### Phase 5: UI Polish - Toaster Fix (15 min)
- [ ] Move Toaster inside ThemeProvider in App.tsx
- [ ] Test toast notifications in dark mode
- [ ] Verify toast styling matches theme

### Phase 6: Validation & Re-Audit (1 hour)
- [ ] Run TypeScript compilation: `npx tsc --noEmit`
- [ ] Run all tests: `npm run test:run`
- [ ] Run coverage: `npm run test:coverage`
- [ ] Verify ≥80% coverage
- [ ] Launch JUNO re-audit
- [ ] Verify 100% completion score

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `WO-MIGRATE-002.2-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was fixed from JUNO audit
2. **Changes Applied** - Detailed breakdown by change set
3. **Test Results** - Before/after test pass rates and coverage
4. **JUNO Re-Audit Score** - Comparison: 58% → 100%
5. **Rollback Plan** - How to revert if issues arise
6. **Next Steps** - Any remaining polish or future work

### Evidence to Provide
- Test output showing all tests passing
- Coverage report showing ≥80%
- JUNO re-audit report showing 100% score
- Screenshots of keyboard shortcuts working
- Screenshots of loading skeletons in action
- Screenshots of toast in dark mode

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `WO-MIGRATE-002.2-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO re-audit report generated automatically
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-002.2-juno-audit-remediation.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-002.2-juno-audit-remediation.md`
   - [ ] Completion report exists in: `trinity/reports/WO-MIGRATE-002.2-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO re-audit exists in: `trinity/reports/WO-MIGRATE-002.2-JUNO-REAUDIT-[TIMESTAMP].md`
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
- [ ] All test files discoverable and passing (6/6 test files)
- [ ] Test coverage ≥80%
- [ ] Progress component has proper ARIA attributes
- [ ] All 3 keyboard shortcuts functional (Ctrl+K, Esc, Ctrl+,)
- [ ] Loading skeletons replace all "Loading..." text
- [ ] Toaster works in both light and dark modes
- [ ] TypeScript compilation passes (0 errors)
- [ ] JUNO re-audit score: 100/100
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
- [ ] Skip test fixes (critical priority)
- [ ] Implement shortcuts that conflict with browser defaults
- [ ] Create skeletons that don't match component layouts
- [ ] Suppress accessibility warnings
- [ ] Skip JUNO re-audit

### DO:
- [ ] Test each change immediately after implementation
- [ ] Use semantic HTML for accessibility
- [ ] Follow existing component patterns
- [ ] Document keyboard shortcuts for users
- [ ] Verify dark mode compatibility for all UI changes

---

## ROLLBACK STRATEGY

If issues arise:
1. **Test failures:** Revert test mock changes in setup.ts
2. **Accessibility regressions:** Remove ARIA attributes and shortcuts
3. **UI issues:** Revert Skeleton and Toaster changes
4. **Complete rollback:** `git checkout src/` (LUKA only)

**Critical Files Backup:** All files in src/__tests__/ and src/renderer/components/ui/

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit Report WO-MIGRATE-002.1-AUDIT-20260125-083013.md
**Key Findings:**
- Test infrastructure completely broken (0% coverage vs claimed 82.45%)
- Accessibility features partially implemented (60% complete)
- UI polish incomplete (50% complete)

**Root Causes Being Fixed:**
1. Test module resolution failure (IPC client import)
2. Missing ARIA attributes on Progress component
3. Keyboard shortcuts not implemented at all
4. Loading skeletons not created
5. Toaster outside ThemeProvider breaks dark mode

**Expected Impact:**
- JUNO score: 58% → 100%
- Test coverage: 0% → ≥80%
- Accessibility compliance: 60% → 100%
- UI polish: 50% → 100%

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All JUNO audit findings must be resolved
**Risk Level:** MEDIUM
**Risk Factors:**
- Test infrastructure changes could break existing tests
- Keyboard shortcuts could conflict with browser/OS shortcuts
- Theme-dependent UI changes need thorough testing

**Mitigation:**
- Test each change in isolation before moving to next
- Document all shortcuts and check for conflicts
- Verify light/dark mode for all UI changes
- Run JUNO audit after each phase for early feedback

---

**Remember:** This work order completes WO-MIGRATE-002.1. Focus on quality over speed. Test thoroughly. Achieve 100% JUNO score. Report all changes to LUKA for git operations.
