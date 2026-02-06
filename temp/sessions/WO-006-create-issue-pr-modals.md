# ORCHESTRATOR WORK ORDER #006
## Type: IMPLEMENTATION
## Create Issue & Create Pull Request Modals

---

## MISSION OBJECTIVE

Add "Create New Issue" and "Create New PR" buttons to the Issues and Pull Requests dropdowns in DevelopmentScreen. Each button opens a modal with a form to submit a new issue or pull request to the upstream repository via the GitHub REST API.

**Implementation Goal:** Users can create issues and pull requests directly from the Development screen toolbar without leaving the app.
**Based On:** User request — extend Issues and Pull Requests dropdowns with creation capability.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/github-rest.service.ts
    changes: Add createIssue() method
    risk: LOW

  - path: src/main/ipc/channels.ts
    changes: Add github:create-issue and github:create-pull-request channel types
    risk: LOW

  - path: src/main/index.ts
    changes: Register 2 new IPC handlers
    risk: LOW

  - path: src/renderer/screens/DevelopmentScreen.tsx
    changes: Add "Create New Issue" and "Create New PR" buttons in dropdowns, wire modals
    risk: MEDIUM

New_Files:
  - src/renderer/components/issues/CreateIssueModal.tsx
  - src/renderer/components/pull-requests/CreatePullRequestModal.tsx

Supporting_Files:
  - tests/main/services/github-rest.service.test.ts - Add createIssue tests
  - tests/renderer/components/issues/CreateIssueModal.test.tsx - New test file
  - tests/renderer/components/pull-requests/CreatePullRequestModal.test.tsx - New test file
  - tests/renderer/screens/DevelopmentScreen.toolbar.test.tsx - Add create button tests
```

### Changes Required

#### Change Set 1: Backend — Service + IPC
**Files:** github-rest.service.ts, channels.ts, index.ts
**Current State:** createPullRequest() exists in service but has no IPC channel. No createIssue() method exists.
**Target State:** Both createIssue() and createPullRequest() service methods exist. IPC channels `github:create-issue` and `github:create-pull-request` are registered and wired.
**Implementation:**
```typescript
// github-rest.service.ts — new method
async createIssue(owner: string, repo: string, title: string, body: string, labels?: string[]): Promise<{ number: number; url: string }> {
  const client = this.getClient();
  const response = await client.issues.create({ owner, repo, title, body, labels });
  return { number: response.data.number, url: response.data.html_url };
}

