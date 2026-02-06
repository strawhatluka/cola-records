# ORCHESTRATOR WORK ORDER #005
## Type: IMPLEMENTATION
## Issues Button & Issue Detail Modal

---

## MISSION OBJECTIVE

Implement the Issues button in the DevelopmentScreen toolbar so that when pressed it displays open issues from the upstream repository. Issues with a branch matching the issue number show a blue fork badge. Clicking an issue opens a detail modal with full issue description, user comments, and the ability to leave a comment.

**Implementation Goal:** Fully functional Issues dropdown and Issue Detail Modal in DevelopmentScreen, mirroring the Pull Requests button/modal pattern established in WO-004.
**Based On:** TRA implementation plan from session 2026-02-03; WO-004 PR Detail Modal as reference pattern.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/ipc/channels.ts
    changes: Add 4 new IPC channels for issue operations; add author/authorAvatarUrl to GitHubIssue type
    risk: LOW

  - path: src/main/services/github-rest.service.ts
    changes: Add listIssues() and listIssueComments() methods
    risk: LOW

  - path: src/main/index.ts
    changes: Register 4 new IPC handlers for issue channels
    risk: LOW

  - path: src/renderer/screens/DevelopmentScreen.tsx
    changes: Add issues state, fetch effect, dropdown rendering with branch-match badge, modal rendering
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/issues/DevelopmentIssueDetailModal.tsx - NEW component (comments, timeline, submit)
```

### Changes Required

#### Change Set 1: IPC Channel Definitions
**Files:** `src/main/ipc/channels.ts`
**Current State:** GitHubIssue type has no `author`/`authorAvatarUrl` fields. No issue list/comment channels exist.
**Target State:** GitHubIssue gains `author` and `authorAvatarUrl` fields. Four new channels added.
**Implementation:**
```typescript
// Add to GitHubIssue interface:
author: string;
authorAvatarUrl: string;

// Add to IpcChannels:
'github:list-issues': (owner: string, repo: string, state?: 'open' | 'closed' | 'all') => { ... }[];
'github:get-issue': (owner: string, repo: string, issueNumber: number) => { ... };
'github:list-issue-comments': (owner: string, repo: string, issueNumber: number) => { ... }[];
'github:create-issue-comment': (owner: string, repo: string, issueNumber: number, body: string) => void;
```

#### Change Set 2: GitHub REST Service Methods
**Files:** `src/main/services/github-rest.service.ts`
**Current State:** Has `getIssue()` and `createIssueComment()` but no `listIssues()` or `listIssueComments()`.
**Target State:** Two new methods added following existing patterns.
**Implementation:**
```typescript
// listIssues: uses client.issues.listForRepo, filters out PRs (pull_request field)
// listIssueComments: uses client.issues.listComments, maps to id/body/author/authorAvatarUrl/createdAt/updatedAt
```

#### Change Set 3: IPC Handler Registration
**Files:** `src/main/index.ts`
**Current State:** No issue-specific handlers beyond search-issues.
**Target State:** Four new handlers registered using dynamic import pattern.

#### Change Set 4: DevelopmentIssueDetailModal Component
**Files:** `src/renderer/components/issues/DevelopmentIssueDetailModal.tsx` (NEW)
**Current State:** Does not exist. Existing `IssueDetailModal.tsx` serves issue discovery (has RepositoryFileTree, no comments).
**Target State:** New modal mirroring PullRequestDetailModal pattern: fetches issue detail + comments, renders markdown body, shows comment timeline with avatars, has comment textarea + submit, View on GitHub button.

#### Change Set 5: DevelopmentScreen Issues Wiring
**Files:** `src/renderer/screens/DevelopmentScreen.tsx`
**Current State:** Issues button shows "Under construction" dropdown.
**Target State:** Issues dropdown fetches and displays issues list. Each issue shows: state badge, title, #number, author. Blue fork badge (GitFork icon from lucide-react) shown when `contribution.branchName` contains the issue number (word-boundary match). Clicking an issue opens DevelopmentIssueDetailModal.

---

## IMPLEMENTATION APPROACH

### Step 1: Backend (IPC Channels + Service + Handlers)
- [ ] Add `author` and `authorAvatarUrl` to `GitHubIssue` interface in channels.ts
- [ ] Add 4 new IPC channel type definitions in channels.ts
- [ ] Add `listIssues(owner, repo, options)` to github-rest.service.ts — filter out PRs via `pull_request` field
- [ ] Add `listIssueComments(owner, repo, issueNumber)` to github-rest.service.ts
- [ ] Register 4 IPC handlers in main/index.ts following existing pattern
- [ ] Verify build compiles cleanly

### Step 2: Frontend (Modal Component)
- [ ] Create `DevelopmentIssueDetailModal.tsx` in `src/renderer/components/issues/`
- [ ] Implement: props (issue, owner, repo, onClose), fetch detail + comments on mount
- [ ] Implement: markdown body rendering, comment timeline, avatar display
- [ ] Implement: comment textarea + submit button, View on GitHub link
- [ ] Implement: loading/error states with retry
- [ ] Export helper functions for testability (formatDate, statusBadge if needed)

### Step 3: Frontend (DevelopmentScreen Wiring)
- [ ] Add state: `issues[]`, `issuesLoading`, `issuesError`, `selectedIssue`
- [ ] Add `useEffect` to fetch issues when `activeDropdown === 'issues'`
- [ ] Replace "Under construction" with issues dropdown UI
- [ ] Add blue fork badge logic: match `contribution.branchName` against issue number
- [ ] Add `onClick` to select issue and open modal
- [ ] Render `DevelopmentIssueDetailModal` when `selectedIssue` is set

### Step 4: Validation
- [ ] Verify all existing tests still pass (LUKA runs `npm test`)
- [ ] Verify build compiles cleanly (LUKA runs `npm run build`)
- [ ] Manual verification: Issues dropdown shows repo issues
- [ ] Manual verification: Blue fork badge appears on matching issues
- [ ] Manual verification: Issue detail modal shows comments and allows commenting

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `ISSUES-BUTTON-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with file changes
3. **Test Results** - Validation of changes
4. **Metrics** - Files changed, lines added/removed
5. **Rollback Plan** - How to revert if needed
6. **Next Steps** - Test coverage, improvements

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Specific line numbers for critical changes
- Test output showing success
- Screenshots of working feature (if available)

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `ISSUES-BUTTON-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] JUNO audit report generated automatically (if applicable)
   - [ ] All deliverables include required sections listed above

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-005-issues-button-detail-modal.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-005-issues-button-detail-modal.md`
   - [ ] Completion report exists in: `trinity/reports/ISSUES-BUTTON-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order -> `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report -> `trinity/archive/reports/YYYY-MM-DD/`
