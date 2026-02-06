# Cola Records -- Exhaustive Codebase Audit Report

**Audit Date:** 2026-02-03
**Auditor:** JUNO (Quality Auditor)
**Branch:** migration
**Framework:** React 19.2.3 + TypeScript 5.9.3 + Electron 40.0.0

---

## Table of Contents

1. [Complete Codebase Inventory](#1-complete-codebase-inventory)
2. [Complete Test Inventory](#2-complete-test-inventory)
3. [Coverage Gap Analysis](#3-coverage-gap-analysis)
4. [Stale / Outdated Tests](#4-stale--outdated-tests)
5. [Prioritized Recommendations](#5-prioritized-recommendations)

---

## 1. Complete Codebase Inventory

### 1.1 Main Process (`src/main/`)

#### 1.1.1 Entry Point

| File | Purpose | Key Exports / Functions |
|------|---------|------------------------|
| `src/main/index.ts` | Electron main entry | `createWindow()`, `setupIpcHandlers()`, `initializeServices()`, `cleanup()` |
| `src/main/preload.ts` | Context bridge for renderer | Exposes `electronAPI` on window |

#### 1.1.2 IPC Layer

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/main/ipc/channels.ts` | Type definitions for 60+ IPC channels | `IpcChannels`, `IpcEvents`, `FileNode`, `FileContent`, `GitStatus`, `GitFileStatus`, `GitCommit`, `DiffFileSummary`, `BranchComparison`, `ReactionContent`, `Reaction`, `SubIssue`, `GitHubIssue`, `GitHubRepository`, `Contribution`, `Alias`, `AppSettings` |
| `src/main/ipc/handlers.ts` | Type-safe IPC handler wrappers | `handleIpc()`, `removeIpcHandler()`, `removeAllIpcHandlers()`, `sendToRenderer()` |
| `src/main/ipc/index.ts` | Barrel export | Re-exports handlers |

**IPC Channel Categories (60+ channels):**

| Category | Channels | Count |
|----------|----------|-------|
| `fs:*` | read-directory, read-file, write-file, delete-file, exists, is-directory, get-stats, create-directory | 8 |
| `git:*` | status, log, add, commit, push, pull, clone, checkout, create-branch, current-branch, branches, is-repo, get-remotes, remote-url, fetch, add-remote, get-branches, compare-branches | 18 |
| `github:*` | search-issues, get-repository, validate-token, get-authenticated-user, get-issue, create-issue-comment, fork-repository, create-pull-request, get-user-repositories, search-repositories-by-topic, get-rate-limit, get-repository-tree, get-repository-contents, create-issue, update-issue, list-issues, list-issue-comments, get-pull-request, list-pull-requests, check-pr-status, list-pr-comments, list-pr-reviews, list-pr-review-comments, has-starred, star-repository, unstar-repository, list-issue-reactions, add-issue-reaction, delete-issue-reaction, list-comment-reactions, add-comment-reaction, delete-comment-reaction, list-sub-issues, create-sub-issue, add-existing-sub-issue | 35 |
| `contribution:*` | create, get-all, get-by-id, update, delete, get-by-type, scan-directory | 7 |
| `project:*` | delete | 1 |
| `settings:*` | get, update | 2 |
| `gitignore:*` | is-ignored, filter-ignored | 2 |
| `dialog:*` | open-directory | 1 |
| `shell:*` | open-external, open-path | 2 |
| `code-server:*` | start, stop, status | 3 |

#### 1.1.3 Database

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/main/database/database.service.ts` | SQLite CRUD service | `database` singleton. Methods: `initialize()`, `close()`, `runMigrations()`, `createContribution()`, `getAllContributions()`, `getContributionById()`, `updateContribution()`, `deleteContribution()`, `getContributionsByType()`, `getSetting()`, `setSetting()`, `getAllSettings()`, `getCacheValue()`, `setCacheValue()`, `deleteCacheValue()`, `cleanupExpiredCache()`, `rowToContribution()` |
| `src/main/database/schema.ts` | Schema + migrations | `SCHEMA_VERSION` (= 3), `CREATE_TABLES` (4 tables: contributions, settings, github_cache, schema_version), `MIGRATIONS` (v2: PR columns; v3: type column) |
| `src/main/database/index.ts` | Barrel export | -- |

**Database Tables:**
- `contributions` -- id, repository_url, local_path, issue_number, issue_title, branch_name, status, created_at, updated_at, upstream_url, is_fork, remotes_valid, pr_status, type
- `settings` -- key (PK), value
- `github_cache` -- cache_key (PK), cache_value, expires_at
- `schema_version` -- version, applied_at

#### 1.1.4 Services (10 files, 9 service classes)

| File | Class | Singleton | Key Methods |
|------|-------|-----------|-------------|
| `filesystem.service.ts` | `FileSystemService` | `fileSystemService` | `readDirectory()`, `readFile()`, `writeFile()`, `deleteFile()`, `exists()`, `isDirectory()`, `getStats()`, `createDirectory()`, `copyFile()`, `moveFile()`, `getExtension()`, `getBaseName()`, `getDirName()`, `joinPaths()`, `normalizePath()`, `resolvePath()` |
| `git.service.ts` | `GitService` | `gitService` | `getStatus()`, `getLog()`, `add()`, `commit()`, `push()`, `pull()`, `clone()`, `checkout()`, `createBranch()`, `getCurrentBranch()`, `getBranches()`, `isRepository()`, `init()`, `getRemotes()`, `getRemoteUrl()`, `fetch()`, `addRemote()`, `compareBranches()` |
| `github.service.ts` | `GitHubService` | `gitHubService` | `searchIssues()`, `getRepository()`, `validateToken()`, `getAuthenticatedUser()`, `getIssue()`, `createIssueComment()`, `forkRepository()`, `createPullRequest()`, `getUserRepositories()`, `searchRepositoriesByTopic()`, `getRateLimit()`, `clearCache()`, `setCacheEnabled()`, `getRepositoryTree()`, `resetClients()` |
| `github-graphql.service.ts` | `GitHubGraphQLService` | `gitHubGraphQLService` | `getClient()`, `resetClient()`, `searchIssues()`, `getRepository()`, `validateToken()`, `getAuthenticatedUser()`, `searchRepositoriesByTopic()`, `getRepositoryTree()` |
| `github-rest.service.ts` | `GitHubRestService` | `gitHubRestService` | `getClient()`, `resetClient()`, `getIssue()`, `createIssueComment()`, `updateIssue()`, `createIssue()`, `listIssues()`, `listIssueComments()`, `forkRepository()`, `createPullRequest()`, `getRepositoryContents()`, `getUserRepositories()`, `hasStarred()`, `starRepository()`, `unstarRepository()`, `getRateLimit()`, `getRepository()`, `getPullRequest()`, `listPullRequests()`, `checkPRStatus()`, `listPRComments()`, `listPRReviews()`, `listPRReviewComments()`, `listIssueReactions()`, `addIssueReaction()`, `deleteIssueReaction()`, `listCommentReactions()`, `addCommentReaction()`, `deleteCommentReaction()`, `listSubIssues()`, `createSubIssue()`, `addExistingSubIssue()` |
| `gitignore.service.ts` | `GitIgnoreService` | `gitIgnoreService` | `loadGitIgnore()`, `getIgnore()`, `isIgnored()`, `getPatterns()`, `filterIgnored()`, `reload()`, `clearCache()`, `hasGitIgnore()` |
| `secure-storage.service.ts` | `SecureStorageService` | `secureStorage` | `isEncryptionAvailable()`, `setItem()`, `getItem()`, `removeItem()`, `clear()`, `hasItem()`, `getAllKeys()`, `loadFromDisk()`, `saveToDisk()` |
| `environment.service.ts` | `EnvironmentService` | `env` | `get()`, `getOrDefault()`, `getRequired()`, `getBoolean()`, `getNumber()`, `development`, `production`, `getAll()`, `reload()`, `loadEnvironmentVariables()`, `parseEnvFile()`, `loadFromProcessEnv()` |
| `contribution-scanner.service.ts` | `ContributionScannerService` | `contributionScannerService` | `scanDirectory()`, `scanRepository()`, `validateRemotes()`, `extractRepoInfo()`, `getIssueTitle()` |
| `code-server.service.ts` | `CodeServerService` | `codeServerService` | `findFreePort()`, `getUserDataDir()`, `getExtensionsDir()`, `toDockerPath()`, `syncVSCodeSettings()`, `createContainerGitConfig()`, `createContainerBashrc()`, `getGitMounts()`, `getClaudeMounts()`, `checkDockerAvailable()`, `dockerExec()`, `waitForReady()`, `start()`, `stop()`, `getStatus()`, `getContainerName()` |
| `index.ts` | Barrel export | -- | Exports 8 of 10 services (excludes code-server, contribution-scanner) |

---

### 1.2 Renderer Process (`src/renderer/`)

#### 1.2.1 Core Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/renderer/App.tsx` | Root component | `App` -- state machine for 7 screens (dashboard, issues, projects, professional, contributions, settings, ide) |
| `src/renderer/index.tsx` | React entry / mount | -- |
| `src/renderer/ipc/client.ts` | IPC client wrapper | `ipc` singleton (`IpcClient`). Methods: `invoke()`, `send()`, `on()`, `platform`, `isDevelopment` |
| `src/renderer/lib/utils.ts` | Utility functions | `cn()` (clsx + tailwind-merge) |

#### 1.2.2 Providers

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/renderer/providers/ThemeProvider.tsx` | Theme context | `ThemeProvider`, `useTheme()` |

#### 1.2.3 Hooks (2 files)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/renderer/hooks/useKeyboardShortcuts.ts` | Global keyboard shortcuts | `useKeyboardShortcuts({ onSearchFocus, onEscapePress, onSettingsOpen })` |
| `src/renderer/hooks/useContributionWorkflow.ts` | Contribution workflow logic | `useContributionWorkflow()` |

#### 1.2.4 Stores (6 files -- NOT 9 as CLAUDE.md claims)

| File | State | Actions |
|------|-------|---------|
| `useContributionsStore.ts` | `contributions[], loading, error` | `setContributions`, `fetchContributions`, `createContribution`, `updateContribution`, `deleteContribution`, `getContributionById` |
| `useIssuesStore.ts` | `issues[], loading, error, searchQuery, selectedLabels` | `searchIssues`, `setSearchQuery`, `setSelectedLabels`, `clearIssues` |
| `useSettingsStore.ts` | `AppSettings + loading, error` | `fetchSettings`, `updateSettings`, `setTheme`, `setDefaultClonePath`, `setAutoFetch`, `setDefaultProjectsPath`, `setDefaultProfessionalProjectsPath` |
| `useProjectsStore.ts` | `projects[], loading, error` | `setProjects`, `deleteProject` |
| `useProfessionalProjectsStore.ts` | `projects[], loading, error` | `setProjects`, `deleteProject` |
| `index.ts` | Barrel export | -- |

**Missing stores (listed in CLAUDE.md but do NOT exist):** useCodeEditorStore, useFileTreeStore, useGitStore, useIDEStore, useTerminalStore

#### 1.2.5 Screens (7 files)

| File | Purpose | Tested? |
|------|---------|---------|
| `DashboardScreen.tsx` | Welcome + stats cards | Yes |
| `IssueDiscoveryScreen.tsx` | Search GitHub issues | No |
| `ContributionsScreen.tsx` | List/manage contributions | No |
| `ProjectsScreen.tsx` | Personal projects list | No |
| `ProfessionalProjectsScreen.tsx` | Professional projects list | No |
| `SettingsScreen.tsx` | Settings with 3 tabs | Yes |
| `DevelopmentScreen.tsx` | IDE with code-server + toolbar | Yes (helpers + toolbar) |

#### 1.2.6 Components (43 files)

**Layout (3):**

| File | Purpose | Tested? |
|------|---------|---------|
| `layout/Layout.tsx` | Main layout with sidebar | No |
| `layout/Sidebar.tsx` | Navigation sidebar | Yes |
| `layout/AppBar.tsx` | Top app bar | No |

**Top-Level (2):**

| File | Purpose | Tested? |
|------|---------|---------|
| `ErrorBoundary.tsx` | React error boundary | Yes |
| `ThemeToggle.tsx` | Theme switch button | No |

**Contributions (4):**

| File | Purpose | Tested? |
|------|---------|---------|
| `contributions/ContributionCard.tsx` | Single contribution card | No |
| `contributions/ContributionList.tsx` | List of contributions | No |
| `contributions/ContributionWorkflowModal.tsx` | Workflow modal | No |
| `contributions/StatusBadge.tsx` | Status badge display | Yes |

**Issues (8):**

| File | Purpose | Tested? |
|------|---------|---------|
| `issues/IssueCard.tsx` | Single issue card | Yes |
| `issues/IssueList.tsx` | List of issues | No |
| `issues/IssueDetailModal.tsx` | Issue details (discovery screen) | No |
| `issues/SearchPanel.tsx` | Search/filter panel | No |
| `issues/RepositoryFileTree.tsx` | File tree for repo preview | No |
| `issues/DevelopmentIssueDetailModal.tsx` | Issue details (dev screen) | Yes |
| `issues/CreateIssueModal.tsx` | Create new issue form | Yes |
| `issues/CreateSubIssueModal.tsx` | Create sub-issue form | No |
| `issues/AddExistingSubIssueModal.tsx` | Add existing sub-issue | No |

**Pull Requests (3):**

| File | Purpose | Tested? |
|------|---------|---------|
| `pull-requests/PullRequestDetailModal.tsx` | PR details modal | Yes |
| `pull-requests/CreatePullRequestModal.tsx` | Create PR form | Yes |
| `pull-requests/MarkdownEditor.tsx` | Markdown editor with toolbar | No |

**Settings (3):**

| File | Purpose | Tested? |
|------|---------|---------|
| `settings/GeneralTab.tsx` | General settings (paths, theme) | No |
| `settings/APITab.tsx` | GitHub token configuration | No |
| `settings/AliasesTab.tsx` | Shell alias management | Yes |

**UI Primitives (19):**

| File | Purpose | Tested? |
|------|---------|---------|
| `ui/Button.tsx` | CVA button (6 variants, 4 sizes) | Yes |
| `ui/Card.tsx` | Card container (6 sub-components) | No |
| `ui/Badge.tsx` | Badge (4 variants) | No |
| `ui/Dialog.tsx` | Radix Dialog primitives | No |
| `ui/Input.tsx` | Styled input | No |
| `ui/Select.tsx` | Radix Select primitives | No |
| `ui/Checkbox.tsx` | Radix Checkbox | No |
| `ui/Skeleton.tsx` | Loading skeleton | No |
| `ui/Separator.tsx` | Horizontal/vertical separator | No |
| `ui/Tooltip.tsx` | Radix Tooltip | No |
| `ui/DropdownMenu.tsx` | Radix DropdownMenu | No |
| `ui/Toaster.tsx` | Sonner toast wrapper | No |
| `ui/Progress.tsx` | Radix Progress bar | No |
| `ui/ContextMenu.tsx` | Radix ContextMenu | No |
| `ui/Textarea.tsx` | Styled textarea | No |
| `ui/EditorSkeleton.tsx` | Code editor loading skeleton | No |
| `ui/FileTreeSkeleton.tsx` | File tree loading skeleton | No |
| `ui/TerminalSkeleton.tsx` | Terminal loading skeleton | No |
| `ui/ReactionPicker.tsx` | Emoji reaction picker | No |

---

### 1.3 Test Support Files

| File | Purpose |
|------|---------|
| `tests/mocks/factories.ts` | Mock data factories: `createMockContribution()`, `createMockIssue()`, `createMockRepository()`, `createMockGitStatus()`, `createMockGitFileStatus()`, `createMockSettings()`, `createMockAlias()` |
| `tests/setup.ts` | Test environment setup (jsdom, matchMedia mock, etc.) |

---

## 2. Complete Test Inventory

### 2.1 Main Process Tests (11 files)

| # | Test File | Module Under Test | Test Cases | Coverage Notes |
|---|-----------|-------------------|------------|----------------|
| 1 | `tests/main/database/schema.test.ts` | `schema.ts` | 10 | Tests SCHEMA_VERSION value, CREATE_TABLES SQL structure, MIGRATIONS v2 columns. **STALE: asserts version=2, actual=3** |
| 2 | `tests/main/database/database.service.test.ts` | `database.service.ts` | 15+ | In-memory SQLite. Covers: CRUD contributions, settings get/set/getAll, cache get/set/TTL/cleanup, error handling (uninitialized DB, close) |
| 3 | `tests/main/services/filesystem.service.test.ts` | `filesystem.service.ts` | 15+ | Mocks fs.promises. Covers: all path utilities (6), readDirectory, readFile, writeFile, deleteFile, exists, isDirectory, getStats, createDirectory, copyFile, moveFile |
| 4 | `tests/main/services/git.service.test.ts` | `git.service.ts` | 18+ | Mocks simple-git. Covers: getStatus, getLog, add, commit, push, pull, checkout, createBranch, getCurrentBranch, getBranches (sort), isRepository, getRemoteUrl, fetch, addRemote. **Missing: clone, init, getRemotes, compareBranches** |
| 5 | `tests/main/services/github.service.test.ts` | `github.service.ts` | 10 | Mocks sub-services. Covers: searchIssues (cache), getRepository, validateToken, createIssueComment (cache invalidation), forkRepository, clearCache, setCacheEnabled, resetClients. **Missing: getAuthenticatedUser, getIssue, createPullRequest, getUserRepositories, searchRepositoriesByTopic, getRepositoryTree** |
| 6 | `tests/main/services/github-graphql.service.test.ts` | `github-graphql.service.ts` | 9 | Mocks @octokit/graphql. Covers: searchIssues, getRepository (null handling), validateToken, getAuthenticatedUser, resetClient, searchRepositoriesByTopic. **Missing: getRepositoryTree** |
| 7 | `tests/main/services/github-rest.service.test.ts` | `github-rest.service.ts` | 30+ | Mocks @octokit/rest. Covers: getIssue, createIssueComment, forkRepository, createPullRequest, getUserRepositories, hasStarred, getRateLimit, resetClient, checkPRStatus, getPullRequest, listPRComments, listPRReviews, listPRReviewComments, listIssues, listIssueComments. **Missing: updateIssue, createIssue, getRepositoryContents, getRepository, starRepository, unstarRepository, listPullRequests, all 6 Reaction methods, all 3 Sub-Issue methods** |
| 8 | `tests/main/services/gitignore.service.test.ts` | `gitignore.service.ts` | 9 | Mocks fs + ignore. Covers: isIgnored (.git, patterns), getPatterns, filterIgnored, hasGitIgnore, cache management |
| 9 | `tests/main/services/secure-storage.service.test.ts` | `secure-storage.service.ts` | 12 | Mocks electron safeStorage + fs. Covers: setItem/getItem (base64 fallback + encrypted), removeItem, clear, hasItem, getAllKeys, isEncryptionAvailable, corrupt data handling |
| 10 | `tests/main/services/environment.service.test.ts` | `environment.service.ts` | 15 | Mocks electron + fs. Covers: get, getOrDefault, getRequired, getBoolean, getNumber, dev/prod, env file parsing (.env.local, comments), getAll, reload |
| 11 | `tests/main/services/code-server.service.test.ts` | `code-server.service.ts` | 14 | Mocks electron, fs, child_process. Covers: toDockerPath, getUserDataDir, getExtensionsDir, getStatus, getContainerName, findFreePort, syncVSCodeSettings, createContainerGitConfig, createContainerBashrc, getGitMounts, getClaudeMounts, stop. **Missing: start(), waitForReady(), checkDockerAvailable()** |

### 2.2 Renderer Tests (22 files)

| # | Test File | Module Under Test | Test Cases | Coverage Notes |
|---|-----------|-------------------|------------|----------------|
| 12 | `tests/renderer/lib/utils.test.ts` | `lib/utils.ts` | 8 | Full coverage: cn() with merging, conditionals, undefined/null, dedup, empty, arrays, objects, Tailwind color merging |
| 13 | `tests/renderer/stores/useSettingsStore.test.ts` | `useSettingsStore.ts` | 7 | Covers: initial state, fetchSettings (success/loading/error), updateSettings (success/error), setTheme, setDefaultClonePath, setAutoFetch. **Missing: setDefaultProjectsPath, setDefaultProfessionalProjectsPath** |
| 14 | `tests/renderer/stores/useContributionsStore.test.ts` | `useContributionsStore.ts` | 4 | Covers: initial state, setContributions, fetchContributions (success/error), deleteContribution. **Missing: createContribution, updateContribution, getContributionById** |
| 15 | `tests/renderer/stores/useIssuesStore.test.ts` | `useIssuesStore.ts` | 6 | Covers: initial state, searchIssues (success/loading/error), setSearchQuery, setSelectedLabels, clearIssues. Full coverage. |
| 16 | `tests/renderer/hooks/useKeyboardShortcuts.test.ts` | `useKeyboardShortcuts.ts` | 6 | Covers: Ctrl+K, Meta+K, no modifier, Escape, Ctrl+comma, cleanup on unmount, optional handlers |
| 17 | `tests/renderer/providers/ThemeProvider.test.tsx` | `ThemeProvider.tsx` | 7 | Covers: default theme, localStorage, custom storage key, setTheme, document class toggle, system theme resolution, useTheme in provider |
| 18 | `tests/renderer/components/ui/Button.test.tsx` | `ui/Button.tsx` | 7 | Covers: render children, click, disabled, variant data-attr, size data-attr, className, ref forwarding |
| 19 | `tests/renderer/components/ErrorBoundary.test.tsx` | `ErrorBoundary.tsx` | 4 | Covers: render children, error UI, "Try again" button, accessible alert role |
| 20 | `tests/renderer/components/layout/Sidebar.test.tsx` | `layout/Sidebar.tsx` | 6 | Covers: expanded nav items, app title, collapsed state, onScreenChange, onToggle, active highlight |
| 21 | `tests/renderer/components/contributions/StatusBadge.test.tsx` | `contributions/StatusBadge.tsx` | 5 | Covers: in_progress, ready, submitted, merged statuses, correct classNames |
| 22 | `tests/renderer/components/issues/IssueCard.test.tsx` | `issues/IssueCard.tsx` | 6 | Covers: title, repo name, labels, overflow labels (+N), onViewDetails click, created date |
| 23 | `tests/renderer/components/settings/AliasesTab.test.tsx` | `settings/AliasesTab.tsx` | 7 | Covers: empty state, existing aliases, add form rendering, empty name validation, space validation, add alias, default aliases info |
| 24 | `tests/renderer/screens/DashboardScreen.test.tsx` | `DashboardScreen.tsx` | 5 | Covers: welcome message, active contributions card, issues viewed card, getting started guide, zero counts |
| 25 | `tests/renderer/screens/SettingsScreen.test.tsx` | `SettingsScreen.tsx` | 5 | Covers: heading, all tabs rendered, General default, switch to API tab, switch to Aliases tab |
| 26 | `tests/renderer/screens/DevelopmentScreen.test.ts` | `DevelopmentScreen.tsx` (extractOwnerRepo helper) | 10 | Covers: HTTPS URL, HTTPS .git, SSH URL, SSH no .git, dots in repo, hyphens, non-GitHub, empty, trailing slash, query string |
| 27 | `tests/renderer/screens/DevelopmentScreen.toolbar.test.tsx` | `DevelopmentScreen.tsx` (toolbar) | 30+ | Covers: Remotes button styling (3), PR button styling (4), Remotes dropdown (open/empty/error), PR dropdown (open/empty/error/badges), dropdown close toggle, PR modal open/close, Issues button styling (green/red/default), Issues dropdown (open/empty/error/branched badge), Issue modal open/close, Create buttons (New Issue, New PR) |
| 28 | `tests/renderer/.../PullRequestDetailModal.helpers.test.tsx` | `PullRequestDetailModal.tsx` (helpers) | 11 | Covers: reviewStateBadge (APPROVED/CHANGES_REQUESTED/COMMENTED/DISMISSED/unknown), statusBadge (merged/open/closed), formatDate (Date/string/different date) |
| 29 | `tests/renderer/.../PullRequestDetailModal.test.tsx` | `PullRequestDetailModal.tsx` | 25+ | Covers: null pr, loading, error/retry, PR title, fallback title, body markdown, empty body, empty state, timeline comments, reviews, filtered COMMENTED reviews, APPROVED no body, review comments (with/without line), activity count, avatar/placeholder, comment submission (disabled/whitespace/enabled/success/clear), View on GitHub, status badges (merged/open/closed) |
| 30 | `tests/renderer/.../CreatePullRequestModal.test.tsx` | `CreatePullRequestModal.tsx` | 9 | Covers: closed state, form fields, disabled submit, enabled submit, successful submission (IPC args, callbacks), error display, cancel, defaultHead pre-fill, defaultBase pre-fill, base defaults to "main" |
| 31 | `tests/renderer/.../DevelopmentIssueDetailModal.helpers.test.tsx` | `DevelopmentIssueDetailModal.tsx` (helpers) | 4 | Covers: issueStatusBadge (open/closed), formatDate (Date/string) |
| 32 | `tests/renderer/.../DevelopmentIssueDetailModal.test.tsx` | `DevelopmentIssueDetailModal.tsx` | 20+ | Covers: null issue, loading, error/retry, issue title, fallback title, body markdown, empty state, labels, comments, comment count, avatar/placeholder, open/closed badges, branched badge (true/false), comment submission (disabled/enabled/success/clear), View on GitHub |
| 33 | `tests/renderer/.../CreateIssueModal.test.tsx` | `CreateIssueModal.tsx` | 8 | Covers: closed state, form fields, disabled submit, enabled submit, successful submission (IPC args, callbacks), error display, cancel, label splitting/trimming |

---

## 3. Coverage Gap Analysis

### 3.1 Untested Source Modules

| # | Source File | Category | Risk | Notes |
|---|-----------|----------|------|-------|
| 1 | `src/main/index.ts` | Entry point | HIGH | IPC handler registration, window creation, cleanup logic -- all untested |
| 2 | `src/main/preload.ts` | IPC bridge | MEDIUM | Context bridge exposure untested |
| 3 | `src/main/ipc/handlers.ts` | IPC wrapper | MEDIUM | `handleIpc()`, `removeAllIpcHandlers()` untested |
| 4 | `src/main/services/contribution-scanner.service.ts` | Service | HIGH | Entire service untested: `scanDirectory()`, `scanRepository()`, `validateRemotes()`, `extractRepoInfo()`, `getIssueTitle()` |
| 5 | `src/renderer/App.tsx` | Root component | MEDIUM | Screen routing, keyboard shortcuts integration, IDE state management |
| 6 | `src/renderer/ipc/client.ts` | IPC client | LOW | Simple wrapper; heavily mocked in other tests |
| 7 | `src/renderer/hooks/useContributionWorkflow.ts` | Hook | MEDIUM | Workflow logic untested |
| 8 | `src/renderer/stores/useProjectsStore.ts` | Store | LOW | Identical pattern to other stores; simple CRUD |
| 9 | `src/renderer/stores/useProfessionalProjectsStore.ts` | Store | LOW | Identical pattern to other stores; simple CRUD |
| 10 | `src/renderer/screens/IssueDiscoveryScreen.tsx` | Screen | MEDIUM | Search flow, issue selection, contribution workflow |
| 11 | `src/renderer/screens/ContributionsScreen.tsx` | Screen | MEDIUM | Scan, list, delete, open IDE flow |
| 12 | `src/renderer/screens/ProjectsScreen.tsx` | Screen | LOW | List + open IDE |
| 13 | `src/renderer/screens/ProfessionalProjectsScreen.tsx` | Screen | LOW | List + open IDE |

### 3.2 Untested Components

| # | Component | Risk | Notes |
|---|-----------|------|-------|
| 1 | `layout/Layout.tsx` | LOW | Layout wrapper |
| 2 | `layout/AppBar.tsx` | LOW | Static UI |
| 3 | `ThemeToggle.tsx` | LOW | Simple toggle |
| 4 | `contributions/ContributionCard.tsx` | MEDIUM | Card display with actions |
| 5 | `contributions/ContributionList.tsx` | LOW | List wrapper |
| 6 | `contributions/ContributionWorkflowModal.tsx` | MEDIUM | Multi-step workflow modal |
| 7 | `issues/IssueList.tsx` | LOW | List wrapper |
| 8 | `issues/IssueDetailModal.tsx` | MEDIUM | Discovery screen issue modal |
| 9 | `issues/SearchPanel.tsx` | MEDIUM | Search + filter UI |
| 10 | `issues/RepositoryFileTree.tsx` | MEDIUM | File tree rendering |
| 11 | `issues/CreateSubIssueModal.tsx` | MEDIUM | Sub-issue creation |
| 12 | `issues/AddExistingSubIssueModal.tsx` | LOW | Simple form |
| 13 | `pull-requests/MarkdownEditor.tsx` | MEDIUM | Complex formatting toolbar |
| 14 | `settings/GeneralTab.tsx` | LOW | Path pickers + theme |
| 15 | `settings/APITab.tsx` | MEDIUM | Token management |
| 16 | All 18 UI primitives except Button | LOW | Thin Radix wrappers |
| 17 | `ui/ReactionPicker.tsx` | MEDIUM | Emoji picker + reaction display logic |

### 3.3 Partially Tested Modules

| Module | Methods Tested | Methods NOT Tested | Gap % |
|--------|---------------|-------------------|-------|
| `git.service.ts` | 14 of 18 | `clone`, `init`, `getRemotes`, `compareBranches` | 22% |
| `github.service.ts` | 8 of 15 | `getAuthenticatedUser`, `getIssue`, `createPullRequest`, `getUserRepositories`, `searchRepositoriesByTopic`, `getRepositoryTree`, `getRateLimit` | 47% |
| `github-graphql.service.ts` | 6 of 8 | `getRepositoryTree` | 12% |
| `github-rest.service.ts` | 15 of 32 | `updateIssue`, `createIssue`, `getRepositoryContents`, `getRepository`, `starRepository`, `unstarRepository`, `listPullRequests`, 6 Reaction methods, 3 Sub-Issue methods | 53% |
| `code-server.service.ts` | 12 of 16 | `start()`, `waitForReady()`, `checkDockerAvailable()`, `stripJsonc()` | 25% |
| `useSettingsStore.ts` | 5 of 7 actions | `setDefaultProjectsPath`, `setDefaultProfessionalProjectsPath` | 29% |
| `useContributionsStore.ts` | 3 of 6 actions | `createContribution`, `updateContribution`, `getContributionById` | 50% |
| `DevelopmentScreen.tsx` | extractOwnerRepo + toolbar | Core IDE lifecycle (start/stop/error), webview rendering | ~40% |

---

## 4. Stale / Outdated Tests

### 4.1 Confirmed Stale Tests

| # | Test File | Issue | Severity |
|---|-----------|-------|----------|
| 1 | `tests/main/database/schema.test.ts` (line 13) | Asserts `SCHEMA_VERSION` is `2`, but `src/main/database/schema.ts` defines it as `3`. Migration v3 (type column) was added but test was not updated. | **CRITICAL -- test will FAIL** |
| 2 | `tests/main/database/schema.test.ts` | Tests only migration v2 columns; does not test migration v3 (type column). | MEDIUM |

### 4.2 Stale Code (Not Tests)

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `src/main/ipc/handlers.ts` (`removeAllIpcHandlers()`) | Lists stale channels: `terminal:spawn`, `terminal:write`, `terminal:resize`, `terminal:kill`, `fs:watch-directory`, `fs:unwatch-directory` -- these do not exist in `IpcChannels`. Also missing 15+ newer channels (git:get-branches, git:compare-branches, all reaction/sub-issue channels, etc.) | HIGH |
| 2 | `CLAUDE.md` and `src/CLAUDE.md` | Claims 9 Zustand stores but only 6 exist. Missing stores: useCodeEditorStore, useFileTreeStore, useGitStore, useIDEStore, useTerminalStore. | MEDIUM (documentation inaccuracy) |
| 3 | `src/CLAUDE.md` | References Jest and PropTypes but project uses Vitest and TypeScript interfaces. Contains generic React code examples not relevant to the actual codebase. | LOW |

---

## 5. Prioritized Recommendations

### Priority 1: CRITICAL (Fix Immediately)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Fix schema.test.ts** -- Update `SCHEMA_VERSION` assertion from 2 to 3 and add test for migration v3 (type column) | Test suite will fail without this fix | 15 min |
| 2 | **Fix removeAllIpcHandlers()** -- Update channel list to match current `IpcChannels` definition. Stale channels cause ipcMain.removeHandler warnings; missing channels cause handler leaks on window close. | Memory leaks, handler conflicts on reload | 30 min |

### Priority 2: HIGH (Next Sprint)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 3 | **Add tests for contribution-scanner.service.ts** -- Entire service has zero test coverage. This service powers the core "scan contributions" feature. | Critical business logic untested | 2-3 hrs |
| 4 | **Test github-rest.service.ts Reactions & Sub-Issues** -- 9 methods (6 reaction, 3 sub-issue) with zero coverage. These are recently added features. | New features shipping untested | 2 hrs |
| 5 | **Test code-server.service.ts start()** -- The 7-step Docker container lifecycle is the most complex untested method. | IDE launch failures would be invisible to tests | 2-3 hrs |
| 6 | **Test useContributionsStore missing actions** -- `createContribution`, `updateContribution`, `getContributionById` handle the core CRUD workflow. | CRUD bugs not caught | 30 min |
| 7 | **Test github.service.ts missing facade methods** -- 7 methods untested in the caching facade layer. | Cache invalidation bugs, error propagation | 1-2 hrs |

### Priority 3: MEDIUM (This Quarter)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 8 | **Test IssueDiscoveryScreen** -- Primary user-facing search flow untested | User journey gaps | 2 hrs |
| 9 | **Test ContributionsScreen** -- Primary contribution management flow untested | User journey gaps | 2 hrs |
| 10 | **Test MarkdownEditor** -- Complex component with formatting toolbar | Editor bugs in PR/issue creation | 1.5 hrs |
| 11 | **Test ContributionWorkflowModal** -- Multi-step workflow modal (clone, fork, branch) | Workflow breakage not caught | 2 hrs |
| 12 | **Test useContributionWorkflow hook** -- Business logic for the workflow | Logic bugs | 1 hr |
| 13 | **Test git.service.ts missing methods** -- `clone()`, `compareBranches()`, `getRemotes()`, `init()` | 4 untested methods in core git service | 1 hr |
| 14 | **Fix CLAUDE.md documentation** -- Update store count from 9 to 6, remove references to non-existent stores | Developer confusion | 15 min |
| 15 | **Test APITab.tsx** -- Token management (save/validate/clear) | Security-related UI untested | 1 hr |
| 16 | **Test ReactionPicker.tsx** -- `groupReactions()` helper + ReactionDisplay component | UI logic bugs | 45 min |

### Priority 4: LOW (Backlog)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 17 | Test useProjectsStore + useProfessionalProjectsStore | Pattern identical to tested stores | 30 min |
| 18 | Test useSettingsStore missing actions | Delegate methods, low risk | 15 min |
| 19 | Test remaining UI primitives (Card, Badge, Dialog, etc.) | Thin Radix wrappers, low risk | 2 hrs total |
| 20 | Test Layout, AppBar, ThemeToggle | Static/simple UI | 1 hr |
| 21 | Test CreateSubIssueModal, AddExistingSubIssueModal | Simple forms | 1 hr |
| 22 | Test IssueDetailModal (discovery screen version) | Similar pattern to tested DevelopmentIssueDetailModal | 1 hr |
| 23 | Test ProjectsScreen, ProfessionalProjectsScreen | Same pattern as ContributionsScreen | 1.5 hrs |
| 24 | Rewrite src/CLAUDE.md to reflect actual patterns (Vitest, no PropTypes, actual hooks) | Documentation accuracy | 30 min |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total source files** | ~80 |
| **Total test files** | 33 |
| **Main process services** | 10 files, 9 service classes |
| **Renderer screens** | 7 (3 tested) |
| **Renderer components** | 43 (14 tested) |
| **Renderer stores** | 6 (3 tested) |
| **Renderer hooks** | 2 (1 tested) |
| **IPC channels** | 60+ |
| **Database tables** | 4 |
| **Stale tests** | 1 file (schema.test.ts) |
| **Untested services** | 1 (contribution-scanner) |
| **Partially tested services** | 5 |
| **Estimated total test cases** | ~330 |
| **Critical fixes needed** | 2 |
| **High priority items** | 5 |

---

**Report generated by JUNO (Quality Auditor)**
**Trinity Version:** 2.1.0
