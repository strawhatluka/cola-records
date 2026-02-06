# ORCHESTRATOR WORK ORDER #016
## Type: IMPLEMENTATION
## Claude Box Upgrade — Phase 2: Core UI

---

## MISSION OBJECTIVE

Build the core UI components for the Claude Box upgrade. This includes the CodeBlock component with syntax highlighting, Claude Orange theme system, full ClaudeMessage overhaul with GFM markdown, ClaudeToolCall display component, and ClaudeThinking collapsible blocks.

**Implementation Goal:** 5 tasks (T5-T9) delivering 3 new components + 1 theme file + 1 major component overhaul.
**Based On:** TRA Plan at `trinity/sessions/TRA-claude-box-upgrade-plan.md`
**Depends On:** WO-015 (Phase 1: Foundation) must be complete — needs types from T1, dependencies from T4.

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/CodeBlock.tsx
    task: T5
    description: Syntax-highlighted code block with copy button and language label
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/claude-theme.ts
    task: T6
    description: Claude Orange design tokens and Tailwind utility classes
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeToolCall.tsx
    task: T8
    description: Collapsible tool use display card with icons and status
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudeThinking.tsx
    task: T9
    description: Collapsible extended thinking/reasoning block
    risk: LOW
```

### Files to Modify
```yaml
Modified_Files:
  - path: src/renderer/components/ide/claude/ClaudeMessage.tsx
    task: T7
    changes: Major overhaul — Claude Orange styling, GFM markdown, CodeBlock integration, tool_use/thinking message routing, hover actions, copy button
    risk: HIGH
```

---

## IMPLEMENTATION APPROACH

### Task T5: CodeBlock Component — Syntax Highlighting + Copy (Complexity 5/10)
**File:** NEW `src/renderer/components/ide/claude/CodeBlock.tsx`
**Dependencies:** T4 (react-syntax-highlighter installed)

Build a reusable code block component:

```tsx
interface CodeBlockProps {
  language: string;
  code: string;
  showLineNumbers?: boolean;
}
```

**Features:**
- **Header bar:** Language label (left) + Copy button (right)
  - Language displayed in small muted text (e.g., "typescript", "bash")
  - Copy button: clipboard icon, shows "Copied!" briefly on click
- **Code area:** `react-syntax-highlighter` with Prism `oneDark` theme
  - Use `PrismLight` from `react-syntax-highlighter/dist/esm/prism-light` for bundle size
  - Register only needed languages: typescript, javascript, python, bash, json, css, html, sql, yaml, go, rust, java, cpp
  - Dark background (#1a1a19) matching Claude dark theme
  - Horizontal scroll for long lines
  - Optional line numbers for blocks > 10 lines
- **Styling:** Rounded corners, Claude dark border (#2e2e2d), compact padding
- **Copy to clipboard:** Uses `navigator.clipboard.writeText()`
- **Fallback:** If language not recognized, render as plain monospace

**Acceptance Criteria:**
- [ ] Renders syntax-highlighted code for supported languages
- [ ] Copy button copies code to clipboard
- [ ] "Copied!" feedback shown for 2 seconds
- [ ] Language label displayed in header
- [ ] Line numbers shown when `showLineNumbers` is true
- [ ] Horizontal scrolling for long lines
- [ ] Dark theme matching Claude aesthetic

---

### Task T6: Claude Orange Theme Constants & Styling (Complexity 3/10)
**File:** NEW `src/renderer/components/ide/claude/claude-theme.ts`
**Dependencies:** None

Define all Claude Orange design tokens as a single source of truth:

```typescript
/** Claude Orange brand color palette */
export const claudeTheme = {
  // Primary
  orange: '#d97757',
  orangeHover: '#c15f3c',
  orangeLight: '#d9775720',  // 12% opacity
  orangeMuted: '#d9775740',  // 25% opacity

  // Backgrounds
  darkBg: '#141413',
  darkSurface: '#1e1e1d',
  darkSurfaceHover: '#262625',
  codeBg: '#1a1a19',

  // Borders
  darkBorder: '#2e2e2d',
  orangeBorder: '#d9775740',

  // Text
  warmWhite: '#faf9f5',
  mutedText: '#b0aea5',
  dimText: '#706f6a',

  // Status
  green: '#788c5d',
  blue: '#6a9bcc',
  yellow: '#c4a35a',
  red: '#c15f5f',
};