- JUNO audit report -> `trinity/archive/reports/YYYY-MM-DD/` (if applicable)
- Session summary -> `trinity/archive/sessions/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Issues button dropdown shows open issues from the upstream repository
- [ ] Issues with a branch matching the issue number display a blue fork badge
- [ ] Clicking an issue opens DevelopmentIssueDetailModal
- [ ] Modal shows full issue body (markdown), comments timeline, and comment submission
- [ ] All existing tests still pass
- [ ] Build compiles cleanly
- [ ] No regressions introduced
- [ ] Code follows existing patterns (mirrors PR button/modal architecture)
- [ ] Implementation report submitted to trinity/reports/

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add** - FORBIDDEN - Only LUKA has permission
- [ ] **git commit** - FORBIDDEN - Only LUKA has permission
- [ ] **git push** - FORBIDDEN - Only LUKA has permission
- [ ] **git pull** - FORBIDDEN - Only LUKA has permission
- [ ] **git merge** - FORBIDDEN - Only LUKA has permission
- [ ] **Any git operation that modifies repository state**

**ALSO FORBIDDEN:**
- [ ] **npm test** - FORBIDDEN - Only LUKA runs tests
- [ ] **npm run build** - FORBIDDEN - Only LUKA runs builds
- [ ] **npm install** - FORBIDDEN - Only LUKA manages dependencies

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Report completion to LUKA with summary of changes
3. LUKA will handle ALL git operations and test/build runs

### Do NOT:
- [ ] Modify the existing `IssueDetailModal.tsx` (used for issue discovery, different purpose)
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond the requirements
- [ ] Suppress warnings instead of fixing issues
- [ ] Create new technical debt

### DO:
- [ ] Follow existing code patterns (mirror PR button/modal architecture)
- [ ] Maintain consistent style
- [ ] Add appropriate error handling
- [ ] Filter PRs from the issues API response (GitHub returns PRs in issues endpoint)
- [ ] Use word-boundary matching for branch-to-issue number comparison
- [ ] Consider edge cases (no issues, API errors, empty body)

---

## ROLLBACK STRATEGY

If issues arise:
1. Revert changes to `channels.ts`, `index.ts`, `github-rest.service.ts`, `DevelopmentScreen.tsx`
2. Delete new file `DevelopmentIssueDetailModal.tsx`
3. Verify existing PR functionality still works

**Critical Files Backup:** DevelopmentScreen.tsx (most complex changes)

---

## CONTEXT FROM TRA PLAN

**Source:** TRA implementation plan (session 2026-02-03)
**Key Findings:**
- Existing `IssueDetailModal.tsx` serves a different purpose (discovery with RepositoryFileTree) — create separate component
- `getIssue()` and `createIssueComment()` already exist in service — only need `listIssues()` and `listIssueComments()`
- GitHub issues API returns PRs too — must filter by checking `pull_request` field
- Branch matching should use word-boundary regex to avoid false positives (issue #4 vs branch `feature-42`)

**Reference Pattern:** WO-004 PR Detail Modal — identical architecture to replicate.

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** LOW
**Risk Factors:**
- GitHub issues API includes PRs (must filter)
- Branch-to-issue matching could produce false positives without word-boundary regex
- Adding `author`/`authorAvatarUrl` to `GitHubIssue` may affect other consumers of that type

**Mitigation:**
- Filter PRs by checking for `pull_request` field on each API response item
- Use `new RegExp('\\b' + issueNumber + '\\b')` for branch matching
- Check all consumers of `GitHubIssue` type before adding fields (make new fields optional if needed)

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
