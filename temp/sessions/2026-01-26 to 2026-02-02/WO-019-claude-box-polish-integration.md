# ORCHESTRATOR WORK ORDER #019
## Type: IMPLEMENTATION
## Claude Box Upgrade — Phase 5: Polish & Integration

---

## MISSION OBJECTIVE

Complete the Claude Box upgrade by integrating all components into the final ClaudePanel, adding keyboard shortcuts and accessibility, and implementing the token/cost tracking display. This is the final phase that brings everything together.

**Implementation Goal:** 3 tasks (T18-T20) delivering 1 new component + 1 major panel integration + keyboard shortcuts.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-box-upgrade-plan.md`
**Depends On:** WO-015 (Phase 1), WO-016 (Phase 2), WO-017 (Phase 3), WO-018 (Phase 4) — ALL prior phases must be complete.
**Stop Point:** Final review — full integration review and user acceptance.

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/ClaudeCostDisplay.tsx
    task: T20
    description: Token/cost tracking display rendered as system message
    risk: LOW
```

### Files to Modify
```yaml
Modified_Files:
  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    task: T18
    changes: Complete rewrite integrating all Phase 1-4 components into the final panel
    risk: HIGH

  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    task: T19
    changes: Add keyboard shortcuts and ARIA labels (same file as T18)
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeInputArea.tsx
    task: T19
    changes: Add keyboard shortcut listeners for Ctrl+L focus
    risk: LOW
```

---

## IMPLEMENTATION APPROACH

### Task T18: ClaudePanel Full Overhaul — Integration (Complexity 8/10)
**File:** `src/renderer/components/ide/claude/ClaudePanel.tsx`
**Dependencies:** T5-T17 (ALL prior tasks)

Complete rewrite that integrates every component from Phases 1-4 into a cohesive panel.

**Imports needed:**
```typescript
import { useClaudeStore } from '../../../stores/useClaudeStore';
import { ClaudeMessage } from './ClaudeMessage';
import { ClaudeInputArea } from './ClaudeInputArea';
import { ClaudeSpinner } from './ClaudeSpinner';
import { ClaudeContextBar } from './ClaudeContextBar';
import { ClaudeSlashCommands } from './ClaudeSlashCommands';
import { ClaudeConversationHistory } from './ClaudeConversationHistory';
import { ClaudePermission } from './ClaudePermission';
import { claude } from './claude-theme';
import { Sparkles, Plus, Clock, Trash2 } from 'lucide-react';
```

**Panel structure:**
```
┌─────────────────────────────────────────────┐
│  ✦ Claude    ● Ready    [+] [⏰] [🗑]      │  ← Header
├─────────────────────────────────────────────┤
│                                             │
│  [System message: Claude is ready...]       │
│                                             │
│           [User message bubble]        →    │
│                                             │
│  ← [Assistant message with markdown]        │
│     ┌─ Tool: Read src/index.ts ──────┐      │
│     │  Reading src/index.ts          │      │
│     └────────────────────────────────┘      │
│     ┌─ Thinking... ──────────────────┐      │
│     │  (collapsed reasoning)         │      │
│     └────────────────────────────────┘      │
│                                             │
│  ┌─ Permission Required ─────────────┐      │
│  │  Claude wants to edit file.ts     │      │
│  │  [Allow]              [Deny]      │      │
│  └───────────────────────────────────┘      │
│                                             │
│         🟠 Marinating...                    │  ← Spinner (when loading)
│                                             │
├─────────────────────────────────────────────┤
│  Normal | Plan | Auto          32% ████░░   │  ← Context Bar
├─────────────────────────────────────────────┤
│  [Ask Claude...                     ] [➤]   │  ← Input Area
└─────────────────────────────────────────────┘

  ┌──────────────────────┐  ← Conversation History (overlay)
  │  Conversations       │
  │  [Search...]         │
  │  Today               │
  │   > Fix auth bug     │
  │   > Add dark mode    │
  │  Yesterday           │
  │   > Setup CI/CD      │
  └──────────────────────┘

  ┌──────────────────────┐  ← Slash Commands (overlay above input)
  │  /clear  Clear conv. │
  │  /cost   Token usage │
  │  /new    New conv.   │
  │  /history Past conv. │
  └──────────────────────┘
```

