# ORCHESTRATOR WORK ORDER #001
## Type: IMPLEMENTATION
## Embed VS Code into Development Screen via code-server Docker

---

## MISSION OBJECTIVE

Embed a full VS Code instance into the Cola Records Development screen using code-server running inside a Docker container. When a user clicks "Open Project" on a contribution, the Development screen loads their complete VS Code environment — settings, extensions, git integration, and credentials — inside an Electron webview.

**Implementation Goal:** Fully functional embedded VS Code in the Development screen with bidirectional extension sync, host settings persistence, and working git integration.
**Based On:** POC validation (WO-000) confirmed code-server Docker approach is viable. TRA plan: `trinity/sessions/TRA-vscode-embed-plan.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/code-server.service.ts
    changes: CREATE - Docker container management service
    risk: MEDIUM

  - path: src/main/services/extension-sync.service.ts
    changes: CREATE - Bidirectional VS Code extension sync
    risk: MEDIUM

  - path: src/renderer/screens/DevelopmentScreen.tsx
    changes: CREATE - Webview-based Development screen component
    risk: LOW

Supporting_Files:
  - src/main/ipc/channels.ts - Add 3 code-server IPC channel types
  - src/main/index.ts - Register IPC handlers, enable webviewTag, add cleanup
  - src/renderer/App.tsx - Wire DevelopmentScreen into screen router
```

### Changes Required

#### Change Set 1: Backend — Docker Container Management
**Files:** `src/main/services/code-server.service.ts`
**Current State:** File does not exist (deleted during cleanup)
**Target State:** Full service managing code-server Docker container lifecycle
**Implementation:**
```typescript
class CodeServerService {
  // Port management
  findFreePort(): Promise<number>

  // Persistent storage
  getUserDataDir(): string        // app.getPath('userData') + '/code-server'
  getExtensionsDir(): string      // getUserDataDir() + '/extensions'

  // Host config sync
  syncVSCodeSettings(): void      // Cross-platform VS Code settings copy
  createContainerGitConfig(): void // gitconfig with safe.directory + credential.helper + host include
  getGitMounts(): string[]        // -v args for .gitconfig and .git-credentials

  // Docker operations
  checkDockerAvailable(): Promise<void>  // docker info check
  dockerExec(args): Promise<string>      // execFile wrapper
  waitForReady(port): Promise<void>      // /healthz polling

  // Lifecycle
  start(projectPath): Promise<{ port, url }>
  stop(): Promise<void>
  getStatus(): { running, port, url }
}
```

#### Change Set 2: Backend — Bidirectional Extension Sync
**Files:** `src/main/services/extension-sync.service.ts`
**Current State:** File does not exist
**Target State:** Service that syncs extensions between host VS Code and container code-server
**Implementation:**
```typescript
class ExtensionSyncService {
  // Discovery
  getHostExtensionIds(): Set<string>           // Read ~/.vscode/extensions/ folder names
  getContainerExtensionIds(container): Set<string>  // docker exec --list-extensions

  // Sync operations
  syncHostToContainer(container): Promise<void>  // Install host extensions in container
  syncContainerToHost(container): Promise<void>  // Install container extensions on host

  // Lifecycle hooks
  syncOnStart(container): Promise<void>   // Called after waitForReady()
  syncOnStop(container): Promise<void>    // Called before docker stop
}
```

#### Change Set 3: IPC Layer
**Files:** `src/main/ipc/channels.ts`, `src/main/index.ts`
**Current State:** No code-server channels; webviewTag not enabled
**Target State:** 3 typed IPC channels; webviewTag enabled; cleanup on quit
**Implementation:**
```typescript
// channels.ts additions
'code-server:start': (projectPath: string) => { port: number; url: string };
'code-server:stop': () => void;
'code-server:status': () => { running: boolean; port: number | null; url: string | null };

// index.ts additions
// - import codeServerService
// - webviewTag: true in BrowserWindow webPreferences
// - 3 IPC handlers
// - codeServerService.stop() in will-quit
```

#### Change Set 4: Frontend — Development Screen
**Files:** `src/renderer/screens/DevelopmentScreen.tsx`, `src/renderer/App.tsx`
**Current State:** Placeholder div in App.tsx 'ide' case
**Target State:** State machine component with webview embedding
**Implementation:**
```typescript
// DevelopmentScreen - 4 states:
// idle → starting → running → error
// Props: { contribution: Contribution; onNavigateBack: () => void }
// Running state: <webview src={url} style="flex:1" />
// Cleanup: ipc.invoke('code-server:stop') on unmount
```

---

## IMPLEMENTATION APPROACH

### Step 1: Backend Infrastructure (Tasks 1-3)
- [ ] Create `code-server.service.ts` with Docker container management
- [ ] Add `checkDockerAvailable()` for prerequisite validation
- [ ] Add 3 IPC channel types to `channels.ts`
- [ ] Register IPC handlers in `index.ts`
- [ ] Enable `webviewTag: true` in BrowserWindow
- [ ] Add `codeServerService.stop()` to `will-quit` handler

