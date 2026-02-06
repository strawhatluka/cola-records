# TRA Implementation Plan — Claude Box Full Feature Upgrade

**Planning Date:** 2026-01-31
**Scale:** LARGE (4 stop points)
**Agent:** TRA (Work Planner)

---

## Objective

Upgrade the Claude Box (ClaudePanel) from a skeleton chat interface to full VS Code Claude Code extension feature parity, with Claude Orange branding throughout.

---

## Architecture Overview

```
Current: 3 components + 1 store + 1 service (skeleton chat)
Target:  12+ components + 2 stores + enhanced service + DB migration
```

### Phase Structure
- **Phase 1 (Foundation):** Types, DB migration, enhanced streaming protocol, new dependencies
- **Phase 2 (Core UI):** Claude Orange theme, CodeBlock, enhanced messages, tool calls, thinking blocks
- **Phase 3 (Input & Interaction):** Slash commands, @-mentions, permissions, spinners, context bar
- **Phase 4 (Conversations):** Persistence, history, conversation management
- **Phase 5 (Polish):** Diff viewer, keyboard shortcuts, cost tracking, final integration

---

## Stop Points

1. **Requirements** — Before T1 (this plan approval)
2. **Design** — After Phase 1 (T1-T4), verify foundation works
3. **Plan** — After Phase 3 (T12), verify core features work end-to-end
4. **Final** — After Phase 5 (T20), full integration review

---

## New Dependencies Required

| Package | Purpose |
|---------|---------|
| `react-syntax-highlighter` | Syntax highlighting in code blocks |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) |

No other new dependencies needed — existing `react-markdown`, `lucide-react`, Tailwind CSS cover the rest.

---

## Task Inventory

### Phase 1: Foundation (T1–T4)

#### T1: Enhanced Claude Stream Types & NDJSON Protocol
**Complexity:** 5/10
**Files:** `src/main/ipc/channels.ts`
**Dependencies:** None

Add new types for rich streaming events:

```typescript
// New NDJSON event types from Claude Agent SDK
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

// Enhanced stream chunk event (replaces simple content+done)
// Update IpcEvents['claude:stream-chunk'] to use ClaudeStreamEvent
```

New IPC channels to add:
```typescript
'claude:conversations:list': (projectPath: string) => ClaudeConversation[];
'claude:conversations:get': (id: string) => { conversation: ClaudeConversation; messages: ClaudePersistedMessage[] };
'claude:conversations:delete': (id: string) => void;
'claude:conversations:save': (conversation: ClaudeConversation, messages: ClaudePersistedMessage[]) => void;
'claude:permission:respond': (requestId: string, approved: boolean) => void;
```

New IPC events:
```typescript
'claude:permission:request': (event: { requestId: string; toolName: string; toolInput: Record<string, unknown>; description: string }) => void;
```

---

#### T2: Database Migration — Conversation Tables
**Complexity:** 4/10
**Files:** `src/main/database/schema.ts`, `src/main/database/database.service.ts`
**Dependencies:** T1

Add schema version 3 with two new tables:

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

Add CRUD methods to `database.service.ts`:
- `saveConversation(conversation)`
- `getConversations(projectPath)`
- `getConversationMessages(conversationId)`
- `deleteConversation(id)`
- `saveMessage(message)`

---

#### T3: Enhanced Backend NDJSON Streaming
**Complexity:** 6/10
**Files:** `src/main/services/claude-container.service.ts`
**Dependencies:** T1

Update `query()` to emit rich `ClaudeStreamEvent` objects instead of simple `{ content, done }`:

- Parse NDJSON lines for types: `text`, `tool_use`, `tool_result`, `thinking`, `error`, `usage`
- Emit `claude:stream-chunk` with full `ClaudeStreamEvent` payload
- Track cumulative token usage per query
- Emit `claude:permission:request` when tool_use events require approval
- Listen for `claude:permission:respond` to send approval back to container
- Return enhanced `ClaudeQueryResponse` with usage stats

---

#### T4: Install New Dependencies
**Complexity:** 1/10
**Files:** `package.json`
**Dependencies:** None

