# WO-070: UI Polish & Missing Elements

**Status:** PLANNED
**Complexity:** 5/10
**Priority:** MEDIUM
**Phase:** 5 - Onboarding, Error Handling & CLI Parity
**Dependencies:** All previous phases (WO-042 through WO-069)
**Category:** Audit Sections 1 (UI Elements), 2 (Command Palette), 6 (Prompt Box), 24 (Status Indicators)
**Estimated Time:** 6-8 hours
**Created:** 2026-02-01

---

## Objective

Address remaining UI polish items and missing visual elements identified in the Claude Code feature parity audit. This includes the selected text indicator in the prompt footer, enhanced file drag-and-drop, tab status dots, gutter bubbles for code changes, context window indicator improvements, command menu refinements, remote conversations placeholder, and an activity bar icon equivalent.

---

## Background

After Phases 1-4 implement the core systems and major features, several smaller UI polish items remain. These are visual indicators, micro-interactions, and UX refinements that bring the Cola Records Claude experience closer to the VS Code extension's polish level. While individually small, together they significantly improve the user experience by providing visual feedback, reducing friction, and aligning with established Claude Code interaction patterns.

### Current State
- No selected text indicator in the prompt footer
- File drag-and-drop supports images only, no Shift+drag for general files
- No tab status dots (blue for permission pending, orange for finished)
- No gutter bubbles for Claude's code changes
- Context window indicator exists (ClaudeContextBar.tsx) but lacks interactive features
- Slash command menu (/) exists but lacks visual refinements
- No remote tab placeholder in conversation history
- No activity bar icon equivalent (sidebar section toggle)

### Target State
- Prompt footer shows selected text line count with toggle visibility icon
- Shift+drag files into prompt for attachment (beyond images)
- Tab status dots indicate pending permissions (blue) and completion (orange)
- Gutter bubbles in Monaco editor show Claude's changes with click-to-diff
- Enhanced context window indicator with percentage, color gradient, and tooltip
- Polished command menu with category grouping and search
- Remote tab placeholder in conversations (disabled, with "Coming soon" label)
- Activity bar icon for toggling Claude panel visibility from sidebar

---

## Acceptance Criteria

- [ ] AC-1: When text is selected in the Monaco editor, the Claude prompt footer displays "N lines selected" with an eye/eye-slash icon to toggle whether the selection is included in context
- [ ] AC-2: Users can Shift+drag any file type (not just images) into the prompt box to attach it; attached files appear as removable chips with filename and size
- [ ] AC-3: When Claude is awaiting permission approval, a blue dot indicator appears on the Claude panel tab/header; when Claude finishes while the panel is not focused, an orange dot appears
- [ ] AC-4: Monaco editor gutter shows colored bubble decorations (green for additions, blue for modifications) on lines Claude has changed; clicking a bubble opens an inline diff preview
- [ ] AC-5: Context window indicator displays a color-graded progress bar (green -> yellow -> orange -> red as usage increases) with percentage label and a tooltip showing token count details
- [ ] AC-6: The slash command menu (/) displays commands grouped by category with a search/filter input at the top
- [ ] AC-7: Conversation history panel includes a "Remote" tab that is visually disabled with a "Coming soon" tooltip
- [ ] AC-8: An icon button exists in the IDE sidebar area to toggle Claude panel visibility
- [ ] AC-9: All new code has unit tests with >= 80% coverage
- [ ] AC-10: All elements render correctly in both light and dark themes

---

## Technical Design

### Architecture

This work order is a collection of independent UI enhancements. Each feature is self-contained and modifies specific renderer components. No new main process services are required -- all changes are in the renderer process with possible minor IPC additions for editor selection tracking.