**Header section:**
- Background: Claude dark (#141413) with bottom border (#2e2e2d)
- Left: Sparkles icon (orange #d97757) + "Claude" label (warm white #faf9f5)
- Center: StatusIndicator (reworked with Claude Orange theme)
  - Ready: green dot (#788c5d) + "Ready"
  - Thinking: orange pulsing dot (#d97757) + current spinner message
  - Starting: yellow pulsing dot (#c4a35a) + "Starting..."
  - Offline: red dot (#c15f5f) + "Offline"
- Right: Action buttons (ghost style, orange on hover)
  - Plus icon → `newConversation()`
  - Clock icon → toggle conversation history overlay
  - Trash2 icon → `clearMessages()`

**Message area:**
- Background: Claude dark (#141413)
- Padding: px-2 py-2
- Empty state: Large Sparkles icon (orange, 32px) + "Ask Claude anything about your project" in muted text, centered
- Messages rendered based on `message.messageType`:
  - `'text'` or `undefined` → `<ClaudeMessage>` (default)
  - `'tool_use'` → `<ClaudeToolCall>` with props from message
  - `'thinking'` → `<ClaudeThinking>` with content + streaming
- Permission requests: `<ClaudePermission>` for each item in `pendingPermissions`
- Loading state: `<ClaudeSpinner>` shown at bottom when `loading` is true
- Error display: Orange-bordered error card with error text
- Auto-scroll: smooth scroll to bottom on new messages

**Overlay management (local state):**
- `showHistory: boolean` — toggles conversation history dropdown
- `showSlashCommands: boolean` — toggles slash command popup
- `slashFilter: string` — current filter text for slash commands

**Slash command handling:**
- Input area calls `onSlashCommand` when `/` detected
- Panel sets `showSlashCommands = true`
- On command selection:
  - `/clear` → `clearMessages()`
  - `/cost` → add ClaudeCostDisplay as system message
  - `/new` → `newConversation()`
  - `/history` → `showHistory = true`

**Store selectors (use individual selectors for performance):**
```typescript
const messages = useClaudeStore(s => s.messages);
const loading = useClaudeStore(s => s.loading);
const containerReady = useClaudeStore(s => s.containerReady);
const containerStarting = useClaudeStore(s => s.containerStarting);
const error = useClaudeStore(s => s.error);
const conversations = useClaudeStore(s => s.conversations);
const currentConversationId = useClaudeStore(s => s.currentConversationId);
const pendingPermissions = useClaudeStore(s => s.pendingPermissions);
const permissionMode = useClaudeStore(s => s.permissionMode);
const tokenUsage = useClaudeStore(s => s.tokenUsage);
const contextPercent = useClaudeStore(s => s.contextPercent);
const messageHistory = useClaudeStore(s => s.messageHistory);
// Actions
const sendMessage = useClaudeStore(s => s.sendMessage);
const clearMessages = useClaudeStore(s => s.clearMessages);
const newConversation = useClaudeStore(s => s.newConversation);
const switchConversation = useClaudeStore(s => s.switchConversation);
const deleteConversation = useClaudeStore(s => s.deleteConversation);
const respondToPermission = useClaudeStore(s => s.respondToPermission);
const setPermissionMode = useClaudeStore(s => s.setPermissionMode);
```

**Acceptance Criteria:**
- [ ] Full Claude Orange dark theme applied to entire panel
- [ ] Header with Sparkles icon, status, action buttons
- [ ] Messages render by type (text, tool_use, thinking)
- [ ] Permission prompts appear in message stream
- [ ] Spinner shown during loading
- [ ] Context bar with mode selector and usage
- [ ] Input area with slash commands and @-mentions
- [ ] Conversation history overlay toggles on/off
- [ ] Slash command popup appears/disappears correctly
- [ ] All overlay clicks outside close the overlay
- [ ] Auto-scroll on new messages
- [ ] Empty state with spark icon
- [ ] Error display with orange accent

---

### Task T19: Keyboard Shortcuts & Accessibility (Complexity 3/10)
**Files:** `ClaudePanel.tsx`, `ClaudeInputArea.tsx`
**Dependencies:** T18

**Keyboard shortcuts (add via useEffect with keydown listener):**

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Escape` | Close slash commands / conversation history | Panel |
| `Ctrl+L` / `Cmd+L` | Focus Claude input textarea | Global (when panel visible) |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Clear conversation | Global (when panel visible) |
| `Up` (at input start) | Previous message in history | Input area |
| `Down` (at input end) | Next message in history | Input area |
| `Enter` | Send message | Input area |
| `Shift+Enter` | New line | Input area |
| `/` (at input start) | Open slash commands | Input area |
| `@` (in input) | Open file mention search | Input area |

**Implementation in ClaudePanel:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+L / Cmd+L → focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'l' && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.focus();
    }
    // Ctrl+Shift+L / Cmd+Shift+L → clear
    if ((e.ctrlKey || e.metaKey) && e.key === 'l' && e.shiftKey) {
      e.preventDefault();
      clearMessages();
    }
    // Escape → close overlays
    if (e.key === 'Escape') {
      setShowHistory(false);
      setShowSlashCommands(false);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

**ARIA labels:**
- Header buttons: `aria-label="New conversation"`, `aria-label="Conversation history"`, `aria-label="Clear messages"`
- Status indicator: `aria-live="polite"` for status changes
- Message list: `role="log"` with `aria-label="Claude conversation"`
- Input: `aria-label="Message Claude"`
- Send button: `aria-label="Send message"`
- Permission buttons: `aria-label="Allow"`, `aria-label="Deny"`

**Acceptance Criteria:**
- [ ] Ctrl+L focuses Claude input
- [ ] Ctrl+Shift+L clears conversation
- [ ] Escape closes all overlays
- [ ] Up/Down navigates message history in input
- [ ] All interactive elements have ARIA labels
- [ ] Message area has log role
- [ ] Status changes announced via aria-live

---

### Task T20: Token/Cost Tracking Display (Complexity 3/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeCostDisplay.tsx`
**Dependencies:** T15 (store with tokenUsage)

```tsx
interface ClaudeCostDisplayProps {
  inputTokens: number;
  outputTokens: number;
  contextPercent: number;
}
```

**Triggered by `/cost` slash command** — rendered as a special system message in the chat.

**Layout:**
- Card styled like a system message but wider
- Claude dark surface (#1e1e1d) with orange top border
- **Title:** "Token Usage" in orange (#d97757)
- **Stats grid (2x2):**
  ```
  Input Tokens     Output Tokens
  12,345           8,901

  Total Tokens     Context Used
  21,246           10.6%
  ```
- Numbers in warm white, large font
- Labels in muted text (#b0aea5), small font
- Context percentage with color coding:
  - < 50%: green (#788c5d)
  - 50-80%: yellow (#c4a35a)
  - > 80%: red (#c15f5f)
- Number formatting: locale string with commas (e.g., 12,345)

**Integration:**
- When `/cost` slash command selected, the panel inserts a `ClaudeCostDisplay` as a system-type message using current `tokenUsage` from store

**Acceptance Criteria:**
- [ ] Renders token stats in a formatted card
- [ ] Input, output, total tokens displayed with commas
- [ ] Context percentage with color coding
- [ ] Orange title accent
- [ ] Matches Claude dark theme
- [ ] Triggered via /cost slash command

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE5-POLISH-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Summary** — Final 3 tasks completed, full integration done
2. **Panel Architecture** — Component tree and data flow
3. **Keyboard Shortcuts** — Full shortcut reference table
4. **Accessibility** — ARIA labels and roles documented
5. **Visual Summary** — Final panel layout description

---

## AFTER COMPLETION

**Step 1:** Create completion report in `trinity/sessions/`
**Step 2:** Move this work order to `trinity/sessions/`
**Step 3:** Verify all 3 tasks complete (T18-T20)
**Step 4:** FINAL STOP POINT — Full integration review
**Step 5:** Run JUNO audit on entire Claude Box upgrade (all 5 phases)

---

## SUCCESS CRITERIA

- [ ] All 3 tasks implemented (T18-T20)
- [ ] ClaudePanel integrates ALL components from Phases 1-4
- [ ] Full Claude Orange dark theme applied
- [ ] All keyboard shortcuts functional
- [ ] ARIA labels on all interactive elements
- [ ] Cost display shows token tracking
- [ ] Conversation history accessible via header button
- [ ] Slash commands work end-to-end
- [ ] Permission prompts appear and respond correctly
- [ ] Spinner shows whimsical messages during loading
- [ ] Build passes (`npm run build`)
- [ ] All tests pass (user runs `npm test`)
- [ ] No regressions in other IDE components

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS
- **NO git operations** — Only LUKA has permission
- **NO running tests** — User runs tests on their end
- **Read file before editing** — No parallel file edits, sequential only
- **No sed commands** — Use Read + Edit tools only

### DO:
- [ ] Use claude-theme.ts constants everywhere (no hardcoded colors)
- [ ] Use individual store selectors (not destructuring entire state)
- [ ] Close overlays on outside clicks
- [ ] Test keyboard shortcuts don't conflict with IDE shortcuts
- [ ] Ensure panel keyboard events don't bubble to parent components when handled

---

## IMPLEMENTATION SEQUENCE

```
T20: ClaudeCostDisplay (depends on T15 store only — can start first)
  ↓
T18: ClaudePanel full integration (depends on ALL prior tasks)
  ↓
T19: Keyboard shortcuts & accessibility (depends on T18)
```

---

## FULL UPGRADE SUMMARY

After this work order, the Claude Box upgrade is complete:

| Phase | WO | Tasks | Components |
|-------|----|-------|------------|
| 1. Foundation | WO-015 | T1-T4 | Types, DB, streaming, deps |
| 2. Core UI | WO-016 | T5-T9 | CodeBlock, theme, message, tool, thinking |
| 3. Input & Interaction | WO-017 | T10-T14 | Spinner, input, slash, permission, context |
| 4. Conversations | WO-018 | T15-T17 | Store, history, IPC handlers |
| 5. Polish & Integration | WO-019 | T18-T20 | Panel, shortcuts, cost display |
| **Total** | **5 WOs** | **20 tasks** | **10 new + 10 modified files** |
