# WO-064: Git Integration (Complete)

**Status:** PENDING
**Complexity:** 5/10
**Priority:** MEDIUM
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 16 - Git Integration
**Dependencies:** None (extends existing git.service.ts)
**Estimated Time:** 5 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Complete the git integration by adding /review and /pr_comments slash commands, co-authored-by attribution settings, git-aware @mention file suggestions, and .gitignore-respecting file search. This extends the existing `GitService` class which already handles clone, pull, push, branch, commit, status, diff, log, and stash operations.

---

## Background

### Current State
- `GitService` exists at `src/main/services/git.service.ts` (278 lines) with full CRUD git operations
- Uses `simple-git` library for all git operations
- Methods: `getStatus`, `getLog`, `add`, `commit`, `push`, `pull`, `clone`, `checkout`, `createBranch`, `getCurrentBranch`, `getBranches`, `isRepository`, `init`, `getRemoteUrl`, `fetch`, `addRemote`
- Git types defined in `src/main/ipc/channels.ts`: `GitStatus`, `GitFileStatus`, `GitCommit`
- No `/review` command for code review of current changes
- No `/pr_comments` command for viewing PR comments
- No co-authored-by attribution setting
- No git-aware @mention optimization (file suggestions use filesystem, not git ls-files)
- No .gitignore-respecting file search setting

### Target State
- `/review` slash command that generates a code review of current uncommitted changes
- `/pr_comments` slash command that fetches and displays PR comments from GitHub
- `attribution` setting controlling co-authored-by trailers in commits and PRs
- Git-aware @mention suggestions using `git ls-files` for faster file lookups
- `respectGitIgnore` setting that filters .gitignore patterns from file searches

---

## Acceptance Criteria

- [ ] AC-1: `/review` command gathers current diff and sends to Claude for code review
- [ ] AC-2: `/review` shows structured review output (issues, suggestions, summary)
- [ ] AC-3: `/pr_comments` fetches comments from the current branch's open PR via GitHub API
- [ ] AC-4: `/pr_comments` displays comments with author, file, line, and body
- [ ] AC-5: `attribution.commits` setting adds `Co-authored-by: Claude <noreply@anthropic.com>` to commit messages
- [ ] AC-6: `attribution.pullRequests` setting adds co-authored-by to PR descriptions
- [ ] AC-7: @mention file suggestions use `git ls-files` when in a git repository (faster than filesystem scan)
- [ ] AC-8: `respectGitIgnore` setting (default: true) filters .gitignore patterns from search results
- [ ] AC-9: All features gracefully degrade when not in a git repository
- [ ] AC-10: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
/review Flow:
  Slash Command -> GitService.getDiff() -> Format diff context
    -> Send to Claude with "review this diff" prompt
    -> Display structured review in chat

/pr_comments Flow:
  Slash Command -> GitService.getCurrentBranch()
    -> GitHubService.getPRForBranch(branch)
    -> GitHubService.getPRComments(prNumber)
    -> Format and display comments

Git-Aware @mentions:
  @mention input -> Check if git repo
    -> Yes: git ls-files (cached, refreshed on file change)
    -> No: filesystem scan (existing behavior)
  Result: ~3x faster file suggestions in git repos

Attribution:
  GitService.commit() -> Check attribution.commits setting
    -> If true, append "Co-authored-by" trailer to message
  GitHubService.createPR() -> Check attribution.pullRequests setting
    -> If true, append "Co-authored-by" to PR body
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/git-review.service.ts` | Code review generation from git diff |
| `src/main/services/git-file-index.service.ts` | Git ls-files based file indexing for @mentions |
| `tests/unit/services/git-review.service.test.ts` | Review service tests |
| `tests/unit/services/git-file-index.service.test.ts` | File index tests |
| `tests/unit/services/git-attribution.test.ts` | Attribution tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/services/git.service.ts` | Add `getDiff()` method, add attribution trailer logic to `commit()` |
| `src/main/ipc/channels.ts` | Add `GitReviewResult`, `GitPRComment`, attribution settings to AppSettings |
| `src/main/index.ts` | Register new IPC handlers for review, pr_comments, git file index |
| `src/renderer/components/settings/SettingsForm.tsx` | Add attribution toggle settings, respectGitIgnore toggle |
| `src/renderer/stores/useSettingsStore.ts` | Add attribution settings fields |

### Interfaces