```
Renderer Process Modifications:

  ClaudeInputArea.tsx (modified)
    -> SelectedTextIndicator (new child component)
    -> Enhanced file drop zone (Shift+drag detection)

  ClaudePanel.tsx (modified)
    -> Tab status dot rendering
    -> Activity bar icon integration

  ClaudeContextBar.tsx (modified)
    -> Color-graded progress bar
    -> Token count tooltip

  ClaudeSlashCommands.tsx (modified)
    -> Category grouping
    -> Search filter input

  ClaudeConversationHistory.tsx (modified)
    -> Remote tab placeholder

  MonacoEditor.tsx (modified)
    -> Gutter bubble decorations
    -> Click-to-diff interaction

  IDELayout.tsx or Sidebar.tsx (modified)
    -> Activity bar icon for Claude toggle
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/components/claude/SelectedTextIndicator.tsx` | Shows selected text line count with visibility toggle | ~80 lines |
| `src/renderer/components/claude/TabStatusDot.tsx` | Blue/orange status dot indicator | ~50 lines |
| `src/renderer/components/claude/GutterBubbleManager.ts` | Monaco decoration manager for gutter bubbles | ~150 lines |
| `src/renderer/components/claude/__tests__/SelectedTextIndicator.test.tsx` | Unit tests | ~80 lines |
| `src/renderer/components/claude/__tests__/TabStatusDot.test.tsx` | Unit tests | ~60 lines |
| `src/renderer/components/claude/__tests__/GutterBubbleManager.test.ts` | Unit tests | ~120 lines |
| `src/renderer/components/claude/__tests__/UIPolish.test.tsx` | Integration tests for multiple polish items | ~150 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/claude/ClaudeInputArea.tsx` | Add SelectedTextIndicator in footer; enhance drop zone for Shift+drag file attachment |
| `src/renderer/components/claude/ClaudePanel.tsx` | Integrate TabStatusDot; add Claude panel focus tracking for orange dot |
| `src/renderer/components/claude/ClaudeContextBar.tsx` | Replace simple progress bar with color-graded bar; add tooltip with token details |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Add category headers and search/filter input to command menu |
| `src/renderer/components/claude/ClaudeConversationHistory.tsx` | Add disabled "Remote" tab with tooltip |
| `src/renderer/components/ide/editor/MonacoEditor.tsx` | Integrate GutterBubbleManager for change decorations |
| `src/renderer/components/ide/IDELayout.tsx` | Add Claude toggle icon button in sidebar area |
| `src/renderer/stores/useCodeEditorStore.ts` | Track editor selection state (selected lines, file path) |
| `src/renderer/stores/useIDEStore.ts` | Add `claudePanelVisible` state and `toggleClaudePanel` action if not already present |

### Interfaces

```typescript
// Selected text indicator
interface EditorSelection {
  filePath: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  text: string;
}

interface SelectedTextIndicatorProps {
  selection: EditorSelection | null;
  isVisible: boolean;           // whether selection is included in context
  onToggleVisibility: () => void;
}

// Tab status dots
type TabStatusDotState = 'none' | 'permission-pending' | 'finished';

interface TabStatusDotProps {
  state: TabStatusDotState;
}

// Gutter bubble decorations
interface GutterBubble {
  lineNumber: number;
  type: 'addition' | 'modification' | 'deletion';
  originalContent?: string;
  newContent?: string;
}

interface GutterBubbleManagerOptions {
  editor: monaco.editor.IStandaloneCodeEditor;
  bubbles: GutterBubble[];
  onBubbleClick: (bubble: GutterBubble) => void;
}

// Enhanced context bar
interface ContextBarProps {
  usedTokens: number;
  maxTokens: number;
  percentage: number;
  // Color thresholds: 0-50% green, 50-75% yellow, 75-90% orange, 90%+ red
}

// Slash command category
interface SlashCommandCategory {
  name: string;
  commands: SlashCommand[];
}

// File attachment from drag-and-drop
interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'image';
}
```

---

## Implementation Tasks

### Task 1: Create SelectedTextIndicator Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/SelectedTextIndicator.tsx`
- **Details:** A compact footer element that displays when text is selected in the Monaco editor. Shows: "[N] lines selected" text and an eye/eye-slash icon button. Clicking the icon toggles whether the selected text is included as context in Claude prompts. When visible (eye icon), the selection text is appended to the next message sent. When hidden (eye-slash icon), the selection is excluded. State managed via `useCodeEditorStore`. Styled as a small, inline element in the prompt footer area with muted text color.
- **Test:** Renders line count correctly. Toggle switches icon. State updates in store.

