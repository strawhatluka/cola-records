# Work Order: Contributions Page Test Coverage

**ID:** WO-CONTRIBUTIONS-TESTS-001
**Created:** 2026-01-29
**Priority:** HIGH
**Status:** PENDING
**Estimated Effort:** 6-8 hours

---

## Summary

Implement comprehensive test coverage for the Contributions page (My Contributions), including all frontend components, the Zustand store, the contribution workflow hook, and IPC handler integration tests.

---

## Scope

**In Scope:**
- ContributionCard component tests
- ContributionList component tests
- StatusBadge component tests
- ContributionWorkflowModal component tests
- ContributionsScreen component tests
- useContributionsStore Zustand store tests
- useContributionWorkflow hook tests
- Contribution IPC handler integration tests

**Out of Scope:**
- IDE/Development page components
- ContributionScannerService (already has ~85% coverage)

---

## Current State (JUNO Audit Results)

| Component | Current Coverage | Target Coverage |
|-----------|-----------------|-----------------|
| ContributionCard.tsx | 0% | ≥80% |
| ContributionList.tsx | 0% | ≥80% |
| StatusBadge.tsx | 0% | ≥80% |
| ContributionWorkflowModal.tsx | 0% | ≥80% |
| ContributionsScreen.tsx | 0% | ≥80% |
| useContributionsStore.ts | 0% | ≥80% |
| useContributionWorkflow.ts | 0% | ≥80% |
| contribution:* IPC handlers | 0% | ≥80% |

---

## Tasks

### Task 1: StatusBadge Component Tests
**File:** `tests/renderer/components/contributions/StatusBadge.test.tsx`
**Priority:** LOW (simple component)
**Estimated:** 30 min

**Test Cases:**
- [ ] Should render "In Progress" badge for `in_progress` status
- [ ] Should render "Ready" badge for `ready` status
- [ ] Should render "PR Created" badge for `submitted` status
- [ ] Should render "Merged" badge for `merged` status
- [ ] Should apply correct CSS classes for each status
- [ ] Should handle undefined status gracefully

---

### Task 2: ContributionList Component Tests
**File:** `tests/renderer/components/contributions/ContributionList.test.tsx`
**Priority:** MEDIUM
**Estimated:** 45 min

**Test Cases:**
- [ ] Should render loading skeletons when loading=true
- [ ] Should render empty state when contributions array is empty
- [ ] Should render ContributionCard for each contribution
- [ ] Should pass correct props to each ContributionCard
- [ ] Should handle large number of contributions (performance)
- [ ] Should maintain grid layout responsiveness

---

### Task 3: ContributionCard Component Tests
**File:** `tests/renderer/components/contributions/ContributionCard.test.tsx`
**Priority:** HIGH (most complex component)
**Estimated:** 2 hours

**Test Cases:**
- [ ] Should render repository name extracted from URL
- [ ] Should render owner/repo info
- [ ] Should render StatusBadge with correct status
- [ ] Should render Fork badge when isFork=true
- [ ] Should render "Not a Fork" badge when isFork=false
- [ ] Should render Remotes Valid badge when remotesValid=true
- [ ] Should render Remotes Invalid badge when remotesValid=false
- [ ] Should render PR status badge when prStatus exists
- [ ] Should display all branches when fetched
- [ ] Should show loading state while fetching branches
- [ ] Should fallback to current branch if fetch fails
- [ ] Should render local path
- [ ] Should render created date formatted
- [ ] Should call onOpenProject when "Open Project" clicked
- [ ] Should call IPC shell:open-external when "View on GitHub" clicked
- [ ] Should call handleSyncPRStatus when refresh button clicked
- [ ] Should show confirm dialog before delete
- [ ] Should call onDelete when delete confirmed
- [ ] Should not call onDelete when delete cancelled
- [ ] Should show spinning animation while syncing
- [ ] Should handle sync error gracefully

---

### Task 4: ContributionWorkflowModal Component Tests
**File:** `tests/renderer/components/contributions/ContributionWorkflowModal.test.tsx`
**Priority:** HIGH
**Estimated:** 1.5 hours

**Test Cases:**
- [ ] Should not render when isOpen=false
- [ ] Should render dialog when isOpen=true
- [ ] Should display issue title in description
- [ ] Should show progress bar
- [ ] Should display correct status message for each workflow status
- [ ] Should show Loader2 spinner during processing
- [ ] Should show local path and branch when complete
- [ ] Should render "Start Dev" button when complete
- [ ] Should render "Done" button when complete
- [ ] Should render "Close" button on error
- [ ] Should render disabled "Please wait..." during processing
- [ ] Should call onComplete and onStartDev when "Start Dev" clicked
- [ ] Should call onClose when "Done" clicked
- [ ] Should reset state when modal closes
- [ ] Should show special error message for Windows path issues
- [ ] Should start workflow automatically when opened with issue

---

### Task 5: ContributionsScreen Component Tests
**File:** `tests/renderer/components/contributions/ContributionsScreen.test.tsx`
**Priority:** MEDIUM
**Estimated:** 1 hour

**Test Cases:**
- [ ] Should render page heading
- [ ] Should render ContributionList
- [ ] Should call contribution:scan-directory on mount
- [ ] Should set isScanning=true during scan
- [ ] Should set isScanning=false after scan completes
- [ ] Should handle scan errors gracefully
- [ ] Should call setContributions with scanned results
- [ ] Should call onOpenIDE when handleOpenProject is called
- [ ] Should not scan if defaultClonePath is empty

---

### Task 6: useContributionsStore Tests
**File:** `tests/renderer/stores/useContributionsStore.test.ts`
**Priority:** HIGH
**Estimated:** 1 hour

