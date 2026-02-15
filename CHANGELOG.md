# Changelog

All notable changes to Cola Records will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Fixed "Stop & Back" button closing all open projects instead of only the active one ([#4](https://github.com/lukadfagundes/cola-records/issues/4))
  - Changed `stopAndGoBack` to use `code-server:remove-workspace` instead of `code-server:stop` so only the current project's workspace is removed
  - Changed `handleNavigateBack` to use `closeProject` instead of `closeAll` so other open projects are preserved

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
