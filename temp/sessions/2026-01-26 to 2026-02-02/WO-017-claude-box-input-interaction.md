# ORCHESTRATOR WORK ORDER #017
## Type: IMPLEMENTATION
## Claude Box Upgrade — Phase 3: Input & Interaction

---

## MISSION OBJECTIVE

Build the interactive input and feedback components for the Claude Box. This includes the whimsical spinner, full ClaudeInputArea overhaul with slash commands and @-mentions, the slash command popup menu, permission accept/reject prompts, and the context bar with mode selector.

**Implementation Goal:** 5 tasks (T10-T14) delivering 4 new components + 1 major component overhaul.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-box-upgrade-plan.md`
**Depends On:** WO-015 (Phase 1) for types (T1), WO-016 (Phase 2) for theme (T6).
**Stop Point:** Plan review after completion — verify core features work end-to-end before Phase 4.

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/ClaudeSpinner.tsx
    task: T10
    description: Animated spinner with rotating whimsical gerund messages
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeSlashCommands.tsx
    task: T12
    description: Popup command menu triggered by "/" in input
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudePermission.tsx
    task: T13
    description: Accept/reject permission prompt card
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudeContextBar.tsx
    task: T14
    description: Footer bar with permission mode selector and context usage
    risk: LOW
```

### Files to Modify
```yaml
Modified_Files:
  - path: src/renderer/components/ide/claude/ClaudeInputArea.tsx
    task: T11
    changes: Major overhaul — orange theme, slash commands, @-mentions, message history, footer bar integration
    risk: HIGH
```

---

## IMPLEMENTATION APPROACH

### Task T10: ClaudeSpinner Component — Whimsical Status (Complexity 3/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeSpinner.tsx`
**Dependencies:** T6 (claude-theme)

```tsx
interface ClaudeSpinnerProps {
  toolName?: string;  // If a tool is active, show "Reading files..." etc.
}
```

**Whimsical messages array:**
```typescript
const SPINNER_MESSAGES = [
  'Forging...', 'Spinning...', 'Marinating...', 'Pondering...',
  'Crafting...', 'Weaving...', 'Brewing...', 'Conjuring...',
  'Sculpting...', 'Distilling...', 'Composing...', 'Assembling...',
  'Orchestrating...', 'Contemplating...', 'Synthesizing...',
];
```

**Layout:**
- Centered in message area
- Orange animated spinner (CSS keyframe rotation, 16x16px circular)
- Message text rotates every 3 seconds (random selection, no repeats until all used)
- If `toolName` provided, show tool-specific message instead:
  - Read → "Reading files..."
  - Edit → "Editing code..."
  - Bash → "Running command..."
  - Glob → "Searching files..."
  - Write → "Writing files..."
  - Default → "Working..."