```typescript
// src/main/services/git-review.service.ts
interface GitReviewRequest {
  repoPath: string;
  staged?: boolean;  // review staged changes only (default: all changes)
}

interface GitReviewResult {
  diff: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
}

interface GitReviewService {
  /** Get diff for review */
  getReviewDiff(request: GitReviewRequest): Promise<GitReviewResult>;
}

// src/main/services/git-file-index.service.ts
interface GitFileIndexService {
  /** Get all tracked files in the repository */
  getTrackedFiles(repoPath: string): Promise<string[]>;
  /** Check if a path is ignored by .gitignore */
  isIgnored(repoPath: string, filePath: string): Promise<boolean>;
  /** Refresh the file index cache */
  refreshIndex(repoPath: string): Promise<void>;
}

// PR Comments (via existing GitHub service)
interface GitPRComment {
  id: string;
  author: string;
  body: string;
  path?: string;       // file path if inline comment
  line?: number;        // line number if inline comment
  createdAt: string;
  url: string;
}

// New AppSettings fields
interface AppSettings {
  // ... existing
  claudeAttributionCommits?: boolean;    // default true
  claudeAttributionPullRequests?: boolean; // default true
  respectGitIgnore?: boolean;             // default true
}

// New IPC channels
'git:review' -> GitReviewResult
'git:pr-comments' -> GitPRComment[]
'git:file-index' -> string[] (tracked file list)
```

---

## Implementation Tasks

### Task 1: Add getDiff Method to GitService
**File:** `src/main/services/git.service.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Add a `getDiff` method to the existing GitService:
- `getDiff(repoPath, staged?)`: Returns unified diff string
- Use `git.diff()` for unstaged changes, `git.diff(['--staged'])` for staged
- Parse diff to extract file list, additions count, deletions count
- Return `GitReviewResult` with diff string and metadata

### Task 2: Add Attribution Logic to GitService.commit
**File:** `src/main/services/git.service.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Modify the existing `commit()` method:
- Accept an optional `attribution` parameter
- If `attribution` is true, append `\n\nCo-authored-by: Claude <noreply@anthropic.com>` to commit message
- Only append if the trailer is not already present in the message
- The caller (IPC handler) reads the `claudeAttributionCommits` setting to determine the flag

### Task 3: Create GitReviewService
**File:** `src/main/services/git-review.service.ts`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** Task 1

Implement code review diff preparation:
- `getReviewDiff()`: Call `gitService.getDiff()` to get the diff
- Parse diff into structured format (files, hunks, line changes)
- Calculate stats (files changed, additions, deletions)
- Format diff context suitable for Claude to review
- Handle edge cases: no changes, binary files, large diffs (truncate at 50KB)

### Task 4: Implement /pr_comments via GitHub API
**File:** `src/main/index.ts` (IPC handler) + extend GitHub service
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** None

Implement PR comments fetching:
- Get current branch via `gitService.getCurrentBranch()`
- Find open PR for branch via GitHub REST API: `GET /repos/{owner}/{repo}/pulls?head={branch}`
- Fetch PR comments: `GET /repos/{owner}/{repo}/pulls/{pr}/comments` (review comments)
- Also fetch issue comments: `GET /repos/{owner}/{repo}/issues/{pr}/comments` (conversation)
- Format into `GitPRComment[]` with author, body, file/line context
- Handle: no PR found, no comments, rate limiting

### Task 5: Create GitFileIndexService
**File:** `src/main/services/git-file-index.service.ts`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** None

Implement git-aware file listing for @mentions:
- `getTrackedFiles(repoPath)`: Execute `git ls-files` via simple-git raw command
- Cache results in memory with 30-second TTL
- `isIgnored(repoPath, filePath)`: Execute `git check-ignore` for a path
- `refreshIndex(repoPath)`: Clear cache and re-fetch
- Return file paths relative to repo root
- Graceful fallback: if not a git repo, return empty array (caller uses filesystem)

