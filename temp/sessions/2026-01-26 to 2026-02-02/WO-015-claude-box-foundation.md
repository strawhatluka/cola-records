# ORCHESTRATOR WORK ORDER #015
## Type: IMPLEMENTATION
## Claude Box Upgrade — Phase 1: Foundation

---

## MISSION OBJECTIVE

Establish the foundation layer for the Claude Box full feature upgrade. This includes enhanced IPC types for rich streaming events, SQLite database migration for conversation persistence, enhanced NDJSON streaming protocol in the backend service, and installation of new dependencies.

**Implementation Goal:** 4 tasks (T1-T4) delivering typed streaming events, conversation tables, enhanced backend protocol, and new npm packages.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-box-upgrade-plan.md`
**Stop Point:** Design review after completion — verify foundation works before Phase 2.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Modified_Files:
  - path: src/main/ipc/channels.ts
    task: T1
    changes: Add ClaudeStreamEvent, ClaudeConversation, ClaudePersistedMessage types; new IPC channels for conversations + permissions; update stream-chunk event type
    risk: MEDIUM

  - path: src/main/database/schema.ts
    task: T2
    changes: Add SCHEMA_VERSION 3 migration with claude_conversations and claude_messages tables + indexes
    risk: LOW

  - path: src/main/database/database.service.ts
    task: T2
    changes: Add CRUD methods — saveConversation, getConversations, getConversationMessages, deleteConversation, saveMessage
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    task: T3
    changes: Update query() to emit rich ClaudeStreamEvent objects, track token usage, handle permission requests
    risk: HIGH

  - path: package.json
    task: T4
    changes: Add react-syntax-highlighter, @types/react-syntax-highlighter, remark-gfm
    risk: LOW
```

---

## IMPLEMENTATION APPROACH

### Task T1: Enhanced Claude Stream Types & NDJSON Protocol (Complexity 5/10)
**File:** `src/main/ipc/channels.ts`
**Dependencies:** None

Add the following types after the existing `ClaudeContainerStatus` interface:

```typescript
// Rich streaming event types from Claude Agent SDK NDJSON protocol
export interface ClaudeStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'usage' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  thinking?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
  done?: boolean;
}

// Conversation persistence types
export interface ClaudeConversation {
  id: string;
  title: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ClaudePersistedMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  messageType: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  toolName?: string;
  toolInput?: string;   // JSON stringified
  toolResult?: string;
  thinking?: string;
  usageInputTokens?: number;
  usageOutputTokens?: number;
  timestamp: number;
}

// Permission request type
export interface ClaudePermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
}
```

Add to `IpcChannels`:
```typescript
// Claude Conversation Channels
'claude:conversations:list': (projectPath: string) => ClaudeConversation[];
'claude:conversations:get': (id: string) => { conversation: ClaudeConversation; messages: ClaudePersistedMessage[] };
'claude:conversations:delete': (id: string) => void;
'claude:conversations:save': (conversation: ClaudeConversation, messages: ClaudePersistedMessage[]) => void;
'claude:permission:respond': (requestId: string, approved: boolean) => void;
```

Update `IpcEvents`:
```typescript
// Replace existing claude:stream-chunk with enhanced version
'claude:stream-chunk': (event: ClaudeStreamEvent) => void;
// Add permission request event
'claude:permission:request': (event: ClaudePermissionRequest) => void;
```

**Acceptance Criteria:**
- [ ] All new types exported and importable
- [ ] Existing ClaudeQueryResponse, ClaudeHealthResponse, ClaudeContainerStatus unchanged
- [ ] New IPC channels added to IpcChannels interface
- [ ] Stream chunk event updated to use ClaudeStreamEvent
- [ ] TypeScript compiles without errors

---

### Task T2: Database Migration — Conversation Tables (Complexity 4/10)
**Files:** `src/main/database/schema.ts`, `src/main/database/database.service.ts`
**Dependencies:** T1

**schema.ts changes:**
- Update `SCHEMA_VERSION` from 2 to 3
- Add migration 3 to `MIGRATIONS` record:

```sql
CREATE TABLE IF NOT EXISTS claude_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_claude_conversations_project
  ON claude_conversations(project_path);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_updated
  ON claude_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS claude_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  tool_name TEXT,
  tool_input TEXT,
  tool_result TEXT,
  thinking TEXT,
  usage_input_tokens INTEGER,
  usage_output_tokens INTEGER,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES claude_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_claude_messages_conversation
  ON claude_messages(conversation_id, timestamp);
```

