# WO-000: VS Code Embedding Proof of Concept (Testing Screen)

**Phase:** 0 - Proof of Concept
**Priority:** CRITICAL
**Complexity:** 6/10
**Dependencies:** None
**Estimated Tasks:** 10
**Category References:** Architectural pivot — replaces WO-042 through WO-070

---

## Objective

Create a "Testing" screen in Cola Records that embeds a full VS Code instance via code-server. This proves the architectural approach of embedding VS Code (with the Claude Code extension) instead of reimplementing ~342 features from scratch across 29 work orders.

## Background

Cola Records currently has a custom IDE with 17+ Claude panel components, a Docker-based Claude container service, and ~27% feature parity with the Claude Code VS Code extension. Two prior audits missed functionality gaps. Rather than implementing 29 work orders (WO-042 through WO-070) to achieve parity, this POC tests embedding code-server (which runs full VS Code in the browser) to get 100% parity immediately.

## Acceptance Criteria

- [ ] "Testing" tab appears in sidebar navigation with FlaskConical icon
- [ ] Clicking Testing shows a folder picker / launch screen
- [ ] Selecting a folder spawns code-server on a free localhost port
- [ ] VS Code UI loads in a webview filling the screen content area
- [ ] File tree, editor, terminal all functional in embedded VS Code
- [ ] Claude Code extension can be installed and is visible in VS Code sidebar
- [ ] Navigating away from Testing stops the code-server process
- [ ] Closing the app cleans up the code-server process
- [ ] No security issues (localhost only, no auth exposure)

## Technical Design

### Architecture

```
Cola Records Electron Shell
├── Sidebar (React) ─── [Dashboard] [Issues] [Contributions] [Settings] [Testing]
└── Content Area
    └── TestingScreen
        └── <webview src="http://localhost:{port}">
            └── code-server (full VS Code)
                ├── File Explorer
                ├── Editor Tabs
                ├── Terminal
                └── Claude Code Extension (sidebar)
```

### New Files to Create

| File | Purpose |
|------|---------|
| `src/main/services/code-server.service.ts` | Manages code-server binary lifecycle (spawn, health check, kill) |
| `src/renderer/screens/TestingScreen.tsx` | Testing screen with webview embed and state machine UI |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `code-server:start`, `code-server:stop`, `code-server:status` IPC channels |
| `src/main/index.ts` | Register IPC handlers, enable `webviewTag: true`, add cleanup on quit |
| `src/renderer/components/layout/Sidebar.tsx` | Add `'testing'` to Screen type, add nav item |
| `src/renderer/App.tsx` | Add `case 'testing'` to renderScreen switch |
| `forge.config.ts` | Add `resources/code-server` to `extraResource` |

### Key Interfaces/Types

```typescript
// IPC Channels
'code-server:start': (projectPath: string) => { port: number; url: string };
'code-server:stop': () => void;
'code-server:status': () => { running: boolean; port: number | null; url: string | null };

// TestingScreen states
type TestingState = 'idle' | 'starting' | 'running' | 'error';
```

## Implementation Tasks

### Task 1: Download code-server binary
- **Type:** infrastructure
- **Files:** `resources/code-server/code-server.exe`
- **Details:** Download code-server release for Windows from https://github.com/coder/code-server/releases. Place binary in resources/code-server/.
- **Test:** Binary exists and is executable

### Task 2: Add IPC channel types
- **Type:** feature
- **Files:** `src/main/ipc/channels.ts`
- **Details:** Add code-server:start, code-server:stop, code-server:status to IpcChannels interface
- **Test:** TypeScript compiles with new channel types

### Task 3: Create CodeServerService
- **Type:** feature
- **Files:** `src/main/services/code-server.service.ts`
- **Details:** Singleton service that: finds free port via net.createServer(0), spawns code-server binary with --auth none --bind-addr 127.0.0.1, polls /healthz for readiness, kills process on stop. Handles extension pre-installation.
- **Test:** Service spawns and kills code-server process correctly

### Task 4: Register IPC handlers
- **Type:** feature
- **Files:** `src/main/index.ts`
- **Details:** Add handleIpc for code-server:start/stop/status. Enable webviewTag in BrowserWindow webPreferences. Add codeServerService.stop() to will-quit handler.
- **Test:** IPC calls work from renderer

### Task 5: Add Testing nav item
- **Type:** feature
- **Files:** `src/renderer/components/layout/Sidebar.tsx`
- **Details:** Add 'testing' to Screen type union. Add { id: 'testing', label: 'Testing', icon: FlaskConical } to navItems.
- **Test:** Testing tab appears in sidebar, clickable

### Task 6: Create TestingScreen
- **Type:** feature
- **Files:** `src/renderer/screens/TestingScreen.tsx`
- **Details:** State machine component: idle (shows launch UI with folder picker), starting (shows spinner), running (shows webview with code-server URL), error (shows error with retry). Cleanup on unmount calls code-server:stop.
- **Test:** Full flow from idle → starting → running → cleanup

### Task 7: Wire into App.tsx
- **Type:** feature
- **Files:** `src/renderer/App.tsx`
- **Details:** Import TestingScreen, add case 'testing' to renderScreen switch
- **Test:** Screen renders when Testing tab clicked

### Task 8: Update forge config
- **Type:** feature
- **Files:** `forge.config.ts`
- **Details:** Add 'resources/code-server' to extraResource array
- **Test:** Build includes code-server binary

### Task 9: Pre-install Claude Code extension
- **Type:** feature
- **Files:** `src/main/services/code-server.service.ts`
- **Details:** On first start, run code-server --install-extension anthropic.claude-code to install the Claude Code extension into code-server's extensions directory
- **Test:** Claude Code appears in VS Code sidebar

### Task 10: End-to-end verification
- **Type:** test
- **Files:** Manual testing
- **Details:** Full flow: click Testing → pick folder → VS Code loads → file tree works → editor works → terminal works → Claude Code extension works → navigate away → process killed → close app → clean shutdown
- **Test:** All acceptance criteria met

## Testing Requirements

- Manual end-to-end testing (this is a POC, not a production feature)
- Verify code-server process starts and stops cleanly
- Verify webview renders VS Code UI
- Verify Claude Code extension installs and functions
- Verify no orphaned processes on app close

## BAS Quality Gates

- [ ] Phase 1: Linting (ESLint passes)
- [ ] Phase 2: Structure (files in correct locations)
- [ ] Phase 3: Build (TypeScript compiles, Vite builds)
- [ ] Phase 4: Testing (manual verification)
- [ ] Phase 5: Coverage (N/A for POC)
- [ ] Phase 6: Review (code review)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| code-server binary size (~100MB) | Bundle size | Acceptable for personal use POC |
| 5-15s startup time | UX | Loading spinner with progress message |
| Claude Code extension incompatibility | Blocks POC goal | Fall back to bundled VSIX or Open VSX |
| Memory usage (~300-500MB) | Performance | Document as known limitation |
| webview tag future deprecation | Long-term | Can migrate to BrowserView later |

## Notes

- This POC determines whether the embedding approach is viable before committing to it
- If successful, this replaces ALL 29 work orders (WO-042 through WO-070) with a single architectural change
- code-server is MIT licensed (Code-OSS base), free to embed
- The Testing screen is intentionally separate from the existing IDE screen to allow A/B comparison
