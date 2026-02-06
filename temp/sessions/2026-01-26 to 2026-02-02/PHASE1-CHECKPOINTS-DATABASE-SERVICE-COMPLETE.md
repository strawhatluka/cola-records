# PHASE 1 — Checkpoints Database & Service Foundation Complete

**Work Order:** WO-024
**Completed:** 2026-01-31
**Status:** ALL 5 TASKS COMPLETE

---

## Executive Summary

Implemented the foundational backend infrastructure for the checkpoint system: schema v4 migration with 2 new tables and 3 branching columns, 8 new database methods (5 checkpoint CRUD + 2 file snapshot CRUD + 1 fork), a CheckpointService with gzip compression/restore/cleanup, 5 IPC channels, and transactional conversation fork logic. Closes GAP-19 backend (Checkpoints) and GAP-20 backend (Conversation Forking). TypeScript compilation passes with zero errors.

---

## Schema Migration Details (v3 → v4)

**New Tables:**
- `claude_checkpoints` — Checkpoint snapshot points in conversations
  - Columns: `id`, `conversation_id`, `message_id`, `label`, `checkpoint_type`, `message_index`, `created_at`
  - Constraint: `checkpoint_type IN ('auto', 'manual')`
  - Foreign key: `conversation_id` → `claude_conversations(id)` ON DELETE CASCADE
  - Index: `idx_checkpoints_conversation` on `(conversation_id, created_at)`

- `claude_file_snapshots` — Compressed file state at each checkpoint
  - Columns: `id`, `checkpoint_id`, `file_path`, `content_compressed` (BLOB), `original_size`, `created_at`
  - Foreign key: `checkpoint_id` → `claude_checkpoints(id)` ON DELETE CASCADE
  - Index: `idx_file_snapshots_checkpoint` on `(checkpoint_id)`

**ALTER Columns on `claude_conversations`:**
- `parent_conversation_id TEXT` — Links to parent conversation for forks
- `fork_checkpoint_id TEXT` — Checkpoint from which conversation was forked
- `branch_label TEXT` — Display label for the branch

---

## Database Methods Added (8)

### Checkpoint CRUD (5 methods)
```typescript
createCheckpoint(cp: Omit<ClaudeCheckpoint, 'fileCount'>): void
getCheckpoints(conversationId: string): ClaudeCheckpoint[]  // includes fileCount via LEFT JOIN
getCheckpointById(id: string): ClaudeCheckpoint | null
deleteCheckpoint(id: string): void  // CASCADE deletes snapshots
deleteOldCheckpoints(conversationId: string, keepCount: number): void
```

### File Snapshot CRUD (2 methods)
```typescript
saveFileSnapshot(snapshot: ClaudeFileSnapshot): void
getFileSnapshots(checkpointId: string): ClaudeFileSnapshot[]
```

### Fork Logic (1 method)
```typescript
forkConversation(sourceConversationId: string, checkpointId: string, branchLabel: string): ClaudeConversation
```

Fork is transactional (wrapped in `db.transaction()`):
1. Creates new conversation with parent/checkpoint references
2. Copies messages up to checkpoint's messageIndex with new IDs
3. Copies file snapshots to a new checkpoint in the forked conversation
4. Returns the new conversation

---

## CheckpointService API

```typescript
class CheckpointService {
  constructor(db: DatabaseService)

  // Create checkpoint with file snapshotting
  async createCheckpoint(conversationId, messageId, label, type, messageIndex, affectedFiles): Promise<ClaudeCheckpoint>

  // Restore files to checkpoint state
  async restoreCheckpoint(checkpointId): Promise<{ restoredFiles: string[]; messageIndex: number }>

  // Get checkpoint timeline for conversation
  getTimeline(conversationId): ClaudeCheckpoint[]

  // Cleanup old checkpoints (default: 50 max, 7-day TTL)
  cleanup(conversationId, maxCount?, maxAgeDays?): void
}
```

**Compression:** Uses Node.js `zlib.gzipSync` / `zlib.gunzipSync` for file content compression.

---

## IPC Channels Registered (5)

| Channel | Params | Returns |
|---------|--------|---------|
| `claude:checkpoints:list` | `conversationId: string` | `ClaudeCheckpoint[]` |
| `claude:checkpoints:create` | `conversationId: string, label: string` | `ClaudeCheckpoint` |
| `claude:checkpoints:restore` | `checkpointId: string` | `{ restoredFiles: string[]; messageIndex: number }` |
| `claude:checkpoints:delete` | `checkpointId: string` | `void` |
| `claude:conversation:fork` | `conversationId: string, checkpointId: string, branchLabel: string` | `ClaudeConversation` |

---

## TypeScript Compilation

- `npx tsc --noEmit` → EXIT_CODE=0 (zero errors)

---

## Files Changed Inventory

| File | Action | Changes |
|------|--------|---------|
| `src/main/database/schema.ts` | Modified | Bumped SCHEMA_VERSION to 4, added MIGRATIONS[4] |
| `src/main/ipc/channels.ts` | Modified | Added ClaudeCheckpoint, ClaudeFileSnapshot types; updated ClaudeConversation; added 5 IPC channels |
| `src/main/database/database.service.ts` | Modified | Added 8 methods (5 checkpoint + 2 snapshot + 1 fork), rowToConversation helper, updated imports |
| `src/main/services/checkpoint.service.ts` | Created | CheckpointService with create, restore, timeline, cleanup, gzip compression |
| `src/main/index.ts` | Modified | Added CheckpointService import/init, 5 IPC handlers |

**Total: 4 files modified, 1 file created**

---

## Next Steps

WO-024 provides the complete backend foundation:
- Schema ready for checkpoints and branching
- CRUD operations for checkpoints and file snapshots
- CheckpointService with gzip compression/decompression
- Fork logic with transactional message + snapshot copying
- All IPC channels wired and ready

WO-025 (Store & Auto-Checkpoint Integration) and WO-026 (UI Components) can now proceed.
