# Changelog

All notable changes to Cola Records will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Fixed innerHTML XSS vector in MermaidBlock component (CRIT-001)
  - Added DOMPurify sanitization of Mermaid SVG output before DOM insertion
  - DOMPurify config allows SVG profiles and `foreignObject` for Mermaid compatibility
  - Blocks `<script>` tags, event handler attributes, and other XSS vectors
  - Added `dompurify` as direct dependency (previously transitive only)
- Reduced npm vulnerabilities from 75 to 52, eliminating all critical CVEs (HIGH-002)
  - Removed `electron-icon-builder` (unused — pulled in `phantomjs-prebuilt` chain with 2 critical `form-data` CVEs)
  - Ran `npm audit fix` for safe transitive dependency patches
  - Remaining 52 vulnerabilities are dev-only toolchain deps (Electron Forge, ESLint) with zero runtime impact

### Changed

- Split `channels.ts` (1,241 LOC) into domain-based type modules with barrel re-export (HIGH-003)
  - `channels/types.ts` — 46 shared interfaces and type aliases
  - `channels/github.channels.ts` — `GitHubChannels` partial interface (git, github, gitignore channels)
  - `channels/integrations.channels.ts` — `IntegrationChannels` partial interface (spotify, discord channels)
  - `channels/core.channels.ts` — `CoreChannels` partial interface (fs, contribution, settings, terminal, etc.)
  - `channels/events.ts` — `IpcEvents` interface (9 events)
  - `channels/index.ts` — barrel composing `IpcChannels` via `extends`; original `channels.ts` reduced to 1-line re-export
  - Zero import changes needed in consuming files (backward-compatible barrel)
- Extracted `PullRequestDetailModal` types and utilities into `pr-detail/` module (HIGH-003)
  - `pr-detail/types.ts` — 11 interfaces + `TimelineItem` union type
  - `pr-detail/utils.tsx` — 6 pure utility functions (`reviewStateBadge`, `statusBadge`, `formatDate`, `formatRelativeTime`, `parseDiffHunkHeader`, `getReviewActionText`)
  - `pr-detail/index.ts` — barrel re-export
  - `PullRequestDetailModal.tsx` reduced by ~200 lines
- Eliminated all 86 unsafe `any` type annotations across 5 API service files (HIGH-001)
  - Created `src/types/spotify-api.types.ts` — 7 interfaces for Spotify REST API response shapes
  - Created `src/types/github-graphql.types.ts` — 7 interfaces for GitHub GraphQL response shapes
  - Created `src/types/discord-api.types.ts` — 22 interfaces for Discord REST API response shapes
  - `discord.service.ts`: 35 `any` → proper Discord API types
  - `github-rest.service.ts`: 28 `any` → Octokit inferred types + inline type assertions
  - `github-graphql.service.ts`: 11 `any` → GraphQL generic response types
  - `spotify.service.ts`: 7 `any` → Spotify API response types
  - `github.service.ts`: 1 `any[]` → `unknown[]`
  - Fixed 3 catch blocks: `catch (error: any)` → `catch (error: unknown)` with proper type narrowing

### Tests

- MermaidBlock sanitization tests (CRIT-001)
  - 3 new tests: DOMPurify called with correct config, script tag stripping, event handler stripping
  - Existing tests updated with DOMPurify mock (passthrough — no behavior change for valid SVG)

## [1.0.5] - 2026-02-19

### Added

