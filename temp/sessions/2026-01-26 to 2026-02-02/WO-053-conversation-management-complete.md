# WO-053: Conversation Management (Complete)

**Status:** PLANNED
**Complexity:** 5/10
**Priority:** HIGH
**Phase:** 2 - Advanced Systems
**Dependencies:** None (extends existing conversation infrastructure)
**Category:** Audit Section 7 - Conversation Management
**Estimated Time:** 6-8 hours
**Created:** 2026-02-01

---

## Objective

Complete the conversation management feature set by adding time-based browsing, keyword search, named sessions via `/rename`, compact with focus instructions, configurable `cleanupPeriodDays` for session retention, and improved conversation history UI. The existing conversation infrastructure (list, save, delete, switch, fork) is preserved and extended.

---

## Background

The conversation system was implemented across WO-015, WO-029, and WO-024/WO-025. It includes: SQLite-backed conversation and message storage, conversation listing per project, create/save/delete/switch operations, conversation forking from checkpoints, and compaction via the `claude:compact` IPC channel. The missing features are user-facing browsing enhancements and session management utilities.

### Current State (Implemented)
- `ClaudeConversation` type with id, title, projectPath, createdAt, updatedAt, messageCount, parentConversationId, forkCheckpointId, branchLabel
- IPC channels: `claude:conversations:list`, `claude:conversations:get`, `claude:conversations:delete`, `claude:conversations:save`
- IPC channel: `claude:compact` (compresses conversation text)
- `useClaudeStore` has: conversations, currentConversationId
- Store actions: loadConversations, newConversation, switchConversation, deleteConversation, saveCurrentConversation

### Missing Features (This WO)
- Time-based grouping in conversation history (Today, Yesterday, Last 7 days, Older)
- Keyword search across conversation titles and message content
- Named sessions via `/rename` command
- Compact with focus instructions (`/compact focus on authentication`)
- `cleanupPeriodDays` setting for automatic session cleanup
- Fork conversation from history list

---

## Acceptance Criteria

1. Conversation history displays entries grouped by time period: Today, Yesterday, Last 7 Days, Last 30 Days, Older
2. A search input at the top of conversation history filters by keyword across titles and message content
3. `/rename` command renames the current session; the new name appears in history
4. `/compact` accepts optional focus instructions that are passed to the compaction prompt
5. `cleanupPeriodDays` setting (default 30) automatically deletes sessions older than the configured period
6. Conversations in history show their custom name (if renamed) or auto-generated title
7. Each conversation entry in history has a context menu with: Resume, Rename, Fork, Delete
8. Search results highlight matching keywords in conversation titles
9. Unit tests cover time grouping, search, rename, compact with focus, cleanup logic
10. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
Existing Infrastructure (preserved):
  ConversationService (main) -- SQLite storage
  useClaudeStore (renderer) -- conversation state
  ClaudeConversationHistory (renderer) -- basic list UI

New/Modified:
  ConversationService -- Add rename, search, cleanup methods
  ClaudeConversationHistory.tsx -- Time grouping, search bar, context menu
  useClaudeStore.ts -- Add rename, search, cleanup, compactWithFocus actions
  ClaudeSlashCommands.tsx -- Register /rename command
  AppSettings -- Add cleanupPeriodDays
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/claude/ConversationSearchBar.tsx` | Search input with keyword filtering |
| `src/renderer/components/claude/ConversationContextMenu.tsx` | Right-click menu for conversation entries |
| `tests/unit/components/claude/ConversationSearchBar.test.tsx` | Search bar tests |
| `tests/unit/components/claude/ConversationContextMenu.test.tsx` | Context menu tests |
| `tests/unit/services/conversation-cleanup.test.ts` | Cleanup logic tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/claude/ClaudeConversationHistory.tsx` | Add time-based grouping, integrate search bar, add context menu |
| `src/renderer/stores/useClaudeStore.ts` | Add renameConversation, searchConversations, cleanupOldConversations, compactWithFocus actions |
| `src/main/ipc/channels.ts` | Add `claude:conversations:rename`, `claude:conversations:search`, `claude:conversations:cleanup` channels, add `cleanupPeriodDays` to AppSettings |
| `src/main/ipc/handlers.ts` | Register new conversation IPC handlers |
| `src/main/services/conversation.service.ts` (or equivalent SQLite handler) | Add rename, search, cleanup SQL queries |
| `src/main/services/claude-container.service.ts` | Pass focus instructions to compact query |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/rename` command |

### Interfaces

```typescript
// Additions to channels.ts

