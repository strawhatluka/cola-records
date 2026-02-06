# TRA Implementation Plan: VS Code Embedding in Development Screen

**Feature:** Embed VS Code (via code-server Docker) into the Development Screen
**Scale:** Medium
**Stop Points:** Design (before implementation), Final (before merge)

---

## Architecture Overview

```
Contributions Page                    Development Screen
┌──────────────┐                     ┌─────────────────────────────┐
│ "Open Project"│ ──contribution──→  │  DevelopmentScreen.tsx       │
│  button       │    (localPath)     │  ┌───────────────────────┐  │
└──────────────┘                     │  │ <webview>             │  │
                                     │  │  code-server @ Docker │  │
                                     │  │  (full VS Code)       │  │
                                     │  └───────────────────────┘  │
                                     │  [Stop] [Back]              │
                                     └─────────────────────────────┘
                                              │
                                              ▼ IPC
                                     ┌─────────────────────────────┐
                                     │  CodeServerService (main)   │
                                     │  - Docker container mgmt    │
                                     │  - Volume mounts            │
                                     │  - Git config generation    │
                                     │  - Settings sync            │
                                     └─────────────────────────────┘
```

## Data Flow

1. User clicks "Open Project" on ContributionsScreen → `onOpenIDE(contribution)` called
2. App.tsx stores contribution, switches to 'ide' screen
3. DevelopmentScreen receives `contribution.localPath`
4. Renderer calls `ipc.invoke('code-server:start', localPath)`
5. Main process CodeServerService:
   a. Finds free port
   b. Syncs VS Code settings from host
   c. Creates container gitconfig (includes host .gitconfig, safe.directory, credential.helper)
   d. Spawns Docker container with volume mounts
   e. Waits for health check
   f. Syncs extensions: host → container (install missing)
   g. Returns `{ port, url }`
6. Renderer loads `url` in `<webview>` tag
7. On unmount/navigate away, renderer calls `ipc.invoke('code-server:stop')`
8. Before container stops: syncs extensions: container → host (install missing on host)

## Volume Mounts (Docker)

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `contribution.localPath` | `/home/coder/project` | Project files (read-write) |
| `{app.getPath('userData')}/code-server/` | `/home/coder/.local/share/code-server` | User data, settings, auth tokens |
| `{app.getPath('userData')}/code-server/extensions/` | `/home/coder/extensions` | VS Code extensions |
| `{os.homedir()}/.gitconfig` | `/home/coder/.gitconfig-host:ro` | Host git config |
| `{os.homedir()}/.git-credentials` | `/home/coder/.git-credentials:ro` | Git credentials |

## Environment Variables (Docker)

| Variable | Value | Purpose |
|----------|-------|---------|
| `GIT_CONFIG_GLOBAL` | `/home/coder/.local/share/code-server/gitconfig` | Custom gitconfig with safe.directory + credential.helper + host .gitconfig include |

**Note:** All host paths are resolved at runtime using `os.homedir()`, `app.getPath('userData')`, and platform detection — no hardcoded user paths.

---

## Implementation Plan

### Phase 1: Setup (Backend Infrastructure)

#### Task 1: Create CodeServerService
**File:** `src/main/services/code-server.service.ts` (NEW)
**Complexity:** 6/10
**Dependencies:** None

Create the Docker container management service with:
- `findFreePort()` — bind to port 0 to find available port
- `getUserDataDir()` / `getExtensionsDir()` — persistent storage paths
- `toDockerPath()` — Windows path → forward slash conversion
- `syncVSCodeSettings()` — copy host VS Code `settings.json` to code-server user data (cross-platform: `%APPDATA%/Code/User/` on Windows, `~/.config/Code/User/` on Linux, `~/Library/Application Support/Code/User/` on macOS)
- `createContainerGitConfig()` — write gitconfig that includes host config + safe.directory + credential.helper=store
- `getGitMounts()` — build -v args for .gitconfig and .git-credentials
- `waitForReady()` — poll `/healthz` endpoint
- `dockerExec()` — run docker commands via execFile
- `start(projectPath)` — orchestrate container launch, return { port, url }
- `stop()` — docker stop + docker rm fallback
- `getStatus()` — return running state

**Docker run args:**
```
docker run --rm --name cola-code-server-{port}
  -p 127.0.0.1:{port}:8080
  -v {project}:/home/coder/project
  -v {userData}:/home/coder/.local/share/code-server
  -v {extensions}:/home/coder/extensions
  -v {gitconfig}:/home/coder/.gitconfig-host:ro
  -v {gitcredentials}:/home/coder/.git-credentials:ro
  -e GIT_CONFIG_GLOBAL=/home/coder/.local/share/code-server/gitconfig
  codercom/code-server:latest
  --auth none --bind-addr 0.0.0.0:8080
  --disable-telemetry --disable-update-check
  --extensions-dir /home/coder/extensions
  /home/coder/project
```