### Task 2: Integrate SelectedTextIndicator into ClaudeInputArea
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeInputArea.tsx`, `src/renderer/stores/useCodeEditorStore.ts`
- **Details:** Add `editorSelection: EditorSelection | null` and `selectionVisible: boolean` state to `useCodeEditorStore`. Listen for Monaco editor `onDidChangeCursorSelection` events to update selection state. Render `SelectedTextIndicator` in the footer area of ClaudeInputArea (below the text input, next to any existing footer elements). When sending a message, if `selectionVisible` is true and `editorSelection` is not null, prepend the selected text as context to the message (e.g., "Selected code from file.ts (lines 5-10):\n```\n...\n```\n\n[user message]").
- **Test:** Selection changes update store. Indicator appears/disappears. Message includes selection when visible.

### Task 3: Enhance File Drag-and-Drop
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeInputArea.tsx`
- **Details:** Extend the existing drag-and-drop zone to support all file types (not just images) when Shift is held. On `dragover` and `drop` events, check if Shift key is pressed (`event.shiftKey`). If Shift is held, accept any file type. Create `FileAttachment` objects with name, path (from `event.dataTransfer.files`), size, and type ('file' or 'image' based on MIME). Display attached files as removable chips (pill-shaped elements with filename, file size in KB/MB, and an X remove button). Without Shift, maintain existing behavior (images only). The attachment area appears between the text input and the send button when attachments are present.
- **Test:** Shift+drag accepts all file types. Non-shift drag only accepts images. Chips render with correct info. X removes attachment.

### Task 4: Create TabStatusDot Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/TabStatusDot.tsx`
- **Details:** A small (8px) colored circle indicator. Props: `state: TabStatusDotState`. States: `none` (hidden), `permission-pending` (blue, pulsing animation), `finished` (orange, static). Uses CSS transitions for smooth state changes. The dot is absolutely positioned relative to its parent container (typically the Claude panel tab or header icon).
- **Test:** Renders correct color for each state. Hidden when state is 'none'. Pulse animation class applied for blue state.

### Task 5: Integrate Tab Status Dots into ClaudePanel
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudePanel.tsx`
- **Details:** Track two states: `permissionPending: boolean` (set true when a permission dialog is shown, false when resolved) and `finishedWhileHidden: boolean` (set true when Claude completes a response while the panel does not have focus). Use `document.hasFocus()` or a focus listener to detect panel visibility. Render `TabStatusDot` in the panel header/tab area. Clear `finishedWhileHidden` when the panel gains focus. Clear `permissionPending` when permission is resolved.
- **Test:** Blue dot appears on permission request. Orange dot appears on completion while hidden. Dots clear on focus/resolution.

### Task 6: Create GutterBubbleManager
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/GutterBubbleManager.ts`
- **Details:** A class that manages Monaco editor decorations for gutter bubbles. Constructor takes a Monaco editor instance. Methods: `setBubbles(bubbles: GutterBubble[])` -- creates/updates decorations, `clear()` -- removes all decorations, `dispose()` -- cleanup. Uses Monaco's `deltaDecorations` API. Decoration config: gutter class name for CSS styling (green circle for additions, blue circle for modifications, red circle for deletions), line highlight background tint. Registers a click handler on the gutter via `editor.onMouseDown` -- when a decorated gutter is clicked, calls `onBubbleClick` callback with the corresponding bubble data. The callback should open an inline diff view (can reuse existing DiffEditor.tsx or create a lightweight inline diff).
- **Test:** Decorations created for each bubble. Click handler fires callback. Clear removes decorations. Dispose cleans up listeners.

### Task 7: Integrate Gutter Bubbles into MonacoEditor
- **Type:** MODIFY
- **Files:** `src/renderer/components/ide/editor/MonacoEditor.tsx`
- **Details:** Instantiate `GutterBubbleManager` when the editor mounts. Listen for Claude change events (from the Claude conversation store or a change tracking mechanism). When Claude modifies a file that is currently open in the editor, compute the changed line ranges and create `GutterBubble` entries. Pass bubbles to the manager. On bubble click, open the existing DiffEditor with the before/after content for the clicked region. Clean up manager on editor unmount. Add CSS classes for gutter bubble styling: `.gutter-bubble-addition { background: rgba(0, 200, 0, 0.6); border-radius: 50%; }`, etc.
- **Test:** Bubbles appear on changed lines. Click opens diff. Bubbles clear when changes are accepted/reverted.

### Task 8: Enhance ClaudeContextBar
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeContextBar.tsx`
- **Details:** Replace the current context indicator with a color-graded progress bar. Color thresholds: 0-50% = green (`#22c55e`), 50-75% = yellow (`#eab308`), 75-90% = orange (`#f97316`), 90-100% = red (`#ef4444`). Use CSS gradient or dynamic class application. Add percentage text label ("67%") on or beside the bar. Add a hover tooltip (using existing Tooltip component from ui/) showing: "Context: 67,000 / 100,000 tokens (67%)\nInput: 45,000 | Output: 22,000". The bar should have a smooth CSS transition when the percentage changes.
- **Test:** Correct color at each threshold. Tooltip shows token breakdown. Smooth transition on update.

