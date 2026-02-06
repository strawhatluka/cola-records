# ORCHESTRATOR WORK ORDER #010
## Type: IMPLEMENTATION
## Claude Container Service + IPC Channels + Settings Integration

---

## MISSION OBJECTIVE

Implement the main process infrastructure for managing the Claude Agent SDK Container. This includes a Docker container lifecycle service, typed IPC channels, IPC handler registration, app lifecycle cleanup, and a new `claudeApiKey` field in AppSettings with corresponding UI in the Settings screen.

**Implementation Goal:** Main process can start/stop the Docker container, query Claude via HTTP, stream responses via WebSocket, store the API token in settings, and clean up on app quit.
**Based On:** TRA Implementation Plan for Claude Agent SDK Container Integration (Phase 1)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/main/services/claude-container.service.ts
    description: Docker container lifecycle + HTTP query + WebSocket streaming
    risk: HIGH
```

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/ipc/channels.ts
    changes: Add Claude IPC channel types + claudeApiKey to AppSettings
    risk: LOW

  - path: src/main/index.ts
    changes: Import service, register IPC handlers, add will-quit cleanup
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/settings/SettingsForm.tsx - Add Claude API Key input field
```

### Changes Required

#### Change Set 1: AppSettings + IPC Channel Types (channels.ts)

**Current State:** AppSettings has githubToken, theme, defaultClonePath, autoFetch
**Target State:** AppSettings adds `claudeApiKey?: string`

Add to `AppSettings`:
```typescript
claudeApiKey?: string;
```

Add to `IpcChannels`:
```typescript
// Claude Container Channels
'claude:start': (projectPath: string) => void;
'claude:stop': () => void;
'claude:query': (prompt: string) => { success: boolean; response: string; messageCount: number; timestamp: string };
'claude:health': () => { status: string; ready: boolean };
'claude:status': () => { running: boolean; projectPath: string | null };
```

Add to `IpcEvents`:
```typescript
'claude:stream-chunk': (event: { content: string; done: boolean }) => void;
'claude:status-changed': (event: { running: boolean; projectPath: string | null }) => void;
```

#### Change Set 2: Claude Container Service (claude-container.service.ts)

**Pattern:** Follow TerminalService singleton pattern with setMainWindow injection.

```typescript
export class ClaudeContainerService {
  private mainWindow: BrowserWindow | null = null;
  private containerRunning = false;
  private projectPath: string | null = null;
  private readonly containerName = 'cola-claude-agent';
  private readonly containerPort = 8080;

  setMainWindow(window: BrowserWindow): void;

  // Lifecycle
  async start(projectPath: string, apiKey: string): Promise<void>;
  async stop(): Promise<void>;
  async isRunning(): Promise<boolean>;

  // Communication
  async query(prompt: string): Promise<QueryResponse>;
  async healthCheck(): Promise<{ status: string; ready: boolean }>;

  // Streaming via WebSocket
  async queryStream(prompt: string, onChunk: (content: string, done: boolean) => void): Promise<void>;

  getStatus(): { running: boolean; projectPath: string | null };
}

export const claudeContainerService = new ClaudeContainerService();
```

**Docker commands (via execFile, NOT shell):**
- `start()`:
  1. Check if container already exists: `docker inspect cola-claude-agent`
  2. If exists and running, skip. If exists and stopped, `docker rm` then recreate.
  3. `docker run -d --name cola-claude-agent -p 8080:8080 -v {projectPath}:/workspace -e CLAUDE_CODE_OAUTH_TOKEN={apiKey} ghcr.io/anthropics/claude-code:latest`
  4. Poll `GET http://localhost:8080/health` until ready (max 30 retries, 1s interval)
  5. Emit `claude:status-changed` event via mainWindow
- `stop()`: `docker stop -t 5 cola-claude-agent && docker rm cola-claude-agent`
- `isRunning()`: `docker inspect --format='{{.State.Running}}' cola-claude-agent`
- `query()`: `POST http://localhost:8080/query` with `{ prompt }` and `X-API-Key` header
- `queryStream()`: Open WebSocket to `ws://localhost:8080/ws`, send prompt, relay chunks to callback
- `healthCheck()`: `GET http://localhost:8080/health`

**Error handling:**
- All Docker commands wrapped in try/catch
- If Docker not installed, throw descriptive error: "Docker is required but not found"
- If container fails to start, throw with Docker logs
- Health check timeout returns `{ status: 'timeout', ready: false }`

#### Change Set 3: IPC Handlers + Lifecycle (index.ts)

**Add import:**
```typescript
import { claudeContainerService } from './services/claude-container.service';
```

**Add to createWindow():**
```typescript
claudeContainerService.setMainWindow(mainWindow);
```

**Add handlers in setupIpcHandlers():**
```typescript
// Claude Container handlers
handleIpc('claude:start', async (_event, projectPath) => {
  const settings = database.getAllSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not configured. Set it in Settings.');
  await claudeContainerService.start(projectPath, apiKey);
});

handleIpc('claude:stop', async () => {
  await claudeContainerService.stop();
});

handleIpc('claude:query', async (_event, prompt) => {
  return await claudeContainerService.query(prompt);
});

handleIpc('claude:health', async () => {
  return await claudeContainerService.healthCheck();
});

handleIpc('claude:status', async () => {
  return claudeContainerService.getStatus();
});
```

