# Getting Started with Cola Records

## Overview

Cola Records is an Electron desktop application for tracking open-source contributions with integrated GitHub workflow management. Built with React 19, TypeScript, and SQLite, it provides a seamless experience for managing your contributions across multiple repositories.

## Prerequisites

Before installing Cola Records, ensure you have the following:

- **Node.js 18 or higher** - Download from [nodejs.org](https://nodejs.org)
- **npm 9+** - Comes with Node.js
- **Git** - Download from [git-scm.com](https://git-scm.com)
- **GitHub account** with personal access token

## Installation

```bash
# Clone the repository
git clone https://github.com/lukadfagundes/cola-records.git
cd cola-records

# Install dependencies
npm install

# This automatically runs electron-rebuild via postinstall
# to compile native modules (better-sqlite3, node-pty) for Electron
```

### Troubleshooting Installation

If you encounter issues with native module compilation:

```bash
# Manually rebuild native modules
npx electron-rebuild

# On Windows, you may need build tools
npm install --global windows-build-tools

# On macOS, ensure Xcode command line tools are installed
xcode-select --install
```

## Configuration

### GitHub Token Setup

A GitHub personal access token is required for API access:

1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Click "Generate new token (classic)"
3. Set an expiration and description (e.g., "Cola Records")
4. Select the following scopes:
   - `public_repo` - Access public repositories
   - `read:user` - Read user profile data
   - `repo` - Full control of private repositories (optional, for private repos)
5. Click "Generate token" and copy the token
6. Enter the token in Cola Records Settings > API Tab

### Environment Variables

While tokens can be configured in-app, you can optionally create a `.env` file:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_API_TIMEOUT=30000
MAX_RETRIES=3

# Application Settings
NODE_ENV=development
DEFAULT_CLONE_PATH=/path/to/your/projects
AUTO_FETCH_ENABLED=true
CACHE_TTL_HOURS=24
LOG_LEVEL=info
```

### Optional Integrations

Cola Records also supports optional integrations:

**Spotify Integration:**

- Configure OAuth credentials in Settings > API Tab
- Enables background music during development

**Discord Integration:**

- Add your Discord token in Settings > API Tab
- Enables Discord messaging directly from the app

## Running the Application

### Development Mode

```bash
# Start with hot reload
npm start

# Start with clean build (clears cache)
npm run start:clean
```

The application will open automatically. Hot reload is enabled for renderer process changes.

### Production Build

```bash
# Build for current platform
npm run make

# Platform-specific builds
npm run build:win    # Windows (NSIS installer + portable)
npm run build:mac    # macOS (DMG + ZIP)
npm run build:linux  # Linux (AppImage, deb, rpm)
```

## Project Structure

Cola Records follows an Electron architecture with separate main and renderer processes:

```
src/
  main/                     # Main Process (Node.js)
    index.ts               # Main entry point
    preload.ts             # Preload script (IPC bridge)
    database/              # SQLite database service
    services/              # Backend services
      git.service.ts       # Local git operations
      github.service.ts    # GitHub API integration
      spotify.service.ts   # Spotify integration
      discord.service.ts   # Discord integration
      terminal.service.ts  # PTY terminal handling

  renderer/                # Renderer Process (React)
    index.tsx              # React entry point
    screens/               # Application screens (7 total)
      DashboardScreen.tsx
      IssueDiscoveryScreen.tsx
      ContributionsScreen.tsx
      ProjectsScreen.tsx
      ProfessionalProjectsScreen.tsx
      DevelopmentScreen.tsx
      SettingsScreen.tsx
    components/            # React components (80 total)
    stores/                # Zustand state stores (9 files, 5 exported via index.ts)
    hooks/                 # Custom React hooks
```

### State Stores Note

The application uses 9 Zustand store files:

- **5 stores** are exported from `stores/index.ts` for convenient imports
- **4 stores** must be imported directly from their files:
  - `useDiscordStore` - Discord connection state
  - `useProfessionalProjectsStore` - Professional project tracking
  - `useProjectsStore` - Open source project tracking
  - `useSpotifyStore` - Spotify playback state

## Core Features

### Contribution Tracking

- Track issues you're working on across multiple repositories
- Monitor PR status (open, merged, closed)
- Manage local branches and remotes

### Issue Discovery

- Search GitHub issues with advanced filters
- Fork repositories and create branches automatically
- Full issue detail view with comments and reactions

### Development Tools

- Integrated terminal with PTY support
- Custom dev scripts per project
- Monaco editor integration

### Integrations

- Spotify player for background music
- Discord client for team communication

## Database

Cola Records uses SQLite (better-sqlite3) for local data persistence:

| Table          | Purpose                      |
| -------------- | ---------------------------- |
| contributions  | Tracked contribution records |
| settings       | Application configuration    |
| github_cache   | API response caching         |
| dev_scripts    | Custom project scripts       |
| schema_version | Database migration tracking  |

## Next Steps

- [API Development Guide](./api-development.md) - Learn about IPC channels and services
- [Deployment Guide](./deployment.md) - Build and distribute the application
- [Contributing Guide](./contributing.md) - Contribute to the project

## Quick Reference

| Command             | Description            |
| ------------------- | ---------------------- |
| `npm start`         | Start development mode |
| `npm test`          | Run test suite         |
| `npm run lint`      | Lint code              |
| `npm run format`    | Format code            |
| `npm run typecheck` | Type check TypeScript  |
| `npm run make`      | Build for production   |

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/lukadfagundes/cola-records/issues)
- **Documentation**: Check the `docs/` directory for detailed guides
