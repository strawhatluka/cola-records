# Deployment Guide

## Overview

Cola Records uses Electron Forge for building, packaging, and publishing. This guide covers all deployment scenarios from development builds to production releases.

## Build System

Cola Records uses the following build stack:

- **Vite** - Fast bundler for renderer process
- **Electron Forge** - Build, package, and publish tooling
- **electron-rebuild** - Native module compilation

## Build Commands

### Development

```bash
# Start development mode with hot reload
npm start

# Start with clean build (clears cache first)
npm run start:clean
```

### Production Builds

```bash
# Build for current platform
npm run make

# Package only (no installers)
npm run package
```

### Platform-Specific Builds

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Publishing

```bash
# Publish release to GitHub
npm run release

# Dry run (test without publishing)
npm run release:draft
```

### Testing & Quality

```bash
# Run test suite
npm test

# Watch mode testing
npm run test:watch

# Run with coverage
npm run test:coverage

# Auto-fix lint issues
npm run lint:fix

# Check formatting
npm run format:check
```

## Output Directory

Built applications are output to the `out/` directory:

```
out/
  cola-records-win32-x64/      # Windows build
  cola-records-darwin-x64/     # macOS Intel build
  cola-records-darwin-arm64/   # macOS Apple Silicon build
  cola-records-linux-x64/      # Linux build
  make/                        # Installer packages
    squirrel.windows/          # Windows NSIS installer
    zip/                       # ZIP archives
    deb/                       # Debian packages
    rpm/                       # RPM packages
```

## Platform-Specific Notes

### Windows

**Output Formats:**

- Squirrel.Windows installer (`.exe`)
- Portable ZIP archive

**Requirements:**

- Windows 10 or later
- Code signing certificate (recommended for distribution)

**Code Signing:**

```bash
# Set certificate environment variables
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=your_password

# Build with signing
npm run build:win
```

**Known Considerations:**

- Windows Defender may flag unsigned apps
- Squirrel installer creates desktop/start menu shortcuts
- Auto-updater uses Squirrel.Windows for updates

### macOS

**Output Formats:**

- DMG disk image
- ZIP archive

**Requirements:**

- macOS 10.15 (Catalina) or later
- Apple Developer certificate for notarization

**Code Signing & Notarization:**

```bash
# Set Apple Developer credentials
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=TEAMID

# Build with signing and notarization
npm run build:mac
```

**Known Considerations:**

- Unsigned apps show "unidentified developer" warning
- Notarization required for macOS 10.15+
- Universal builds (Intel + Apple Silicon) increase bundle size

### Linux

**Output Formats:**

- AppImage (universal)
- `.deb` (Debian/Ubuntu)
- `.rpm` (Fedora/RHEL)

**Requirements:**

- Various libraries depending on features used
- `fuse` for AppImage execution

**AppImage Usage:**

```bash
# Make executable and run
chmod +x cola-records.AppImage
./cola-records.AppImage
```

**Known Considerations:**

- AppImage is most portable format
- Native packages integrate with system package manager
- Some distributions require additional dependencies

## Environment Variables

### Build-Time Variables

```env
# Build configuration
NODE_ENV=production

# Code signing (Windows)
CSC_LINK=/path/to/certificate.pfx
CSC_KEY_PASSWORD=certificate_password

# Code signing (macOS)
APPLE_ID=developer@email.com
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=ABCD1234
```

### Runtime Variables

```env
# Production settings
NODE_ENV=production

# Application behavior
GITHUB_API_TIMEOUT=30000
CACHE_TTL_HOURS=24
MAX_RETRIES=3
LOG_LEVEL=info
```

## Auto-Updates

Cola Records includes auto-update functionality via `electron-updater`.

### How It Works

1. App checks for updates on startup
2. Downloads update in background
3. Prompts user to install
4. Restarts with new version

### Update Channels

```typescript
// Configure update channel
autoUpdater.channel = 'latest'; // stable releases
autoUpdater.channel = 'beta'; // beta releases
```

### GitHub Releases Setup

1. Configure GitHub publisher in `forge.config.js`
2. Create GitHub personal access token with `repo` scope
3. Set `GITHUB_TOKEN` environment variable
4. Run `npm run release`

### Testing Updates

```bash
# Create draft release for testing
npm run release:draft

# Manually trigger update check (in development)
# Use IPC channel: updater:check
```

## Forge Configuration

The Electron Forge configuration is in `forge.config.js`:

```javascript
module.exports = {
  packagerConfig: {
    name: 'Cola Records',
    icon: './assets/icon',
    asar: true,
    // ... other options
  },
  makers: [
    { name: '@electron-forge/maker-squirrel' },
    { name: '@electron-forge/maker-zip' },
    { name: '@electron-forge/maker-deb' },
    { name: '@electron-forge/maker-rpm' },
    { name: '@electron-forge/maker-dmg' },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'strawhatluka',
          name: 'cola-records',
        },
      },
    },
  ],
  plugins: [{ name: '@electron-forge/plugin-vite' }],
};
```

## Native Modules

Cola Records uses native Node.js modules that require compilation:

- **better-sqlite3** - SQLite database
- **node-pty** - Terminal emulation

### Rebuilding Native Modules

```bash
# Automatic rebuild (runs via postinstall)
npm install

# Manual rebuild
npx electron-rebuild

# Rebuild specific module
npx electron-rebuild -m node_modules/better-sqlite3
```

### Troubleshooting Native Modules

**Windows:**

```bash
# Install build tools
npm install --global windows-build-tools

# Or install Visual Studio Build Tools manually
```

**macOS:**

```bash
# Install Xcode command line tools
xcode-select --install
```

**Linux:**

```bash
# Install build essentials
sudo apt-get install build-essential python3
```

## Build Artifacts

### Clean Build

```bash
# Remove all build artifacts
npm run clean

# This removes:
# - dist/
# - .vite/
# - out/
```

### Artifact Sizes (Approximate)

| Platform | Packaged | Installer         |
| -------- | -------- | ----------------- |
| Windows  | ~180 MB  | ~65 MB            |
| macOS    | ~200 MB  | ~70 MB (DMG)      |
| Linux    | ~190 MB  | ~60 MB (AppImage) |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install

      - run: npm run make

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: out/make/**/*
```

## Troubleshooting

### Build Fails

1. Clear cache: `npm run clean`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Rebuild native modules: `npx electron-rebuild`

### Signing Issues

- Verify certificate is valid and not expired
- Check environment variables are set correctly
- Ensure certificate has proper signing capabilities

### Update Issues

- Verify GitHub release is published (not draft)
- Check `GITHUB_TOKEN` has correct permissions
- Verify version number is incremented in `package.json`

## Version Management

Update version in `package.json` before release:

```json
{
  "version": "1.0.11"
}
```

Use semantic versioning:

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backwards compatible
- **Patch** (0.0.1): Bug fixes
