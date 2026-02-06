# ORCHESTRATOR WORK ORDER #011
## Type: IMPLEMENTATION
## Claude Zustand Store + IDE Initialization + WebSocket Stream Handling

---

## MISSION OBJECTIVE

Implement the renderer-side state management for the Claude AI assistant. This includes a Zustand store for chat state and message history, WebSocket stream handling for real-time response rendering, integration with the IDE initialization sequence to auto-start the container, and IPC event listeners for stream chunks and status changes.

**Implementation Goal:** Renderer process can start the container on IDE entry, send messages, receive streaming responses in real time, and maintain chat history per session.
**Based On:** TRA Implementation Plan Phase 2 + WO-010 (Phase 1 must be complete first)
**Depends On:** WO-010-claude-container-service (IPC channels and container service must exist)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/stores/useClaudeStore.ts
    description: Zustand store for Claude chat state, message history, streaming
    risk: MEDIUM
```

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/hooks/useIDEInitialization.ts
    changes: Add step 6 — start Claude container for the project
    risk: LOW

Supporting_Files:
  - src/renderer/ipc/client.ts - Verify ipc.on() supports claude:stream-chunk events (should already work)
```

### Changes Required

#### Change Set 1: Claude Store (useClaudeStore.ts)

**Pattern:** Follow useGitStore async pattern with loading/error state + useSettingsStore convenience methods.

```typescript
// Types
interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;  // true while assistant message is being streamed
}

interface ClaudeState {
  // State
  messages: ClaudeMessage[];
  loading: boolean;           // true while waiting for response
  containerReady: boolean;    // true when health check passes
  containerStarting: boolean; // true while container is starting up
  error: string | null;
  projectPath: string | null;

  // Actions
  startContainer: (projectPath: string) => Promise<void>;
  stopContainer: () => Promise<void>;
  sendMessage: (prompt: string) => Promise<void>;
  checkHealth: () => Promise<void>;
  clearMessages: () => void;
  reset: () => void;

  // Internal (called by IPC event listeners)
  _handleStreamChunk: (content: string, done: boolean) => void;
  _handleStatusChange: (running: boolean, projectPath: string | null) => void;
}
```

**Store Implementation Details:**

`startContainer(projectPath)`:
1. `set({ containerStarting: true, error: null, projectPath })`
2. `await ipc.invoke('claude:start', projectPath)`
3. Poll `ipc.invoke('claude:health')` until `ready: true` (max 30 attempts, 1s apart)
4. `set({ containerStarting: false, containerReady: true })`
5. Add system message: "Claude is ready. Working in: {projectPath}"
6. On error: `set({ containerStarting: false, error: String(error) })`

`sendMessage(prompt)`:
1. Generate UUID for user message, add to messages array
2. `set({ loading: true, error: null })`
3. Generate UUID for assistant message (empty, streaming: true), add to messages
4. Set up IPC listener for `claude:stream-chunk` events
5. Call `ipc.invoke('claude:query', prompt)` — this triggers streaming via WebSocket on main process side
6. Stream chunks update the last assistant message's content via `_handleStreamChunk`
7. On `done: true`, mark assistant message `streaming: false`, `set({ loading: false })`
8. On error: remove empty assistant message, `set({ loading: false, error: String(error) })`

`_handleStreamChunk(content, done)`:
1. Find last message with `streaming: true`
2. Append `content` to its content string
3. If `done`, set `streaming: false` and `loading: false`

`_handleStatusChange(running, projectPath)`:
1. `set({ containerReady: running, projectPath })`

`clearMessages()`:
1. `set({ messages: [] })`

`reset()`:
1. `set({ messages: [], loading: false, containerReady: false, containerStarting: false, error: null, projectPath: null })`

**IPC Event Listener Setup:**
The store needs to register listeners for `claude:stream-chunk` and `claude:status-changed` events. This should be done via a `setupListeners()` function called once, or handled inline within `sendMessage`.

Best approach: Register `claude:stream-chunk` listener inside `sendMessage` and clean up after `done: true`. Register `claude:status-changed` listener as a one-time setup (store-level initialization).

#### Change Set 2: IDE Initialization Integration (useIDEInitialization.ts)

