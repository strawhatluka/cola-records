# ORCHESTRATOR WORK ORDER #004
## Type: IMPLEMENTATION
## Pull Request Detail Modal - Full PR Review Interface

---

## MISSION OBJECTIVE

Implement a full pull request review interface accessible from the DevelopmentScreen's Pull Requests dropdown. When a user clicks a PR in the list, a modal opens showing the complete PR conversation (description, comments, reviews, inline review comments) with the ability to respond to comments. This essentially replicates the GitHub PR page experience within the app.

**Implementation Goal:** Users can view full PR details, read all comments/reviews, and post replies without leaving the app.
**Based On:** Existing PR list dropdown in DevelopmentScreen (current session work) and existing `IssueDetailModal` pattern.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/github-rest.service.ts
    changes: Add 3 new methods (listPRComments, listPRReviews, listPRReviewComments)
    risk: LOW

  - path: src/main/ipc/channels.ts
    changes: Add 5 new IPC channel type definitions
    risk: LOW

  - path: src/main/index.ts
    changes: Register 5 new IPC handlers
    risk: LOW

  - path: src/renderer/components/pull-requests/PullRequestDetailModal.tsx
    changes: NEW FILE - Full PR review modal component
    risk: MEDIUM

  - path: src/renderer/screens/DevelopmentScreen.tsx
    changes: Add selectedPR state, make PR items clickable, render modal
    risk: LOW

Supporting_Files:
  - src/renderer/components/ui/Dialog.tsx - No changes (existing Radix Dialog used as-is)
