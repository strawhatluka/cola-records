# ORCHESTRATOR WORK ORDER #018
## Type: IMPLEMENTATION
## Claude Box Upgrade — Phase 4: Conversations

---

## MISSION OBJECTIVE

Implement the conversation management layer for the Claude Box. This includes the full Zustand store overhaul with conversation support, tool tracking, token usage, and permission modes; the conversation history UI component; and the IPC handlers for SQLite conversation persistence.

**Implementation Goal:** 3 tasks (T15-T17) delivering 1 new component + 1 major store overhaul + IPC handler additions.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-box-upgrade-plan.md`
**Depends On:** WO-015 (Phase 1) for types (T1), DB migration (T2), enhanced streaming (T3). WO-016 (Phase 2) for theme (T6).

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/ClaudeConversationHistory.tsx
    task: T16
    description: Dropdown panel for browsing past conversations with search and date grouping
    risk: MEDIUM
```

### Files to Modify
```yaml
Modified_Files:
  - path: src/renderer/stores/useClaudeStore.ts
    task: T15
    changes: Major overhaul — conversations, tool tracking, permissions, token usage, message history, enhanced streaming handler
    risk: HIGH

  - path: src/main/index.ts
    task: T17
    changes: Add 4 new IPC handlers for conversation CRUD + 1 for permission response
    risk: MEDIUM
```

---

## IMPLEMENTATION APPROACH

### Task T15: Enhanced useClaudeStore — Full State Overhaul (Complexity 8/10)
**File:** `src/renderer/stores/useClaudeStore.ts`
**Dependencies:** T1 (types), T2 (DB), T3 (enhanced streaming)

This is the most complex task in the entire upgrade. The store must be rewritten to support conversations, rich streaming events, tool tracking, permissions, and token usage while maintaining backward compatibility with existing callers.

**Extended ClaudeMessage type:**
```typescript
export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  // NEW fields
  messageType?: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  thinking?: string;
  usageInputTokens?: number;
  usageOutputTokens?: number;
}
```

**New state fields:**
```typescript
interface ClaudeState {
  // EXISTING (preserved)
  messages: ClaudeMessage[];
  loading: boolean;
  containerReady: boolean;
  containerStarting: boolean;
  error: string | null;
  projectPath: string | null;

  // NEW — Conversations
  currentConversationId: string | null;
  conversations: ClaudeConversation[];

  // NEW — Permissions
  pendingPermissions: ClaudePermissionRequest[];
  permissionMode: 'normal' | 'plan' | 'auto';

  // NEW — Usage Tracking
  tokenUsage: { inputTokens: number; outputTokens: number };
  contextPercent: number;

  // NEW — Message History (for up/down navigation in input)
  messageHistory: string[];
  historyIndex: number;
}
```

**New actions:**
```typescript
// Conversation management
loadConversations: (projectPath: string) => Promise<void>;
newConversation: () => void;
switchConversation: (id: string) => Promise<void>;
deleteConversation: (id: string) => Promise<void>;
saveCurrentConversation: () => Promise<void>;

// Permissions
respondToPermission: (requestId: string, approved: boolean) => void;
setPermissionMode: (mode: 'normal' | 'plan' | 'auto') => void;
```

**Enhanced `sendMessage` flow:**
1. Add prompt to `messageHistory` array
2. Create user message + empty assistant message (existing pattern)
3. Set up `claude:stream-chunk` listener for `ClaudeStreamEvent`:
   - `type: 'text'` → Append content to assistant message (existing behavior)
   - `type: 'tool_use'` → Add new tool message to messages array
   - `type: 'tool_result'` → Update corresponding tool message with result
   - `type: 'thinking'` → Add/update thinking message
   - `type: 'usage'` → Accumulate token counts, update contextPercent
   - `type: 'error'` → Set error state
   - `type: 'done'` → Mark streaming complete, unsubscribe
