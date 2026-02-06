# ORCHESTRATOR WORK ORDER #003
## Type: IMPLEMENTATION
## Comprehensive Test Coverage Implementation

---

## MISSION OBJECTIVE

Implement test coverage across the entire Cola Records codebase, targeting ≥80% line and branch coverage. Build test infrastructure (mocks, factories, setup), then systematically test all layers: database, services, IPC handlers, Zustand stores, hooks, providers, components, and screens.

**Implementation Goal:** Full test suite with 30 test files covering all testable units, running via Vitest with 2-shard parallelism.
**Based On:** TRA test coverage plan + JUNO audit (41 findings). Follows WO-002 (settings redesign).
**Testing Framework:** Vitest (already configured in vitest.config.ts)

---

## JUNO AUDIT CONTEXT

The JUNO audit identified 41 findings (4 Critical, 7 High, 12 Medium, 12 Low, 6 Info). Tests should cover:
- Security-critical paths (filesystem access, shell commands, token handling)
- Error handling gaps identified by audit
- State management correctness
- Component rendering and interactions

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Infrastructure:
  - path: tests/setup.ts
    purpose: Vitest global setup with jsdom, Electron mocks, window.electronAPI mock, localStorage mock, jest-dom matchers
    risk: MEDIUM

  - path: tests/mocks/electron.ts
    purpose: Mock Electron modules (app, BrowserWindow, ipcMain, dialog, shell, safeStorage)
    risk: MEDIUM

  - path: tests/mocks/ipc.ts
    purpose: Mock IPC client (renderer-side window.electronAPI)
    risk: LOW

  - path: tests/mocks/database.ts
    purpose: SQLite mock / in-memory database factory
    risk: MEDIUM

  - path: tests/mocks/factories.ts
    purpose: Test data factories (Contribution, Issue, Settings, GitStatus, Repository)
    risk: LOW

Database_Tests:
  - path: tests/main/database/schema.test.ts
    purpose: CREATE_TABLES SQL validity, SCHEMA_VERSION, MIGRATIONS structure
    risk: LOW

  - path: tests/main/database/database.service.test.ts
    purpose: CRUD operations, settings get/set, cache, migrations, error handling
    risk: MEDIUM

Service_Tests:
  - path: tests/main/services/environment.service.test.ts
    purpose: get/set, env file parsing, boolean/number coercion, reload
    risk: LOW

  - path: tests/main/services/filesystem.service.test.ts
    purpose: read/write/delete, directory operations, path utilities
    risk: MEDIUM

  - path: tests/main/services/gitignore.service.test.ts
    purpose: Pattern matching, caching, filtering, .gitignore detection
    risk: LOW

  - path: tests/main/services/git.service.test.ts
    purpose: All git operations via simple-git mock
    risk: MEDIUM

  - path: tests/main/services/contribution-scanner.service.test.ts
    purpose: Directory scanning, repo detection, remote validation, URL parsing
    risk: MEDIUM

  - path: tests/main/services/github-graphql.service.test.ts
    purpose: GraphQL search, repository, token validation, user, topics, tree
    risk: MEDIUM

  - path: tests/main/services/github-rest.service.test.ts
    purpose: REST issues, PRs, forks, repos, stars, rate limit
    risk: MEDIUM

  - path: tests/main/services/github.service.test.ts
    purpose: Unified caching layer, TTL, cache invalidation, delegated methods
    risk: MEDIUM

  - path: tests/main/services/code-server.service.test.ts
    purpose: Port finder, Docker path conversion, settings sync, gitconfig, bashrc, Docker lifecycle
    risk: HIGH

  - path: tests/main/ipc/handlers.test.ts
    purpose: handleIpc, removeIpcHandler, removeAllIpcHandlers, sendToRenderer
    risk: LOW