### Task 6: Register IPC Handlers
**File:** `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 25 min
**Dependencies:** Tasks 1-5

- Add `git:review` handler: calls `gitReviewService.getReviewDiff()`, returns diff data
- Add `git:pr-comments` handler: fetches PR comments for current branch
- Add `git:file-index` handler: returns `gitFileIndexService.getTrackedFiles()`
- Pass attribution setting to `gitService.commit()` calls

### Task 7: Update AppSettings and Types
**File:** `src/main/ipc/channels.ts`
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** None

- Add `claudeAttributionCommits?: boolean` (default true) to AppSettings
- Add `claudeAttributionPullRequests?: boolean` (default true) to AppSettings
- Add `respectGitIgnore?: boolean` (default true) to AppSettings
- Add `GitReviewResult`, `GitPRComment` type exports

### Task 8: Update Settings UI
**File:** `src/renderer/components/settings/SettingsForm.tsx`
**Complexity:** Low
**Estimated Time:** 25 min
**Dependencies:** Task 7

- Add "Git Attribution" section with two toggles:
  - "Add Co-authored-by to commits" (claudeAttributionCommits)
  - "Add Co-authored-by to pull requests" (claudeAttributionPullRequests)
- Add "Respect .gitignore" toggle (respectGitIgnore)
- Group under an existing "Git" settings section or create new one

### Task 9: Wire Git File Index into @mention System
**File:** `src/renderer/components/claude/` (@ mention component)
**Complexity:** Medium
**Estimated Time:** 30 min
**Dependencies:** Task 5, Task 6

- When @mention input is active and the project is a git repo:
  - Fetch file list from `git:file-index` IPC channel instead of filesystem scan
  - Use git ls-files results for fuzzy matching
  - Fall back to filesystem scan if git fails
- This should result in noticeably faster @mention suggestions in git repos

### Task 10: Write Unit Tests
**Files:** `tests/unit/services/git-review.service.test.ts`, `tests/unit/services/git-file-index.service.test.ts`, `tests/unit/services/git-attribution.test.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Tasks 1-9

Test coverage:
- getDiff: unstaged changes, staged changes, no changes, binary files
- Attribution: trailer appended, not duplicated, disabled setting
- Review: diff parsing, stats calculation, large diff truncation
- PR comments: successful fetch, no PR found, no comments, API error
- File index: git ls-files parsing, cache hit/miss, non-git fallback
- .gitignore: ignored files filtered, non-ignored files included

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 20-25 | 80%+ lines and branches |
| Integration Tests | 2-3 | Review flow end-to-end, file index with real git repo |
| Mock Requirements | simple-git, GitHub REST API (Octokit) |

### Key Test Scenarios
1. `/review` returns structured diff for uncommitted changes
2. `/review` handles empty diff (no changes) gracefully
3. `/pr_comments` fetches comments for branch with open PR
4. `/pr_comments` returns empty array when no PR exists
5. Attribution trailer appended to commit message
6. Attribution trailer not duplicated on repeated commits
7. Git ls-files returns tracked files quickly
8. File index cache expires and refreshes
9. Non-git directory falls back gracefully
10. Large diffs truncated at 50KB limit

---

## BAS Quality Gates

| Phase | Gate | Pass Criteria |
|-------|------|---------------|
| 1 | Linting | ESLint + Prettier: 0 errors |
| 2 | Structure | All imports resolve, types valid |
| 3 | Build | TypeScript compilation: 0 errors |
| 4 | Testing | All tests pass (unit + integration) |
| 5 | Coverage | 80%+ lines and branches |
| 6 | Review | DRA approval |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 16:

- [ ] /review command - Request code review of current changes
- [ ] /pr_comments command - View pull request comments from GitHub
- [ ] Co-authored-by attribution - `attribution` setting controls adding co-authorship to commits and PRs
- [ ] Git-aware @mentions - File suggestions ~3x faster in git repositories
- [ ] Respect .gitignore - Setting to exclude .gitignore patterns from file searches (default: true)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub API rate limiting for PR comments | Medium | Low | Cache PR comments, use conditional requests |
| Large diffs cause performance issues | Medium | Medium | Truncate at 50KB, show warning to user |
| git ls-files slow on very large repos | Low | Low | Cache with TTL, limit to tracked files only |
| PR not found for current branch | Medium | Low | Clear error message, suggest creating PR first |
| simple-git raw command fails on some git versions | Low | Low | Version check, fallback to parsed methods |

---

## Notes

- The existing `GitService` at `src/main/services/git.service.ts` is a clean, well-structured class. The modifications (getDiff, attribution) fit naturally into its pattern.
- The `simple-git` library supports raw commands via `git.raw()`, which is needed for `git ls-files` and `git check-ignore`.
- Co-authored-by trailers are a standard git convention. The format `Co-authored-by: Name <email>` is recognized by GitHub, GitLab, and other platforms.
- The `/review` command does not execute the review itself - it gathers the diff and sends it to Claude as context for Claude to perform the review. The slash command handler should construct an appropriate prompt.
- The `/pr_comments` command requires a GitHub token to be configured (existing `githubToken` in settings). If no token is available, it should prompt the user to configure one.
- The `respectGitIgnore` setting affects file search operations globally, not just @mentions. It should be wired into the file tree, search, and glob operations.
