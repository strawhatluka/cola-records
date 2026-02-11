# Source Code

Main source code for Cola Records, an Electron desktop application.

## Overview

This directory contains all application source code, split between Electron's main and renderer processes.

## Structure

```
src/
├── main/           # Electron main process (Node.js)
├── renderer/       # React renderer process (browser)
└── types/          # Shared TypeScript type definitions
```

## Architecture

Cola Records uses Electron's multi-process architecture:

| Process  | Technology            | Purpose                                  |
| -------- | --------------------- | ---------------------------------------- |
| Main     | Node.js + TypeScript  | Backend services, IPC handlers, database |
| Renderer | React 19 + TypeScript | User interface, state management         |

### Main Process (`main/`)

- IPC handler registration
- Database operations (SQLite)
- Git operations (simple-git)
- GitHub API integration
- Spotify/Discord services
- Terminal management (node-pty)

### Renderer Process (`renderer/`)

- React components and screens
- Zustand state management
- Tailwind CSS styling
- IPC client for main process communication

## Documentation

- See [CLAUDE.md](CLAUDE.md) for React/TypeScript coding standards
- See [main/CLAUDE.md](main/CLAUDE.md) for main process patterns
- See [renderer/CLAUDE.md](renderer/CLAUDE.md) for renderer patterns