/** Reusable Tailwind class combinations for Claude Box components */
export const claude = {
  // Panel
  panel: 'bg-[#141413] text-[#faf9f5]',
  panelBorder: 'border-[#2e2e2d]',

  // Surfaces
  surface: 'bg-[#1e1e1d]',
  surfaceHover: 'hover:bg-[#262625]',
  codeBg: 'bg-[#1a1a19]',

  // Text
  text: 'text-[#faf9f5]',
  textMuted: 'text-[#b0aea5]',
  textDim: 'text-[#706f6a]',

  // Accent
  accent: 'text-[#d97757]',
  accentBg: 'bg-[#d97757]',
  accentHover: 'hover:bg-[#c15f3c]',
  accentBorder: 'border-[#d97757]',
  accentBorderMuted: 'border-l-[#d9775740]',

  // Buttons
  btnPrimary: 'bg-[#d97757] hover:bg-[#c15f3c] text-white',
  btnGhost: 'text-[#b0aea5] hover:text-[#faf9f5] hover:bg-[#262625]',

  // Status dots
  statusReady: 'bg-[#788c5d]',
  statusThinking: 'bg-[#d97757] animate-pulse',
  statusStarting: 'bg-[#c4a35a] animate-pulse',
  statusOffline: 'bg-[#c15f5f]',

  // Focus
  focusRing: 'focus:ring-1 focus:ring-[#d97757] focus:outline-none',
};
```

**Acceptance Criteria:**
- [ ] All color values defined as constants
- [ ] Tailwind class helpers exported
- [ ] No dependencies on other files
- [ ] Consistent naming convention
- [ ] Comments documenting color purpose

---

### Task T7: Enhanced ClaudeMessage — Full Overhaul (Complexity 7/10)
**File:** `src/renderer/components/ide/claude/ClaudeMessage.tsx`
**Dependencies:** T5 (CodeBlock), T6 (claude-theme)

Major rewrite of the message component. The `ClaudeMessage` type will be extended to support different message types.

**Message type routing:**
```tsx
// Route based on message type
if (message.messageType === 'tool_use') return <ClaudeToolCall ... />;
if (message.messageType === 'thinking') return <ClaudeThinking ... />;
// Default: render as text message (user/assistant/system)
```

**User messages:**
- Right-aligned, max-width 85%
- Background: `orangeLight` (#d9775720) with `orangeBorder` left accent
- Text: warm white (#faf9f5)
- No markdown rendering (plain text, whitespace preserved)

**Assistant messages:**
- Left-aligned, max-width 90%
- Background: dark surface (#1e1e1d)
- Text: warm white
- Rich markdown via ReactMarkdown + remark-gfm:
  - **Code blocks:** Delegate to `<CodeBlock>` component (fenced code)
  - **Inline code:** Orange-tinted background (#d9775720) with monospace font
  - **Tables:** Styled with dark borders, header row highlighted
  - **Links:** Blue (#6a9bcc) with hover underline
  - **Blockquotes:** Orange left border, muted text
  - **Lists:** Properly indented with disc/decimal markers
  - **Strikethrough:** Supported via remark-gfm
  - **Task lists:** Checkboxes rendered via remark-gfm

**System messages:**
- Centered, small text
- Muted color (#b0aea5) with orange Sparkles icon

**Hover actions (all message types):**
- Copy button appears top-right on hover (copies message content)
- Timestamp shown on hover as tooltip

**Streaming indicator:**
- Pulsing orange cursor (bg-[#d97757] animate-pulse) appended to content

**Acceptance Criteria:**
- [ ] User messages styled with Claude Orange accent
- [ ] Assistant messages render full GFM markdown
- [ ] Code blocks use CodeBlock component with syntax highlighting
- [ ] Tables render correctly
- [ ] Copy button appears on hover
- [ ] Streaming cursor is orange and pulsing
- [ ] Tool use and thinking messages route to respective components
- [ ] System messages have orange spark icon

---

### Task T8: ClaudeToolCall Component — Tool Use Display (Complexity 5/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeToolCall.tsx`
**Dependencies:** T6 (claude-theme)

```tsx
interface ClaudeToolCallProps {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: string;
  status: 'running' | 'complete' | 'error';
}
```