- Dashboard screen with 6 live widgets in a responsive 2-column grid ([#18](https://github.com/lukadfagundes/cola-records/issues/18))
  - **Contribution Status** widget: 4 metric cards (Open PRs, Merged PRs 30d, Open Issues, Closed Issues 30d) via `github:search-issues-and-prs` with `Promise.allSettled` error isolation
  - **GitHub Profile** widget: real avatar image (with initial fallback), bio, "Member since" date, 4-stat row (Repos/Stars/Followers/Following), and top-3 language usage bar via expanded `github:get-authenticated-user` GraphQL query and `github:list-user-repos` IPC channel
  - **PRs Needing Attention** widget: up to 10 open PRs the user is involved in (`involves:` query — authored, assigned, review-requested, mentioned) with aggregated review state and CI status, plus "Open in Cola Records" button per entry via `github:search-issues-and-prs`, `github:list-pr-reviews`, `github:get-pr-check-status`
  - **Open Issues** widget: issues assigned to user AND issues authored by user across all of GitHub via dual `github:search-issues-and-prs` queries with `Promise.allSettled`, merged and deduplicated, sorted by newest first, limited to 10, with label badges and "Open in Cola Records" button per entry
  - **Recent Activity** widget: last 10 GitHub events (push, PR, issue, create, delete, fork, star, comment, review, release) via `github:list-user-events` with type-specific icons
  - **CI/CD Status** widget: latest workflow run per repo (all repos, no limit) with color-coded status dots (green/red/yellow/gray), sorted by most recent, limited to 10 displayed, via `github:list-user-repos`, `github:list-workflow-runs` and `Promise.allSettled` error isolation
  - Reusable `DashboardWidget` wrapper component with loading spinner, error + retry, empty state, and no-token fallback rendering
  - Shared dashboard utilities: `formatRelativeTime`, CI status color constants
  - New `github:search-issues-and-prs` IPC channel wrapping GitHub Search API with normalized results
  - New `github:list-user-events` IPC channel wrapping GitHub Events API with normalized event data
  - Barrel export for all dashboard components and utilities (`components/dashboard/index.ts`)
  - All widgets fetch data directly from GitHub API — no dependency on local contributions store
  - Graceful degradation: widgets detect missing GitHub token and show "Connect GitHub in Settings" prompt
  - "Open in Cola Records" navigation: PRs, Issues, and CI/CD widgets include a per-entry button that matches `repoFullName` to a local Contribution record and opens the project in the IDE via `DashboardScreen` → `App.tsx` `handleOpenIDE` callback plumbing
- Auto-assign issue to authenticated user when clicking "Fix Issue" in the Issues tool ([#18](https://github.com/lukadfagundes/cola-records/issues/18))
  - New `github:add-assignees` IPC channel wrapping `client.issues.addAssignees`
  - New `addAssignees()` method in `GitHubRestService`
  - Best-effort assignment after branch creation — failure does not block the Fix Issue flow

### Fixed

- Fixed Create Pull Request form not scrolling in Tool Box inline mode ([#25](https://github.com/lukadfagundes/cola-records/issues/25))
  - Removed `overflow-hidden` from `formContent` wrapper in `CreatePullRequestModal` which was blocking the outer scroll container
  - Title, Description, and Submit button are now reachable when the comparison preview is tall
- Fixed terminal output overflow breaking Tool Box layout ([#26](https://github.com/lukadfagundes/cola-records/issues/26))
  - Replaced `calc(100% - terminalHeight)` with flex-based layout in ToolsPanel to prevent ~44px overflow when header and drag handle were unaccounted for
  - Added `overflow-hidden` to ToolsPanel wrapper in DevelopmentScreen for containment
  - Header now has explicit `shrink-0` to prevent compression when terminal is large
- Fixed dev scripts from wrong project appearing in header and Tool Box when multiple projects open ([#24](https://github.com/lukadfagundes/cola-records/issues/24))
  - Changed `useDevScriptsStore` to merge scripts from multiple projects instead of replacing the global array
  - Added `selectScriptsForProject()` utility for consumer-side filtering by `projectPath`
  - `DevelopmentScreen` header buttons now filter by `contribution.localPath`
  - `DevScriptsTool` script list now filters by `workingDirectory`
- Fixed links in code-server opening in Electron window instead of user's default browser ([#28](https://github.com/lukadfagundes/cola-records/issues/28))
  - Added global `app.on('web-contents-created')` handler with `setWindowOpenHandler` to redirect external URLs via `shell.openExternal`
  - Only `http://` and `https://` protocols are opened externally (security hardening)

### Tests

- Dashboard feature tests
  - `utils.test.tsx`: tests covering `formatRelativeTime`, CI status color constants
  - `DashboardWidget.test.tsx`: 10 tests covering loading, error, empty, noToken, children, retry, and state priority
  - `ContributionStatusWidget.test.tsx`: 5 tests covering 4 metric cards with counts, no-token fallback, partial/total failure handling
  - `GitHubProfileWidget.test.tsx`: 14 tests covering loading, error, data, noToken, avatar image/fallback, bio, followers/following, "Member since" date, language bar, repo count, stars
  - `PRsNeedingAttentionWidget.test.tsx`: 9 tests covering PR list, review/CI icons, empty state, 10-item limit, `involves:` query, Open button callback, no Open button without prop, error handling
  - `OpenIssuesWidget.test.tsx`: 11 tests covering issue list, labels, 10-item limit, noToken, dual-query merge/dedup, assigned + authored results, Open button callback, no Open button without prop, error handling
  - `RecentActivityWidget.test.tsx`: 9 tests covering event descriptions (push/PR/issue/create), 10-item limit, noToken, error handling
  - `CICDStatusWidget.test.tsx`: 13 tests covering pipeline list, status dots (green/red/yellow), empty repos, all-rejected error surfacing, noToken, all repos processed (no 5-repo limit), 10-pipeline display limit, Open button callback, no Open button without prop
  - `DashboardScreen.test.tsx`: 8 tests covering header, widget composition, grid layout, scrollable area, `onOpenIDE` prop plumbing to PRs, Issues, and CI/CD widgets
  - `github-rest.service.test.ts`: 9 new tests for `searchIssuesAndPullRequests` and `listUserEvents` (field mapping, query pass-through, empty results, API errors)
  - `github-rest.service.test.ts`: 2 new tests for `addAssignees` (correct params, API error)
  - `DevelopmentIssueDetailModal.test.tsx`: 2 new tests for Fix Issue auto-assign (assigns user after branch creation, completes when assignment fails)
  - `CreatePullRequestModal.test.tsx`: 1 new test for inline mode scrollable container regression check
  - `ToolsPanel.test.tsx`: 1 new test for flex-based tool content layout regression guard ([#26](https://github.com/lukadfagundes/cola-records/issues/26))
- Dev script overrun fix tests ([#24](https://github.com/lukadfagundes/cola-records/issues/24))
  - `useDevScriptsStore.test.ts`: 6 new tests for multi-project merge behavior and `selectScriptsForProject`
  - `DevScriptsTool.test.tsx`: 2 new tests for cross-project script isolation
  - Updated existing "different project paths" test for merge semantics
  - Updated store mocks in 4 DevelopmentScreen test files and ToolsPanel test to export `selectScriptsForProject`
- Webview external link redirect tests ([#28](https://github.com/lukadfagundes/cola-records/issues/28))
  - `webview-external-links.test.ts`: 5 tests covering handler registration, http/https redirect, deny action, and non-http protocol blocking

## [1.0.4] - 2026-02-17

### Added

- Persistent webview sessions for multi-project support ([#6](https://github.com/lukadfagundes/cola-records/issues/6))
  - All open DevelopmentScreens now render persistently using CSS visibility toggling (`display: none`/`display: contents`) instead of conditional mounting
  - Background processes (Claude Code, terminals, builds) survive tab switches — webview WebSocket connections stay alive
  - Previously, switching project tabs unmounted the `<webview>`, severing the code-server connection and killing the Extension Host Process ~5 min later
- In-app documentation reader with category navigation and Mermaid diagram support ([#8](https://github.com/lukadfagundes/cola-records/issues/8))
  - New "Documentation" screen accessible from sidebar navigation
  - Category-based browsing of `docs/` directory (subdirectories as categories)
  - Full GitHub Flavored Markdown rendering with Mermaid diagram support
  - New `docs:get-structure` IPC channel for documentation tree retrieval
- Code Server settings tab for Docker container resource configuration ([#3](https://github.com/lukadfagundes/cola-records/issues/3))
  - Resource allocation with presets (Light, Standard, Performance, Unlimited) and manual CPU/memory/shared memory controls
  - Live container usage display polling `docker stats` every 5 seconds with CPU and memory progress bars
  - Startup behavior settings: auto-start Docker Desktop toggle and configurable health check timeout
  - VS Code settings: auto-sync host settings toggle, GPU acceleration select, terminal scrollback lines
  - Extension management: add/remove VS Code extension IDs for auto-install on container start
  - Environment configuration: timezone setting and custom environment variables with reserved name validation
  - Advanced: configurable container name
  - New `code-server:get-stats` IPC channel for real-time container resource monitoring
  - New `CodeServerConfig` and `EnvVar` type definitions with full IPC round-trip persistence
- Automatic container recreation when resource config changes ([#3](https://github.com/lukadfagundes/cola-records/issues/3))
  - `hasResourceConfigChanged()` compares saved CPU/memory/SHM settings against running container via `docker inspect`
  - `parseMemoryString()` converts Docker memory notation (e.g. `4g`, `512m`) to bytes for comparison
  - `start()` now detects config drift on stopped or running containers and recreates with updated settings
- `checkDockerAvailable()` respects `autoStartDocker` config setting — throws immediately when disabled instead of polling
- Tool Box expansion: Issues and Pull Requests moved from header dropdowns into Tool Box panel ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `IssuesTool` component with inline list, detail, and create views inside Tool Box
  - New `PullRequestsTool` component with inline list, detail, and create views inside Tool Box
  - Tool Box now opens by default when entering Development screen with 60/40 IDE/Tool Box split
  - Tool Box panel is resizable by dragging the border (min 300px, max 70% of viewport)
  - Invisible overlay during resize prevents Electron `<webview>` from capturing mouse events (fixes drag lock and choppy movement)
  - First-click resize reads actual DOM width to avoid snap when pixel state is uninitialized
  - Tool navigation order: Issues → Pull Requests → Actions → Dev Scripts → Terminal → Maintenance
  - Header Issues/PR buttons now act as Tool Box navigation shortcuts (color indicators preserved)
  - Added `inline` rendering mode to `DevelopmentIssueDetailModal`, `CreateIssueModal`, `PullRequestDetailModal`, and `CreatePullRequestModal`
  - Removed standalone Issues/PR dropdown panels and modal popups from header toolbar
- GitHub Actions tool in Tool Box with workflow run monitoring ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `ActionsTool` component with list → run detail → job logs navigation
  - Workflow runs list with color-coded status badges (green/red/yellow/gray), branch, event, actor, and relative timestamps
  - Run detail view showing summary metadata, jobs with duration, and step-by-step status dots
  - Job logs viewer with truncation (last 500 lines) and "Open in GitHub" link
  - 3 new IPC channels: `github:list-workflow-runs`, `github:list-workflow-run-jobs`, `github:get-job-logs`
  - 3 new `GitHubRestService` methods: `listWorkflowRuns`, `listWorkflowRunJobs`, `getJobLogs`
- GitHub Releases tool in Tool Box with full release lifecycle management ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `ReleasesTool` component with list → detail → draft-edit → create views
  - Releases list sorted newest-to-oldest with Latest, Draft, and Pre-release badges
  - Detail view with full Markdown rendering (ReactMarkdown + remark-gfm + rehype-raw) and delete confirmation
  - Draft edit view with tag, title, body (MarkdownEditor with write/preview tabs), pre-release and latest checkboxes, save/publish/delete actions
  - Create view for new draft releases with tag name, title, target branch, body, and pre-release/latest options
  - 6 new IPC channels: `github:list-releases`, `github:get-release`, `github:create-release`, `github:update-release`, `github:delete-release`, `github:publish-release`
  - 5 new `GitHubRestService` methods: `listReleases`, `getRelease`, `createRelease`, `updateRelease`, `deleteRelease`
  - Tool navigation order updated: Issues → Pull Requests → Actions → Releases → Dev Scripts → Terminal → Maintenance
- Persistent terminal bar at bottom of Tool Box panel ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - Terminal removed from hamburger menu navigation (6 tools remain: Issues, Pull Requests, Actions, Releases, Dev Scripts, Maintenance)
  - Minimized terminal bar always visible at bottom of Tool Box regardless of active tool, with Terminal icon, label, and expand chevron
  - Click to expand terminal to 50% of Tool Box height; tool content on top, terminal on bottom
  - Vertical drag-to-resize handle between tool content and terminal when expanded (min 100px, max 80% of container)
  - Invisible overlay during resize prevents content from capturing mouse events (same pattern as horizontal IDE/Tool Box resize)
  - `adoptSessions` auto-expands terminal bar instead of switching active tool
  - Tool navigation order updated: Issues → Pull Requests → Actions → Releases → Dev Scripts → Maintenance (Terminal is always-present fixture)

### Tests

- 7 new tests for persistent webview sessions (1759 total, 109 test files, all passing)
  - `App.persistent-webviews.test.tsx`: 7 tests covering simultaneous rendering, display state toggling, tab switch DOM preservation, non-IDE screen hiding, project close cleanup, and empty state
- 67 new tests for Code Server settings feature (1752 total, 108 test files, all passing)
  - `CodeServerTab.test.tsx`: 37 tests covering rendering, presets, save/reset/validation, extensions, env vars, stats polling
  - `code-server.service.test.ts`: 24 tests covering resource config in `createContainer`, env/startup config, `getContainerStats`, `hasResourceConfigChanged`, container recreation on config change
  - `useSettingsStore.test.ts`: 4 tests covering `codeServerConfig` state lifecycle
  - `SettingsScreen.test.tsx`: 2 tests covering Code Server tab navigation
  - `factories.ts`: New `createMockCodeServerConfig()` and `createMockEnvVar()` test factories
- 31 new tests for Tool Box expansion (all passing)
  - `IssuesTool.test.tsx`: 15 tests covering list/detail/create views, sorting, badges, callbacks, error/empty states
  - `PullRequestsTool.test.tsx`: 16 tests covering list/detail/create views, sorting, badges, callbacks, error/empty states
  - Updated `ToolsPanel.test.tsx` for new default tool (Issues) and 6-tool menu
  - Updated `DevelopmentScreen.toolbar.test.tsx` for Tool Box navigation pattern (removed dropdown/modal tests)
- Tests for GitHub Actions tool
  - `ActionsTool.test.tsx`: 18 tests covering list/detail/logs views, status badges, navigation, refresh, error/empty states
  - `github-rest.service.test.ts`: 9 new tests for `listWorkflowRuns`, `listWorkflowRunJobs`, `getJobLogs` (field mapping, empty results, API errors)
  - Updated `DevelopmentScreen.tools.test.tsx` to remove stale modal mocks
- Tests for GitHub Releases tool
  - `ReleasesTool.test.tsx`: 22 tests covering list/detail/draft-edit/create views, badges, navigation, delete confirmation, publish, MarkdownEditor integration
  - `github-rest.service.test.ts`: 15 new tests for `listReleases`, `getRelease`, `createRelease`, `updateRelease`, `deleteRelease` (field mapping, isLatest inference, empty results, API errors)
  - Updated `ToolsPanel.test.tsx` for 7-tool menu
- Tests for persistent terminal bar
  - Updated `ToolsPanel.test.tsx`: 6-tool menu assertions (Terminal removed), new `persistent terminal bar` describe block with 5 tests (minimized bar rendering, expand on click, collapse on click, drag handle presence, bar visible across tool switches), updated adoption tests for auto-expand behavior

## [1.0.3] - 2026-02-15

### Added

- Branch naming now follows `<type>/<number>-<description>` convention ([#7](https://github.com/lukadfagundes/cola-records/issues/7))
  - Added `generateBranchName()` utility that maps GitHub labels to type prefixes (bug→fix, enhancement→feat, documentation→docs, etc.)
  - Updated both Development screen and Issues screen branch creation to use new naming

## [1.0.2] - 2026-02-15

### Fixed

- Fixed terminal double-paste bug where Ctrl+V pasted clipboard content twice ([#1](https://github.com/lukadfagundes/cola-records/issues/1))
  - Switched from `onData` to `terminal.paste()` so paste flows through xterm's data handler exactly once
  - Added `e.preventDefault()` to block the browser's native paste event
- Fixed issue close/reopen failing silently with no user feedback ([#10](https://github.com/lukadfagundes/cola-records/issues/10))
  - Added error alerts to `handleCloseIssue` and `handleReopenIssue` so users see why the operation failed
  - Added `Issues: Read/Write` to required GitHub token permissions in `.env.example`
- Fixed Issues button color and "branched" badge not updating after Fix Issue creates a branch
  - Extracted branch fetching into reusable `fetchBranches` callback and added it to the issue modal's `onClose` handler
  - Fix required permissions in 'settings/api' screen
- Fixed "Stop & Back" button closing all open projects instead of only the active one ([#4](https://github.com/lukadfagundes/cola-records/issues/4))
  - Changed `stopAndGoBack` to use `code-server:remove-workspace` instead of `code-server:stop` so only the current project's workspace is removed
  - Changed `handleNavigateBack` to use `closeProject` instead of `closeAll` so other open projects are preserved

### Added

- Auto-start Docker Desktop when navigating to the Development screen ([#5](https://github.com/lukadfagundes/cola-records/issues/5))
  - Added `launchDockerDesktop()` with platform-specific launch commands (macOS, Windows, Linux)
  - Modified `checkDockerAvailable()` to automatically launch Docker Desktop and poll for up to 60 seconds

## [1.0.1] - 2026-02-12

### Fixed

- Moved `app-update.yml` generation to `postPackage` hook so file is placed in correct location (resources folder next to app.asar)
- Fixed `postPackage` hook to handle macOS app bundle structure (`Cola Records.app/Contents/Resources/`) for `app-update.yml` generation

## [1.0.0] - 2026-02-12

### Changed

- Replaced dark mode toggle in AppBar with dynamic version indicator

### Added

#### Core Application

- Electron 40.x desktop application with React 19 and TypeScript
- Main process (Node.js) + Renderer process (React) architecture with IPC bridge
- SQLite database with better-sqlite3 (schema version 6, 5 tables)
- Auto-update functionality via electron-updater with GitHub Releases integration
- Secure storage service for credential management

#### User Interface

- 7 application screens: Dashboard, Issues, Contributions, Projects, Professional, IDE, Settings
- 87 React components built with Radix UI primitives and Tailwind CSS
- 9 Zustand stores for state management (5 exported via index, 4 direct import)
- Monaco Editor integration for code editing
- React resizable panels for flexible layouts
- Toast notifications via Sonner
- Virtualized lists with react-window for performance

#### Issue Discovery

- GitHub "good first issues" search across repositories
- Issue filtering by language, labels, and repository
- Issue detail view with full markdown rendering
- Issue caching with local database storage

#### Contribution Tracking

- Fork and clone repositories directly from the app
- Track contribution progress through workflow stages
- Contribution status management (In Progress, Completed, Abandoned)
- Contribution scanner service for project directory analysis

#### Git Integration

- Built-in Git operations: clone, commit, push, pull, fetch
- Branch management: create, switch, delete, checkout
- Remote management: add, remove, configure remotes
- Git status and diff viewing
- Simple-git library integration with 17 IPC channels
- Gitignore service for managing ignore patterns

#### GitHub Integration

- GitHub REST API client (@octokit/rest) with 45 IPC channels
- GitHub GraphQL API client (@octokit/graphql)
- Pull request creation and management
- Issue viewing and interaction
- Repository search and discovery
- User profile and authentication

#### Embedded IDE (Development Screen)

- Code-server (VS Code) running in Docker container
- Full editor capabilities with extension support
- 6 IPC channels for container management
- Container status monitoring and health checks

#### Terminal Integration

- Multi-tab terminal with node-pty backend
- Shell support: Git Bash, PowerShell, CMD
- xterm.js frontend with addon-fit and web-links
- 4 IPC channels for PTY terminal management
- Working directory synchronization with projects

#### Spotify Integration

- Spotify Web API integration with OAuth authentication
- Music playback during development sessions
- Now playing display with track information
- Playback controls (play, pause, skip, volume)
- 18 IPC channels for Spotify operations
- Dedicated Spotify store for playback state

#### Discord Integration

- Discord REST API integration for messaging
- Server and channel listing
- Message sending and receiving
- 29 IPC channels for Discord operations
- Dedicated Discord store for connection state

#### Multi-Project Workspace

- Open Projects store for managing multiple projects
- Project switching and context preservation
- Project-specific dev scripts support
- 3 IPC channels for dev-scripts management

#### SSH Remotes

- SSH host configuration for remote access
- Terminal-based remote connections
- 3 IPC channels for shell operations

#### File System Operations

- File and directory operations service
- 8 IPC channels for file system access
- Native dialog integration for file/folder selection

#### Settings Management

- Application settings persistence
- GitHub token configuration
- Spotify OAuth configuration
- Discord token configuration
- 4 IPC channels for settings operations

#### Developer Tooling

- Custom dev scripts per project
- Tools panel with terminal and editor access
- Environment detection service

#### CI/CD Pipeline

- GitHub Actions CI workflow (.github/workflows/ci.yml)
- Automated linting (ESLint) and formatting checks (Prettier)
- TypeScript type checking on push/PR
- Vitest test suite with coverage reporting
- Multi-platform builds (Windows, macOS, Linux) via matrix strategy
- npm dependency caching for faster builds
- Build artifacts uploaded with 7-day retention
- Concurrency control to cancel outdated runs

#### Release Workflow

- GitHub Actions release workflow (.github/workflows/release.yml)
- Triggered on version tags (v*.*.\*)
- Multi-platform builds: Windows (Squirrel), macOS (DMG/ZIP), Linux (DEB/RPM)
- Automatic release notes extraction from CHANGELOG.md
- Draft GitHub Releases with all platform artifacts
- Integration with electron-updater for auto-updates
- No code signing (users may see OS warnings on first install)

#### Pre-commit Hooks

- Pre-commit configuration with auto-formatting
- Trailing whitespace and end-of-file fixes
- YAML and JSON validation
- Large file detection (500KB limit)
- Merge conflict detection
- Private key detection
- ESLint with auto-fix
- Prettier with auto-format

#### Database Layer

- SQLite database with better-sqlite3
- 5 database tables for data persistence
- Contribution CRUD operations (7 IPC channels)
- Updater operations (5 IPC channels)

### Changed

### Deprecated

### Removed

### Fixed

### Security

- Secure storage service for credential management
- GitHub token stored securely
- OAuth tokens protected

## [0.0.8] - 2026-02-12

### Fixed

- Release workflow now only includes changelog notes in release body (removed Downloads table)
- Release workflow now requires matching version section in CHANGELOG.md before releasing
- Update notification dialog enlarged (50% wider, 30% taller) for better readability

## [0.0.6] - 2026-02-12

### Fixed

- Update notification release notes now render as Markdown instead of raw HTML
- Update notification dialog widened and uses styled scrollbars

## [0.0.5] - 2026-02-12

### Fixed

- Auto-updater now programmatically sets GitHub feed URL instead of relying on `app-update.yml` file
- Release workflow now generates `latest.yml` and `latest-mac.yml` manifests required by electron-updater

## [0.0.4] - 2026-02-12

### Added

- Update notification UI with user action options:
  - **Install Now**: Download and install updates immediately
  - **Remind Me Later**: Dismiss notification for current session
  - **Skip This Version**: Permanently skip specific version (persisted to localStorage)
- Update notification dialog states: available, downloading (with progress), downloaded, error
- `useUpdaterStore` Zustand store for update state management
- IPC event listeners for real-time update progress from main process
- Comprehensive test coverage for update notification (70 new tests)

## [0.0.3] - 2026-02-12

### Added

- CI/CD pipeline with GitHub Actions
- Multi-platform builds (Windows, macOS, Linux)
- Release workflow with automatic changelog extraction

### Fixed

- ESLint flat config compatibility (removed `--ext` flag)
- Native module compilation for better-sqlite3 and node-pty in CI
- macOS pip install with `--break-system-packages` flag
- Windows build environment setup
- Cross-platform path handling for SSH config

[Unreleased]: https://github.com/lukadfagundes/cola-records/compare/v0.0.8...HEAD
[0.0.8]: https://github.com/lukadfagundes/cola-records/compare/v0.0.6...v0.0.8
[0.0.6]: https://github.com/lukadfagundes/cola-records/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/lukadfagundes/cola-records/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/lukadfagundes/cola-records/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/lukadfagundes/cola-records/releases/tag/v0.0.3
