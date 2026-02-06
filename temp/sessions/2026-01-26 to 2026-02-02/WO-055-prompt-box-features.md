# WO-055: Prompt Box Features (Complete)

**Status:** PENDING
**Complexity:** 6/10
**Priority:** HIGH
**Phase:** 3 - UI & UX Features
**Dependencies:** WO-044 (Custom Commands), WO-045 (Full Permissions System)
**Category:** Audit Checklist Section 6 - Prompt Box Features
**Estimated Time:** 5-6 hours (including BAS gates)

---

## Objective

Enhance the Claude prompt box (ClaudeInputArea) with advanced mention types, context visibility controls, configurable send behavior, and editor integration. This brings the prompt input experience to feature parity with the Claude Code VS Code extension.

---

## Background

### Current State (What Exists)
- **ClaudeInputArea.tsx** (~16KB): Multi-featured input component with:
  - Text input with multi-line support (Shift+Enter)
  - `@file` mentions with fuzzy matching autocomplete (via `claude:search-files` IPC)
  - Slash command support (/) with command menu
  - Image attachments (paste/drag-drop with base64 encoding)
  - Message history navigation (Up/Down arrows)
  - Character/line counter
  - Model selector and extended thinking toggle in footer
- **useClaudeStore**: Tracks `tokenUsage`, `contextPercent` (200K max), `permissionMode`, `selectedModel`
- **IPC channel** `claude:search-files`: Returns file paths matching a query string

### What Is Missing (From Audit Checklist Section 6)
1. `@file.ts#5-10` line range syntax in @mentions
2. `@src/components/` folder @mentions (trailing slash indicates directory)
3. `@terminal:name` reference to terminal output by terminal title
4. Selection toggle (eye-slash icon) in prompt footer to hide/show selected text from Claude
5. Context usage visual indicator directly in the prompt box
6. Ctrl/Cmd+Enter configurable send option (vs default Enter to send)
7. Permission mode switching indicator clickable from prompt box
8. Auto-selected text context from the Monaco editor

---

## Acceptance Criteria

- [ ] AC-1: User can type `@file.ts#5-10` and the mention resolves to lines 5-10 of that file, included in the prompt context
- [ ] AC-2: User can type `@src/components/` (trailing slash) to mention an entire folder; autocomplete shows directories
- [ ] AC-3: User can type `@terminal:name` to reference a terminal session's output by its title
- [ ] AC-4: A toggle icon (eye/eye-slash) in the prompt footer shows/hides the current editor selection from Claude's context
- [ ] AC-5: A context usage meter (percentage or bar) is visible in or near the prompt box area
- [ ] AC-6: A setting `useCtrlEnterToSend` allows Ctrl/Cmd+Enter to send instead of Enter (Enter then inserts newline)
- [ ] AC-7: The permission mode indicator in the prompt footer is clickable and cycles through modes (Normal/Plan/Auto-accept)
- [ ] AC-8: When text is selected in the Monaco editor, it is automatically included as context (unless toggled off via AC-4)
- [ ] AC-9: All new mention types display correctly in the autocomplete dropdown with appropriate icons
- [ ] AC-10: All features have unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The prompt box enhancement follows a layered approach:
1. **Mention Parser Layer** - Extends the existing `@mention` regex parser to support line ranges, folders, and terminal references
2. **Context Resolver Layer** - New IPC channels resolve mention targets (file line ranges, directory contents, terminal output)
3. **UI Layer** - New UI elements in ClaudeInputArea footer (selection toggle, context meter, mode indicator)
4. **Settings Layer** - New setting for Ctrl+Enter send behavior

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/components/ide/claude/ClaudeContextMeter.tsx` | Visual context usage indicator (progress bar + percentage) | ~80 lines |
| `src/renderer/components/ide/claude/ClaudeSelectionToggle.tsx` | Eye/eye-slash toggle for editor selection visibility | ~60 lines |
| `src/renderer/components/ide/claude/ClaudeModeIndicator.tsx` | Clickable permission mode badge in prompt footer | ~70 lines |
| `src/renderer/components/ide/claude/mention-parser.ts` | Extended mention parser supporting line ranges, folders, terminals | ~150 lines |
| `src/renderer/components/ide/claude/__tests__/mention-parser.test.ts` | Tests for mention parser | ~200 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeContextMeter.test.tsx` | Tests for context meter | ~80 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeSelectionToggle.test.tsx` | Tests for selection toggle | ~80 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeModeIndicator.test.tsx` | Tests for mode indicator | ~80 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Integrate new mention parser, add footer elements (context meter, selection toggle, mode indicator), add Ctrl+Enter send logic |
| `src/renderer/stores/useClaudeStore.ts` | Add `editorSelection` state, `useCtrlEnterToSend` setting, `setEditorSelection` action |
| `src/main/ipc/channels.ts` | Add `claude:resolve-mention` IPC channel type, add `ClaudeMentionTarget` type |
| `src/main/ipc/handlers.ts` | Register `claude:resolve-mention` handler |
| `src/main/services/terminal.service.ts` | Add method to get terminal output buffer by session name |
| `src/renderer/components/ide/editor/MonacoEditor.tsx` | Emit selection changes to Claude store for auto-selected text context |
| `src/renderer/stores/useSettingsStore.ts` | Add `useCtrlEnterToSend` setting field |

