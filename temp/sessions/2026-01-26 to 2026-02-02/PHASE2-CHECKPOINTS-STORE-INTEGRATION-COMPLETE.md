# PHASE 2 — Checkpoints Store & Auto-Checkpoint Integration Complete

**Work Order:** WO-025
**Completed:** 2026-01-31
**Status:** ALL 5 TASKS COMPLETE (T6-T10)

---

## Executive Summary

Implemented the full store integration and streaming pipeline hooks for the checkpoint system: 4 new state fields in `useClaudeStore`, 7 new store actions (checkpoint CRUD + rewind + fork + branch management), auto-checkpoint creation in the NDJSON streaming pipeline for Edit/Write tool_use events, conversation ID tracking in the container service, and end-to-end rewind/fork flows. TypeScript compilation passes with zero errors.

---

## Store State Fields Added (4)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `checkpoints` | `ClaudeCheckpoint[]` | `[]` | Checkpoint timeline for current conversation |
| `checkpointLoading` | `boolean` | `false` | Loading state for checkpoint operations |
| `branches` | `ClaudeConversation[]` | `[]` | Conversations in the same branch lineage |
| `currentBranchId` | `string \| null` | `null` | ID of currently active branch |

All fields cleared in `clearMessages()` and `reset()`.

---

## Store Actions Implemented (7)

### Checkpoint Actions (4)

| Action | Description |
|--------|-------------|
| `loadCheckpoints()` | Fetches checkpoints via `claude:checkpoints:list` IPC for current conversation |
| `createManualCheckpoint(label)` | Creates a manual checkpoint via `claude:checkpoints:create` IPC |
| `rewindToCheckpoint(checkpointId)` | Full rewind: restore files → truncate messages → save conversation → reload checkpoints |
| `deleteCheckpoint(checkpointId)` | Deletes checkpoint via `claude:checkpoints:delete` IPC, reloads list |

### Branch Actions (3)

| Action | Description |
|--------|-------------|
| `forkFromCheckpoint(checkpointId, label)` | Creates forked conversation via IPC, adds to list, switches to it, loads branches |
| `loadBranches()` | Finds all conversations in same lineage (parent + siblings) |
| `switchBranch(conversationId)` | Switches conversation and reloads branch tree |

### Integration Points

- `switchConversation` now calls `loadCheckpoints()` and `loadBranches()` after loading messages
- `clearMessages()` and `reset()` clear all checkpoint/branch state

---

## Auto-Checkpoint Pipeline Integration

### How It Works

When the NDJSON stream delivers a `tool_use` event for `Edit` or `Write` tools:

1. Container service checks if `currentConversationId` is set and `checkpointService` is available
2. Extracts affected file paths via `extractAffectedFiles()` helper
3. Fires a **non-blocking** `createCheckpoint()` call (fire-and-forget with `.catch()`)
4. Checkpoint captures the file's current state BEFORE the tool modifies it
5. Label format: `"Before {ToolName} {basename}"`

### Non-Blocking Design

Auto-checkpoints use fire-and-forget pattern to avoid blocking the streaming pipeline:
```typescript
this.checkpointService.createCheckpoint(...)
  .catch(err => log('Auto-checkpoint failed:', err));
```

### Tools That Trigger Auto-Checkpoints

- `Edit` — file path extracted from `input.file_path`
- `Write` — file path extracted from `input.file_path`
- All other tools (Read, Glob, Bash, etc.) — **no checkpoint** (non-destructive)

---

## Container Service Changes

### New Private State

| Field | Type | Purpose |
|-------|------|---------|
| `currentConversationId` | `string \| null` | Tracks which conversation is being queried |
| `currentMessageIndex` | `number` | Incremented on each text/tool_use/tool_result event |
| `checkpointService` | `CheckpointService \| null` | Reference for auto-checkpoint creation |

### New Methods

| Method | Description |
|--------|-------------|
| `setCheckpointService(service)` | Sets the checkpoint service reference |
| `extractAffectedFiles(toolName, input)` | Extracts file paths from tool input |

### query() Signature Updated

```typescript
// Before
async query(prompt, model?, thinking?): Promise<ClaudeQueryResponse>

// After
async query(prompt, model?, thinking?, conversationId?, messageIndex?): Promise<ClaudeQueryResponse>
```

### Message Index Tracking

`currentMessageIndex` incremented on each:
- `text` event (with content)
- `tool_use` event
- `tool_result` event

Both `currentConversationId` and `currentMessageIndex` reset to defaults on `res.on('end')`.

---

## Rewind Flow Description

`rewindToCheckpoint(checkpointId)`:

1. **Restore files** — Calls `claude:checkpoints:restore` IPC, which decompresses and writes snapshot files back to disk
2. **Truncate messages** — Slices `messages[]` to `result.messageIndex`
3. **Save conversation** — Persists truncated messages via `claude:conversations:save` IPC
4. **Reload checkpoints** — Fetches updated checkpoint list from backend
5. **Error handling** — Sets `error` state and resets `checkpointLoading` on failure

---

## Fork Flow Description

`forkFromCheckpoint(checkpointId, label)`:

1. **Create fork** — Calls `claude:conversation:fork` IPC (transactional backend: copies messages + snapshots, restores files)
2. **Update conversations list** — Prepends new conversation to `conversations[]`
3. **Switch to fork** — Calls `switchConversation(newConversation.id)` which loads messages, checkpoints, branches
4. **Reload branches** — Updates branch lineage tree
5. **Error handling** — Sets `error` state and resets `checkpointLoading` on failure

---

## IPC Channel Updated

| Channel | Change |
|---------|--------|
| `claude:query` | Added optional `conversationId?: string` and `messageIndex?: number` params |

---

## Files Modified List

| File | Action | Changes |
|------|--------|---------|
| `src/renderer/stores/useClaudeStore.ts` | Modified | Added ClaudeCheckpoint import, 4 state fields, 7 actions, wired into switchConversation/clearMessages/reset, passes conversationId to query |
| `src/main/services/claude-container.service.ts` | Modified | Added CheckpointService import, 3 private state fields, setCheckpointService/extractAffectedFiles methods, auto-checkpoint in tool_use handler, message index tracking, updated query() signature |
| `src/main/ipc/channels.ts` | Modified | Updated claude:query channel with conversationId and messageIndex params |
| `src/main/index.ts` | Modified | Updated claude:query handler to pass through new params, wired checkpointService into container service |

**Total: 4 files modified**

---

## TypeScript Compilation

- `npx tsc --noEmit` → EXIT_CODE=0 (zero errors)

---

## Next Steps

WO-025 completes the store and pipeline integration:
- Store has full checkpoint/branch state management
- Auto-checkpoints fire on Edit/Write tool use events
- Rewind restores files + truncates conversation
- Fork creates independent branch + switches to it

WO-026 (UI Components & Panel Integration) can now proceed to build the visual checkpoint timeline, branch switcher, and rewind/fork buttons.