Store_Tests:
  - path: tests/renderer/stores/useSettingsStore.test.ts
    purpose: Initial state, fetch, update, theme/path/autoFetch setters, loading/error
    risk: LOW

  - path: tests/renderer/stores/useContributionsStore.test.ts
    purpose: CRUD operations, state updates, loading/error, getContributionById
    risk: LOW

  - path: tests/renderer/stores/useIssuesStore.test.ts
    purpose: Search, labels, query state, clearIssues, loading/error
    risk: LOW

Provider_and_Hook_Tests:
  - path: tests/renderer/providers/ThemeProvider.test.tsx
    purpose: Default theme, switching, localStorage, matchMedia, useTheme hook
    risk: LOW

  - path: tests/renderer/hooks/useKeyboardShortcuts.test.ts
    purpose: Ctrl+K, Escape, Ctrl+Comma, cleanup on unmount
    risk: LOW

  - path: tests/renderer/hooks/useContributionWorkflow.test.ts
    purpose: Workflow state machine, progress updates, error handling
    risk: MEDIUM

Component_Tests:
  - path: tests/renderer/components/ui/Button.test.tsx
    purpose: Variants, sizes, disabled, onClick
    risk: LOW

  - path: tests/renderer/components/ui/Card.test.tsx
    purpose: Renders children, classNames
    risk: LOW

  - path: tests/renderer/components/ui/Input.test.tsx
    purpose: onChange, types, disabled, ref forwarding
    risk: LOW

  - path: tests/renderer/components/ErrorBoundary.test.tsx
    purpose: Normal rendering, error catch, fallback UI, reset
    risk: LOW

  - path: tests/renderer/components/layout/Layout.test.tsx
    purpose: Renders sidebar + main content, collapse behavior
    risk: LOW

  - path: tests/renderer/components/layout/Sidebar.test.tsx
    purpose: Nav items, active state, screen change callback
    risk: LOW

  - path: tests/renderer/components/layout/AppBar.test.tsx
    purpose: Renders title, ThemeToggle
    risk: LOW

  - path: tests/renderer/components/contributions/StatusBadge.test.tsx
    purpose: Status labels and classNames for each status
    risk: LOW

  - path: tests/renderer/components/contributions/ContributionCard.test.tsx
    purpose: Renders details, delete button, open project, sync
    risk: MEDIUM

  - path: tests/renderer/components/contributions/ContributionList.test.tsx
    purpose: Loading skeleton, empty state, renders cards
    risk: LOW

  - path: tests/renderer/components/issues/IssueCard.test.tsx
    purpose: Renders title, labels, repository, click handler
    risk: LOW

  - path: tests/renderer/components/issues/IssueList.test.tsx
    purpose: Loading skeleton, empty state, renders cards
    risk: LOW

  - path: tests/renderer/components/issues/SearchPanel.test.tsx
    purpose: Language select, label checkboxes, search submission
    risk: LOW

  - path: tests/renderer/components/settings/GeneralTab.test.tsx
    purpose: Directory browser, theme select, save handler
    risk: LOW

  - path: tests/renderer/components/settings/APITab.test.tsx
    purpose: Token input, validation flow, success/error states
    risk: LOW

  - path: tests/renderer/components/settings/AliasesTab.test.tsx
    purpose: Add/edit/delete aliases, validation rules, keyboard shortcuts
    risk: MEDIUM

Screen_Tests:
  - path: tests/renderer/screens/DashboardScreen.test.tsx
    purpose: Renders cards with static content
    risk: LOW

  - path: tests/renderer/screens/SettingsScreen.test.tsx
    purpose: Tab navigation, renders correct tab content
    risk: LOW

  - path: tests/renderer/screens/ContributionsScreen.test.tsx
    purpose: Scans directory on mount, renders contribution list
    risk: MEDIUM

  - path: tests/renderer/screens/IssueDiscoveryScreen.test.tsx
    purpose: Search flow, issue selection, workflow modal
    risk: MEDIUM

  - path: tests/renderer/screens/DevelopmentScreen.test.tsx
    purpose: State machine (idle -> starting -> running -> error), webview rendering
    risk: MEDIUM

  - path: tests/renderer/App.test.tsx
    purpose: Renders with providers, screen navigation, settings fetch
    risk: MEDIUM