4. Set up `claude:permission:request` listener:
   - If `permissionMode === 'auto'` → auto-respond with approved=true
   - Otherwise → add to `pendingPermissions` array (UI renders ClaudePermission)
5. Auto-save conversation after exchange completes

**Enhanced `startContainer`:**
- After container ready, call `loadConversations(projectPath)`
- Load most recent conversation if available, or create new one

**Conversation management methods:**
- `loadConversations`: IPC call to `claude:conversations:list`, update `conversations` array
- `newConversation`: Clear messages, generate new conversationId, add to conversations
- `switchConversation`: Save current, load target via `claude:conversations:get`, update messages
- `deleteConversation`: IPC call to `claude:conversations:delete`, remove from array, switch if current
- `saveCurrentConversation`: IPC call to `claude:conversations:save` with current messages

**Context percentage calculation:**
```typescript
const MAX_CONTEXT_TOKENS = 200_000;
contextPercent = Math.round((tokenUsage.inputTokens + tokenUsage.outputTokens) / MAX_CONTEXT_TOKENS * 100);
```

**Backward compatibility:**
- All existing state fields preserved with same defaults
- `ClaudeMessage` interface extends (new fields are optional)
- `sendMessage`, `startContainer`, `stopContainer`, `checkHealth`, `clearMessages`, `reset` all still work
- Existing stream-chunk handler updated to handle both old `{ content, done }` and new `ClaudeStreamEvent` formats

**Acceptance Criteria:**
- [ ] All existing state and actions preserved
- [ ] Conversations loaded on container start
- [ ] New conversation creates fresh message list
- [ ] Switch conversation loads messages from DB
- [ ] Delete conversation removes from DB and UI
- [ ] Stream events handled by type (text, tool_use, thinking, usage, etc.)
- [ ] Permission requests handled based on mode
- [ ] Token usage tracked and context percent calculated
- [ ] Message history populated for input navigation
- [ ] Auto-save after each exchange
- [ ] Existing callers (ClaudePanel, etc.) still work without changes

---

### Task T16: ClaudeConversationHistory Component (Complexity 5/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeConversationHistory.tsx`
**Dependencies:** T15 (store with conversations), T6 (claude-theme)

```tsx
interface ClaudeConversationHistoryProps {
  conversations: ClaudeConversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}
```