#### Task 2: Add IPC Channel Types
**File:** `src/main/ipc/channels.ts` (MODIFY)
**Complexity:** 2/10
**Dependencies:** None

Add to `IpcChannels`:
```typescript
'code-server:start': (projectPath: string) => { port: number; url: string };
'code-server:stop': () => void;
'code-server:status': () => { running: boolean; port: number | null; url: string | null };
```

#### Task 3: Register IPC Handlers + Enable webviewTag
**File:** `src/main/index.ts` (MODIFY)
**Complexity:** 3/10
**Dependencies:** Task 1, Task 2

- Import `codeServerService`
- Add `webviewTag: true` to BrowserWindow webPreferences
- Register 3 IPC handlers for code-server:start, code-server:stop, code-server:status
- Add `codeServerService.stop()` to `will-quit` handler

### Phase 2: Core (Frontend Implementation)

#### Task 4: Create DevelopmentScreen Component
**File:** `src/renderer/screens/DevelopmentScreen.tsx` (NEW)
**Complexity:** 5/10
**Dependencies:** Task 2

State machine UI with 4 states:
- **idle** — initial state, auto-starts on mount with contribution path
- **starting** — shows spinner while Docker container launches
- **running** — full-screen `<webview src={url}>` with Stop/Back buttons in header
- **error** — shows error message with Retry button

Props: `{ contribution: Contribution; onNavigateBack: () => void }`

Behavior:
- On mount: call `ipc.invoke('code-server:start', contribution.localPath)`
- On success: transition to 'running', set webview src
- On error: transition to 'error' with message
- On unmount: call `ipc.invoke('code-server:stop')`
- Stop button: call stop, navigate back
- Back button: call stop, navigate back

#### Task 5: Wire DevelopmentScreen into App.tsx
**File:** `src/renderer/App.tsx` (MODIFY)
**Complexity:** 2/10
**Dependencies:** Task 4

- Import DevelopmentScreen
- Store `selectedContribution` in state (re-add the state that was removed in cleanup)
- Update `handleOpenIDE` to store contribution and switch to 'ide'
- Replace placeholder in 'ide' case with `<DevelopmentScreen contribution={selectedContribution} onNavigateBack={...} />`

### Phase 3: Finalize (Polish & Verification)

#### Task 6: Docker Prerequisite Check
**File:** `src/main/services/code-server.service.ts` (MODIFY)
**Complexity:** 3/10
**Dependencies:** Task 1

Add `checkDockerAvailable()` method:
- Run `docker info` to verify Docker Desktop is running
- Called at start of `start()` before anything else
- Returns clear error message if Docker not available
- DevelopmentScreen shows this error in the error state

#### Task 7: Bidirectional Extension Sync
**File:** `src/main/services/extension-sync.service.ts` (NEW)
**Complexity:** 5/10
**Dependencies:** Task 1

Keeps VS Code extensions in sync between the host and the code-server container.

**Host → Container (on startup, after container ready):**
1. Read host extensions from the VS Code extensions directory (cross-platform: `~/.vscode/extensions/` on all platforms) — each subfolder is `{publisher}.{name}-{version}`
2. Parse extension IDs from folder names (e.g., `anthropics.claude-code-1.0.0` → `anthropics.claude-code`)
3. List container extensions via `docker exec {container} code-server --extensions-dir /home/coder/extensions --list-extensions`
4. Diff the two lists — find extensions on host but not in container
5. For each missing: `docker exec {container} code-server --extensions-dir /home/coder/extensions --install-extension {id}`
6. Run installs in parallel (Promise.allSettled) with a concurrency limit
7. Log successes and failures

**Container → Host (on stop, before container teardown):**
1. List container extensions via `docker exec {container} code-server --extensions-dir /home/coder/extensions --list-extensions`
2. Read host extensions from `~/.vscode/extensions/` directory
3. Diff — find extensions in container but not on host
4. For each missing: run `code --install-extension {id}` on the host (uses local VS Code CLI)
5. Log successes and failures

**Key methods:**
- `getHostExtensionIds()` — reads `{os.homedir()}/.vscode/extensions/` folder names, returns Set<string> of extension IDs
- `getContainerExtensionIds(containerName)` — runs `docker exec ... --list-extensions`, returns Set<string>
- `syncHostToContainer(containerName)` — installs host extensions missing from container
- `syncContainerToHost(containerName)` — installs container extensions missing from host
- `syncOnStart(containerName)` — called after `waitForReady()` in `start()`
- `syncOnStop(containerName)` — called before `docker stop` in `stop()`

