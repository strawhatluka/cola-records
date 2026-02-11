# Changelog

All notable changes to Cola Records will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/lukadfagundes/cola-records/compare/main...HEAD