**database.service.ts changes:**
Add methods:
- `saveConversation(conv: ClaudeConversation): void` — INSERT OR REPLACE
- `getConversations(projectPath: string): ClaudeConversation[]` — SELECT ordered by updated_at DESC
- `getConversationMessages(conversationId: string): ClaudePersistedMessage[]` — SELECT ordered by timestamp ASC
- `deleteConversation(id: string): void` — DELETE (cascade handles messages)
- `saveMessage(msg: ClaudePersistedMessage): void` — INSERT OR REPLACE

**Acceptance Criteria:**
- [ ] Migration 3 runs on app startup without errors
- [ ] CRUD methods work correctly with SQLite
- [ ] Foreign key cascade deletes messages when conversation is deleted
- [ ] Indexes created for performance
- [ ] Existing migrations (1, 2) unaffected

---

### Task T3: Enhanced Backend NDJSON Streaming (Complexity 6/10)
**File:** `src/main/services/claude-container.service.ts`
**Dependencies:** T1

Update the `query()` method to emit rich `ClaudeStreamEvent` objects:

**Changes to `query()` NDJSON line parsing:**
- `{"type":"text","content":"..."}` → emit `{ type: 'text', content: '...' }`
- `{"type":"tool_use","name":"...","input":{...}}` → emit `{ type: 'tool_use', toolName: '...', toolInput: {...} }`
- `{"type":"tool_result","content":"..."}` → emit `{ type: 'tool_result', toolResult: '...' }`
- `{"type":"thinking","content":"..."}` → emit `{ type: 'thinking', thinking: '...' }`
- `{"type":"error","message":"..."}` → emit `{ type: 'error', error: '...' }` + reject
- `{"type":"usage","input_tokens":N,"output_tokens":N}` → emit `{ type: 'usage', usage: {...} }`

**On response end:** emit `{ type: 'done', done: true }`

**Token usage tracking:**
- Track cumulative input/output tokens per query
- Include in enhanced `ClaudeQueryResponse`

**Permission flow:**
- When `tool_use` events arrive, emit `claude:permission:request` via IPC
- Listen for `claude:permission:respond` to continue/abort
- In auto mode, skip permission and continue immediately

**Backward compatibility:**
- The `ClaudeQueryResponse` return type keeps `success`, `response`, `messageCount`, `timestamp`
- Add optional `usage?: { inputTokens: number; outputTokens: number }` field

**Acceptance Criteria:**
- [ ] All NDJSON event types parsed and emitted as ClaudeStreamEvent
- [ ] Token usage tracked and returned in response
- [ ] Permission request/response flow works via IPC
- [ ] Existing query functionality not broken
- [ ] Error handling preserved for HTTP errors and NDJSON errors

---

### Task T4: Install New Dependencies (Complexity 1/10)
**File:** `package.json`
**Dependencies:** None

```bash
npm install react-syntax-highlighter remark-gfm
npm install -D @types/react-syntax-highlighter
```

**Acceptance Criteria:**
- [ ] `react-syntax-highlighter` in dependencies
- [ ] `remark-gfm` in dependencies
- [ ] `@types/react-syntax-highlighter` in devDependencies
- [ ] `npm install` succeeds
- [ ] Build still passes

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE1-FOUNDATION-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Summary** — Types, migration, streaming, dependencies all implemented
2. **Changes Applied** — Files modified with descriptions
3. **Type Inventory** — All new TypeScript types listed
4. **Migration Details** — Schema version 3 tables and indexes
5. **Protocol Changes** — Before/after stream event format

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below

**Step 1:** Create completion report in `trinity/sessions/`
**Step 2:** Move this work order to `trinity/sessions/`
**Step 3:** Verify all 4 tasks complete (T1-T4)
**Step 4:** STOP POINT — Design review before Phase 2

---

## SUCCESS CRITERIA

- [ ] All 4 tasks implemented (T1-T4)
- [ ] TypeScript compiles without errors
- [ ] Database migration runs successfully
- [ ] Existing tests still pass (user runs `npm test`)
- [ ] New dependencies installed
- [ ] Build passes (`npm run build`)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS
- **NO git operations** — Only LUKA has permission
- **NO running tests** — User runs tests on their end
- **Read file before editing** — No parallel file edits, sequential only
- **No sed commands** — Use Read + Edit tools only
- **Backward compatibility** — Existing stream-chunk consumers must still work

### DO:
- [ ] Follow existing patterns in channels.ts, schema.ts, database.service.ts
- [ ] Use TypeScript strict types
- [ ] Add JSDoc comments on new interfaces
- [ ] Test migration SQL syntax before applying

---

## IMPLEMENTATION SEQUENCE

```
T1: Enhanced types in channels.ts (no dependencies)
T4: Install npm dependencies (no dependencies, parallel with T1)
  ↓
T2: Database migration (depends on T1 types)
T3: Enhanced NDJSON streaming (depends on T1 types)
```
