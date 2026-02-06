# ORCHESTRATOR WORK ORDER #024
## Type: IMPLEMENTATION
## Checkpoints — Database & Service Foundation

---

## MISSION OBJECTIVE

Implement the foundational database schema and service layer for the checkpoint system. This includes a v4 schema migration adding checkpoint and file snapshot tables, conversation branching columns, checkpoint CRUD operations in the database service, a dedicated CheckpointService with gzip compression/restore/cleanup, checkpoint IPC channels, and conversation fork logic.

**Implementation Goal:** Complete backend infrastructure for checkpoints: schema, CRUD, service, IPC, and fork logic — ready for store and UI integration in WO-025/026.
**Based On:** TRA Plan `trinity/sessions/TRA-WO-024-checkpoints-forking-plan.md`, Gap Analysis GAP-19 (Checkpoints), GAP-20 (Conversation Forking)
**Depends On:** WO-020 through WO-023 (all Claude Box gap closure phases complete)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/database/schema.ts
    changes: Bump SCHEMA_VERSION to 4, add MIGRATIONS[4] with claude_checkpoints + claude_file_snapshots tables + ALTER claude_conversations for branching
    risk: MEDIUM

  - path: src/main/database/database.service.ts
    changes: Add 8 new methods — 5 checkpoint CRUD + 2 file snapshot CRUD + 1 forkConversation
    risk: HIGH

  - path: src/main/ipc/channels.ts
    changes: Add ClaudeCheckpoint and ClaudeFileSnapshot types, update ClaudeConversation with branching fields, add 5 new IPC channels
    risk: LOW

  - path: src/main/index.ts
    changes: Add 5 IPC handlers for checkpoint channels
    risk: LOW

New_Files:
  - path: src/main/services/checkpoint.service.ts
    changes: New CheckpointService with createCheckpoint, restoreCheckpoint, getTimeline, cleanup, gzip compression/decompression, file snapshot/restore helpers
    risk: HIGH
```

---

## TASK BREAKDOWN

### T1: Database Schema v4 Migration — Checkpoint Tables
**Complexity:** 6
**Files Modified:** `src/main/database/schema.ts`, `src/main/ipc/channels.ts`

**Schema Changes (MIGRATIONS[4]):**
```sql
-- Checkpoints: snapshot points in a conversation
CREATE TABLE IF NOT EXISTS claude_checkpoints (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  label TEXT NOT NULL,
  checkpoint_type TEXT NOT NULL CHECK(checkpoint_type IN ('auto', 'manual')),
  message_index INTEGER NOT NULL,
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
  content_compressed BLOB NOT NULL,
  original_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES claude_checkpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_snapshots_checkpoint
  ON claude_file_snapshots(checkpoint_id);

-- Conversation branching columns
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
  fileCount?: number;  // derived via JOIN, not stored
}

export interface ClaudeFileSnapshot {
  id: string;
  checkpointId: string;
  filePath: string;
  contentCompressed: Buffer;
  originalSize: number;
  createdAt: number;
}
```

**Update ClaudeConversation interface** with:
```typescript
parentConversationId?: string;
forkCheckpointId?: string;
branchLabel?: string;
```

**Acceptance Criteria:**
- [ ] SCHEMA_VERSION bumped to 4
- [ ] MIGRATIONS[4] creates 2 new tables + 3 ALTER columns
- [ ] Foreign keys with CASCADE delete on both new tables
- [ ] Indexes on conversation_id and checkpoint_id
- [ ] ClaudeCheckpoint and ClaudeFileSnapshot types exported from channels.ts
- [ ] ClaudeConversation updated with branching fields
- [ ] Migration runs cleanly from v3→v4

### T2: Database CRUD — Checkpoint Operations
**Complexity:** 5
**Depends on:** T1
**Files Modified:** `src/main/database/database.service.ts`

**New Methods (7):**
```typescript
// Checkpoint CRUD
createCheckpoint(cp: Omit<ClaudeCheckpoint, 'fileCount'>): void;
getCheckpoints(conversationId: string): ClaudeCheckpoint[];  // includes fileCount via JOIN
getCheckpointById(id: string): ClaudeCheckpoint | null;
deleteCheckpoint(id: string): void;  // CASCADE deletes snapshots
deleteOldCheckpoints(conversationId: string, keepCount: number): void;

