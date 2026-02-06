# ORCHESTRATOR WORK ORDER #012
## Type: IMPLEMENTATION
## Claude Chat UI Components + IDE Layout Integration

---

## MISSION OBJECTIVE

Implement the user-facing chat interface for the Claude AI assistant in the IDE's right-top panel. This includes a chat panel with message history, real-time streaming display, input area with keyboard shortcuts, markdown rendering for code blocks, and integration into the IDE grid layout replacing the "Under Construction" placeholder.

**Implementation Goal:** User can chat with Claude in the right-top panel of the IDE, see streaming responses in real time with proper markdown/code formatting, and Claude operates within the context of the currently opened project.
**Based On:** TRA Implementation Plan Phase 3 + WO-010 + WO-011 (both must be complete first)
**Depends On:** WO-010-claude-container-service, WO-011-claude-store-and-streaming

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    description: Main chat panel with header, message list, input area
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudeMessage.tsx
    description: Individual message bubble with markdown rendering
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeInputArea.tsx
    description: Chat input with auto-resize textarea and send button
    risk: LOW
```

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/IDELayout.tsx
    changes: Replace right-top "Under Construction" with ClaudePanel
    risk: LOW
```

### Changes Required

#### Change Set 1: ClaudeMessage Component (ClaudeMessage.tsx)

Individual message rendering component.

```typescript
interface ClaudeMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    streaming?: boolean;
  };
}
```

**Rendering rules by role:**

- **user**: Right-aligned bubble with primary background color. Show content as plain text.
- **assistant**: Left-aligned bubble with muted background. Parse and render markdown:
  - Code blocks (```) with syntax highlighting class and copy button
  - Inline code (`) with monospace background
  - Bold (**text**) and italic (*text*)
  - Lists (- and 1.)
  - Line breaks preserved
  - If `streaming: true`, show blinking cursor at end of content
- **system**: Centered, muted text, smaller font. No bubble.

**Markdown rendering approach:**
- Use a simple custom parser (NOT an external markdown library) that handles:
  - Fenced code blocks: split by ``` markers, wrap in `<pre><code>`
  - Inline code: regex replace backticks with `<code>` spans
  - Bold/italic: regex replace `**` and `*` markers
  - This keeps the bundle small and avoids dependency bloat
- Alternatively, if `react-markdown` or `marked` is already in dependencies, use that.
  Check package.json before deciding.

**Timestamps:** Show on hover (title attribute) in locale format.

#### Change Set 2: ClaudeInputArea Component (ClaudeInputArea.tsx)

Chat input component with auto-resizing textarea.

```typescript
interface ClaudeInputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
}
```

**Behavior:**
- Textarea auto-resizes as user types (min 1 row, max 6 rows)
- **Enter** sends the message (if not empty and not disabled)
- **Shift+Enter** inserts a newline
- Send button (arrow icon from lucide-react) to the right of textarea
- Send button disabled when textarea empty or `disabled` prop is true
- Clear textarea after sending
- Focus textarea on mount

#### Change Set 3: ClaudePanel Component (ClaudePanel.tsx)

Main panel orchestrating the chat experience.

```typescript
// No props needed — reads from useClaudeStore
export function ClaudePanel() { ... }
```

**Layout (flex column, full height):**

1. **Header bar** (flex-shrink: 0):
   - Left: "Claude" label with Bot icon (lucide-react)
   - Center: Status indicator
     - Green dot + "Ready" when `containerReady && !loading`
     - Yellow dot + "Starting..." when `containerStarting`
     - Blue dot + "Thinking..." when `loading`
     - Red dot + "Offline" when `!containerReady && !containerStarting`
   - Right: Clear button (Trash2 icon) to clear messages

2. **Message list** (flex: 1, overflow-y: auto):
   - Renders array of `ClaudeMessage` components
   - Auto-scrolls to bottom when new messages arrive (useEffect + ref.scrollIntoView)
   - Empty state: centered text "Ask Claude anything about your project"
   - Error state: system message showing `error` from store

3. **Input area** (flex-shrink: 0):
   - `ClaudeInputArea` with `onSend` calling `sendMessage` from store
   - Disabled when `loading` or `!containerReady`

**State subscriptions (from useClaudeStore):**
```typescript
const messages = useClaudeStore(s => s.messages);
const loading = useClaudeStore(s => s.loading);
const containerReady = useClaudeStore(s => s.containerReady);
const containerStarting = useClaudeStore(s => s.containerStarting);
const error = useClaudeStore(s => s.error);
const sendMessage = useClaudeStore(s => s.sendMessage);
const clearMessages = useClaudeStore(s => s.clearMessages);
```

**Auto-scroll behavior:**
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// At bottom of message list:
<div ref={messagesEndRef} />
```

#### Change Set 4: IDE Layout Integration (IDELayout.tsx)

**Current (right-top area):**
```tsx
<div
  style={{ gridArea: 'right-top' }}
  className="border-l overflow-hidden flex items-center justify-center"
>
  <p className="text-muted-foreground text-sm">Under Construction</p>
</div>
```

**Target:**
```tsx
<div
  style={{ gridArea: 'right-top' }}
  className="border-l overflow-hidden"
>
  <ClaudePanel />
</div>
```

**Changes:**
- Add import: `import { ClaudePanel } from './claude/ClaudePanel';`
- Replace the right-top div contents
- Remove `flex items-center justify-center` classes (ClaudePanel handles its own layout)