### Task 9: Improve Slash Command Menu
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`
- **Details:** Add a search/filter input at the top of the command menu dropdown. As the user types, filter commands by name and description (case-insensitive substring match). Group commands by category: "Session" (/clear, /compact, /exit), "Configuration" (/config, /model, /permissions, /allowed-tools), "Context" (/memory, /context, /init), "Monitoring" (/cost, /status, /doctor, /bug), "Workflow" (/review, /agents, /skills), "Display" (/theme, /output-style, /vim). Each category has a small gray header label. Empty categories are hidden. Highlight the currently focused command for keyboard navigation.
- **Test:** Search filters commands correctly. Categories display with headers. Empty categories hidden. Keyboard navigation works.

### Task 10: Add Remote Tab Placeholder
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeConversationHistory.tsx`
- **Details:** Add a tab bar at the top of the conversation history panel with two tabs: "Local" (active, default) and "Remote" (disabled). The "Remote" tab is visually muted (gray text, no hover effect, cursor: not-allowed). On hover/click, a tooltip displays "Remote sessions - Coming soon". The "Local" tab shows the existing conversation list. This is a placeholder for future remote session support (Audit Section 27). No backend work needed.
- **Test:** Both tabs render. Remote tab is disabled. Tooltip appears on Remote tab hover. Local tab shows conversation list.

### Task 11: Add Activity Bar Icon
- **Type:** MODIFY
- **Files:** `src/renderer/components/ide/IDELayout.tsx` (or `src/renderer/components/layout/Sidebar.tsx`), `src/renderer/stores/useIDEStore.ts`
- **Details:** Add a Claude spark icon button in the IDE sidebar area (activity bar equivalent). Clicking toggles the Claude panel visibility in the IDE layout. Add `claudePanelVisible: boolean` and `toggleClaudePanel: () => void` to `useIDEStore` if not already present. The icon uses the same spark/lightning icon used elsewhere for Claude branding. When the Claude panel is visible, the icon appears active (highlighted background). When hidden, the icon appears inactive (muted). Position: in the vertical icon strip of the IDE sidebar, below existing icons (file tree, search, git, etc.).
- **Test:** Icon renders in sidebar. Click toggles panel visibility. Active/inactive states display correctly.

### Task 12: Add CSS for Gutter Bubbles and Status Dots
- **Type:** MODIFY
- **Files:** `src/renderer/index.css` (or equivalent global styles file)
- **Details:** Add CSS classes for gutter bubble decorations and status dot animations:
  ```css
  /* Gutter bubble decorations */
  .gutter-bubble-addition { /* green circle */ }
  .gutter-bubble-modification { /* blue circle */ }
  .gutter-bubble-deletion { /* red circle */ }

  /* Tab status dot */
  .status-dot-pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  ```
  These styles must work in both light and dark themes. Use CSS custom properties or Tailwind classes for theme-aware colors.
- **Test:** Visual verification in both themes. Animation runs smoothly.

### Task 13: Write Comprehensive Tests
- **Type:** CREATE
- **Files:** All `__tests__/` files listed in New Files section
- **Details:** Write unit tests for all new components and modifications:
  - SelectedTextIndicator: rendering, toggle, line count display
  - TabStatusDot: all three states, animation class
  - GutterBubbleManager: decoration creation, click handling, cleanup
  - Enhanced drag-and-drop: Shift key detection, file type filtering, chip rendering
  - Context bar: color thresholds, tooltip content, transitions
  - Command menu: search filtering, category grouping, keyboard navigation
  - Remote tab: disabled state, tooltip
  - Activity bar icon: toggle behavior, active/inactive states
- **Test:** All tests pass. Coverage >= 80% for new files.

---

## Testing Requirements

### Unit Tests
- SelectedTextIndicator: render with/without selection, toggle visibility, line count format
- TabStatusDot: each state renders correctly, pulse animation for blue, hidden for none
- GutterBubbleManager: creates decorations, handles clicks, cleans up on dispose
- ClaudeInputArea file drop: Shift+drag accepts all files, non-Shift rejects non-images, chip rendering
- ClaudeContextBar: color at 25%, 60%, 80%, 95%; tooltip content; transition
- ClaudeSlashCommands: search filter, category grouping, empty category hiding
- ClaudeConversationHistory: Remote tab disabled state, tooltip
- IDELayout activity bar icon: toggle, active/inactive states