### Interfaces

```typescript
// mention-parser.ts
interface MentionToken {
  type: 'file' | 'file-range' | 'folder' | 'terminal';
  raw: string;           // e.g. "@file.ts#5-10"
  target: string;        // e.g. "file.ts"
  lineStart?: number;    // e.g. 5
  lineEnd?: number;      // e.g. 10
  terminalName?: string; // e.g. "bash"
}

function parseMentions(text: string): MentionToken[];
function formatMentionForDisplay(token: MentionToken): string;

// IPC channel addition
interface ClaudeMentionTarget {
  type: 'file-range' | 'folder-contents' | 'terminal-output';
  content: string;
  metadata: {
    path?: string;
    lineStart?: number;
    lineEnd?: number;
    terminalName?: string;
    fileCount?: number;
  };
}

// In IpcChannels:
'claude:resolve-mention': (projectPath: string, mention: MentionToken) => ClaudeMentionTarget;

// Editor selection state addition to useClaudeStore
interface EditorSelection {
  filePath: string;
  text: string;
  startLine: number;
  endLine: number;
}
```

---

## Implementation Tasks

### T1: Extended Mention Parser (45 min)
**File:** `src/renderer/components/ide/claude/mention-parser.ts`
- Extract mention parsing logic from ClaudeInputArea into standalone module
- Add regex patterns for `@file#L5-L10` (or `#5-10`) line range syntax
- Add regex pattern for `@path/` folder mentions (trailing slash detection)
- Add regex pattern for `@terminal:name` terminal references
- Export `parseMentions()` and `formatMentionForDisplay()` functions
- Maintain backward compatibility with existing `@file` plain mentions

### T2: Mention Parser Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/mention-parser.test.ts`
- Test plain file mention: `@auth.ts` -> `{ type: 'file', target: 'auth.ts' }`
- Test line range: `@auth.ts#5-10` -> `{ type: 'file-range', target: 'auth.ts', lineStart: 5, lineEnd: 10 }`
- Test single line: `@auth.ts#42` -> `{ type: 'file-range', target: 'auth.ts', lineStart: 42, lineEnd: 42 }`
- Test folder: `@src/components/` -> `{ type: 'folder', target: 'src/components/' }`
- Test terminal: `@terminal:bash` -> `{ type: 'terminal', terminalName: 'bash' }`
- Test edge cases: no match, multiple mentions, nested paths

### T3: Mention Resolution IPC Channel (45 min)
**Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- Add `claude:resolve-mention` channel to `IpcChannels` interface
- Implement handler that:
  - For `file-range`: reads file via filesystem.service, extracts specified line range
  - For `folder-contents`: reads directory listing via filesystem.service, returns file names/summaries
  - For `terminal-output`: reads terminal buffer via terminal.service (new method)
- Add `ClaudeMentionTarget` type to channels.ts

### T4: Terminal Output Buffer Access (30 min)
**File:** `src/main/services/terminal.service.ts`
- Add `getTerminalOutputBuffer(sessionId: string): string` method
- Store last N lines (configurable, default 500) of terminal output per session
- Expose terminal session names for `@terminal:name` autocomplete

### T5: ClaudeInputArea Integration - Mentions (60 min)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- Replace inline mention parsing with imported `parseMentions()`
- Update autocomplete dropdown to show:
  - File results with line range hint (e.g., "auth.ts - add #L5-L10 for range")
  - Directory results with folder icon and trailing slash
  - Terminal sessions with terminal icon and `@terminal:` prefix
- Before sending message, resolve all mentions via `claude:resolve-mention` IPC
- Include resolved mention content in the prompt context sent to `claude:query`

### T6: Context Usage Meter Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeContextMeter.tsx`
- Small horizontal progress bar showing context usage percentage
- Color coding: green (<60%), yellow (60-80%), red (>80%)
- Tooltip showing "X / 200K tokens used"
- Reads `contextPercent` from useClaudeStore
- Compact design suitable for prompt box footer

### T7: Selection Toggle Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeSelectionToggle.tsx`
- Eye/eye-slash icon button (lucide-react: `Eye`, `EyeOff`)
- Shows "N lines selected" text when editor has selection
- Toggles whether selection is included in Claude's context
- Reads `editorSelection` from useClaudeStore

### T8: Permission Mode Indicator Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeModeIndicator.tsx`
- Badge showing current mode: "Normal", "Plan", "Auto-accept"
- Clickable to cycle through modes
- Color coding per mode (green=Normal, blue=Plan, orange=Auto-accept)
- Calls `setPermissionMode()` from useClaudeStore on click