---

## IMPLEMENTATION APPROACH

### Step 1: Check Dependencies
- [ ] Read package.json to check if react-markdown or marked is available
- [ ] If not, plan for simple custom markdown parser
- [ ] Verify lucide-react icons available (Bot, Trash2, Send, ArrowUp)

### Step 2: Create ClaudeMessage
- [ ] Create src/renderer/components/ide/claude/ClaudeMessage.tsx
- [ ] Implement user/assistant/system message rendering
- [ ] Implement markdown parsing for assistant messages (code blocks, inline code, bold, italic)
- [ ] Add streaming cursor indicator
- [ ] Add hover timestamps

### Step 3: Create ClaudeInputArea
- [ ] Create src/renderer/components/ide/claude/ClaudeInputArea.tsx
- [ ] Implement auto-resize textarea
- [ ] Implement Enter to send, Shift+Enter for newline
- [ ] Implement send button with disabled state
- [ ] Auto-focus on mount

### Step 4: Create ClaudePanel
- [ ] Create src/renderer/components/ide/claude/ClaudePanel.tsx
- [ ] Implement header with status indicator
- [ ] Implement message list with auto-scroll
- [ ] Wire up useClaudeStore subscriptions
- [ ] Implement empty state and error state
- [ ] Implement clear messages button

### Step 5: Integrate into IDELayout
- [ ] Read IDELayout.tsx
- [ ] Import ClaudePanel
- [ ] Replace right-top "Under Construction" with ClaudePanel
- [ ] Remove flex centering classes from right-top div

### Step 6: Validation
- [ ] Verify TypeScript compiles without errors
- [ ] Verify existing tests pass (no regressions)
- [ ] Verify component follows existing UI patterns (Tailwind, lucide-react icons)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CLAUDE-CHAT-UI-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with file paths
3. **Test Results** - No regressions verified
4. **Metrics** - Files created/modified
5. **Rollback Plan** - How to revert
6. **Next Steps** - Future enhancements (file attachment, command shortcuts, etc.)

### Evidence to Provide
- File diff statistics
- Component hierarchy diagram
- TypeScript compilation verification

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-012-claude-chat-ui.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-012-claude-chat-ui.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] ClaudePanel.tsx renders in the right-top grid area
- [ ] Messages display with proper user/assistant/system styling
- [ ] Streaming responses render in real time (character by character)
- [ ] Code blocks in responses are properly formatted
- [ ] Input area supports Enter to send, Shift+Enter for newline
- [ ] Auto-scroll follows new messages
- [ ] Status indicator reflects container state (Ready/Starting/Thinking/Offline)
- [ ] Clear messages button works
- [ ] Empty state shown when no messages
- [ ] Error state shown when container unavailable
- [ ] TypeScript compiles without errors
- [ ] No test regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Add heavy external dependencies (no react-markdown unless already in package.json)
- [ ] Modify files outside the specified scope
- [ ] Over-engineer the markdown parser — basic code blocks and inline formatting is sufficient
- [ ] Perform ANY git operations

### DO:
- [ ] Follow existing component patterns (Tailwind CSS classes, lucide-react icons)
- [ ] Use existing UI primitives (Card, Button, Input from ui/ components) where appropriate
- [ ] Keep components focused — one responsibility per component
- [ ] Use useRef for auto-scroll, not imperative DOM queries
- [ ] Read file before editing

---

## ROLLBACK STRATEGY

If issues arise:
1. Delete `src/renderer/components/ide/claude/` directory (3 files)
2. Revert IDELayout.tsx right-top div back to "Under Construction" placeholder
3. Remove ClaudePanel import from IDELayout.tsx

**Critical Files Backup:** IDELayout.tsx

---

## CONTEXT FROM INVESTIGATION

**Source:** TRA Implementation Plan Phase 3 + WO-010 + WO-011 outputs
**Key Findings:**
- IDE uses CSS Grid with named areas — right-top area is `gridArea: 'right-top'`
- Existing components use Tailwind CSS + lucide-react icons consistently
- useClaudeStore (from WO-011) provides all state and actions via selectors
- Streaming responses come as `claude:stream-chunk` IPC events, handled by store
- Auto-scroll pattern: useRef + useEffect on messages array length

**Expected Impact:** Full end-to-end Claude chat experience in the IDE

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- Markdown rendering edge cases (nested code blocks, special characters)
- Auto-scroll behavior during streaming (must not fight user scrolling up)
- Textarea auto-resize calculation

**Mitigation:**
- Keep markdown parser simple — handle common cases, escape HTML
- Only auto-scroll if user is already at bottom of message list
- Use scrollHeight for textarea resize calculation

---

## UI REFERENCE

### Color Scheme (follows existing Tailwind theme)
- User messages: `bg-primary text-primary-foreground`
- Assistant messages: `bg-muted text-foreground`
- System messages: `text-muted-foreground text-xs`
- Header: `bg-background border-b`
- Input area: `bg-background border-t`
- Status dots: green (`bg-green-500`), yellow (`bg-yellow-500`), blue (`bg-blue-500`), red (`bg-red-500`)

### Layout Dimensions
- Panel fills entire right-top grid area (35% width, 55% height of main area)
- Header: ~36px height
- Input area: ~60-120px height (auto-resize)
- Message list: remaining space with vertical scroll

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