// File snapshot CRUD
saveFileSnapshot(snapshot: ClaudeFileSnapshot): void;
getFileSnapshots(checkpointId: string): ClaudeFileSnapshot[];
```

**Key Implementation Details:**
- `getCheckpoints` returns `fileCount` via `LEFT JOIN claude_file_snapshots GROUP BY`
- `deleteOldCheckpoints` keeps the most recent `keepCount` checkpoints, deletes the rest
- All methods follow existing patterns (prepare + run/all/get)

**Acceptance Criteria:**
- [ ] All 7 methods implemented with proper SQL
- [ ] `getCheckpoints` returns file count via JOIN
- [ ] `deleteOldCheckpoints` keeps most recent N, deletes rest
- [ ] Follows existing code patterns in database.service.ts

### T3: Checkpoint Service — Core Logic
**Complexity:** 7
**Depends on:** T2
**Files NEW:** `src/main/services/checkpoint.service.ts`

**Service Design:**
```typescript
export class CheckpointService {
  private db: DatabaseService;

  constructor(db: DatabaseService);

  // Create checkpoint: capture file state for affected files
  async createCheckpoint(
    conversationId: string,
    messageId: string,
    label: string,
    type: 'auto' | 'manual',
    messageIndex: number,
    affectedFiles: string[]
  ): Promise<ClaudeCheckpoint>;

  // Restore checkpoint: revert files to checkpoint state
  async restoreCheckpoint(checkpointId: string): Promise<{
    restoredFiles: string[];
    messageIndex: number;
  }>;

  // Get checkpoint timeline for a conversation
  getTimeline(conversationId: string): ClaudeCheckpoint[];

  // Cleanup old checkpoints (50 limit, 7-day TTL)
  cleanup(conversationId: string, maxCount?: number, maxAgeDays?: number): void;