**Current Steps:** 1. Load file tree → 2. Fetch git status → 3. Fetch branches → 4. Open last file → 5. Initialize terminal

**Add Step 6:**
```typescript
import { useClaudeStore } from '../stores/useClaudeStore';

// In the hook:
const { startContainer } = useClaudeStore();

// After step 5 (terminal), add:
// 6. Start Claude container (non-blocking — don't fail IDE init if this fails)
try {
  await startContainer(contribution.localPath);
} catch (err) {
  // Log but don't block — Claude panel will show the error
  console.warn('Failed to start Claude container:', err);
}
```

**Important:** This step is non-blocking. If the container fails to start (Docker not running, no API key, etc.), the IDE still loads normally. The Claude panel will show an appropriate error message from the store's error state.

---

## IMPLEMENTATION APPROACH

### Step 1: Create Claude Store
- [ ] Create src/renderer/stores/useClaudeStore.ts
- [ ] Implement ClaudeMessage type with id, role, content, timestamp, streaming fields
- [ ] Implement ClaudeState interface with all state fields and actions
- [ ] Implement startContainer with health polling loop
- [ ] Implement sendMessage with stream chunk listener setup
- [ ] Implement _handleStreamChunk for real-time content appending
- [ ] Implement _handleStatusChange for container status events
- [ ] Implement clearMessages and reset
- [ ] Use uuid (v4) for message IDs — check if project has existing UUID dependency, otherwise use crypto.randomUUID()
- [ ] Export store as useClaudeStore

### Step 2: IDE Initialization Integration
- [ ] Read useIDEInitialization.ts
- [ ] Import useClaudeStore
- [ ] Add startContainer call as step 6 in initialize()
- [ ] Wrap in try/catch so failure doesn't block IDE loading
- [ ] Add console.warn for container start failures

### Step 3: Validation
- [ ] Verify TypeScript compiles without errors
- [ ] Verify existing tests pass (no regressions)
- [ ] Verify store follows existing patterns (useGitStore, useTerminalStore)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CLAUDE-STORE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with file paths and line numbers
3. **Test Results** - No regressions verified
4. **Metrics** - Files created/modified
5. **Rollback Plan** - How to revert
6. **Next Steps** - Phase 3 dependencies

### Evidence to Provide
- File diff statistics
- TypeScript compilation verification
- Store API surface documentation

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-011-claude-store-and-streaming.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-011-claude-store-and-streaming.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] useClaudeStore.ts created with full state management
- [ ] Messages have streaming support for real-time rendering
- [ ] Container auto-starts during IDE initialization (non-blocking)
- [ ] IPC event listeners properly handle stream chunks
- [ ] Store handles all error states gracefully
- [ ] TypeScript compiles without errors
- [ ] No test regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Add external dependencies (use built-in crypto.randomUUID or existing uuid)
- [ ] Block IDE initialization if container fails
- [ ] Perform ANY git operations

### DO:
- [ ] Follow existing Zustand store patterns (useGitStore for async, useTerminalStore for events)
- [ ] Use ipc.invoke for request/response channels
- [ ] Use ipc.on for event channels (stream-chunk, status-changed)
- [ ] Clean up event listeners when no longer needed
- [ ] Read file before editing

---

## ROLLBACK STRATEGY

If issues arise:
1. Delete `src/renderer/stores/useClaudeStore.ts`
2. Revert useIDEInitialization.ts (remove step 6 + import)

**Critical Files Backup:** useIDEInitialization.ts

---

## CONTEXT FROM INVESTIGATION

**Source:** TRA Implementation Plan Phase 2 + WO-010 outputs
**Key Findings:**
- useGitStore is the reference for async operations with loading/error state
- useTerminalStore is the reference for IPC event listener patterns
- useIDEInitialization orchestrates all subsystem startups sequentially
- Container streams via WebSocket — main process relays chunks as IPC events
- crypto.randomUUID() available in modern Electron (no dependency needed)

**Expected Impact:** Renderer fully wired to communicate with Claude container

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Stream chunk ordering must be preserved
- Container start can be slow (Docker pull + health poll)
- Event listener cleanup to prevent memory leaks

**Mitigation:**
- WebSocket guarantees ordering
- Health poll with timeout prevents infinite waiting
- Clean up listeners on done/error/unmount

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
