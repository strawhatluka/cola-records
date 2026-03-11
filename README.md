# Cola Records

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/lukadfagundes/cola-records/actions/workflows/ci.yml/badge.svg)](https://github.com/lukadfagundes/cola-records/actions/workflows/ci.yml)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A cross-platform desktop developer workspace that brings together GitHub project management, an embedded IDE, integrated terminal, and third-party services into a single application.

## Features

### GitHub Integration

- **Issue Discovery** - Search for "good first issues" across GitHub repositories with filtering and sorting
- **Contribution Tracking** - Fork, clone, and track progress on open-source contributions
- **Pull Request Management** - Create, review, and monitor pull requests with status checks
- **Branch Management** - Create, switch, and manage Git branches with visual UI
- **GitHub Config Tools** - Edit CODEOWNERS, issue templates, workflows, and markdown files

### Development Environment

- **Embedded IDE** - Code-server (VS Code) running in Docker with config sync
- **Multi-Tab Terminal** - xterm.js-based terminal with Git Bash, PowerShell, and CMD support
- **Monaco Editor** - Integrated code editor for configuration files
- **SSH Remotes** - Configure and connect to SSH hosts for remote development

### Project Tooling

- **Dev Scripts** - Define, manage, and execute custom development scripts
- **Build Configuration** - Visual editors for build, test, lint, format, and coverage configs
- **Package Management** - Explore and manage npm dependencies
- **Environment Editor** - Edit `.env` files with variable management
- **EditorConfig & Hooks** - Manage `.editorconfig` and Git hooks visually
- **CLI Explorer** - Discover and browse installed CLI tools
- **Maintenance Tools** - Disk usage analysis, version management, changelog generation

### AI Assistant

- **Multi-Provider Support** - Gemini, Anthropic (Claude), OpenAI, and Ollama (local)
- **Configurable Models** - Select from available models per provider with API key management

### Integrations

- **Spotify** - Music playback with now playing, playlists, search, and volume control
- **Discord** - Full messaging client with channels, embeds, polls, reactions, emoji/GIF/sticker pickers
- **Notifications** - Centralized notification system with persistence

### Core Features

- **Git Operations** - Clone, commit, push, pull, branch, and remote management via simple-git
- **Auto-Updates** - Automatic update detection, download, and installation via GitHub Releases
- **SQLite Database** - Local persistence for contributions, settings, scripts, cache, and notifications
- **Dark/Light Theme** - System-aware theming with manual toggle

## Screenshots

<!-- Add screenshots here -->

## Installation

### Download

Download the latest release from [GitHub Releases](https://github.com/lukadfagundes/cola-records/releases).

### Windows

1. Download `ColaRecordsSetup.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch Cola Records from the Start Menu

### macOS

1. Download `Cola Records.dmg`
2. Open the DMG file
3. Drag Cola Records to your Applications folder
4. Launch from Applications

### Linux

**Debian/Ubuntu:**

```bash
sudo dpkg -i cola-records_<version>_amd64.deb
```

**Fedora/RHEL:**

```bash
sudo rpm -i cola-records-<version>.x86_64.rpm
```

## Requirements

- **Git** - Required for version control operations
- **GitHub Account** - For issue discovery and contribution tracking
- **Docker** _(optional)_ - Required only for the embedded IDE (code-server)

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Docker Desktop _(optional, for code-server)_

### Getting Started

```bash
# Clone the repository
git clone https://github.com/lukadfagundes/cola-records.git
cd cola-records

# Install dependencies
npm install

# Start development server
npm start
```

### Available Scripts

| Script                  | Description                                |
| ----------------------- | ------------------------------------------ |
| `npm start`             | Start the Electron app in development mode |
| `npm run start:clean`   | Clean build artifacts and start fresh      |
| `npm test`              | Run all tests (Vitest)                     |
| `npm run test:watch`    | Run tests in watch mode                    |
| `npm run test:coverage` | Run tests with coverage report             |
| `npm run lint`          | Run ESLint                                 |
| `npm run lint:fix`      | Run ESLint with auto-fix                   |
| `npm run typecheck`     | Run TypeScript type checking               |
| `npm run format`        | Format code with Prettier                  |
| `npm run format:check`  | Check code formatting                      |
| `npm run build:win`     | Build Windows installer (Squirrel)         |
| `npm run build:mac`     | Build macOS DMG                            |
| `npm run build:linux`   | Build Linux packages (DEB + RPM)           |
| `npm run clean`         | Remove build artifacts                     |

Build artifacts are output to the `out/` directory.

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App lifecycle
│   ├── database/            # SQLite schema and service (better-sqlite3)
│   ├── ipc/                 # IPC handler modules (12 domain handlers)
│   ├── services/            # Backend services (39 service files)
│   └── workers/             # Background workers (contribution scanning)
├── renderer/                # React renderer process
│   ├── App.tsx              # Root component with screen-based navigation
│   ├── components/          # React components (153 files)
│   │   ├── branches/        # Branch management UI
│   │   ├── contributions/   # Contribution tracking cards/lists
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── discord/         # Discord client (19 components)
│   │   ├── documentation/   # Markdown/Mermaid rendering
│   │   ├── issues/          # GitHub issue discovery
│   │   ├── layout/          # App shell, sidebar, header
│   │   ├── notifications/   # Notification center
│   │   ├── projects/        # Project management
│   │   ├── pull-requests/   # PR creation and detail views
│   │   ├── settings/        # Settings panels (8 tabs)
│   │   ├── spotify/         # Spotify player (7 components)
│   │   ├── tools/           # Dev tooling (51 components)
│   │   ├── ui/              # Radix UI primitives (23 components)
│   │   └── updates/         # Auto-update notifications
│   ├── hooks/               # Custom React hooks
│   ├── ipc/                 # Type-safe IPC client
│   ├── screens/             # 8 application screens
│   └── stores/              # 11 Zustand state stores
└── types/                   # Shared TypeScript types
```

### Tech Stack

| Layer     | Technology                            |
| --------- | ------------------------------------- |
| Framework | Electron 40                           |
| UI        | React 19, Tailwind CSS, Radix UI, CVA |
| State     | Zustand 5                             |
| Database  | SQLite (better-sqlite3)               |
| Build     | Vite 7, Electron Forge                |
| Terminal  | xterm.js 6, node-pty                  |
| Git       | simple-git                            |
| Testing   | Vitest 4, React Testing Library       |
| Language  | TypeScript 5.9 (strict mode)          |

### IPC Architecture

Communication between main and renderer processes uses a `domain:action` pattern across 12 handler modules:

`github` | `core` | `contribution` | `settings` | `integrations` | `dev-tools` | `ai` | `github-config` | `notification` | `project` | `workflow`

## Documentation

Detailed documentation is available in the [docs/](docs/) directory:

### Guides

- [Getting Started](docs/guides/getting-started.md) - Installation and initial setup
- [API Development](docs/guides/api-development.md) - IPC channel reference
- [Deployment](docs/guides/deployment.md) - Building and publishing releases

### Architecture

- [Application Flow](docs/architecture/mvc-flow.md) - Electron IPC architecture
- [Database Schema](docs/architecture/database-er.md) - SQLite ER diagram
- [Component Hierarchy](docs/architecture/component-hierarchy.md) - React component tree

## Configuration

All configuration is managed through the in-app Settings screen. No external config files are required.

### Required

1. **GitHub Token** - Required for GitHub API access
   - Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
   - Create a token with `public_repo` and `read:user` scopes
   - Add to **Settings > API** tab in the app

### Optional Integrations

Configure these in Settings:

| Integration                      | Settings Tab | Auth Method          |
| -------------------------------- | ------------ | -------------------- |
| Spotify                          | API          | OAuth flow           |
| Discord                          | API          | Token-based          |
| AI (Gemini, Claude, GPT, Ollama) | AI           | API key per provider |
| Code Server (Docker)             | Code Server  | Local Docker         |
| SSH Remotes                      | SSH Remotes  | SSH key/config       |

## Auto-Updates

Cola Records includes automatic update functionality:

1. The app notifies you when a new version is available
2. Click "Download" to download the update in the background
3. Once downloaded, click "Install & Restart" to apply

Updates are published to GitHub Releases and downloaded securely over HTTPS.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/lukadfagundes/cola-records/issues) - Bug reports and feature requests
- [Discussions](https://github.com/lukadfagundes/cola-records/discussions) - Questions and community
