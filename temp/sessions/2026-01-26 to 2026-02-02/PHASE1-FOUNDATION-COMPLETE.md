# Phase 1: Foundation — Completion Report

**Work Order:** WO-015-claude-box-foundation
**Status:** COMPLETE
**Tasks:** T1, T2, T3, T4 — All implemented

---

## Summary

Phase 1 establishes the foundation layer for the Claude Box upgrade. All 4 tasks delivered:
- **T1:** Enhanced IPC types for rich streaming events, conversations, and permissions
- **T2:** SQLite migration v3 with `claude_conversations` and `claude_messages` tables + CRUD methods
- **T3:** Refactored NDJSON streaming to emit rich `ClaudeStreamEvent` objects with token tracking and permission flow
- **T4:** Installed `react-syntax-highlighter`, `remark-gfm`, and `@types/react-syntax-highlighter`

---

## Changes Applied

### `src/main/ipc/channels.ts` (T1)
- Added `ClaudeStreamEvent` — rich streaming event union type (text, tool_use, tool_result, thinking, error, usage, done)
- Added `ClaudeConversation` — conversation persistence type
- Added `ClaudePersistedMessage` — message persistence type with tool/thinking fields
- Added `ClaudePermissionRequest` — permission request type for tool use approval
- Added `usage` field to `ClaudeQueryResponse` (optional, backward compatible)
- Added 5 new IPC channels: `claude:conversations:list`, `get`, `delete`, `save`, `claude:permission:respond`
- Updated `claude:stream-chunk` event to use `ClaudeStreamEvent` type
- Added `claude:permission:request` event

### `src/main/database/schema.ts` (T2)
- Bumped `SCHEMA_VERSION` from 2 to 3
- Added migration 3: `claude_conversations` table with project_path and updated_at indexes
- Added migration 3: `claude_messages` table with FK cascade to conversations, conversation+timestamp index

### `src/main/database/database.service.ts` (T2)
- Added `saveConversation()` — INSERT OR REPLACE
- Added `getConversations(projectPath)` — SELECT ordered by updated_at DESC
- Added `getConversationMessages(conversationId)` — SELECT ordered by timestamp ASC
- Added `deleteConversation(id)` — DELETE with FK cascade
- Added `saveMessage()` — INSERT OR REPLACE

### `src/main/services/claude-container.service.ts` (T3)
- Added `pendingPermissions` Map for permission callback tracking
- Refactored `query()` to use `handleNdjsonEvent()` for all event type parsing
- Added `handleNdjsonEvent()` — switch on event type, emits corresponding ClaudeStreamEvent
- Added `emitStreamEvent()` — centralized stream event emission
- Added `emitPermissionRequest()` — generates human-readable descriptions for tool use
- Added `respondToPermission()` — resolves pending permission callbacks
- Token usage tracking: accumulates input/output tokens per query, returned in response

### `package.json` (T4)
- Added `react-syntax-highlighter: ^15.6.1` (dependencies)
- Added `remark-gfm: ^4.0.1` (dependencies)
- Added `@types/react-syntax-highlighter: ^15.5.13` (devDependencies)

### `tests/main/services/claude-container.service.test.ts`
- Updated stream-chunk event assertions to match new `ClaudeStreamEvent` shape
- Text events: `{ type: 'text', content: 'chunk1' }` (was `{ content, done: false }`)
- Done events: `{ type: 'done', done: true }` (was `{ content: '', done: true }`)

---

## Type Inventory

| Type | File | Purpose |
|------|------|---------|
| `ClaudeStreamEvent` | channels.ts | Rich streaming event (7 types) |
| `ClaudeConversation` | channels.ts | Conversation metadata for persistence |
| `ClaudePersistedMessage` | channels.ts | Full message with tool/thinking fields |
| `ClaudePermissionRequest` | channels.ts | Tool use permission prompt |

---

## Migration Details

**Schema Version:** 3 (was 2)

### claude_conversations
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Conversation identifier |
| title | TEXT | First user message or "New Conversation" |
| project_path | TEXT | Links to contribution workspace |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp, indexed DESC |
| message_count | INTEGER | Running count |

### claude_messages
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Message identifier |
| conversation_id | TEXT FK | References claude_conversations(id) CASCADE |
| role | TEXT | user/assistant/system/tool |
| content | TEXT | Message content |
| message_type | TEXT | text/tool_use/tool_result/thinking |
| tool_name | TEXT | Optional tool identifier |
| tool_input | TEXT | JSON stringified tool input |
| tool_result | TEXT | Tool execution result |
| thinking | TEXT | Extended thinking content |
| usage_input_tokens | INTEGER | Token count |
| usage_output_tokens | INTEGER | Token count |
| timestamp | INTEGER | Unix timestamp |

---

## Protocol Changes

### Before (WO-010)
```
Stream event: { content: string, done: boolean }
```

### After (WO-015)
```
Stream event: ClaudeStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'usage' | 'done'
  content?: string        // text events
  toolName?: string       // tool_use events
  toolInput?: object      // tool_use events
  toolResult?: string     // tool_result events
  thinking?: string       // thinking events
  error?: string          // error events
  usage?: { inputTokens, outputTokens }  // usage events
  done?: boolean          // done events
}
```

### Backward Compatibility
- Existing store reads `chunk.content` and `chunk.done` — both still present on relevant event types
- New event types (tool_use, thinking, usage) are silently ignored by current store
- Store overhaul (T15, WO-018) will handle all event types