  // Internal helpers
  private compressContent(content: string): Buffer;      // zlib.gzipSync
  private decompressContent(compressed: Buffer): string;  // zlib.gunzipSync
  private async snapshotFile(filePath: string): Promise<{ content: Buffer; size: number }>;
  private async restoreFile(filePath: string, compressed: Buffer): Promise<void>;
}
```

**Key Implementation Details:**
- Use Node.js `zlib.gzipSync` / `zlib.gunzipSync` for compression
- Read/write files via `fs.readFileSync` / `fs.writeFileSync` (main process has direct access)
- `createCheckpoint` is transactional: wrap in `db.transaction()` (better-sqlite3 transactions)
- `restoreCheckpoint` reads snapshots, writes files, returns messageIndex for conversation truncation
- Default limits: 50 checkpoints per conversation, 7 days TTL
- Export singleton: `export const checkpointService = new CheckpointService(database);`

**Acceptance Criteria:**
- [ ] Service creates checkpoints with compressed file snapshots
- [ ] Service restores files from checkpoints
- [ ] Compression/decompression works correctly with gzip
- [ ] Transactional: checkpoint + snapshots created atomically
- [ ] Cleanup respects count and age limits
- [ ] Handles missing files gracefully (file deleted since snapshot → recreate on restore)

### T4: Checkpoint IPC Channels
**Complexity:** 4
**Depends on:** T1, T3
**Files Modified:** `src/main/ipc/channels.ts`, `src/main/index.ts`

**New IPC Channels (in IpcChannels):**
```typescript
'claude:checkpoints:list': (conversationId: string) => ClaudeCheckpoint[];
'claude:checkpoints:create': (conversationId: string, label: string) => ClaudeCheckpoint;
'claude:checkpoints:restore': (checkpointId: string) => { restoredFiles: string[]; messageIndex: number };
'claude:checkpoints:delete': (checkpointId: string) => void;
'claude:conversation:fork': (conversationId: string, checkpointId: string, branchLabel: string) => ClaudeConversation;
```

**IPC Handlers in index.ts:**
- Each handler calls the corresponding `checkpointService` or `database` method
- `claude:conversation:fork` calls `database.forkConversation()` then restores checkpoint files

**Acceptance Criteria:**
- [ ] All 5 channels defined in IpcChannels type
- [ ] All 5 handlers implemented in index.ts
- [ ] Handlers call checkpoint service / database methods
- [ ] Error handling with try/catch

### T5: Conversation Fork Logic in Database
**Complexity:** 6
**Depends on:** T2, T3
**Files Modified:** `src/main/database/database.service.ts`

**New Method:**
```typescript
forkConversation(
  sourceConversationId: string,
  checkpointId: string,
  branchLabel: string
): ClaudeConversation;
```

**Fork Logic:**
1. Get source conversation
2. Get checkpoint by ID (validate it belongs to the source conversation)
3. Create new conversation with `parentConversationId` and `forkCheckpointId` set
4. Copy all messages up to (and including) checkpoint's `messageIndex` into new conversation with new IDs
5. Copy file snapshots from the checkpoint to a new checkpoint in the forked conversation
6. Return the new conversation

**Implementation:** Wrap entire operation in a `db.transaction()` for atomicity.

**Acceptance Criteria:**
- [ ] Fork creates new conversation with parent/checkpoint references
- [ ] Messages copied up to checkpoint point with new IDs
- [ ] New conversation has its own message copies (not shared references)
- [ ] File snapshots copied to new checkpoint in forked conversation
- [ ] Branch label set on forked conversation
- [ ] Entire operation is transactional

---

## IMPLEMENTATION APPROACH

### Step 1: Schema + Types (T1)
- [ ] Bump SCHEMA_VERSION to 4 in schema.ts
- [ ] Add MIGRATIONS[4] with full SQL
- [ ] Add ClaudeCheckpoint and ClaudeFileSnapshot interfaces to channels.ts
- [ ] Update ClaudeConversation interface with branching fields
- [ ] Update getConversations/getConversationById to return new fields

### Step 2: Database CRUD (T2)
- [ ] Add 5 checkpoint methods to database.service.ts
- [ ] Add 2 file snapshot methods to database.service.ts
- [ ] Implement JOIN query for fileCount in getCheckpoints

### Step 3: Checkpoint Service (T3)
- [ ] Create checkpoint.service.ts
- [ ] Implement gzip compression/decompression helpers
- [ ] Implement createCheckpoint with transactional file snapshotting
- [ ] Implement restoreCheckpoint with file restoration
- [ ] Implement getTimeline and cleanup
- [ ] Export singleton instance

### Step 4: Fork Logic (T5) — parallel with Step 3
- [ ] Add forkConversation method to database.service.ts
- [ ] Implement transactional fork with message and snapshot copying

### Step 5: IPC Channels (T4) — after Steps 3 & 4
- [ ] Add 5 channel definitions to channels.ts IpcChannels
- [ ] Add 5 IPC handlers in index.ts

### Step 6: Validation
- [ ] All new methods callable via IPC
- [ ] Schema migration creates tables correctly
- [ ] Checkpoint create → restore round-trip works
- [ ] Fork creates independent conversation copy

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE1-CHECKPOINTS-DATABASE-SERVICE-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Schema Migration Details
3. Database Methods Added (count + signatures)
4. CheckpointService API
5. IPC Channels Registered
6. Fork Logic Implementation
7. Files Modified/Created List

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-024-checkpoints-database-service-foundation.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-024-checkpoints-database-service-foundation.md`

---

## SUCCESS CRITERIA

- [ ] All 5 tasks (T1-T5) implemented
- [ ] Schema v4 migration creates 2 tables + 3 ALTER columns
- [ ] 8 new database methods (7 CRUD + 1 fork)
- [ ] CheckpointService with create, restore, timeline, cleanup
- [ ] Gzip compression working for file snapshots
- [ ] 5 IPC channels defined and handled
- [ ] Fork logic creates independent conversation copy
- [ ] All operations transactional where required
- [ ] All tests pass (LUKA runs final verification)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install
- [ ] Modify UI components (that's WO-026)
- [ ] Modify store (that's WO-025)

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially (not in parallel)
- [ ] Follow existing code patterns in database.service.ts and other services
- [ ] Use better-sqlite3 transaction() for atomic operations
- [ ] Use Node.js zlib for compression (no external deps)

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** HIGH
**Risk Factors:**
- Schema migration must work cleanly from v3 to v4 on existing databases
- File snapshot compression must handle binary and text files
- Fork logic complexity — transactional message + snapshot copying
- CheckpointService interacts with filesystem directly

**Mitigation:**
- Test migration path from v3 (ALTERs are safe on existing tables)
- Use try/catch around file reads (file may not exist)
- Wrap all multi-step operations in transactions
- Follow existing service patterns (singleton, constructor injection)

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