**Layout:**
- Dropdown panel positioned below the history button in the header
- Absolute positioning, z-10, max-height 400px with overflow scroll
- Dark surface background (#1e1e1d) with Claude dark border
- Rounded corners, shadow-lg

**Sections:**
1. **Header bar:**
   - "Conversations" title (small, orange accent)
   - "New" button (Plus icon, orange)
   - Close button (X icon)

2. **Search input:**
   - Small text input with magnifying glass icon
   - Filters conversations by title
   - Dark input matching Claude theme

3. **Conversation list (grouped by date):**
   - **Today** / **Yesterday** / **Last 7 Days** / **Older** — section headers in muted text
   - Each item:
     - Title: First user message truncated to 50 chars (or "New Conversation")
     - Subtitle: message count + relative timestamp (e.g., "12 messages · 2h ago")
     - Orange left border on current conversation
     - Hover: surface hover color (#262625)
     - Delete button (Trash2 icon) on hover, right side
   - Click item → calls `onSelect(id)`

4. **Empty state:**
   - "No conversations yet" in muted text

**Date grouping logic:**
```typescript
function getDateGroup(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const day = 86400000;
  if (diff < day) return 'Today';
  if (diff < day * 2) return 'Yesterday';
  if (diff < day * 7) return 'Last 7 Days';
  return 'Older';
}
```

**Acceptance Criteria:**
- [ ] Renders as dropdown overlay
- [ ] Search filters conversations by title
- [ ] Conversations grouped by date
- [ ] Current conversation highlighted with orange
- [ ] Click selects conversation
- [ ] Delete button with confirmation (or immediate)
- [ ] "New" button creates new conversation
- [ ] Close button dismisses dropdown
- [ ] Empty state when no conversations

---

### Task T17: IPC Handlers for Conversation Persistence (Complexity 4/10)
**File:** `src/main/index.ts`
**Dependencies:** T1 (types), T2 (DB migration + CRUD methods)

Add IPC handlers after existing Claude handlers:

```typescript
// Claude Conversation handlers
handleIpc('claude:conversations:list', async (_event, projectPath) => {
  return database.getConversations(projectPath);
});

handleIpc('claude:conversations:get', async (_event, id) => {
  const conversations = database.getConversations(''); // need to find by id
  const conversation = conversations.find(c => c.id === id);
  if (!conversation) throw new Error(`Conversation ${id} not found`);
  const messages = database.getConversationMessages(id);
  return { conversation, messages };
});

handleIpc('claude:conversations:delete', async (_event, id) => {
  database.deleteConversation(id);
});

handleIpc('claude:conversations:save', async (_event, conversation, messages) => {
  database.saveConversation(conversation);
  for (const msg of messages) {
    database.saveMessage(msg);
  }
});

// Permission response handler
handleIpc('claude:permission:respond', async (_event, requestId, approved) => {
  claudeContainerService.respondToPermission(requestId, approved);
});
```

**Note:** The `claude:conversations:get` handler may need a dedicated `getConversationById` method in database.service.ts. If T2 didn't add one, add it here.

**Also add** `respondToPermission` method to `claudeContainerService` if not added in T3:
- Store pending permission callbacks in a Map
- When permission response received, resolve/reject the corresponding promise

**Acceptance Criteria:**
- [ ] `claude:conversations:list` returns conversations for a project
- [ ] `claude:conversations:get` returns conversation + messages
- [ ] `claude:conversations:delete` removes conversation and messages (cascade)
- [ ] `claude:conversations:save` persists conversation and all messages
- [ ] `claude:permission:respond` routes response to container service
- [ ] Error handling for not-found conversations
- [ ] All handlers follow existing handleIpc pattern

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE4-CONVERSATIONS-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Summary** — 3 tasks completed
2. **Store Architecture** — State shape, actions, streaming flow
3. **Conversation Flow** — Create, switch, save, delete lifecycle
4. **Permission Flow** — Request/response lifecycle by mode
5. **Database Integration** — IPC handlers and CRUD

---

## AFTER COMPLETION

**Step 1:** Create completion report in `trinity/sessions/`
**Step 2:** Move this work order to `trinity/sessions/`
**Step 3:** Verify all 3 tasks complete (T15-T17)
**Step 4:** Build passes, existing tests pass

---

## SUCCESS CRITERIA

- [ ] All 3 tasks implemented (T15-T17)
- [ ] Store manages conversations, permissions, token usage
- [ ] Conversation history component renders with date grouping
- [ ] IPC handlers persist conversations to SQLite
- [ ] Permission flow works in all three modes (normal, plan, auto)
- [ ] Existing store consumers still work
- [ ] Build passes (`npm run build`)
- [ ] Existing tests pass (user runs `npm test`)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS
- **NO git operations** — Only LUKA has permission
- **NO running tests** — User runs tests on their end
- **Read file before editing** — No parallel file edits, sequential only
- **No sed commands** — Use Read + Edit tools only
- **Backward compatibility** — Existing ClaudeMessage consumers must not break

### DO:
- [ ] Extend ClaudeMessage interface (don't replace)
- [ ] Keep all existing store actions working
- [ ] Handle both old and new stream event formats gracefully
- [ ] Use TypeScript strict types for all new state
- [ ] Follow existing IPC handler patterns in index.ts

---

## IMPLEMENTATION SEQUENCE

```
T17: IPC handlers (depends on T1 types + T2 DB methods)
  ↓
T15: Store overhaul (depends on T1 + T2 + T3 + T17 handlers)
  ↓
T16: ConversationHistory component (depends on T15 store + T6 theme)
```