### T9: Monaco Editor Selection Integration (30 min)
**File:** `src/renderer/components/ide/editor/MonacoEditor.tsx`
- Listen to Monaco `onDidChangeCursorSelection` event
- When selection changes, update `editorSelection` in useClaudeStore
- Debounce updates (300ms) to avoid excessive store writes
- Clear selection state when editor loses focus

### T10: Ctrl+Enter Send Setting (20 min)
**Files:** `src/renderer/stores/useSettingsStore.ts`, `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- Add `useCtrlEnterToSend: boolean` (default: false) to settings store
- In ClaudeInputArea keydown handler:
  - If `useCtrlEnterToSend=true`: Enter inserts newline, Ctrl/Cmd+Enter sends
  - If `useCtrlEnterToSend=false`: Enter sends, Shift+Enter inserts newline (current behavior)

### T11: Store Updates (20 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Add `editorSelection: EditorSelection | null` state
- Add `selectionVisible: boolean` state (default: true)
- Add `setEditorSelection(selection: EditorSelection | null)` action
- Add `toggleSelectionVisible()` action

### T12: Footer Assembly in ClaudeInputArea (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- Add footer row below textarea containing:
  - Left: ClaudeSelectionToggle (when selection exists)
  - Center: ClaudeContextMeter
  - Right: ClaudeModeIndicator
- Responsive layout that collapses gracefully on narrow widths

### T13: Component Tests (45 min)
**Files:** `__tests__/ClaudeContextMeter.test.tsx`, `__tests__/ClaudeSelectionToggle.test.tsx`, `__tests__/ClaudeModeIndicator.test.tsx`
- ClaudeContextMeter: renders correct percentage, color changes at thresholds, tooltip content
- ClaudeSelectionToggle: toggles icon, shows line count, disabled when no selection
- ClaudeModeIndicator: displays current mode, cycles on click, correct colors

---

## Testing Requirements

### Unit Tests
- Mention parser: all mention types, edge cases, malformed input
- Context meter: rendering, color thresholds, tooltip
- Selection toggle: toggle state, icon change, line count display
- Mode indicator: mode display, click cycling, color mapping

### Integration Tests
- End-to-end mention resolution: type `@file#5-10` -> autocomplete -> resolve -> context includes lines
- Ctrl+Enter send behavior toggle: verify setting changes keydown behavior
- Editor selection -> prompt context flow: select text in Monaco -> appears in Claude prompt context

### Coverage Target
- Lines: >= 80%
- Branches: >= 80%

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier: 0 errors after auto-fix |
| 2 | Structure | All imports resolve, TypeScript types valid, no circular deps |
| 3 | Build | `tsc --noEmit` passes with 0 errors |
| 4 | Testing | All new + existing tests pass |
| 5 | Coverage | >= 80% lines and branches on new files |
| 6 | Review | DRA code review: best practices, design doc adherence |

---

## Audit Checklist Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 6:

- [ ] `@-mention with line ranges` - Reference specific lines: @file.ts#5-10 (T1, T2, T3, T5)
- [ ] `@-mention folders` - Include trailing slash for folders: @src/components/ (T1, T2, T3, T5)
- [ ] `@terminal:name` - Reference terminal output by terminal title name (T1, T2, T3, T4, T5)
- [ ] `Auto-selected text context` - When text is selected in editor, Claude can see highlighted code (T7, T9, T11)
- [ ] `Selection toggle` - Click eye-slash icon in prompt footer to hide/show selected text (T7, T11, T12)
- [ ] `Context usage display` - Visual indicator of how much context window is being used (T6, T12)
- [ ] `Permission mode switching` - Click mode indicator at bottom of prompt box to switch modes (T8, T12)
- [ ] `Ctrl/Cmd+Enter to send` - Optional: configurable to use Ctrl/Cmd+Enter instead of Enter (T10)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mention parser regex complexity leads to false positives | Medium | Medium | Comprehensive test suite with edge cases; use structured parsing not just regex |
| Terminal output buffer grows unbounded | Low | High | Cap buffer at 500 lines per session; implement ring buffer |
| Monaco selection events fire too frequently causing store churn | Medium | Low | Debounce at 300ms; only update on meaningful selection changes |
| ClaudeInputArea becomes too large | Medium | Medium | Extract footer into separate component; keep ClaudeInputArea as orchestrator |

---

## Notes

- The mention parser should be extracted as a standalone module for reusability by other components (e.g., custom commands that use `@file` syntax).
- The `@terminal:name` feature requires terminal sessions to have assignable names. If terminal.service does not currently support named sessions, use the session ID as the name with a TODO for proper naming.
- The context meter reads from `contextPercent` which is already tracked in useClaudeStore. No additional API calls needed for this component.
- The permission mode indicator must respect WO-045's permission system once implemented. For now, it cycles through the modes already defined in `ClaudePermissionMode` type.
- Line range syntax follows the convention `#L5-L10` (with L prefix) for clarity, but also accepts `#5-10` without prefix for convenience.