**Edge cases:**
- Extension install failures are logged but don't block startup/shutdown
- Extensions that exist in both are skipped (no version comparison — just presence check)
- If `code` CLI not found on host, skip container→host sync with warning
- First launch will be slower due to extension installs; subsequent launches are fast (volume persists)

#### Task 8: Manual E2E Verification (LUKA)
**Complexity:** N/A
**Dependencies:** All tasks

Test checklist:
- [ ] Docker Desktop running
- [ ] Click "Open Project" on contribution → Development screen loads
- [ ] VS Code appears in webview with project file tree
- [ ] Host VS Code settings applied (theme, font size, etc.)
- [ ] Git status indicators on files (modified files dimmed/colored)
- [ ] Git operations work in embedded terminal (git status, git log)
- [ ] All host extensions appear in code-server extensions panel
- [ ] Extensions persist after stop → restart
- [ ] Install new extension in code-server → appears in host VS Code after stop
- [ ] Install new extension in host VS Code → appears in code-server after next start
- [ ] Stop button cleanly kills container
- [ ] Navigate back → navigate to another project works
- [ ] App quit cleanly stops container

---

## Task Sequence

```
Phase 1 (Sequential):
  Task 1: CodeServerService ──→ Task 3: IPC Handlers + webviewTag
  Task 2: Channel Types ──────↗

Phase 2 (Sequential, depends on Phase 1):
  Task 4: DevelopmentScreen ──→ Task 5: Wire into App.tsx

Phase 3 (Sequential, depends on Phase 2):
  Task 6: Docker Check ─┐
  Task 7: Extension Sync ├──→ Task 8: Manual E2E (LUKA)
                         ┘
```

**Parallelizable:** Tasks 1 and 2 (no shared files). Tasks 6 and 7 (different files).

---

## TRA Handoff

```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Create CodeServerService (Docker container management)",
      "file": "src/main/services/code-server.service.ts",
      "action": "CREATE",
      "dependencies": [],
      "complexity": 6
    },
    {
      "id": 2,
      "description": "Add code-server IPC channel types",
      "file": "src/main/ipc/channels.ts",
      "action": "MODIFY",
      "dependencies": [],
      "complexity": 2
    },
    {
      "id": 3,
      "description": "Register IPC handlers + enable webviewTag",
      "file": "src/main/index.ts",
      "action": "MODIFY",
      "dependencies": [1, 2],
      "complexity": 3
    },
    {
      "id": 4,
      "description": "Create DevelopmentScreen component",
      "file": "src/renderer/screens/DevelopmentScreen.tsx",
      "action": "CREATE",
      "dependencies": [2],
      "complexity": 5
    },
    {
      "id": 5,
      "description": "Wire DevelopmentScreen into App.tsx",
      "file": "src/renderer/App.tsx",
      "action": "MODIFY",
      "dependencies": [4],
      "complexity": 2
    },
    {
      "id": 6,
      "description": "Add Docker prerequisite check",
      "file": "src/main/services/code-server.service.ts",
      "action": "MODIFY",
      "dependencies": [1],
      "complexity": 3
    },
    {
      "id": 7,
      "description": "Bidirectional extension sync (host ↔ container)",
      "file": "src/main/services/extension-sync.service.ts",
      "action": "CREATE",
      "dependencies": [1],
      "complexity": 5
    },
    {
      "id": 8,
      "description": "Manual E2E verification (LUKA)",
      "file": null,
      "action": "TEST",
      "dependencies": [3, 5, 6, 7],
      "complexity": 0
    }
  ],
  "sequence": [1, 2, 3, 4, 5, 6, 7, 8],
  "parallelizable": [[1, 2], [6, 7]],
  "stopPoints": ["design", "final"],
  "risks": [
    {
      "risk": "Docker Desktop not installed or not running",
      "mitigation": "Task 6 adds explicit check with clear error message"
    },
    {
      "risk": "First container launch slow (image pull)",
      "mitigation": "Starting state shows spinner; user can pre-pull image"
    },
    {
      "risk": "Git credentials not available on host (.git-credentials missing)",
      "mitigation": "Git read operations work without credentials; push/pull will prompt in terminal"
    },
    {
      "risk": "VS Code settings incompatible with code-server",
      "mitigation": "Settings sync copies file; code-server ignores unsupported keys"
    }
  ]
}
```

---

## Files Modified Summary

| File | Action | Task |
|------|--------|------|
| `src/main/services/code-server.service.ts` | CREATE | 1, 6 |
| `src/main/services/extension-sync.service.ts` | CREATE | 7 |
| `src/main/ipc/channels.ts` | MODIFY | 2 |
| `src/main/index.ts` | MODIFY | 3 |
| `src/renderer/screens/DevelopmentScreen.tsx` | CREATE | 4 |
| `src/renderer/App.tsx` | MODIFY | 5 |

**Total new files:** 3
**Total modified files:** 3