```bash
npm install react-syntax-highlighter remark-gfm
npm install -D @types/react-syntax-highlighter
```

---

### Phase 2: Core UI (T5–T9)

#### T5: CodeBlock Component — Syntax Highlighting + Copy
**Complexity:** 5/10
**Files:** NEW `src/renderer/components/ide/claude/CodeBlock.tsx`
**Dependencies:** T4

Features:
- Language label in top-left corner (e.g., "typescript", "python")
- Copy button in top-right corner (copies code to clipboard)
- Syntax highlighting using `react-syntax-highlighter` with `oneDark` theme
- Dark background matching Claude's dark code style
- Horizontal scroll for long lines
- Line numbers (optional, for longer blocks)
- Compact header bar with language + copy button

```tsx
interface CodeBlockProps {
  language: string;
  code: string;
  showLineNumbers?: boolean;
}
```

---

#### T6: Claude Orange Theme Constants & Styling
**Complexity:** 3/10
**Files:** NEW `src/renderer/components/ide/claude/claude-theme.ts`
**Dependencies:** None

Define Claude Orange design tokens:

```typescript
export const claudeTheme = {
  orange: '#d97757',       // Primary accent
  orangeHover: '#c15f3c',  // Darker hover state
  orangeLight: '#d9775720', // 12% opacity for backgrounds
  orangeMuted: '#d9775740', // 25% opacity for borders
  darkBg: '#141413',       // Panel background
  darkSurface: '#1e1e1d',  // Message/card surface
  darkBorder: '#2e2e2d',   // Border color
  warmWhite: '#faf9f5',    // Light text
  mutedText: '#b0aea5',    // Secondary text
  green: '#788c5d',        // Success/ready
  blue: '#6a9bcc',         // Info/links
};
```

Also export Tailwind utility classes for consistent usage:
```typescript
export const claudeClasses = {
  panel: 'bg-[#141413] text-[#faf9f5]',
  surface: 'bg-[#1e1e1d]',
  border: 'border-[#2e2e2d]',
  accent: 'text-[#d97757]',
  accentBg: 'bg-[#d97757]',
  accentHover: 'hover:bg-[#c15f3c]',
  muted: 'text-[#b0aea5]',
  // ... etc
};
```

---

#### T7: Enhanced ClaudeMessage — Full Overhaul
**Complexity:** 7/10
**Files:** `src/renderer/components/ide/claude/ClaudeMessage.tsx`
**Dependencies:** T5, T6

Major rewrite:

- **Claude Orange themed bubbles:**
  - User messages: Orange accent border/background
  - Assistant messages: Dark surface (#1e1e1d) with warm white text
  - System messages: Muted, centered, orange accent icon

- **Rich Markdown with GFM:**
  - Add `remark-gfm` plugin for tables, strikethrough, task lists
  - Tables with styled headers and borders
  - Task lists with checkboxes

- **Code blocks use CodeBlock component:**
  - Replace inline `<code>` blocks with `CodeBlock` for fenced code
  - Inline code stays as styled `<code>` elements

- **Message hover actions:**
  - Copy entire message button (appears on hover)
  - Timestamp tooltip

- **Streaming indicator:**
  - Pulsing orange cursor instead of plain foreground

- **Message types beyond text:**
  - `tool_use` messages render as `ClaudeToolCall`
  - `thinking` messages render as `ClaudeThinking`

---

#### T8: ClaudeToolCall Component — Tool Use Display
**Complexity:** 5/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeToolCall.tsx`
**Dependencies:** T6

Display tool operations in the chat stream:

- Collapsible card with tool icon + name header
- Icons per tool type: File (Read), Pencil (Edit), Terminal (Bash), Search (Glob), FileOutput (Write)
- Shows tool input summary (e.g., "Reading src/index.ts", "Running npm test")
- Expandable to show full input/output
- Orange accent left border
- Tool result shown below when available (collapsible)
- Status indicator: spinner while running, checkmark when done, X on error

```tsx
interface ClaudeToolCallProps {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: string;
  status: 'running' | 'complete' | 'error';
}
```

---

#### T9: ClaudeThinking Component — Extended Thinking
**Complexity:** 4/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeThinking.tsx`
**Dependencies:** T6

Collapsible thinking/reasoning block:

- Collapsed by default: shows "Thinking..." with brain icon and orange accent
- Expandable to show full reasoning text
- Muted styling (dimmer than regular messages)
- Streaming support (updates while Claude thinks)
- Chevron toggle icon

```tsx
interface ClaudeThinkingProps {
  content: string;
  streaming?: boolean;
}
```

---

### Phase 3: Input & Interaction (T10–T14)

#### T10: ClaudeSpinner Component — Whimsical Status
**Complexity:** 3/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeSpinner.tsx`
**Dependencies:** T6

Animated spinner with rotating whimsical gerund messages:

- Messages rotate every 3 seconds: "Forging...", "Spinning...", "Marinating...", "Pondering...", "Crafting...", "Weaving...", "Brewing...", "Conjuring...", "Sculpting...", "Distilling..."
- Orange spinner animation (CSS)
- Replaces the simple "Thinking..." text when Claude is processing
- Shows tool name when a tool is being used (e.g., "Reading files...")

---

#### T11: Enhanced ClaudeInputArea — Full Overhaul
**Complexity:** 7/10
**Files:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
**Dependencies:** T6

Major rewrite:

- **Orange-themed send button** (filled orange, white arrow icon)
- **Slash command support:**
  - Type `/` to open a popup menu above the input
  - Commands: `/clear`, `/cost`, `/new`, `/history`
  - Menu disappears on selection or Escape
- **@-mention support:**
  - Type `@` to open a fuzzy file search popup
  - Searches project file tree via IPC
  - Inserts `@filename` reference into the prompt
  - Highlighted with orange styling in the input
- **Message history navigation:**
  - Up/Down arrow keys cycle through previous messages
  - Only when cursor is at start/end of input
- **Prompt footer bar:**
  - Left: Permission mode selector pill (Normal | Plan | Auto)
  - Right: Context usage percentage (e.g., "32% context")
- **Orange focus ring** on textarea

---

#### T12: ClaudeSlashCommands Component — Command Menu
**Complexity:** 4/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
**Dependencies:** T6

Popup menu that appears above the input when `/` is typed:

- Filtered list of commands
- Keyboard navigation (up/down + enter)
- Commands:
  - `/clear` — Clear conversation
  - `/cost` — Show token usage
  - `/new` — New conversation
  - `/history` — Open conversation history
- Orange highlight on selected item
- Each item: icon + name + description

---

#### T13: ClaudePermission Component — Accept/Reject
**Complexity:** 5/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudePermission.tsx`
**Dependencies:** T1, T6

Permission prompt card in the chat stream:

- Shows tool name and description of what Claude wants to do
- "Allow" button (orange, filled) and "Deny" button (outlined)
- Expandable section showing full tool input details
- Auto-scrolls into view when permission is requested
- Sends response via `claude:permission:respond` IPC channel

```tsx
interface ClaudePermissionProps {
  requestId: string;
  toolName: string;
  description: string;
  toolInput: Record<string, unknown>;
  onRespond: (requestId: string, approved: boolean) => void;
}
```

---

#### T14: ClaudeContextBar Component — Footer Status
**Complexity:** 4/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeContextBar.tsx`
**Dependencies:** T6

Slim footer bar between message list and input:

- **Left side:** Permission mode pill selector
  - Three modes: Normal, Plan, Auto
  - Orange highlight on active mode
  - Click to cycle through modes
- **Right side:** Context window usage
  - Percentage text (e.g., "32%")
  - Small progress bar with orange fill
  - Calculated from token usage / max context (200K)

```tsx
interface ClaudeContextBarProps {
  mode: 'normal' | 'plan' | 'auto';
  onModeChange: (mode: 'normal' | 'plan' | 'auto') => void;
  contextPercent: number;
}
```

---

### Phase 4: Conversations (T15–T17)

#### T15: Enhanced useClaudeStore — Full State Overhaul
**Complexity:** 8/10
**Files:** `src/renderer/stores/useClaudeStore.ts`
**Dependencies:** T1, T2, T3

Major store rewrite. New state shape:

```typescript
interface ClaudeState {
  // Existing
  messages: ClaudeMessage[];
  loading: boolean;
  containerReady: boolean;
  containerStarting: boolean;
  error: string | null;
  projectPath: string | null;

  // NEW — Conversations
  currentConversationId: string | null;
  conversations: ClaudeConversation[];

  // NEW — Tool & Thinking
  activeToolCalls: Map<string, { toolName: string; toolInput: Record<string, unknown> }>;
  pendingPermissions: PermissionRequest[];

  // NEW — Usage & Mode
  tokenUsage: { inputTokens: number; outputTokens: number };
  permissionMode: 'normal' | 'plan' | 'auto';
  contextPercent: number;

  // NEW — Message History
  messageHistory: string[];
  historyIndex: number;

  // Existing actions (enhanced)
  startContainer: (projectPath: string) => Promise<void>;
  stopContainer: () => Promise<void>;
  sendMessage: (prompt: string) => Promise<void>;
  checkHealth: () => Promise<void>;
  clearMessages: () => void;
  reset: () => void;

  // NEW actions
  loadConversations: (projectPath: string) => Promise<void>;
  newConversation: () => void;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  saveCurrentConversation: () => Promise<void>;
  respondToPermission: (requestId: string, approved: boolean) => void;
  setPermissionMode: (mode: 'normal' | 'plan' | 'auto') => void;
}
```

Enhanced `sendMessage`:
- Add message to history for up/down navigation
- Process `ClaudeStreamEvent` types (tool_use, thinking, text, usage)
- Auto-save conversation after each exchange
- Handle permission requests based on mode (auto-approve in 'auto' mode)
- Track token usage

Enhanced streaming handler:
- Parse `ClaudeStreamEvent` instead of simple content chunks
- Create `tool_use` messages in the stream
- Create `thinking` blocks
- Accumulate token usage
- Calculate context percentage

---

#### T16: ClaudeConversationHistory Component
**Complexity:** 5/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeConversationHistory.tsx`
**Dependencies:** T15, T6

Dropdown panel for browsing past conversations:

- Triggered by history icon button in panel header
- Search input at top (filters by title)
- Grouped by date: Today, Yesterday, Last 7 Days, Older
- Each item: title (first user message truncated), message count, timestamp
- Click to switch conversation
- Delete button (with confirmation) on hover
- Orange highlight on current conversation
- "New Conversation" button at top

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

---

#### T17: IPC Handlers for Conversation Persistence
**Complexity:** 4/10
**Files:** `src/main/index.ts`
**Dependencies:** T1, T2

Add IPC handlers for conversation CRUD:
- `claude:conversations:list` — Query conversations by projectPath, ordered by updated_at DESC
- `claude:conversations:get` — Get conversation + all messages
- `claude:conversations:delete` — Delete conversation and cascade messages
- `claude:conversations:save` — Upsert conversation + messages

---

### Phase 5: Polish & Integration (T18–T20)

#### T18: ClaudePanel Full Overhaul — Integration
**Complexity:** 8/10
**Files:** `src/renderer/components/ide/claude/ClaudePanel.tsx`
**Dependencies:** T5–T17 (all prior tasks)

Complete rewrite integrating all new components:

**Header:**
- Claude spark icon (Sparkles from lucide-react) with orange accent
- "Claude" label in warm white
- Status indicator with orange theme (Ready=green, Thinking=orange pulse, Starting=yellow, Offline=red)
- New conversation button (Plus icon)
- Conversation history button (Clock icon)
- Clear messages button (Trash icon)
- All buttons use orange hover states

**Message Area:**
- Claude Orange dark background (#141413)
- Empty state: Claude spark icon + "Ask Claude anything about your project" in muted text
- Messages rendered through enhanced ClaudeMessage
- Tool calls rendered through ClaudeToolCall
- Thinking blocks rendered through ClaudeThinking
- Permission prompts rendered through ClaudePermission
- ClaudeSpinner replaces simple "Thinking..." during loading
- Auto-scroll with smooth behavior

**Footer:**
- ClaudeContextBar (mode selector + context usage)
- ClaudeInputArea (enhanced with slash commands, @-mentions)

**Overlay:**
- ClaudeConversationHistory dropdown (absolute positioned)
- ClaudeSlashCommands popup (absolute positioned above input)

---

#### T19: Keyboard Shortcuts & Accessibility
**Complexity:** 3/10
**Files:** `src/renderer/components/ide/claude/ClaudePanel.tsx`, `ClaudeInputArea.tsx`
**Dependencies:** T18

- `Escape` — Close slash command menu / conversation history
- `Ctrl+L` / `Cmd+L` — Focus Claude input (when panel visible)
- `Ctrl+Shift+L` / `Cmd+Shift+L` — Clear conversation
- `Up/Down` — Navigate message history in input
- `Enter` — Send message
- `Shift+Enter` — New line
- `/` at start of input — Open slash commands
- `@` in input — Open file mention search
- ARIA labels on all interactive elements

---

#### T20: Token/Cost Tracking Display
**Complexity:** 3/10
**Files:** NEW `src/renderer/components/ide/claude/ClaudeCostDisplay.tsx`, store updates
**Dependencies:** T15

Simple cost display triggered by `/cost` slash command:

- Shows as a system message in the chat
- Displays: Input tokens, Output tokens, Total tokens
- Context window percentage used
- Session total across all messages
- Formatted with orange accent headers

---

## Task Dependency Graph

```
T1 (Types) ──────┬──> T3 (Enhanced Backend)
                  ├──> T2 (DB Migration) ──> T17 (IPC Handlers)
                  ├──> T13 (Permissions)
                  └──> T15 (Store Overhaul)

T4 (Dependencies) ──> T5 (CodeBlock)

T6 (Theme) ──────┬──> T7 (Message Overhaul)
                  ├──> T8 (ToolCall)
                  ├──> T9 (Thinking)
                  ├──> T10 (Spinner)
                  ├──> T11 (InputArea Overhaul)
                  ├──> T12 (SlashCommands)
                  ├──> T13 (Permissions)
                  ├──> T14 (ContextBar)
                  └──> T16 (ConversationHistory)

T5 (CodeBlock) ──> T7 (Message Overhaul)

T15 (Store) ──────┬──> T16 (ConversationHistory)
                  ├──> T18 (Panel Integration)
                  └──> T20 (CostDisplay)

T7, T8, T9, T10, T11, T12, T13, T14, T16 ──> T18 (Panel Integration)

T18 ──> T19 (Keyboard Shortcuts)
```

---

## Execution Sequence

### Sequential Critical Path
```
T1 → T2 → T3 → T15 → T18 → T19
```

### Parallelizable Groups

**Group A (after T1):** T2, T3 (both depend only on T1)
**Group B (after T4):** T5 (depends only on T4)
**Group C (after T6, independent of T1-T3):** T6, then T8, T9, T10, T12, T14 in parallel
**Group D (after T5+T6):** T7 (depends on both)
**Group E (after T6):** T11 (depends on T6)
**Group F (after T1+T6):** T13 (depends on both)
**Group G (after T2+T1):** T17 (depends on T2)
**Group H (after T15+T6):** T16 (depends on both)
**Group I (after T15):** T20 (depends on T15)
**Group J (everything):** T18 → T19

### Optimal Execution Order
```
Wave 1: T1, T4, T6        (3 parallel — foundation)
Wave 2: T2, T3, T5        (3 parallel — depends on Wave 1)
Wave 3: T8, T9, T10, T12, T14  (5 parallel — leaf components)
Wave 4: T7, T11, T13, T17 (4 parallel — enhanced components)
Wave 5: T15               (1 — store overhaul, needs T1-T3)
Wave 6: T16, T20          (2 parallel — conversation UI + cost)
Wave 7: T18               (1 — full panel integration)
Wave 8: T19               (1 — keyboard shortcuts)
```

---

## JSON Handoff

```json
{
  "tasks": [
    { "id": "T1", "description": "Enhanced Claude Stream Types & NDJSON Protocol", "dependencies": [], "complexity": 5, "files": ["src/main/ipc/channels.ts"] },
    { "id": "T2", "description": "Database Migration — Conversation Tables", "dependencies": ["T1"], "complexity": 4, "files": ["src/main/database/schema.ts", "src/main/database/database.service.ts"] },
    { "id": "T3", "description": "Enhanced Backend NDJSON Streaming", "dependencies": ["T1"], "complexity": 6, "files": ["src/main/services/claude-container.service.ts"] },
    { "id": "T4", "description": "Install New Dependencies", "dependencies": [], "complexity": 1, "files": ["package.json"] },
    { "id": "T5", "description": "CodeBlock Component — Syntax Highlighting + Copy", "dependencies": ["T4"], "complexity": 5, "files": ["src/renderer/components/ide/claude/CodeBlock.tsx"] },
    { "id": "T6", "description": "Claude Orange Theme Constants & Styling", "dependencies": [], "complexity": 3, "files": ["src/renderer/components/ide/claude/claude-theme.ts"] },
    { "id": "T7", "description": "Enhanced ClaudeMessage — Full Overhaul", "dependencies": ["T5", "T6"], "complexity": 7, "files": ["src/renderer/components/ide/claude/ClaudeMessage.tsx"] },
    { "id": "T8", "description": "ClaudeToolCall Component — Tool Use Display", "dependencies": ["T6"], "complexity": 5, "files": ["src/renderer/components/ide/claude/ClaudeToolCall.tsx"] },
    { "id": "T9", "description": "ClaudeThinking Component — Extended Thinking", "dependencies": ["T6"], "complexity": 4, "files": ["src/renderer/components/ide/claude/ClaudeThinking.tsx"] },
    { "id": "T10", "description": "ClaudeSpinner Component — Whimsical Status", "dependencies": ["T6"], "complexity": 3, "files": ["src/renderer/components/ide/claude/ClaudeSpinner.tsx"] },
    { "id": "T11", "description": "Enhanced ClaudeInputArea — Full Overhaul", "dependencies": ["T6"], "complexity": 7, "files": ["src/renderer/components/ide/claude/ClaudeInputArea.tsx"] },
    { "id": "T12", "description": "ClaudeSlashCommands Component — Command Menu", "dependencies": ["T6"], "complexity": 4, "files": ["src/renderer/components/ide/claude/ClaudeSlashCommands.tsx"] },
    { "id": "T13", "description": "ClaudePermission Component — Accept/Reject", "dependencies": ["T1", "T6"], "complexity": 5, "files": ["src/renderer/components/ide/claude/ClaudePermission.tsx"] },
    { "id": "T14", "description": "ClaudeContextBar Component — Footer Status", "dependencies": ["T6"], "complexity": 4, "files": ["src/renderer/components/ide/claude/ClaudeContextBar.tsx"] },
    { "id": "T15", "description": "Enhanced useClaudeStore — Full State Overhaul", "dependencies": ["T1", "T2", "T3"], "complexity": 8, "files": ["src/renderer/stores/useClaudeStore.ts"] },
    { "id": "T16", "description": "ClaudeConversationHistory Component", "dependencies": ["T15", "T6"], "complexity": 5, "files": ["src/renderer/components/ide/claude/ClaudeConversationHistory.tsx"] },
    { "id": "T17", "description": "IPC Handlers for Conversation Persistence", "dependencies": ["T1", "T2"], "complexity": 4, "files": ["src/main/index.ts"] },
    { "id": "T18", "description": "ClaudePanel Full Overhaul — Integration", "dependencies": ["T7", "T8", "T9", "T10", "T11", "T12", "T13", "T14", "T15", "T16"], "complexity": 8, "files": ["src/renderer/components/ide/claude/ClaudePanel.tsx"] },
    { "id": "T19", "description": "Keyboard Shortcuts & Accessibility", "dependencies": ["T18"], "complexity": 3, "files": ["src/renderer/components/ide/claude/ClaudePanel.tsx", "src/renderer/components/ide/claude/ClaudeInputArea.tsx"] },
    { "id": "T20", "description": "Token/Cost Tracking Display", "dependencies": ["T15"], "complexity": 3, "files": ["src/renderer/components/ide/claude/ClaudeCostDisplay.tsx"] }
  ],
  "sequence": ["T1", "T4", "T6", "T2", "T3", "T5", "T8", "T9", "T10", "T12", "T14", "T7", "T11", "T13", "T17", "T15", "T16", "T20", "T18", "T19"],
  "parallelizable": [
    ["T1", "T4", "T6"],
    ["T2", "T3", "T5"],
    ["T8", "T9", "T10", "T12", "T14"],
    ["T7", "T11", "T13", "T17"],
    ["T16", "T20"]
  ],
  "stopPoints": ["requirements", "design", "plan", "final"],
  "scale": "LARGE",
  "totalTasks": 20,
  "newFiles": 10,
  "modifiedFiles": 7,
  "newDependencies": ["react-syntax-highlighter", "@types/react-syntax-highlighter", "remark-gfm"]
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude Agent SDK NDJSON format doesn't match expected types | Medium | High | T3 includes protocol inspection; adapter layer can normalize |
| react-syntax-highlighter bundle size bloat | Low | Medium | Use async/Prism-light variant with only needed languages |
| Store overhaul (T15) breaks existing tests | High | Medium | Maintain backward-compatible ClaudeMessage interface; update tests incrementally |
| Permission flow timing issues (async IPC) | Medium | High | Timeout on permissions; default to deny after 60s |
| Conversation persistence performance with large histories | Low | Low | Paginate messages; index on conversation_id+timestamp |

---

## BAS Quality Gates Per Phase

| Phase | Lint | Build | Test | Coverage |
|-------|------|-------|------|----------|
| Phase 1 (T1-T4) | ✓ | ✓ | ✓ | ≥80% new code |
| Phase 2 (T5-T9) | ✓ | ✓ | ✓ | ≥80% new components |
| Phase 3 (T10-T14) | ✓ | ✓ | ✓ | ≥80% new components |
| Phase 4 (T15-T17) | ✓ | ✓ | ✓ | ≥80% store + handlers |
| Phase 5 (T18-T20) | ✓ | ✓ | ✓ | ≥80% integration |

---

## File Inventory

### New Files (10)
1. `src/renderer/components/ide/claude/CodeBlock.tsx`
2. `src/renderer/components/ide/claude/claude-theme.ts`
3. `src/renderer/components/ide/claude/ClaudeToolCall.tsx`
4. `src/renderer/components/ide/claude/ClaudeThinking.tsx`
5. `src/renderer/components/ide/claude/ClaudeSpinner.tsx`
6. `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
7. `src/renderer/components/ide/claude/ClaudePermission.tsx`
8. `src/renderer/components/ide/claude/ClaudeContextBar.tsx`
9. `src/renderer/components/ide/claude/ClaudeConversationHistory.tsx`
10. `src/renderer/components/ide/claude/ClaudeCostDisplay.tsx`

### Modified Files (7)
1. `src/main/ipc/channels.ts` (new types + channels)
2. `src/main/database/schema.ts` (migration v3)
3. `src/main/database/database.service.ts` (conversation CRUD)
4. `src/main/services/claude-container.service.ts` (enhanced streaming)
5. `src/main/index.ts` (new IPC handlers)
6. `src/renderer/stores/useClaudeStore.ts` (full overhaul)
7. `src/renderer/components/ide/claude/ClaudePanel.tsx` (full overhaul)
8. `src/renderer/components/ide/claude/ClaudeMessage.tsx` (full overhaul)
9. `src/renderer/components/ide/claude/ClaudeInputArea.tsx` (full overhaul)
10. `package.json` (new dependencies)