// channels.ts — new channels
'github:create-issue': (owner: string, repo: string, title: string, body: string, labels?: string[]) => { number: number; url: string };
'github:create-pull-request': (owner: string, repo: string, title: string, head: string, base: string, body: string) => { number: number; url: string; state: string };
```

#### Change Set 2: CreateIssueModal Component
**Files:** src/renderer/components/issues/CreateIssueModal.tsx (NEW)
**Current State:** Does not exist
**Target State:** Modal with title input, body textarea (markdown), optional labels, submit button
**Implementation:**
- Follow DevelopmentIssueDetailModal pattern (Dialog, DialogContent, DialogHeader)
- Form fields: title (required), body (markdown textarea), labels (optional comma-separated or tag input)
- Submit calls `ipc.invoke('github:create-issue', ...)`
- On success: close modal, refresh issues list (via callback)
- On error: show inline error message
- Loading state on submit button

#### Change Set 3: CreatePullRequestModal Component
**Files:** src/renderer/components/pull-requests/CreatePullRequestModal.tsx (NEW)
**Current State:** Does not exist
**Target State:** Modal with title input, body textarea (markdown), head branch (pre-filled from contribution.branchName), base branch (default: main/master from upstream), submit button
**Implementation:**
- Follow PullRequestDetailModal pattern
- Form fields: title (required), body (markdown textarea), head branch (pre-filled, editable), base branch (default main, editable)
- Submit calls `ipc.invoke('github:create-pull-request', ...)`
- Head format: `{fork-owner}:{branchName}` for cross-fork PRs
- On success: close modal, refresh PR list (via callback)
- On error: show inline error message

#### Change Set 4: Wire into DevelopmentScreen
**Files:** src/renderer/screens/DevelopmentScreen.tsx
**Current State:** Issues and PR dropdowns show list items only
**Target State:** Each dropdown has a "Create New Issue" / "Create New PR" button at the top. Clicking opens the respective modal. On successful creation, the dropdown list refreshes.
**Implementation:**
- Add state: `showCreateIssue`, `showCreatePR`
- Add button at top of each dropdown
- Render CreateIssueModal and CreatePullRequestModal conditionally
- Pass `onCreated` callback that refreshes the respective list

---

## IMPLEMENTATION APPROACH

### Step 1: Backend
- [ ] Add `createIssue()` method to github-rest.service.ts
- [ ] Add `github:create-issue` and `github:create-pull-request` channel types to channels.ts
- [ ] Register IPC handlers in index.ts for both channels

### Step 2: Create Issue Modal
- [ ] Create CreateIssueModal.tsx with form (title, body, labels)
- [ ] Handle submit, loading, error states
- [ ] Write component tests

### Step 3: Create PR Modal
- [ ] Create CreatePullRequestModal.tsx with form (title, body, head, base)
- [ ] Pre-fill head branch from contribution.branchName
- [ ] Handle cross-fork PR head format (`owner:branch`)
- [ ] Write component tests

### Step 4: Integration
- [ ] Add "Create New Issue" button to Issues dropdown in DevelopmentScreen
- [ ] Add "Create New PR" button to Pull Requests dropdown in DevelopmentScreen
- [ ] Wire onCreated callbacks to refresh lists
- [ ] Add toolbar integration tests

### Step 5: Validation
- [ ] All existing tests still pass
- [ ] New tests cover happy path, error states, form validation
- [ ] No TypeScript compilation errors

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CREATE-ISSUE-PR-MODALS-IMPLEMENTATION-COMPLETE-2026-02-03.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with diffs
3. **Test Results** - Validation of changes
4. **Metrics** - Files changed, lines added, tests added
5. **Rollback Plan** - How to revert if needed
6. **Next Steps** - What to monitor or do next

### Evidence to Provide
- File diff statistics
- Specific line numbers for critical changes
- Test output showing success

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `CREATE-ISSUE-PR-MODALS-IMPLEMENTATION-COMPLETE-2026-02-03.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-006-create-issue-pr-modals.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-006-create-issue-pr-modals.md`
   - [ ] Completion report exists in: `trinity/reports/CREATE-ISSUE-PR-MODALS-IMPLEMENTATION-COMPLETE-2026-02-03.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Users can create a new issue from the Issues dropdown
- [ ] Users can create a new PR from the Pull Requests dropdown
- [ ] Both modals have proper form validation (title required)
- [ ] Both modals show loading state during submission
- [ ] Both modals show error messages on failure
- [ ] On successful creation, the dropdown list refreshes to show the new item
- [ ] PR modal pre-fills head branch from contribution.branchName
- [ ] All new code has test coverage
- [ ] No regressions in existing tests
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, pull, merge, checkout, branch, tag, rebase, reset, revert, stash.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond the requirements
- [ ] Perform ANY git operations
- [ ] Run npm test, npm run build, npm install (LUKA only)

### DO:
- [ ] Follow existing modal patterns (DevelopmentIssueDetailModal, PullRequestDetailModal)
- [ ] Use existing UI components (Dialog, Badge, Button from ui/)
- [ ] Follow existing IPC handler pattern (dynamic imports)
- [ ] Follow existing test patterns (mock IPC, mock react-markdown, mock lucide-react)

---

## ROLLBACK STRATEGY

If issues arise:
1. Revert changes to channels.ts, index.ts, github-rest.service.ts, DevelopmentScreen.tsx
2. Delete CreateIssueModal.tsx and CreatePullRequestModal.tsx
3. Delete new test files
4. Revert test additions in existing test files

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Cross-fork PR head format (`owner:branch`) needs correct formatting
- createPullRequest() already exists in service but has no IPC channel — reuse existing method

**Mitigation:**
- Test cross-fork PR creation with proper head format
- Reuse existing createPullRequest() service method, only add IPC wiring

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
