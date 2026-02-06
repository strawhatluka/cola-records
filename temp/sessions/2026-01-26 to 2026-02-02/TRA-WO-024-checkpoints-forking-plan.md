# TRA Implementation Plan: WO-024 — Checkpoints & Conversation Forking

**Plan Date:** 2026-01-31
**Planner:** TRA (Work Planner)
**Input:** JUNO Gap Analysis GAP-19, GAP-20
**Scale:** Large (4 stop points)
**Phases:** 3 phases, 14 tasks
**Complexity Total:** 78

---

## Executive Summary

Checkpoints and conversation forking are the most architecturally complex features in the Claude Box gap closure. They require:

1. **Database schema v4** with 3 new tables (checkpoints, file snapshots, conversation branches)
2. **A dedicated checkpoint service** in the main process that captures file state before tool operations and restores it on rewind
3. **Store enhancements** for checkpoint timeline, rewind actions, and branch navigation
4. **3 new UI components** (checkpoint timeline, rewind confirmation, branch switcher)
5. **Integration hooks** in the streaming pipeline to auto-create checkpoints

### Key Design Decision: Diff-Based vs Full-Copy Snapshots

**Recommendation: Full-copy snapshots with compression.**

Rationale:
- Diffs are more storage-efficient but require sequential application to restore (slow, error-prone)
- Full copies are simpler, enable instant restore, and disk space is cheap for local desktop apps
- Compress with `zlib.gzip` — typical source files compress 5-10x
- A 100-file checkpoint with average 10KB files = ~1MB raw, ~100-200KB compressed
- Automatic cleanup: delete checkpoints older than 7 days or beyond 50 per conversation

---

## Phase Overview

| Phase | Focus | Tasks | Complexity Sum |
|-------|-------|-------|---------------|
| 1 | Database + Service Foundation | T1-T5 | 28 |
| 2 | Store + Auto-Checkpoint Integration | T6-T10 | 28 |
| 3 | UI Components + Panel Integration | T11-T14 | 22 |

---

## STOP POINT 1: Requirements Confirmed
> Confirm: full-copy snapshots, gzip compression, 50-checkpoint limit, 7-day TTL.

---

## Phase 1: Database + Service Foundation