```

---

## TASK BREAKDOWN

### Phase 0: Test Infrastructure (Tasks 1-2)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 1 | Create test setup file (jsdom, Electron mocks, window.electronAPI, localStorage, jest-dom matchers) | Medium | None |
| 2 | Create shared mock factories (Electron modules, IPC client, database, data factories) | Medium | Task 1 |

### Phase 1: Database Layer (Tasks 3-5)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 3 | Database schema tests (SQL validity, version, migrations) | Low | Task 2 |
| 4 | Utility cn() function tests (class merging, tailwind merge) | Low | Task 2 |
| 5 | DatabaseService unit tests (CRUD, settings, cache, migrations, errors) | High | Task 2 |

**Parallelizable:** Tasks 3 and 4 can run in parallel.

### Phase 2: Service Tests (Tasks 6-15)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 6 | EnvironmentService tests | Medium | Task 2 |
| 7 | FileSystemService tests | Medium | Task 2 |
| 8 | GitIgnoreService tests | Medium | Task 2 |
| 9 | GitService tests (simple-git mock) | Medium | Task 2 |
| 10 | ContributionScannerService tests | Medium | Task 2 |
| 11 | GitHubGraphQLService tests | Medium | Task 2 |
| 12 | GitHubRestService tests | Medium | Task 2 |
| 13 | GitHubService (unified caching) tests | Medium | Tasks 11, 12 |
| 14 | CodeServerService tests (Docker lifecycle) | High | Task 2 |
| 15 | IPC handler utilities tests | Low | Task 2 |

**Parallelizable:** Tasks 6-12, 14, 15 all parallel. Task 13 waits on 11+12.

### Phase 3: Zustand Stores (Tasks 16-18)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 16 | useSettingsStore tests | Medium | Task 2 |
| 17 | useContributionsStore tests | Medium | Task 2 |
| 18 | useIssuesStore tests | Low | Task 2 |

**Parallelizable:** All three in parallel.

### Phase 4: Hooks & Providers (Tasks 19-21)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 19 | ThemeProvider tests | Medium | Task 2 |
| 20 | useKeyboardShortcuts tests | Low | Task 2 |
| 21 | useContributionWorkflow tests | Medium | Task 2 |

**Parallelizable:** All three in parallel.

### Phase 5: React Components (Tasks 22-28)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 22 | UI primitive tests (Button, Card, Input) | Low | Task 2 |
| 23 | ErrorBoundary tests | Low | Task 2 |
| 24 | Layout component tests (Layout, Sidebar, AppBar) | Medium | Task 19 |
| 25 | StatusBadge + ThemeToggle tests | Low | Task 19 |
| 26 | Issue component tests (IssueCard, IssueList, SearchPanel) | Medium | Task 2 |
| 27 | Contribution component tests (ContributionCard, ContributionList) | Medium | Task 2 |
| 28 | Settings tab tests (GeneralTab, APITab, AliasesTab) | Medium | Task 19 |

**Parallelizable:** Tasks 22-23 parallel, 24-25 parallel, 26-27 parallel, 28 parallel.

### Phase 6: Screen & Integration Tests (Tasks 29-30)
| Task | Description | Complexity | Dependencies |
|------|-------------|------------|--------------|
| 29 | Screen component tests (all 5 screens) | High | Tasks 16-18, 24, 26-28 |
| 30 | App root component tests | Medium | Task 29 |

**Sequential:** These must run in order.

---

## DEPENDENCY GRAPH

```
Phase 0:  [1] -> [2]
                  |
Phase 1:  [2] -> [3, 4, 5]  (3 and 4 parallel)
                  |
Phase 2:  [2] -> [6, 7, 8, 9, 10, 14, 15]  (all parallel)
          [2] -> [11, 12] -> [13]
                  |
