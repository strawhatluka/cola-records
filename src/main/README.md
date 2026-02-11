# Main Process

Electron main process code for Cola Records.

## Overview

The main process handles all backend operations including IPC communication, database access, and external service integrations.

## Structure

```
main/
├── index.ts              # Main entry point, IPC handlers
├── preload.ts            # Preload script for context bridge
├── database/             # SQLite database layer
├── services/             # Backend service implementations
├── ipc/                  # IPC channel definitions
└── workers/              # Worker thread pool
```

## Key Components

### Entry Point (`index.ts`)

- Application lifecycle management
- IPC handler registration
- Window creation and management
- Service initialization

### Services

| Service        | File                                       | Purpose                     |
| -------------- | ------------------------------------------ | --------------------------- |
| Database       | `database/database.service.ts`             | SQLite CRUD operations      |
| Git            | `services/git.service.ts`                  | Local git operations        |
| GitHub         | `services/github.service.ts`               | GitHub API orchestration    |
| GitHub REST    | `services/github-rest.service.ts`          | GitHub REST API calls       |
| GitHub GraphQL | `services/github-graphql.service.ts`       | GitHub GraphQL queries      |
| Code Server    | `services/code-server.service.ts`          | Docker container management |
| Terminal       | `services/terminal.service.ts`             | PTY terminal instances      |
| Spotify        | `services/spotify.service.ts`              | Spotify Web API             |
| Discord        | `services/discord.service.ts`              | Discord REST API            |
| File System    | `services/filesystem.service.ts`           | File/directory operations   |
| Git Ignore     | `services/gitignore.service.ts`            | Git ignore patterns         |
| Secure Storage | `services/secure-storage.service.ts`       | Credential storage          |
| Environment    | `services/environment.service.ts`          | Environment detection       |
| Scanner        | `services/contribution-scanner.service.ts` | Project directory scanning  |
| Updater        | `services/updater.service.ts`              | Auto-update management      |

### IPC Channels

IPC channels follow the `domain:action` naming convention (15 categories, 120+ channels):

- `fs:*` - File system operations (8 channels)
- `git:*` - Git operations (17 channels)
- `github:*` - GitHub API proxy (45 channels)
- `contribution:*` - Contribution CRUD (7 channels)
- `settings:*` - Application settings (4 channels)
- `terminal:*` - PTY terminal management (4 channels)
- `spotify:*` - Spotify playback (18 channels)
- `discord:*` - Discord messaging (29 channels)
- `dev-scripts:*` - Custom scripts (3 channels)
- `code-server:*` - VS Code server (6 channels)
- `updater:*` - Auto-update (5 channels)
- `project:*` - Project scanning (1 channel)
- `gitignore:*` - Git ignore (2 channels)
- `dialog:*` - Native dialogs (1 channel)
- `shell:*` - Shell operations (3 channels)

## Documentation

See [CLAUDE.md](CLAUDE.md) for main process development guidelines.