- Text: muted color (#b0aea5), small size (text-xs)

**CSS Spinner:**
```css
@keyframes claude-spin {
  to { transform: rotate(360deg); }
}
```
- 12px orange circle border (border-2 border-[#d97757] border-t-transparent)
- 1s linear infinite rotation

**Acceptance Criteria:**
- [ ] Orange spinner animation renders
- [ ] Messages rotate every 3 seconds
- [ ] Tool-specific messages shown when toolName provided
- [ ] No repeated messages until all exhausted
- [ ] Smooth transition between messages

---

### Task T11: Enhanced ClaudeInputArea — Full Overhaul (Complexity 7/10)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
**Dependencies:** T6 (claude-theme)

Major rewrite of the input component.

**Props update:**
```tsx
interface ClaudeInputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  // NEW
  onSlashCommand?: (command: string) => void;
  onFileMention?: (query: string) => Promise<string[]>;  // fuzzy file search
  messageHistory?: string[];
}
```

**Visual changes:**
- **Textarea:** Claude dark surface (#1e1e1d), warm white text, orange focus ring
- **Send button:** Filled orange (#d97757), white ArrowUp icon, hover darkens to #c15f3c
- **Border:** Top border in Claude dark border (#2e2e2d)

**Slash command support:**
- When user types `/` at the start of input (position 0), trigger `onSlashCommand` callback
- The parent component renders `ClaudeSlashCommands` popup
- On command selection, clear the `/` from input and execute command

**@-mention support:**
- When user types `@`, trigger `onFileMention` callback with text after `@`
- Display results in a dropdown popup (similar to slash commands)
- On selection, insert `@filename` into the input text
- @-mention text styled with orange color in the textarea (via a ContentEditable approach or overlay)
- NOTE: If ContentEditable is too complex, keep as plain textarea with @filename inserted as plain text (Phase 5 can polish this)

**Message history navigation:**
- Store sent messages in `messageHistory` prop
- Up arrow at cursor position 0 → cycle backward through history
- Down arrow → cycle forward
- Track history index in local state
- Reset index when user types new text

**Layout:**
```
┌──────────────────────────────────────┐
│ [textarea with orange focus ring   ] │
│ [                           ] [Send] │
└──────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Orange-themed send button
- [ ] Orange focus ring on textarea
- [ ] Slash command detection (/ at start)
- [ ] @-mention detection and file insertion
- [ ] Message history navigation with up/down arrows
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Auto-resize between 1-6 rows (preserved from current)
- [ ] Disabled state styling preserved

---

### Task T12: ClaudeSlashCommands Component — Command Menu (Complexity 4/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
**Dependencies:** T6 (claude-theme)

```tsx
interface SlashCommand {
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface ClaudeSlashCommandsProps {
  filter: string;          // Text after "/" for filtering
  onSelect: (command: string) => void;
  onClose: () => void;
}
```

**Commands:**
```typescript
const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'clear', description: 'Clear conversation', icon: <Trash2 /> },
  { name: 'cost', description: 'Show token usage', icon: <Coins /> },
  { name: 'new', description: 'New conversation', icon: <Plus /> },
  { name: 'history', description: 'Browse past conversations', icon: <Clock /> },
];
```

**Layout:**
- Popup positioned **above** the input area (absolute positioning, bottom anchor)
- Dark surface background (#1e1e1d) with Claude dark border
- Rounded corners, shadow
- Each item: icon (16px) + `/name` (bold) + description (muted)
- Orange highlight (#d9775720) on selected/hovered item
- Filter: items whose name starts with the filter text
- Max 4 items visible (no scroll needed with only 4 commands)

**Keyboard navigation:**
- Up/Down arrows move selection
- Enter selects current item
- Escape closes menu
- Typing continues to filter

**Acceptance Criteria:**
- [ ] Renders above the input area
- [ ] Shows all 4 commands when unfiltered
- [ ] Filters by name as user types
- [ ] Keyboard navigation (up/down/enter/escape)
- [ ] Orange highlight on selected item
- [ ] Calls onSelect with command name
- [ ] Closes on selection or escape

---

### Task T13: ClaudePermission Component — Accept/Reject (Complexity 5/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudePermission.tsx`
**Dependencies:** T1 (ClaudePermissionRequest type), T6 (claude-theme)

```tsx
interface ClaudePermissionProps {
  requestId: string;
  toolName: string;
  description: string;
  toolInput: Record<string, unknown>;
  onRespond: (requestId: string, approved: boolean) => void;
}
```

**Layout:**
- Card in the message stream (full width, not a bubble)
- Orange left border (border-l-4 border-[#d97757])
- Dark surface background (#1e1e1d)
- **Header:** Shield icon (lucide-react) + "Permission Required" in orange
- **Body:** Description text explaining what Claude wants to do
  - Auto-generated from toolName + toolInput:
    - Read: "Claude wants to read `{path}`"
    - Edit: "Claude wants to edit `{file_path}`"
    - Bash: "Claude wants to run: `{command}`"
    - Write: "Claude wants to create `{file_path}`"
    - Default: "Claude wants to use {toolName}"
- **Details (expandable):** Full toolInput as JSON (collapsed by default)
- **Action buttons:**
  - "Allow" — Orange filled button (#d97757), left side
  - "Deny" — Outlined button with orange border, right side
  - Both call `onRespond(requestId, approved)`
  - Buttons disabled after responding (show "Allowed" or "Denied" text)

**Acceptance Criteria:**
- [ ] Renders permission card with orange accent
- [ ] Shows tool description derived from toolName + input
- [ ] Allow and Deny buttons work
- [ ] Expandable details section with full toolInput
- [ ] Buttons disable after response
- [ ] Responds via onRespond callback

---

### Task T14: ClaudeContextBar Component — Footer Status (Complexity 4/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeContextBar.tsx`
**Dependencies:** T6 (claude-theme)

```tsx
interface ClaudeContextBarProps {
  mode: 'normal' | 'plan' | 'auto';
  onModeChange: (mode: 'normal' | 'plan' | 'auto') => void;
  contextPercent: number;  // 0-100
}
```

**Layout:**
- Slim horizontal bar (h-7, py-1, px-3)
- Dark background matching panel (#141413)
- Top border in Claude dark border (#2e2e2d)
- Two sections: left and right

**Left side — Permission mode selector:**
- Three pill buttons in a row: "Normal" | "Plan" | "Auto"
- Active pill: orange background (#d97757) with white text
- Inactive pills: transparent with muted text, hover shows surface color
- Click switches mode
- Small text (text-xs)
- Rounded pill shape (rounded-full px-2 py-0.5)

**Right side — Context usage:**
- Percentage text: "32%" in muted color
- Small progress bar (w-16 h-1 rounded-full)
  - Background: dark border (#2e2e2d)
  - Fill: orange (#d97757) — width based on contextPercent
  - If > 80%: fill turns red (#c15f5f)
  - If > 90%: text also turns red

**Acceptance Criteria:**
- [ ] Three mode pills rendered
- [ ] Active mode highlighted with orange
- [ ] Mode changes on click
- [ ] Context percentage displayed
- [ ] Progress bar fills proportionally
- [ ] Red warning when > 80%
- [ ] Compact height (28px)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE3-INPUT-INTERACTION-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Summary** — 5 tasks completed
2. **Component Inventory** — Props interfaces and behavior
3. **Interaction Patterns** — Slash commands, @-mentions, permissions
4. **Keyboard Shortcuts** — Input area key bindings

---

## AFTER COMPLETION

**Step 1:** Create completion report in `trinity/sessions/`
**Step 2:** Move this work order to `trinity/sessions/`
**Step 3:** Verify all 5 tasks complete (T10-T14)
**Step 4:** STOP POINT — Plan review before Phase 4

---

## SUCCESS CRITERIA

- [ ] All 5 tasks implemented (T10-T14)
- [ ] Spinner shows whimsical messages with orange animation
- [ ] Input area has orange theme, slash commands, @-mentions, history
- [ ] Slash command popup navigable via keyboard
- [ ] Permission prompts show allow/deny with orange styling
- [ ] Context bar shows mode selector and usage percentage
- [ ] Build passes (`npm run build`)
- [ ] Existing tests pass (user runs `npm test`)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS
- **NO git operations** — Only LUKA has permission
- **NO running tests** — User runs tests on their end
- **Read file before editing** — No parallel file edits, sequential only
- **No sed commands** — Use Read + Edit tools only

### DO:
- [ ] Use claude-theme.ts constants everywhere
- [ ] Use lucide-react for all icons
- [ ] Handle keyboard events correctly (prevent default where needed)
- [ ] Ensure popups close on outside click and escape
- [ ] Follow existing component patterns

---

## IMPLEMENTATION SEQUENCE

```
T10: ClaudeSpinner (depends on T6 theme only)
T12: ClaudeSlashCommands (depends on T6 theme only)
T14: ClaudeContextBar (depends on T6 theme only)
  ↓ (all three parallel)
T13: ClaudePermission (depends on T1 types + T6 theme)
T11: ClaudeInputArea overhaul (depends on T6 theme, integrates with T12)
```