Phase 3:  [2] -> [16, 17, 18]  (all parallel)
                  |
Phase 4:  [2] -> [19, 20, 21]  (all parallel)
                  |
Phase 5:  [2] -> [22, 23]  (parallel)
         [19] -> [24, 25]  (parallel)
          [2] -> [26, 27]  (parallel)
         [19] -> [28]
                  |
Phase 6:  [16,17,18,24,26,27,28] -> [29] -> [30]
```

---

## MOCK STRATEGY

### Main Process Mocking
- `electron` (app, BrowserWindow, ipcMain, dialog, shell, safeStorage)
- `better-sqlite3` (in-memory `:memory:` DB for integration, full mock for unit)
- `simple-git` for git service tests
- `@octokit/graphql` and `@octokit/rest` for GitHub service tests
- `child_process` (execFile) for CodeServerService
- `fs` - selectively mock or use tmp directories
- `net` - mock for port finding

### Renderer Process Mocking
- `window.electronAPI` - mock invoke/send/on globally in setup.ts
- `window.matchMedia` - mock for theme detection
- `localStorage` - mock or use jsdom built-in
- IPC client (`src/renderer/ipc/client.ts`) - mock the `ipc` singleton

### Data Factories
```typescript
// tests/mocks/factories.ts
export function createMockContribution(overrides?: Partial<Contribution>): Contribution;
export function createMockIssue(overrides?: Partial<GitHubIssue>): GitHubIssue;
export function createMockSettings(overrides?: Partial<AppSettings>): AppSettings;
export function createMockGitStatus(overrides?: Partial<GitStatus>): GitStatus;
export function createMockRepository(overrides?: Partial<GitHubRepository>): GitHubRepository;
```

---

## QUALITY GATES (BAS)

| Task Type | Gates |
|-----------|-------|
| Infrastructure (1-2) | lint, build |
| Database tests (3, 5) | lint, build, test, coverage |
| Service tests (6-15) | lint, build, test, coverage |
| Store tests (16-18) | lint, build, test, coverage |
| Hook/Provider tests (19-21) | lint, build, test, coverage |
| Component tests (22-28) | lint, test, coverage |
| Screen/Integration tests (29-30) | lint, build, test, coverage |

---

## STOP POINTS

1. **After Phase 0 (Task 2):** Verify mock infrastructure works — run a trivial test
2. **After Phase 1 (Task 5):** Verify database tests pass with in-memory SQLite
3. **After Phase 3 (Task 18):** Verify Zustand store testing pattern is solid
4. **After Phase 6 (Task 30):** Final coverage report review — target ≥80%

---

## SUCCESS CRITERIA

1. All 30 test tasks produce passing test files
2. `npm test` passes with 0 failures
3. `npm run test:coverage` reports ≥80% line and branch coverage
4. Mock infrastructure is reusable and well-documented
5. No test depends on external services (Docker, GitHub API, filesystem outside tmp)

---

## RISK ASSESSMENT

| Risk | Impact | Mitigation |
|------|--------|------------|
| Electron module mocking complexity | High | Dedicate full Tasks 1+2 to mock infrastructure |
| better-sqlite3 native module in jsdom | Medium | Use in-memory DB for integration, mock for unit |
| React 19 testing library compatibility | Low | Already have @testing-library/react 16.3 |
| IPC channel type coupling | Medium | Mock at window.electronAPI level |
| CodeServerService Docker dependency | Medium | Mock all Docker/child_process calls |

---

## ROLLBACK STRATEGY

If tests break the build:
1. Tests are in a separate `tests/` directory — no source code modified
2. `vitest.config.ts` already excludes test files from coverage of source
3. Can disable individual test files by renaming `.test.ts` → `.test.ts.skip`
4. Mock infrastructure is isolated and has no runtime dependencies

---

**Work Order Created:** 2026-02-02
**Source:** TRA Test Coverage Plan + JUNO Audit Report
**Status:** READY FOR EXECUTION