export interface ConversationSearchResult {
  conversation: ClaudeConversation;
  /** Matching snippet from message content (if matched on content, not title) */
  matchSnippet?: string;
  /** Which field matched: 'title' or 'content' */
  matchField: 'title' | 'content';
}

export interface ConversationTimeGroup {
  label: string; // "Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Older"
  conversations: ClaudeConversation[];
}

// New IPC channels:
// 'claude:conversations:rename': (id: string, newName: string) => ClaudeConversation
// 'claude:conversations:search': (projectPath: string, keyword: string) => ConversationSearchResult[]
// 'claude:conversations:cleanup': (olderThanDays: number) => { deletedCount: number }

// AppSettings addition:
// cleanupPeriodDays?: number; // Default: 30
```

---

## Implementation Tasks

### Task 1: Conversation Rename IPC and Service
- **Type:** FEATURE
- **Files:** `src/main/ipc/channels.ts`, `src/main/services/conversation.service.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add `claude:conversations:rename` IPC channel that accepts conversation ID and new name string. In the conversation service (or SQLite handler), execute `UPDATE conversations SET title = ?, updatedAt = ? WHERE id = ?`. Return the updated `ClaudeConversation`. Register the handler in handlers.ts. Validate: name must be non-empty and under 100 characters.
- **Test:** Test rename with valid name, empty name rejection, name too long, non-existent conversation ID

### Task 2: Conversation Search IPC and Service
- **Type:** FEATURE
- **Files:** `src/main/ipc/channels.ts`, `src/main/services/conversation.service.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add `claude:conversations:search` IPC channel that accepts projectPath and keyword string. In the service, query: search conversation titles with `LIKE %keyword%`, then search message content with `LIKE %keyword%`. Return `ConversationSearchResult[]` with matchField and matchSnippet (50 chars around match). Limit to 50 results. Order by updatedAt descending.
- **Test:** Test title match, content match, no results, special characters in keyword, result limit

### Task 3: Conversation Cleanup IPC and Service
- **Type:** FEATURE
- **Files:** `src/main/ipc/channels.ts`, `src/main/services/conversation.service.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add `claude:conversations:cleanup` IPC channel that accepts `olderThanDays` integer. Delete conversations (and their messages, checkpoints, file snapshots) where `updatedAt < now - olderThanDays * 86400000`. Use SQL transaction for cascading deletes. Return `{ deletedCount: number }`. Add `cleanupPeriodDays` to `AppSettings` interface with default value of 30.
- **Test:** Test cleanup with various day thresholds, cascading deletes, empty result

### Task 4: Compact with Focus Instructions
- **Type:** FEATURE
- **Files:** `src/main/services/claude-container.service.ts`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Modify the compact flow to accept optional focus instructions. When `/compact focus on authentication` is invoked, the focus string ("focus on authentication") is appended to the compaction system prompt: "Compress this conversation history while preserving important context. Focus: [user focus]". Update `claude:compact` IPC to accept an optional `focusInstructions` parameter. Update store action `compactConversation(focusInstructions?: string)`.
- **Test:** Test compact without focus (existing behavior preserved), compact with focus instructions passed to container

### Task 5: /rename Slash Command
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Register `/rename` in slash command registry. When invoked with argument (e.g., `/rename Authentication Feature`), call `renameConversation(currentConversationId, newName)`. If invoked without argument, show an inline prompt asking for the new name. After rename, update the conversation in the conversations list and show a confirmation message. Add `renameConversation(id, name)` action to store.
- **Test:** Test with argument, without argument, current conversation null handling