### Step 2: Extension Sync (Task 7)
- [ ] Create `extension-sync.service.ts`
- [ ] Implement `getHostExtensionIds()` — read `{os.homedir()}/.vscode/extensions/`
- [ ] Implement `getContainerExtensionIds()` — docker exec --list-extensions
- [ ] Implement `syncHostToContainer()` — install missing in container
- [ ] Implement `syncContainerToHost()` — install missing on host via `code` CLI
- [ ] Wire `syncOnStart()` into `code-server.service.ts` start()
- [ ] Wire `syncOnStop()` into `code-server.service.ts` stop()

### Step 3: Frontend (Tasks 4-5)
- [ ] Create `DevelopmentScreen.tsx` with state machine UI
- [ ] Implement idle → starting → running → error transitions
- [ ] Add webview tag for running state
- [ ] Add Stop/Back navigation buttons
- [ ] Add cleanup on unmount (call code-server:stop)
- [ ] Wire into `App.tsx` — restore selectedContribution state, update 'ide' case

### Step 4: Validation (Task 8 — LUKA manual)
- [ ] Docker Desktop running prerequisite
- [ ] Open Project → Development screen loads
- [ ] VS Code appears with project file tree
- [ ] Host settings applied (theme, font, etc.)
- [ ] Git status indicators present on files
- [ ] Git operations work in embedded terminal
- [ ] All host extensions synced to container
- [ ] Extensions persist across restarts
- [ ] Bidirectional sync: new extension in container → host after stop
- [ ] Bidirectional sync: new extension in host → container after start
- [ ] Stop/Back navigation works cleanly
- [ ] App quit stops container

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `VSCODE-EMBED-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - All files created/modified with descriptions
3. **Test Results** - Manual E2E verification results
4. **Docker Configuration** - Volume mounts, env vars, container args
5. **Extension Sync** - Bidirectional sync mechanism details
6. **Next Steps** - Known limitations, future improvements

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Screenshot of embedded VS Code with file tree and extensions
- Console log showing extension sync output
- Git status working inside container

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] Follow format: `VSCODE-EMBED-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] All deliverables include required sections listed above

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-001-vscode-embed-development-screen.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-001-vscode-embed-development-screen.md`
   - [ ] Completion report exists in: `trinity/sessions/VSCODE-EMBED-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 6 files have been created/modified as specified
- [ ] Docker container launches and serves VS Code in webview
- [ ] Host VS Code settings are applied in embedded VS Code
- [ ] Git tracking works (status indicators on files, terminal operations)
- [ ] Bidirectional extension sync works (host ↔ container)
- [ ] Extensions and auth tokens persist across container restarts
- [ ] All paths are cross-platform (no hardcoded usernames or OS-specific paths)
- [ ] Clean container shutdown on navigation and app quit
- [ ] Manual E2E verification passes all checklist items

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add/commit/push/pull/merge/checkout/branch/tag/rebase/reset/revert/stash** - FORBIDDEN
- [ ] Only LUKA has permission for git operations
- [ ] Only LUKA runs `npm test`, `npm run build`, `npm install`

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Report completion to LUKA with summary of changes
3. LUKA will handle ALL git operations and dependency management

### Do NOT:
- [ ] Hardcode usernames, paths, or OS-specific values
- [ ] Modify files outside the specified scope
- [ ] Install npm packages (report needed packages to LUKA)
- [ ] Run destructive Docker commands against user's other containers
- [ ] Store secrets or credentials in code

### DO:
- [ ] Use `os.homedir()`, `app.getPath('userData')`, and platform detection for all paths
- [ ] Handle cross-platform differences (Windows/macOS/Linux)
- [ ] Log all Docker operations for debugging
- [ ] Make extension sync failures non-blocking (log and continue)
- [ ] Clean up containers on all exit paths (normal, error, app quit)

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify:** VS Code fails to load, Docker errors, extension sync crashes
2. **Rollback:** Delete the 3 new files, revert the 3 modified files to their current state (placeholder)
3. **Verify:** App starts without errors, Development screen shows placeholder

**Critical Files Backup:** No backup needed — all changes are additive (new files) or minimal modifications to existing files.

---

## CONTEXT FROM TRA PLAN

**Source Plan:** `trinity/sessions/TRA-vscode-embed-plan.md`
**POC Validation:** WO-000 (Testing Screen) confirmed:
- code-server Docker image works with Electron webview
- File tree loads correctly with Docker bind mounts
- Extensions can be installed and used inside container
- Volume mounts persist data across container restarts

**Key POC Learnings Applied:**
- Extensions mount at `/home/coder/extensions` (separate from user data — avoids overlapping mount conflict)
- `GIT_CONFIG_GLOBAL` env var is more reliable than `docker exec` post-startup
- Host `.gitconfig` mounted as `-host` suffix to avoid path conflicts
- No `DOCKER_USER=root` — run as default `coder` user

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** MEDIUM
**Risk Factors:**
- Docker Desktop may not be installed or running on user's machine
- First container launch requires image pull (slow)
- Git credentials may not exist on host (.git-credentials file)
- Some VS Code settings may not be compatible with code-server
- Extension install can fail for marketplace availability differences

**Mitigation:**
- `checkDockerAvailable()` provides clear error before attempting launch
- Starting state shows spinner; DevelopmentScreen handles slow startup gracefully
- Git read operations work without credentials; push/pull prompt in terminal
- Settings sync copies file as-is; code-server ignores unsupported keys
- Extension sync logs failures but doesn't block startup/shutdown

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