**Test Cases:**
- [ ] Should initialize with empty contributions array
- [ ] Should initialize with loading=false
- [ ] Should initialize with error=null
- [ ] setContributions should update contributions array
- [ ] fetchContributions should set loading=true
- [ ] fetchContributions should call IPC contribution:get-all
- [ ] fetchContributions should set contributions on success
- [ ] fetchContributions should set loading=false on success
- [ ] fetchContributions should set error on failure
- [ ] createContribution should set loading=true
- [ ] createContribution should call IPC contribution:create
- [ ] createContribution should add new contribution to array
- [ ] createContribution should return created contribution
- [ ] createContribution should set error and throw on failure
- [ ] updateContribution should set loading=true
- [ ] updateContribution should call IPC contribution:update
- [ ] updateContribution should update contribution in array
- [ ] updateContribution should return updated contribution
- [ ] updateContribution should set error and throw on failure
- [ ] deleteContribution should set loading=true
- [ ] deleteContribution should call IPC contribution:delete
- [ ] deleteContribution should remove contribution from array
- [ ] deleteContribution should set error and throw on failure
- [ ] getContributionById should return contribution if found
- [ ] getContributionById should return undefined if not found

---

### Task 7: useContributionWorkflow Hook Tests
**File:** `tests/renderer/hooks/useContributionWorkflow.test.ts`
**Priority:** HIGH
**Estimated:** 1.5 hours

**Test Cases:**
- [ ] Should initialize with idle status
- [ ] Should initialize with progress=0
- [ ] Should initialize with error=null
- [ ] Should initialize with contribution=null
- [ ] startWorkflow should set status to forking (25%)
- [ ] startWorkflow should call github:fork-repository
- [ ] startWorkflow should set status to cloning (50%)
- [ ] startWorkflow should call git:clone
- [ ] startWorkflow should handle duplicate directory names
- [ ] startWorkflow should set status to setting_up_remotes (75%)
- [ ] startWorkflow should call git:add-remote for upstream
- [ ] startWorkflow should set status to creating_branch (85%)
- [ ] startWorkflow should call git:create-branch
- [ ] startWorkflow should call git:checkout
- [ ] startWorkflow should call createContribution
- [ ] startWorkflow should set status to complete (100%)
- [ ] startWorkflow should return contribution on success
- [ ] startWorkflow should set error status on failure
- [ ] startWorkflow should call rollback on failure
- [ ] reset should reset state to initial values

---

### Task 8: Contribution IPC Handler Integration Tests
**File:** `tests/main/ipc/contribution-handlers.test.ts`
**Priority:** MEDIUM
**Estimated:** 1 hour

**Test Cases:**
- [ ] contribution:create should create contribution in database
- [ ] contribution:get-all should return all contributions
- [ ] contribution:get-by-id should return contribution if found
- [ ] contribution:get-by-id should return null if not found
- [ ] contribution:update should update contribution
- [ ] contribution:delete should delete contribution
- [ ] contribution:delete should delete local directory
- [ ] contribution:delete should stop file watcher
- [ ] contribution:scan-directory should scan and import contributions
- [ ] contribution:scan-directory should update existing contributions
- [ ] contribution:sync-with-github should fetch PR status
- [ ] contribution:sync-with-github should update contribution with PR details
- [ ] contribution:sync-with-github should throw if contribution not found

---

## Acceptance Criteria

1. All test files created in appropriate locations
2. All test cases pass
3. Overall test coverage ≥80% for each component
4. Tests follow existing project patterns (Vitest, React Testing Library)
5. IPC mocks properly configured
6. No console errors during test runs
7. Tests are maintainable and well-documented

---

## Dependencies

- Vitest test framework
- @testing-library/react
- @testing-library/user-event
- better-sqlite3 (for IPC handler tests - with skipIf pattern)

---

## Technical Notes

1. **IPC Mocking:** Use `vi.mock('../../ipc/client')` pattern from existing tests
2. **Zustand Testing:** Use `act()` wrapper for store updates
3. **SQLite Tests:** Use `describe.skipIf(!canUseSqlite)` pattern for native module compatibility
4. **Radix UI:** Polyfills already in tests/setup.ts for pointer capture events

---

## File Structure

```
tests/
├── renderer/
│   ├── components/
│   │   └── contributions/
│   │       ├── StatusBadge.test.tsx
│   │       ├── ContributionCard.test.tsx
│   │       ├── ContributionList.test.tsx
│   │       ├── ContributionWorkflowModal.test.tsx
│   │       └── ContributionsScreen.test.tsx
│   ├── stores/
│   │   └── useContributionsStore.test.ts
│   └── hooks/
│       └── useContributionWorkflow.test.ts
└── main/
    └── ipc/
        └── contribution-handlers.test.ts
```

---

## References

- Existing test patterns: `tests/renderer/components/issues/IssueDetailModal.test.tsx`
- Store test patterns: `tests/renderer/stores/useSettingsStore.test.ts`
- IPC handler patterns: `tests/main/ipc/settings-handlers.test.ts`
- Backend service patterns: `tests/main/services/contribution-scanner.service.test.ts`

---

## Deliverables

1. [ ] StatusBadge.test.tsx (Task 1)
2. [ ] ContributionList.test.tsx (Task 2)
3. [ ] ContributionCard.test.tsx (Task 3)
4. [ ] ContributionWorkflowModal.test.tsx (Task 4)
5. [ ] ContributionsScreen.test.tsx (Task 5)
6. [ ] useContributionsStore.test.ts (Task 6)
7. [ ] useContributionWorkflow.test.ts (Task 7)
8. [ ] contribution-handlers.test.ts (Task 8)
9. [ ] JUNO verification report confirming ≥80% coverage
