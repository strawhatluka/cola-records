# Changelog

All notable changes to Cola Records will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  - Tool navigation order: Issues → Pull Requests → Dev Scripts → Terminal → Maintenance
  - Header Issues/PR buttons now act as Tool Box navigation shortcuts (color indicators preserved)
  - Added `inline` rendering mode to `DevelopmentIssueDetailModal`, `CreateIssueModal`, `PullRequestDetailModal`, and `CreatePullRequestModal`
  - Removed standalone Issues/PR dropdown panels and modal popups from header toolbar

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
  - Updated `ToolsPanel.test.tsx` for new default tool (Issues) and 5-tool menu
  - Updated `DevelopmentScreen.toolbar.test.tsx` for Tool Box navigation pattern (removed dropdown/modal tests)
  - Updated `DevelopmentScreen.tools.test.tsx` to remove stale modal mocks

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