**Layout:**
- Compact card with orange left border (border-l-2 border-[#d97757])
- Dark surface background (#1e1e1d)
- **Header row:** Tool icon + tool name + status indicator
  - Icons (from lucide-react): FileText (Read), Pencil (Edit), Terminal (Bash), Search (Glob), FilePlus (Write), Wrench (default)
  - Status: Loader2 spinner (running), Check (complete), X (error)
  - Status colors: orange (running), green (complete), red (error)
- **Summary line:** Auto-generated from toolInput
  - Read: "Reading {path}"
  - Edit: "Editing {file_path}"
  - Bash: "Running `{command}`" (truncated to 80 chars)
  - Glob: "Searching {pattern}"
  - Write: "Writing {file_path}"
  - Default: "{toolName}" with input preview
- **Expandable body:** Click header to toggle
  - Shows full toolInput as formatted JSON (using CodeBlock with language="json")
  - Shows toolResult below if available (also in CodeBlock)
- **Collapsed by default** when status is 'complete'
- **Expanded by default** when status is 'running'

**Acceptance Criteria:**
- [ ] Renders tool name with correct icon
- [ ] Shows summary line derived from tool input
- [ ] Collapsible/expandable on click
- [ ] Status indicator (spinner/check/x) with correct colors
- [ ] Orange left border accent
- [ ] Full input/output visible when expanded
- [ ] Auto-collapses on completion

---

### Task T9: ClaudeThinking Component — Extended Thinking (Complexity 4/10)
**File:** NEW `src/renderer/components/ide/claude/ClaudeThinking.tsx`
**Dependencies:** T6 (claude-theme)

```tsx
interface ClaudeThinkingProps {
  content: string;
  streaming?: boolean;
}
```

**Layout:**
- Collapsible block, **collapsed by default**
- **Header (always visible):** Brain icon (lucide-react) + "Thinking..." text + chevron toggle
  - Orange accent on brain icon
  - Muted text color (#b0aea5)
  - ChevronRight when collapsed, ChevronDown when expanded
- **Body (when expanded):**
  - Content rendered as plain text (not markdown — thinking is raw reasoning)
  - Dimmer styling than regular messages (text-[#706f6a])
  - Italic text
  - Max-height with scroll for very long thinking blocks (max-h-[300px] overflow-y-auto)
- **Streaming:** When `streaming=true`, show pulsing orange dot next to "Thinking..."
- **Border:** Subtle dashed left border in muted orange (#d9775740)

**Acceptance Criteria:**
- [ ] Collapsed by default showing "Thinking..." with brain icon
- [ ] Expandable to show full reasoning content
- [ ] Streaming indicator (pulsing orange dot) when active
- [ ] Muted/dim styling distinct from regular messages
- [ ] Scrollable for long content
- [ ] Chevron rotates on expand/collapse

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE2-CORE-UI-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Summary** — 5 tasks completed, components built
2. **Component Inventory** — Each new component with props interface
3. **Theme System** — Color tokens and class helpers documented
4. **Visual Specifications** — Key styling decisions
5. **Screenshots/Descriptions** — How each component looks

---

## AFTER COMPLETION

**Step 1:** Create completion report in `trinity/sessions/`
**Step 2:** Move this work order to `trinity/sessions/`
**Step 3:** Verify all 5 tasks complete (T5-T9)
**Step 4:** Build passes, existing tests pass

---

## SUCCESS CRITERIA

- [ ] All 5 tasks implemented (T5-T9)
- [ ] CodeBlock renders syntax-highlighted code with copy
- [ ] Claude Orange theme applied consistently
- [ ] ClaudeMessage renders GFM markdown with tables
- [ ] ClaudeToolCall shows tool operations with icons
- [ ] ClaudeThinking collapses/expands with reasoning
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
- [ ] Use claude-theme.ts constants everywhere (no hardcoded colors)
- [ ] Use PrismLight for bundle optimization
- [ ] Follow existing component patterns (functional components, TypeScript interfaces)
- [ ] Use lucide-react for all icons
- [ ] Ensure all components are properly exported

---

## IMPLEMENTATION SEQUENCE

```
T6: Claude Orange theme (no dependencies — can start immediately)
T5: CodeBlock component (needs react-syntax-highlighter from T4)
  ↓
T8: ClaudeToolCall (depends on T6 theme)
T9: ClaudeThinking (depends on T6 theme)
  ↓
T7: ClaudeMessage overhaul (depends on T5 CodeBlock + T6 theme)
```