### T1: Database Schema v4 Migration — Checkpoint Tables
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/main/database/schema.ts` — Bump `SCHEMA_VERSION` to 4, add `MIGRATIONS[4]`
- `src/main/ipc/channels.ts` — Add `ClaudeCheckpoint` and `ClaudeFileSnapshot` types

**Schema Design:**
```sql
-- Checkpoints: snapshot points in a conversation
CREATE TABLE IF NOT EXISTS claude_checkpoints (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,          -- The message this checkpoint was created BEFORE
  label TEXT NOT NULL,                -- Human-readable: "Before Edit src/index.ts"
  checkpoint_type TEXT NOT NULL       -- 'auto' | 'manual'
    CHECK(checkpoint_type IN ('auto', 'manual')),
  message_index INTEGER NOT NULL,    -- Index in messages array at checkpoint time
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES claude_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_conversation
  ON claude_checkpoints(conversation_id, created_at);

-- File snapshots: captured file state at each checkpoint
CREATE TABLE IF NOT EXISTS claude_file_snapshots (
  id TEXT PRIMARY KEY,
  checkpoint_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_compressed BLOB NOT NULL,   -- gzip-compressed file content
  original_size INTEGER NOT NULL,     -- uncompressed size in bytes
  created_at INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES claude_checkpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_snapshots_checkpoint
  ON claude_file_snapshots(checkpoint_id);

-- Conversation branches: parent-child relationships
ALTER TABLE claude_conversations ADD COLUMN parent_conversation_id TEXT;
ALTER TABLE claude_conversations ADD COLUMN fork_checkpoint_id TEXT;
ALTER TABLE claude_conversations ADD COLUMN branch_label TEXT;
```

**Types to add to channels.ts:**
```typescript
export interface ClaudeCheckpoint {
  id: string;
  conversationId: string;
  messageId: string;
  label: string;
  checkpointType: 'auto' | 'manual';
  messageIndex: number;
  createdAt: number;
  fileCount?: number;  // derived, not stored
}

export interface ClaudeFileSnapshot {
  id: string;
  checkpointId: string;
  filePath: string;
  contentCompressed: Buffer;
  originalSize: number;
  createdAt: number;
}

// Update ClaudeConversation
export interface ClaudeConversation {
  // ... existing fields ...
  parentConversationId?: string;
  forkCheckpointId?: string;
  branchLabel?: string;
}
```

**Acceptance Criteria:**
- [ ] Schema v4 migration creates 2 new tables + 3 ALTER columns
- [ ] Foreign keys with CASCADE delete
- [ ] Indexes on conversation_id and checkpoint_id
- [ ] Types exported from channels.ts
- [ ] Migration runs cleanly from v3→v4

### T2: Database CRUD — Checkpoint Operations
**Complexity:** 5 (Medium)
**Files Modified:**
- `src/main/database/database.service.ts` — Add 7 new methods

**Methods:**
```typescript
// Checkpoint CRUD
createCheckpoint(cp: Omit<ClaudeCheckpoint, 'fileCount'>): void;
getCheckpoints(conversationId: string): ClaudeCheckpoint[];
getCheckpointById(id: string): ClaudeCheckpoint | null;
deleteCheckpoint(id: string): void;  // CASCADE deletes snapshots
deleteOldCheckpoints(conversationId: string, keepCount: number): void;

// File snapshot CRUD
saveFileSnapshot(snapshot: ClaudeFileSnapshot): void;
getFileSnapshots(checkpointId: string): ClaudeFileSnapshot[];
```

**Acceptance Criteria:**
- [ ] All 7 methods implemented with proper SQL
- [ ] `getCheckpoints` returns file count via JOIN
- [ ] `deleteOldCheckpoints` keeps most recent N, deletes rest
- [ ] Tests pass

### T3: Checkpoint Service — Core Logic
**Complexity:** 7 (High)
**Files NEW:**
- `src/main/services/checkpoint.service.ts`

**Service Design:**
```typescript
export class CheckpointService {
  private db: DatabaseService;

  // Create checkpoint: capture file state for affected files
  async createCheckpoint(
    conversationId: string,
    messageId: string,
    label: string,
    type: 'auto' | 'manual',
    messageIndex: number,
    affectedFiles: string[]  // files to snapshot
  ): Promise<ClaudeCheckpoint>;

  // Restore checkpoint: revert files to checkpoint state
  async restoreCheckpoint(checkpointId: string): Promise<{
    restoredFiles: string[];
    messageIndex: number;
  }>;

  // Get checkpoint timeline for a conversation
  getTimeline(conversationId: string): ClaudeCheckpoint[];

  // Cleanup old checkpoints (called periodically)
  cleanup(conversationId: string, maxCount?: number, maxAgeDays?: number): void;

  // Internal: compress/decompress file content
  private compressContent(content: string): Buffer;
  private decompressContent(compressed: Buffer): string;

  // Internal: read file, snapshot it
  private async snapshotFile(filePath: string): Promise<{ content: Buffer; size: number }>;

  // Internal: restore file from snapshot
  private async restoreFile(filePath: string, compressed: Buffer): Promise<void>;
}
```

**Key Implementation Details:**
- Use Node.js `zlib.gzipSync` / `zlib.gunzipSync` for compression (synchronous is fine for individual files)
- Read files via `fs.readFileSync`, write via `fs.writeFileSync` (main process has direct access)
- `createCheckpoint` is transactional: wrap in `db.transaction()`
- `restoreCheckpoint` reads snapshots, writes files, returns messageIndex for conversation truncation
- Default limits: 50 checkpoints per conversation, 7 days TTL

**Acceptance Criteria:**
- [ ] Service creates checkpoints with compressed file snapshots
- [ ] Service restores files from checkpoints
- [ ] Compression/decompression works correctly
- [ ] Transactional: checkpoint + snapshots created atomically
- [ ] Cleanup respects count and age limits
- [ ] Tests pass

### T4: Checkpoint IPC Channels
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/main/ipc/channels.ts` — Add 5 new IPC channels
- `src/main/index.ts` — Add 5 IPC handlers

**Channels:**
```typescript
// In IpcChannels:
'claude:checkpoints:list': (conversationId: string) => ClaudeCheckpoint[];
'claude:checkpoints:create': (conversationId: string, label: string) => ClaudeCheckpoint;
'claude:checkpoints:restore': (checkpointId: string) => { restoredFiles: string[]; messageIndex: number };
'claude:checkpoints:delete': (checkpointId: string) => void;
'claude:conversation:fork': (conversationId: string, checkpointId: string, branchLabel: string) => ClaudeConversation;
```

**Acceptance Criteria:**
- [ ] All 5 channels defined in IpcChannels
- [ ] All 5 handlers implemented in index.ts
- [ ] Handlers call checkpoint service methods
- [ ] Fork creates new conversation with parent reference

### T5: Conversation Fork Logic in Database
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/main/database/database.service.ts` — Add `forkConversation` method

**Fork Logic:**
1. Get source conversation + all messages up to checkpoint's `messageIndex`
2. Create new conversation with `parentConversationId` and `forkCheckpointId` set
3. Copy messages up to (and including) `messageIndex` into new conversation
4. Copy file snapshots from the checkpoint to a new checkpoint in the forked conversation
5. Return the new conversation

**Acceptance Criteria:**
- [ ] Fork creates new conversation with parent/checkpoint references
- [ ] Messages copied up to checkpoint point
- [ ] New conversation has its own message copies (not shared)
- [ ] Branch label set on forked conversation
- [ ] Tests pass

**Phase 1 Dependencies:**
```
T1 ──→ T2 (schema needed before CRUD)
T2 ──→ T3 (CRUD needed before service)
T1 ──→ T4 (types needed before channels)
T3 ──→ T4 (service needed before handlers)
T2 ──→ T5 (CRUD needed before fork logic)
T3 ──→ T5 (service needed for snapshot copying)
```

**Sequence:** T1 → T2 → [T3, T5 parallel after T2] → T4

---

## STOP POINT 2: Design Approved
> Database schema and service layer verified before integrating with streaming pipeline.

---

## Phase 2: Store + Auto-Checkpoint Integration

### T6: Store Checkpoint State
**Complexity:** 5 (Medium)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts`

**New State Fields:**
```typescript
// Checkpoint state
checkpoints: ClaudeCheckpoint[];
checkpointLoading: boolean;

// Branch state
branches: ClaudeConversation[];  // conversations that share a parent
currentBranchId: string | null;
```

**New Actions:**
```typescript
loadCheckpoints: () => Promise<void>;
createManualCheckpoint: (label: string) => Promise<void>;
rewindToCheckpoint: (checkpointId: string) => Promise<void>;
deleteCheckpoint: (checkpointId: string) => Promise<void>;
forkFromCheckpoint: (checkpointId: string, label: string) => Promise<void>;
loadBranches: () => Promise<void>;
switchBranch: (conversationId: string) => Promise<void>;
```

**Acceptance Criteria:**
- [ ] All state fields added with defaults
- [ ] `loadCheckpoints` fetches from IPC on conversation switch
- [ ] `rewindToCheckpoint` calls IPC, truncates messages to messageIndex, reloads
- [ ] `forkFromCheckpoint` creates new conversation, switches to it
- [ ] State cleared on `clearMessages()` and `reset()`
- [ ] Tests pass

### T7: Auto-Checkpoint in Streaming Pipeline
**Complexity:** 7 (High)
**Files Modified:**
- `src/main/services/claude-container.service.ts` — Hook into `handleNdjsonEvent` for auto-checkpointing
- `src/main/services/checkpoint.service.ts` — Expose method for auto-checkpoint

**Design:**
When a `tool_use` event for Edit, Write, or Bash (file-modifying tools) arrives:
1. Extract affected file paths from `toolInput`
2. Create auto-checkpoint BEFORE the tool executes
3. Label: `"Before {toolName} {filePath}"`
4. Snapshot the affected files at their current state

**Integration Point in `handleNdjsonEvent`:**
```typescript
case 'tool_use':
  // Auto-checkpoint for file-modifying tools
  if (['Edit', 'Write', 'Bash'].includes(parsed.name)) {
    const files = this.extractAffectedFiles(parsed.name, parsed.input);
    if (files.length > 0) {
      await this.checkpointService.createCheckpoint(
        this.currentConversationId,
        messageId,
        `Before ${parsed.name} ${files[0]}`,
        'auto',
        this.currentMessageIndex,
        files
      );
    }
  }
  // ... existing tool_use handling
```

**File Extraction Logic:**
```typescript
private extractAffectedFiles(toolName: string, input: Record<string, unknown>): string[] {
  switch (toolName) {
    case 'Edit': return input.file_path ? [String(input.file_path)] : [];
    case 'Write': return input.file_path ? [String(input.file_path)] : [];
    case 'Bash': return [];  // Can't reliably determine; skip or use heuristics
    default: return [];
  }
}
```

**Acceptance Criteria:**
- [ ] Auto-checkpoints created before Edit and Write tool operations
- [ ] Checkpoint captures current file state before modification
- [ ] No checkpoint for Read, Glob (non-modifying tools)
- [ ] Bash commands optionally checkpointed (configurable)
- [ ] Does not block the streaming pipeline (async)
- [ ] Tests pass

### T8: Conversation ID Tracking in Container Service
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/main/services/claude-container.service.ts` — Track current conversation ID and message index
- `src/renderer/stores/useClaudeStore.ts` — Pass conversation ID when starting a query

**Changes:**
- Service needs to know `currentConversationId` and `currentMessageIndex` for auto-checkpointing
- Pass via `query(prompt, model, conversationId, messageIndex)` or set as state before query
- Message index incremented as messages arrive in the stream

**Acceptance Criteria:**
- [ ] Service knows which conversation it's operating on
- [ ] Message index tracked accurately during streaming
- [ ] Available for checkpoint creation

### T9: Rewind Checkpoint Action — Full Flow
**Complexity:** 5 (Medium)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Implement full rewind flow

**Rewind Flow:**
1. User clicks rewind on checkpoint
2. Store calls `ipc.invoke('claude:checkpoints:restore', checkpointId)`
3. Backend restores files to checkpoint state
4. Backend returns `{ restoredFiles, messageIndex }`
5. Store truncates `messages[]` to `messageIndex`
6. Store saves truncated conversation
7. Store refreshes checkpoints list
8. UI updates to show conversation at checkpoint point

**Edge Cases:**
- If file no longer exists (deleted after checkpoint), create it from snapshot
- If checkpoint's conversation doesn't match current, reject
- If restore fails mid-way, log which files were restored and which weren't

**Acceptance Criteria:**
- [ ] Full rewind flow works end-to-end
- [ ] Files restored on disk
- [ ] Messages truncated in store
- [ ] Conversation saved after rewind
- [ ] Error handling for partial failures
- [ ] Tests pass

### T10: Fork Checkpoint Action — Full Flow
**Complexity:** 7 (High)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Implement full fork flow

**Fork Flow:**
1. User clicks fork on checkpoint
2. Store calls `ipc.invoke('claude:conversation:fork', conversationId, checkpointId, label)`
3. Backend creates new conversation with messages up to checkpoint
4. Backend returns new `ClaudeConversation`
5. Store adds new conversation to `conversations[]` and `branches[]`
6. Store switches to new conversation
7. Store loads checkpoints for new conversation
8. Original conversation is preserved unchanged

**Acceptance Criteria:**
- [ ] Fork creates new conversation from checkpoint point
- [ ] Original conversation untouched
- [ ] User switched to forked conversation
- [ ] Branch relationship tracked
- [ ] Tests pass

**Phase 2 Dependencies:**
```
T6 ─── independent (store state)
T7 ──→ depends on T3 (checkpoint service)
T8 ──→ depends on T7 (service needs conversation tracking)
T9 ──→ depends on T6 (store state) + T4 (IPC channels)
T10 ──→ depends on T6 + T4 + T5 (fork logic)
```

**Sequence:** T6 parallel with T7/T8, then T9 and T10

---

## STOP POINT 3: Plan Approved
> Store and auto-checkpoint integration verified before building UI.

---

## Phase 3: UI Components + Panel Integration

### T11: ClaudeCheckpoints Component — Timeline UI
**Complexity:** 7 (High)
**Files NEW:**
- `src/renderer/components/ide/claude/ClaudeCheckpoints.tsx`

**Component Design:**
```typescript
interface ClaudeCheckpointsProps {
  checkpoints: ClaudeCheckpoint[];
  onRewind: (checkpointId: string) => void;
  onFork: (checkpointId: string) => void;
  onDelete: (checkpointId: string) => void;
  onCreateManual: (label: string) => void;
  loading: boolean;
}
```

**UI Layout:**
```
┌─ Checkpoints ──────────────────────────┐
│  [+ Manual Checkpoint]                  │
│                                         │
│  ● Before Edit src/index.ts      [↩][⑂]│
│  │  3 files · 2m ago                    │
│  │                                      │
│  ● Before Write src/new-file.ts  [↩][⑂]│
│  │  1 file · 5m ago                     │
│  │                                      │
│  ● Before Edit package.json      [↩][⑂]│
│    2 files · 8m ago                     │
│                                         │
│  [↩] = Rewind  [⑂] = Fork              │
└─────────────────────────────────────────┘
```

**Features:**
- Vertical timeline with dots and connector lines
- Each checkpoint shows: label, file count, relative time
- Rewind button (RotateCcw icon) — confirmation dialog before executing
- Fork button (GitBranch icon) — prompts for branch label
- Delete on hover (X icon)
- Manual checkpoint button at top
- Auto-checkpoints labeled with tool name + file path
- Claude Orange accent for timeline dots and active checkpoint
- Scrollable, max-height constrained

**Acceptance Criteria:**
- [ ] Timeline renders all checkpoints chronologically
- [ ] Rewind button triggers confirmation then calls onRewind
- [ ] Fork button prompts for label then calls onFork
- [ ] Delete on hover
- [ ] Manual checkpoint creation
- [ ] Claude Orange styling
- [ ] Accessible (aria-labels on all buttons)

### T12: ClaudeBranchSwitcher Component
**Complexity:** 5 (Medium)
**Files NEW:**
- `src/renderer/components/ide/claude/ClaudeBranchSwitcher.tsx`

**Component Design:**
```typescript
interface ClaudeBranchSwitcherProps {
  branches: ClaudeConversation[];
  currentBranchId: string | null;
  parentConversation: ClaudeConversation | null;
  onSwitchBranch: (conversationId: string) => void;
}
```

**UI Layout:**
```
┌─ Branches ─────────────────────────────┐
│  ● Main conversation            [active]│
│  ├─ Fork: "Try different approach"      │
│  └─ Fork: "Alternative fix"            │
└─────────────────────────────────────────┘
```

**Features:**
- Tree view showing parent → child branches
- Active branch highlighted with orange accent
- Click to switch branches
- Shows fork label and message count
- Compact inline display (dropdown or overlay)

**Acceptance Criteria:**
- [ ] Renders branch tree
- [ ] Active branch highlighted
- [ ] Click switches branch
- [ ] Shows fork labels
- [ ] Claude Orange styling

### T13: ClaudePanel Integration — Checkpoints + Branches
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Add checkpoint timeline, branch switcher, rewind confirmation dialog

**Changes:**
- Add checkpoint timeline as a collapsible side panel or overlay (toggled via new header button)
- Add branch switcher next to conversation history button (GitBranch icon)
- Add rewind confirmation dialog (modal): "Rewind to {label}? This will restore {N} files and remove {M} messages after this point."
- Load checkpoints when conversation changes
- Connect all checkpoint/branch store actions

**New Header Button Layout:**
```
[+ New] [Clock History] [GitBranch Branches] [RotateCcw Checkpoints] [Trash Clear]
```

**Acceptance Criteria:**
- [ ] Checkpoint button in header toggles timeline overlay
- [ ] Branch button shows branch switcher
- [ ] Rewind confirmation dialog before restoring
- [ ] Fork prompts for branch label
- [ ] All connected to store actions
- [ ] Tests updated

### T14: ClaudeToolCall — Rewind-to Button
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeToolCall.tsx` — Add rewind button on completed Edit/Write tool calls

**Changes:**
- For tool calls with toolName Edit or Write, and status 'complete', show a small rewind (RotateCcw) button
- Button appears on hover
- Clicking it finds the checkpoint associated with this tool call and triggers rewind
- Requires passing checkpoints list or a `onRewindToMessage` callback

**Acceptance Criteria:**
- [ ] Rewind button on completed Edit/Write tool calls
- [ ] Only on hover, non-intrusive
- [ ] Triggers rewind flow for the correct checkpoint
- [ ] Not shown for Read/Glob/non-modifying tools

**Phase 3 Dependencies:**
```
T11 ─── depends on T6 (store state)
T12 ─── depends on T6, T10 (branch state)
T13 ──→ depends on T11, T12 (components)
T14 ─── depends on T6 (checkpoint data)
```

**Parallelizable:** [T11, T12, T14] can start simultaneously

---

## STOP POINT 4: Final Review
> All phases complete, JUNO re-audit of checkpoint/fork features.

---

## Test Strategy

### Unit Tests (per task)
Each task includes tests in its acceptance criteria. Key test areas:

| Area | Test File | Key Tests |
|------|-----------|-----------|
| Schema migration | `tests/main/database/schema.test.ts` | v3→v4 migration, table creation, indexes |
| Checkpoint CRUD | `tests/main/database/database.service.test.ts` | Create, read, delete, cleanup |
| Checkpoint service | `tests/main/services/checkpoint.service.test.ts` | Snapshot, restore, compress/decompress |
| Fork logic | `tests/main/database/database.service.test.ts` | Fork creates copy, parent preserved |
| Store actions | `tests/renderer/stores/useClaudeStore.test.ts` | Rewind, fork, load checkpoints |
| ClaudeCheckpoints | `tests/renderer/components/ide/claude/ClaudeCheckpoints.test.tsx` | Timeline, rewind, fork |
| ClaudeBranchSwitcher | `tests/renderer/components/ide/claude/ClaudeBranchSwitcher.test.tsx` | Branch tree, switch |
| Panel integration | `tests/renderer/components/ide/claude/ClaudePanel.test.tsx` | Checkpoint button, rewind dialog |
| ToolCall rewind | `tests/renderer/components/ide/claude/ClaudeToolCall.test.tsx` | Rewind button on Edit |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| File restore race condition (user editing while rewind) | HIGH | Lock UI during restore, show progress indicator |
| Large file snapshots consuming disk space | MEDIUM | Gzip compression (5-10x), 50-checkpoint limit, 7-day TTL, auto-cleanup |
| Auto-checkpoint slowing streaming pipeline | MEDIUM | Async snapshot creation, don't await in event handler |
| Fork creating duplicate large conversations | LOW | Messages are small text, snapshots are compressed, cleanup handles it |
| Schema migration failure on existing DBs | MEDIUM | Wrap in transaction, test migration path from v3 |
| Bash commands: can't determine affected files | LOW | Don't auto-checkpoint for Bash (or checkpoint all workspace files — expensive) |

---

## Summary JSON

```json
{
  "tasks": [
    { "id": "T1", "description": "Database schema v4 — checkpoint tables", "dependencies": [], "complexity": 6, "phase": 1 },
    { "id": "T2", "description": "Database CRUD — checkpoint operations", "dependencies": ["T1"], "complexity": 5, "phase": 1 },
    { "id": "T3", "description": "Checkpoint service — core logic", "dependencies": ["T2"], "complexity": 7, "phase": 1 },
    { "id": "T4", "description": "Checkpoint IPC channels", "dependencies": ["T1", "T3"], "complexity": 4, "phase": 1 },
    { "id": "T5", "description": "Conversation fork logic in database", "dependencies": ["T2", "T3"], "complexity": 6, "phase": 1 },
    { "id": "T6", "description": "Store checkpoint state + actions", "dependencies": [], "complexity": 5, "phase": 2 },
    { "id": "T7", "description": "Auto-checkpoint in streaming pipeline", "dependencies": ["T3"], "complexity": 7, "phase": 2 },
    { "id": "T8", "description": "Conversation ID tracking in container service", "dependencies": ["T7"], "complexity": 4, "phase": 2 },
    { "id": "T9", "description": "Rewind checkpoint — full flow", "dependencies": ["T4", "T6"], "complexity": 5, "phase": 2 },
    { "id": "T10", "description": "Fork checkpoint — full flow", "dependencies": ["T4", "T5", "T6"], "complexity": 7, "phase": 2 },
    { "id": "T11", "description": "ClaudeCheckpoints — timeline UI", "dependencies": ["T6"], "complexity": 7, "phase": 3 },
    { "id": "T12", "description": "ClaudeBranchSwitcher component", "dependencies": ["T6", "T10"], "complexity": 5, "phase": 3 },
    { "id": "T13", "description": "ClaudePanel — checkpoint + branch integration", "dependencies": ["T11", "T12"], "complexity": 6, "phase": 3 },
    { "id": "T14", "description": "ClaudeToolCall — rewind-to button", "dependencies": ["T6"], "complexity": 4, "phase": 3 }
  ],
  "sequence": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  "parallelizable": [
    [1],
    [2],
    [3, 5],
    [4],
    [6, 7],
    [8, 9, 10],
    [11, 12, 14],
    [13]
  ],
  "stopPoints": ["requirements", "design", "plan", "final"],
  "deferred": []
}
```

### Effort by Phase
| Phase | Tasks | Complexity Sum |
|-------|-------|---------------|
| Phase 1: Database + Service | T1-T5 | 28 |
| Phase 2: Store + Integration | T6-T10 | 28 |
| Phase 3: UI Components | T11-T14 | 22 |
| **Total** | **14** | **78** |

### File Inventory
| Category | Count | Files |
|----------|-------|-------|
| New files | 3 | `checkpoint.service.ts`, `ClaudeCheckpoints.tsx`, `ClaudeBranchSwitcher.tsx` |
| Modified files | 8 | `schema.ts`, `database.service.ts`, `channels.ts`, `index.ts`, `claude-container.service.ts`, `useClaudeStore.ts`, `ClaudePanel.tsx`, `ClaudeToolCall.tsx` |
| New test files | 3 | `checkpoint.service.test.ts`, `ClaudeCheckpoints.test.tsx`, `ClaudeBranchSwitcher.test.tsx` |
| Modified test files | 4 | `database.service.test.ts`, `useClaudeStore.test.ts`, `ClaudePanel.test.tsx`, `ClaudeToolCall.test.tsx` |
| **Total** | **18** | |