**Add to will-quit cleanup:**
```typescript
app.on('will-quit', async () => {
  removeAllIpcHandlers();
  await fileWatcherService.unwatchAll();
  terminalService.killAll();
  await claudeContainerService.stop();  // <-- ADD THIS
  database.close();
});
```

**Add settings handler updates for claudeApiKey:**
In the `settings:update` handler, add:
```typescript
if (updates.claudeApiKey !== undefined) {
  database.setSetting('claudeApiKey', updates.claudeApiKey);
}
```

In the `settings:get` return, add:
```typescript
claudeApiKey: settings.claudeApiKey,
```

#### Change Set 4: Settings Form UI (SettingsForm.tsx)

**Add after the GitHub card, before the Save button:**

New "Claude AI" Card with:
- Label: "Claude API Key (Max Plan)"
- Password input for the key
- Description text: "Your Claude Code OAuth token for the integrated AI assistant. Uses your Anthropic Max subscription."
- No validate button needed (validation happens when container starts)

---

## IMPLEMENTATION APPROACH

### Step 1: IPC Types + AppSettings
- [ ] Add `claudeApiKey` to `AppSettings` interface in channels.ts
- [ ] Add 5 Claude IPC channels to `IpcChannels`
- [ ] Add 2 Claude events to `IpcEvents`

### Step 2: Container Service
- [ ] Create claude-container.service.ts following TerminalService singleton pattern
- [ ] Implement start() with Docker run + health poll
- [ ] Implement stop() with Docker stop + rm
- [ ] Implement query() with HTTP POST to /query
- [ ] Implement queryStream() with WebSocket to /ws
- [ ] Implement healthCheck() with HTTP GET /health
- [ ] Implement isRunning() with docker inspect
- [ ] Export singleton instance

### Step 3: IPC Handlers + Settings
- [ ] Import claudeContainerService in index.ts
- [ ] Register 5 IPC handlers in setupIpcHandlers()
- [ ] Add claudeContainerService.setMainWindow() in createWindow()
- [ ] Add claudeContainerService.stop() to will-quit handler
- [ ] Update settings:get to include claudeApiKey
- [ ] Update settings:update to handle claudeApiKey

### Step 4: Settings UI
- [ ] Add Claude API Key input card to SettingsForm.tsx
- [ ] Add local state for claudeApiKey
- [ ] Include claudeApiKey in handleSave

### Step 5: Validation
- [ ] Verify TypeScript compiles with no errors
- [ ] Verify existing tests pass (no regressions)
- [ ] Verify IPC types are consistent

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CLAUDE-CONTAINER-SERVICE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with file paths
3. **Test Results** - Validation of changes
4. **Metrics** - Files created/modified counts
5. **Rollback Plan** - How to revert if needed
6. **Next Steps** - Phase 2 dependencies

### Evidence to Provide
- File diff statistics
- Specific line numbers for critical changes
- TypeScript compilation verification

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-010-claude-container-service.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-010-claude-container-service.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] claude-container.service.ts created with full Docker lifecycle management
- [ ] All 5 IPC channels typed and handlers registered
- [ ] 2 IPC events typed for streaming and status
- [ ] App quit cleanly stops the container
- [ ] claudeApiKey stored in AppSettings and editable in Settings screen
- [ ] TypeScript compiles without errors
- [ ] No test regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Perform ANY git operations
- [ ] Use shell: true in execFile calls (security risk)

### DO:
- [ ] Follow existing service singleton pattern (TerminalService reference)
- [ ] Use execFile (not exec) for Docker commands
- [ ] Use node:http for HTTP requests (no external dependencies)
- [ ] Handle Docker-not-installed gracefully
- [ ] Read file before editing

---

## ROLLBACK STRATEGY

If issues arise:
1. Delete `src/main/services/claude-container.service.ts`
2. Revert additions to channels.ts (remove Claude channels + claudeApiKey)
3. Revert additions to index.ts (remove Claude handlers + import + cleanup)
4. Revert SettingsForm.tsx (remove Claude API Key card)

**Critical Files Backup:** channels.ts, index.ts, SettingsForm.tsx

---

## CONTEXT FROM INVESTIGATION

**Source:** TRA Implementation Plan for Claude Agent SDK Container
**Key Findings:**
- Container exposes REST at `/query` and WebSocket at `/ws` for streaming
- Health check at `GET /health`
- Auth via `CLAUDE_CODE_OAUTH_TOKEN` environment variable (Max plan billing)
- TerminalService is the reference pattern for process lifecycle management
- AppSettings stored in SQLite via database.setSetting()/getAllSettings()

**Expected Impact:** Main process fully capable of managing Claude container lifecycle

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Docker command execution from Electron main process
- WebSocket streaming requires careful error handling
- Container startup timing (health poll needed)

**Mitigation:**
- Use execFile (not exec/shell) for Docker commands
- Implement health polling with timeout
- Graceful error messages when Docker unavailable

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