### Integration Tests
- Selected text flows through to message context when visible
- Tab status dots update based on permission and completion events
- Gutter bubbles appear when Claude changes open file, click opens diff
- Full slash command menu interaction: type /, search, select command

### Edge Cases
- No editor selection (indicator hidden)
- Zero-length selection (indicator hidden)
- Large file drag (>10MB warning)
- Context bar at exactly 0% and 100%
- All slash commands in one category (no empty categories)
- Monaco editor not mounted when gutter bubbles update (queue until mount)
- Panel visibility toggle while Claude is processing (preserve state)

---

## BAS Quality Gates

| Phase | Gate | Tool | Pass Criteria |
|-------|------|------|---------------|
| 1 | Linting | ESLint + Prettier | 0 errors, auto-fix applied |
| 2 | Structure | Import/export validation | All imports resolve, types valid |
| 3 | Build | TypeScript compiler (tsc) | 0 compilation errors |
| 4 | Testing | Vitest | 100% tests pass |
| 5 | Coverage | @vitest/coverage-v8 | >= 80% lines and branches for new files |
| 6 | Review | DRA code review | Best practices compliance |

---

## Audit Items Addressed

From `CLAUDE-CODE-EXTENSION-AUDIT.md`:

**Section 1 - UI Elements:**
- [ ] **Selected Text Indicator** - Footer of prompt box shows number of lines currently selected in editor; click eye-slash icon to toggle selection visibility to Claude
- [ ] **File Attachments** - Files can be drag-and-dropped (with Shift held) into prompt box as attachments; X button removes them
- [ ] **Tab Status Dots** - Small colored dots: blue = permission request pending, orange = Claude finished while tab was hidden
- [ ] **Gutter Bubbles** - Colored indicators in left margin of code showing Claude's changes; clicking shows inline diff
- [ ] **Activity Bar Icon** - Spark icon appears in Activity Bar when Claude panel is docked to sidebar

**Section 2 - Command Palette:**
- [ ] (Indirectly) Improved command menu with search and categories

**Section 6 - Prompt Box:**
- [ ] **Context usage display** - Visual indicator of how much context window is being used (enhanced)
- [ ] **Command menu (/)** - Type / or click / button to open menu with commands and options (enhanced)

**Section 7 - Conversation Management:**
- [ ] **Remote Tab (Conversations)** - Tab in past conversations showing remote sessions (placeholder)

**Section 24 - Status Indicators:**
- [ ] **Tab status dots** - Blue dot = permission pending; orange dot = Claude finished (duplicate of Section 1)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Monaco deltaDecorations API changes between versions | Low | Medium | Pin Monaco version; use stable decoration API surface |
| Gutter click detection unreliable on different OS | Medium | Low | Use Monaco's built-in `onMouseDown` with target type check; fallback to line-level click |
| Selected text tracking causes performance issues with large selections | Medium | Low | Debounce selection change events (100ms); only track line count, not full text, until message send |
| File drag-and-drop behavior inconsistent across OS | Medium | Medium | Test on Windows (primary target); use standard HTML5 drag-and-drop API; Shift key detection via `event.shiftKey` |
| Color gradient on context bar not accessible for color-blind users | Medium | Low | Include percentage text label alongside color; ensure sufficient contrast ratios |
| Many small changes across many files increases merge conflict risk | Medium | Medium | This WO is intentionally last in the phase; all other changes should be stable |

---

## Notes

- This work order is intentionally scheduled last in Phase 5 because it modifies many existing components. All previous work orders should be complete and stable before applying these polish changes.
- Each task in this work order is independently implementable and testable. If time is constrained, tasks can be prioritized: Task 1-2 (selected text), Task 4-5 (status dots), and Task 8 (context bar) provide the most user-visible improvements.
- The "Remote" tab placeholder (Task 10) is a no-op UI element. It exists solely to indicate future capability and establish the tab structure. No backend work is needed.
- Gutter bubbles (Tasks 6-7) require a change tracking mechanism that may already exist from WO-056 (Diff View & Code Changes). If WO-056 provides a change list, gutter bubbles can consume it directly. If not, a simple before/after file content comparison can be used.
- The activity bar icon (Task 11) adapts the VS Code concept to the Cola Records IDE layout. The exact placement depends on the current sidebar structure -- it should be placed in the icon strip alongside file tree, search, and git icons.
- All color values should use Tailwind CSS classes or CSS custom properties for theme consistency. Hard-coded hex values should only appear in documentation, not in code.
