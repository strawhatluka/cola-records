# Cola Records

A desktop application for managing developer contributions to open-source projects.

## Features

- **Issue Discovery**: Search GitHub for "good first issues" across repositories
- **Contribution Tracking**: Fork, clone, and track progress on contributions
- **Git Integration**: Built-in Git operations (clone, commit, push, branch, remotes)
- **Embedded IDE**: Code-server (VS Code) running in Docker
- **Terminal Integration**: Multi-tab terminal with Git Bash, PowerShell, CMD support
- **Spotify Integration**: Music playback during development sessions
- **Discord Integration**: Community communication client
- **SSH Remotes**: Configure SSH hosts for terminal-based access

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
sudo dpkg -i cola-records_1.0.0_amd64.deb
```

**Fedora/RHEL:**

```bash
sudo rpm -i cola-records-1.0.0.x86_64.rpm
```

## Requirements

- **Docker**: Required for the embedded IDE (code-server)
- **Git**: Required for version control operations
- **GitHub Account**: For issue discovery and contribution tracking

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Docker Desktop (for code-server)

### Installation

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

| Script                | Description                  |
| --------------------- | ---------------------------- |
| `npm start`           | Start the development server |
| `npm run build:win`   | Build Windows installer      |
| `npm run build:mac`   | Build macOS DMG              |
| `npm run build:linux` | Build Linux packages         |
| `npm test`            | Run tests                    |
| `npm run lint`        | Run ESLint                   |
| `npm run typecheck`   | Run TypeScript type checking |

### Building from Source

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Build artifacts will be in the `out/` directory.

## Auto-Updates

Cola Records includes automatic update functionality. When a new version is available:

1. The app will notify you of the update
2. Click "Download" to download the update in the background
3. Once downloaded, click "Install & Restart" to apply the update

Updates are published to GitHub Releases and downloaded securely over HTTPS.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read the contribution guidelines before submitting a pull request.

## Support

- [GitHub Issues](https://github.com/lukadfagundes/cola-records/issues)
- [Discussions](https://github.com/lukadfagundes/cola-records/discussions)