### Task 6: Time-Based Grouping in Conversation History
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeConversationHistory.tsx`
- **Details:** Group conversations by time period based on `updatedAt`. Groups: "Today" (same day), "Yesterday" (previous day), "Last 7 Days" (2-7 days ago), "Last 30 Days" (8-30 days ago), "Older" (>30 days). Each group has a collapsible header with the label and count. Empty groups are hidden. Create a pure utility function `groupConversationsByTime(conversations: ClaudeConversation[]): ConversationTimeGroup[]` that can be tested independently.
- **Test:** Test grouping logic with various dates, empty groups, edge cases (midnight boundary)

### Task 7: ConversationSearchBar Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/ConversationSearchBar.tsx`
- **Details:** Search input with magnifying glass icon at the top of conversation history. Debounced search (300ms) that calls `searchConversations(keyword)` on the store. When search is active, replace time-grouped list with flat search results. Each search result shows conversation title with keyword highlighted and match snippet if content-matched. Clear button (X) to reset search and return to time-grouped view.
- **Test:** `tests/unit/components/claude/ConversationSearchBar.test.tsx` - Input change, debounce, clear, result rendering

### Task 8: ConversationContextMenu Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/ConversationContextMenu.tsx`
- **Details:** Right-click context menu on conversation entries with options: Resume (switches to conversation), Rename (opens inline rename input), Fork (creates branch from latest checkpoint), Delete (confirms and deletes). Menu positioned at cursor location. Each option calls the corresponding store action. Delete shows a confirmation dialog before executing.
- **Test:** `tests/unit/components/claude/ConversationContextMenu.test.tsx` - Render options, click handlers, delete confirmation

### Task 9: Automatic Cleanup on Startup
- **Type:** FEATURE
- **Files:** `src/main/services/claude-container.service.ts` (or app startup logic)
- **Details:** On app startup (or Claude container start), check `cleanupPeriodDays` from settings. If set and > 0, call `claude:conversations:cleanup` with the configured value. Log the number of deleted conversations. Only run cleanup once per app session (not on every container restart).
- **Test:** Test startup cleanup triggers, respects setting value, runs only once

### Task 10: Integrate All Components into History UI
- **Type:** INTEGRATION
- **Files:** `src/renderer/components/claude/ClaudeConversationHistory.tsx`
- **Details:** Assemble the complete conversation history panel: ConversationSearchBar at top, time-grouped conversation list below, ConversationContextMenu on right-click. Show conversation custom name (from rename) or auto-title. Show message count and last updated time per entry. Show branch badge for forked conversations. Smooth transitions between search and grouped views.
- **Test:** Integration render test with mock conversations across time periods, search interaction, context menu

---

## Testing Requirements

- **Unit Tests:** Time grouping utility, search bar debounce, context menu actions, rename/search/cleanup store actions
- **Integration Tests:** Full search flow (type keyword -> results displayed), rename flow (command -> title updated), cleanup flow (startup -> old conversations deleted)
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock SQLite for service tests, mock IPC for store tests, mock useClaudeStore for component tests
- **Edge Cases:** Empty conversation history, all conversations in "Today" group, search with no results, rename to same name, cleanup with 0 days (delete all), conversation updated exactly at midnight boundary

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for search performance, cleanup safety, UX flow |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 7 (Conversation Management):

- [x] New conversation (existing)
- [x] Conversation history (existing)
- [ ] Browse by time (Today, Yesterday, Last 7 days, etc.)
- [ ] Search conversations by keyword
- [x] Resume conversation (existing)
- [ ] Named sessions (/rename)
- [x] Multiple parallel conversations (existing - new conversation)
- [x] Conversation compaction (existing)
- [ ] Compact with focus instructions
- [ ] Session cleanup (cleanupPeriodDays)
- [x] Fork conversation (existing)

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Search performance on large conversation databases | MEDIUM | MEDIUM | Use SQLite FTS5 or LIKE with index; limit results to 50 |
| Cleanup accidentally deleting active conversation | HIGH | LOW | Never delete the currently active conversation; filter by ID |
| Rename causing title collisions | LOW | LOW | Allow duplicate titles; conversations identified by UUID |
| Compact with focus losing important context | MEDIUM | MEDIUM | Include focus instructions as guidance, not hard filter; preserve core context |

---

## Notes

- This work order has NO external dependencies since it extends the existing conversation infrastructure.
- The existing IPC channels for conversations remain unchanged; new channels are additive.
- The `/resume` command from the audit is equivalent to clicking a conversation in the history list. Our UI provides this natively without needing a separate command.
- The `cleanupPeriodDays` default of 30 matches Claude Code's default retention period.
- Search uses simple `LIKE` matching initially. If performance becomes an issue with large databases, we can upgrade to SQLite FTS5 in a future optimization pass.
- The `/compact` command's focus parameter is a UX improvement that helps users preserve specific context during auto-compaction.