```

### Changes Required

#### Change Set 1: Backend - New GitHub REST Service Methods
**Files:** `src/main/services/github-rest.service.ts`
**Current State:** Has `getPullRequest()`, `listPullRequests()`, `createIssueComment()` but no methods for listing comments or reviews on a PR.
**Target State:** Three new methods to fetch PR conversation data.
**Implementation:**

1. `listPRComments(owner, repo, prNumber)` - Uses `client.issues.listComments({ issue_number: prNumber })` (GitHub API treats PR comments as issue comments). Returns array of:
```typescript
{
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
```

2. `listPRReviews(owner, repo, prNumber)` - Uses `client.pulls.listReviews({ pull_number: prNumber })`. Returns array of:
```typescript
{
  id: number;
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  author: string;
  authorAvatarUrl: string;
  submittedAt: Date;
}
```

3. `listPRReviewComments(owner, repo, prNumber)` - Uses `client.pulls.listReviewComments({ pull_number: prNumber })`. Returns array of:
```typescript
{
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  path: string;
  line: number | null;
  createdAt: Date;
  inReplyToId: number | null;
}
```

#### Change Set 2: IPC Channel Types & Handlers
**Files:** `src/main/ipc/channels.ts`, `src/main/index.ts`
**Current State:** No IPC channels for PR details, comments, or reviews.
**Target State:** 5 new typed IPC channels with registered handlers.

New channels:
- `'github:get-pull-request': (owner: string, repo: string, prNumber: number) => PRDetail`
- `'github:list-pr-comments': (owner: string, repo: string, prNumber: number) => PRComment[]`
- `'github:list-pr-reviews': (owner: string, repo: string, prNumber: number) => PRReview[]`
- `'github:list-pr-review-comments': (owner: string, repo: string, prNumber: number) => PRReviewComment[]`
- `'github:create-pr-comment': (owner: string, repo: string, prNumber: number, body: string) => void`

Note: `github:create-pr-comment` delegates to existing `createIssueComment()` (GitHub API treats PR comments as issue comments).

#### Change Set 3: PullRequestDetailModal Component
**Files:** `src/renderer/components/pull-requests/PullRequestDetailModal.tsx` (NEW)
**Current State:** Does not exist.
**Target State:** Full PR review modal following `IssueDetailModal` pattern.

**Component Structure:**
```
PullRequestDetailModal
├── DialogHeader
│   ├── PR Title + Number
│   ├── Status Badge (open/merged/closed)
│   └── Author + Branch + Dates
├── PR Description (ReactMarkdown)
├── Timeline (chronological feed)
│   ├── Comments (from listPRComments)
│   │   └── Each: avatar, author, timestamp, markdown body
│   ├── Reviews (from listPRReviews)
│   │   └── Each: avatar, author, state badge, body
│   └── Review Comments (from listPRReviewComments)
│       └── Grouped by file path, showing line number + body
├── Comment Input
│   ├── Textarea for new comment
│   └── Submit button (calls github:create-pr-comment)
└── DialogFooter
    └── "View on GitHub" button (shell:open-external)
```

**Props:**
```typescript
interface PullRequestDetailModalProps {
  pr: PullRequest | null;  // From existing PullRequest interface in DevelopmentScreen
  owner: string;
  repo: string;
  onClose: () => void;
}
```

**State:**
- `prDetail` - Full PR data (body, etc.) from `github:get-pull-request`
- `comments` - PR comments array
- `reviews` - PR reviews array
- `reviewComments` - Inline review comments array
- `loading` - Loading state
- `error` - Error state
- `newComment` - Textarea value for composing replies
- `submitting` - Comment submission state

**Behavior:**
- On open: Fetches PR detail, comments, reviews, and review comments in parallel
- Timeline items sorted chronologically by date
- Reviews show state as colored badges: APPROVED (green), CHANGES_REQUESTED (orange), COMMENTED (blue), DISMISSED (gray)
- Review comments grouped by file path with line numbers
- Comment textarea at bottom with Submit button
- After submitting a comment, re-fetches comments to show the new one
- "View on GitHub" opens PR URL in browser

#### Change Set 4: DevelopmentScreen Wiring
**Files:** `src/renderer/screens/DevelopmentScreen.tsx`
**Current State:** PR dropdown shows list of PRs as non-clickable items.
**Target State:** PR items are clickable; clicking opens PullRequestDetailModal.

Changes:
- Add `selectedPR` state (`PullRequest | null`)
- Extract `owner`/`repo` from contribution URL (already have `extractOwnerRepo` helper)
- Add `onClick` to PR items in dropdown that sets `selectedPR` and closes dropdown
- Render `<PullRequestDetailModal>` when `selectedPR` is set
- Pass `onClose={() => setSelectedPR(null)}` to modal

---

## IMPLEMENTATION APPROACH

### Step 1: Backend Methods
- [ ] Add `listPRComments()` to `github-rest.service.ts`
- [ ] Add `listPRReviews()` to `github-rest.service.ts`
- [ ] Add `listPRReviewComments()` to `github-rest.service.ts`
- [ ] Verify return shapes match Octokit response types

### Step 2: IPC Layer
- [ ] Add 5 channel type definitions to `channels.ts`
- [ ] Register 5 handlers in `index.ts`
- [ ] `github:create-pr-comment` handler delegates to existing `createIssueComment()`

### Step 3: PullRequestDetailModal Component
- [ ] Create `src/renderer/components/pull-requests/` directory
- [ ] Create `PullRequestDetailModal.tsx` following `IssueDetailModal` pattern
- [ ] Implement parallel data fetching on mount
- [ ] Build timeline UI with chronological comment/review feed
- [ ] Add comment textarea with submit functionality
- [ ] Add "View on GitHub" footer button
- [ ] Handle loading, error, and empty states

### Step 4: DevelopmentScreen Integration
- [ ] Add `selectedPR` state
- [ ] Make PR list items clickable with cursor-pointer styling
- [ ] Render `PullRequestDetailModal` conditionally
- [ ] Verify modal opens/closes correctly

### Step 5: Validation
- [ ] Test with a repo that has open PRs with comments
- [ ] Test with a repo that has reviews (APPROVED, CHANGES_REQUESTED)
- [ ] Test posting a comment and seeing it appear
- [ ] Verify "View on GitHub" opens correct URL
- [ ] Verify modal close behavior (X button, outside click, escape)
- [ ] Confirm no regressions in existing PR dropdown behavior

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PR-DETAIL-MODAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with diffs
3. **Test Results** - Validation of changes
4. **Metrics** - Files changed, lines added
5. **Rollback Plan** - How to revert if needed
6. **Next Steps** - Future enhancements (threading, pagination, diff view)

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Specific line numbers for critical changes
- Screenshot or description of modal UI
- List of all IPC channels added

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `PR-DETAIL-MODAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-004-pr-detail-modal.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-004-pr-detail-modal.md`
   - [ ] Completion report exists in: `trinity/reports/PR-DETAIL-MODAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report → `trinity/archive/reports/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 3 new REST service methods are implemented and return correct shapes
- [ ] All 5 IPC channels are typed and handlers registered
- [ ] PullRequestDetailModal opens from PR dropdown click
- [ ] Modal shows PR title, status, description (rendered markdown)
- [ ] Modal shows chronological timeline of comments and reviews
- [ ] Review state badges display correctly (APPROVED/CHANGES_REQUESTED/etc.)
- [ ] Inline review comments are grouped by file path
- [ ] User can type and submit a comment from the modal
- [ ] Submitted comment appears in the timeline after refresh
- [ ] "View on GitHub" button opens correct URL
- [ ] Modal closes via X button, Escape key, and outside click
- [ ] No regressions in existing DevelopmentScreen functionality
- [ ] Code follows existing patterns (IssueDetailModal, IPC handler style)

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add** - FORBIDDEN - Only LUKA has permission
- [ ] **git commit** - FORBIDDEN - Only LUKA has permission
- [ ] **git push** - FORBIDDEN - Only LUKA has permission
- [ ] **Any git operation that modifies repository state**

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Test thoroughly in local environment
3. Report completion to LUKA with summary of changes
4. LUKA will handle ALL git operations

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Run `npm test`, `npm run build`, `npm install`, or any git commands
- [ ] Add pagination (V1 uses first page of 100 items)
- [ ] Add review comment threading (V1 shows flat, grouped by file)
- [ ] Add inline diff view (future enhancement)
- [ ] Create new technical debt

### DO:
- [ ] Follow existing `IssueDetailModal` pattern for modal structure
- [ ] Follow existing IPC handler pattern (`handleIpc` with dynamic import)
- [ ] Use existing UI components (Dialog, Badge, Button, Textarea)
- [ ] Use ReactMarkdown for rendering comment/review bodies
- [ ] Handle loading, error, and empty states gracefully
- [ ] Add appropriate error handling in all new methods

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify:** Modal fails to load, IPC errors, or API rate limiting
2. **Rollback Steps:**
   - Remove `PullRequestDetailModal.tsx` (new file)
   - Revert changes to `DevelopmentScreen.tsx` (remove selectedPR state and modal render)
   - Revert changes to `index.ts` (remove 5 new handlers)
   - Revert changes to `channels.ts` (remove 5 new channel types)
   - Revert changes to `github-rest.service.ts` (remove 3 new methods)
3. **Verify:** PR dropdown still works as before (list-only, no click behavior)

**Critical Files Backup:** `DevelopmentScreen.tsx` (has recent changes from current session)

---

## CONTEXT FROM CURRENT SESSION

**Source:** Current development session working on DevelopmentScreen toolbar buttons
**Key Findings:**
- `IssueDetailModal` provides proven modal pattern (Radix Dialog, max-w-4xl, overflow-y-auto)
- `github-rest.service.ts` already has full Octokit client with `pulls` and `issues` namespaces
- `createIssueComment()` already exists and works for PR comments (GitHub API quirk)
- `getPullRequest()` already returns PR body but is not exposed via IPC
- `extractOwnerRepo()` helper already exists in DevelopmentScreen
- `ReactMarkdown` already installed and used in `IssueDetailModal`

**Expected Impact:** Users can manage PR conversations entirely within the app, eliminating context switches to GitHub.

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
- GitHub API rate limits when fetching 4 endpoints per modal open
- Large PR conversations (100+ comments) may load slowly

**Mitigation:**
- All fetches are read-only and cached by GitHub CDN
- V1 fetches first page only (100 items per endpoint)
- Loading state shown during fetch

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
