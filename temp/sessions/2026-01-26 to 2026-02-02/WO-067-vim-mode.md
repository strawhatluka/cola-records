# WO-067: Vim Mode

**Status:** PENDING
**Complexity:** 5/10
**Priority:** LOW
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 29 - Vim Mode
**Dependencies:** None
**Estimated Time:** 5 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Implement vim mode for the Claude chat input area, providing alternating insert/command modes with standard vim key bindings. This allows power users to navigate and edit their prompts using familiar vim motions. Activated via the `/vim` slash command, with a mode indicator and seamless mode switching.

---

## Background

### Current State
- Claude input area is a standard text input/textarea in the renderer
- No vim key binding support exists anywhere in the application
- No `/vim` slash command
- No mode indicator for input modes
- Monaco editor (used for code editing) has built-in vim mode support via extensions, but this WO targets the Claude chat input specifically

### Target State
- `/vim` slash command toggles vim mode on/off for the Claude input area
- Insert mode: Normal text input (type freely)
- Command mode: Vim-style navigation and editing (hjkl movement, dd, yy, p, etc.)
- Mode indicator showing current mode (INSERT / COMMAND) in the input area
- Mode switching: Esc to enter command mode, i/a/o to enter insert mode
- Vim mode preference persisted in settings

---

## Acceptance Criteria

- [ ] AC-1: `/vim` command toggles vim mode on/off
- [ ] AC-2: In insert mode, typing works normally (no interception)
- [ ] AC-3: Pressing Esc in insert mode switches to command mode
- [ ] AC-4: In command mode, pressing i enters insert mode at cursor
- [ ] AC-5: In command mode, pressing a enters insert mode after cursor
- [ ] AC-6: In command mode, h/j/k/l move cursor left/down/up/right
- [ ] AC-7: In command mode, dd deletes current line
- [ ] AC-8: In command mode, yy yanks (copies) current line
- [ ] AC-9: In command mode, p pastes yanked text after cursor
- [ ] AC-10: Mode indicator displays current mode (INSERT/COMMAND/--VIM--)
- [ ] AC-11: Vim mode preference persisted across sessions
- [ ] AC-12: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
Vim Mode Architecture:

  Claude Input Area (textarea/contenteditable)
       |
       v
  VimModeController (keyboard event interceptor)
       |
       +--> Insert Mode Handler (pass-through, Esc -> command mode)
       |
       +--> Command Mode Handler
              |
              +--> Motion commands (h, j, k, l, w, b, 0, $, gg, G)
              +--> Edit commands (dd, yy, p, P, x, r, cc, cw)
              +--> Mode switch commands (i, a, o, O, A, I)
              +--> Undo/Redo (u, Ctrl+R)
       |
       v
  VimStateManager (mode, register, cursor position)
       |
       v
  Mode Indicator Component (shows INSERT/COMMAND)

Key Event Flow:
  keydown -> VimModeController.handleKey(event)
    -> If vim disabled: pass through (no interception)
    -> If insert mode: pass through (except Esc)
    -> If command mode: intercept, execute vim command, preventDefault
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/services/vim-mode.service.ts` | Core vim mode state machine and command execution |
| `src/renderer/services/vim-commands.ts` | Vim command definitions (motions, edits, mode switches) |
| `src/renderer/components/claude/ClaudeVimIndicator.tsx` | Mode indicator component |
| `src/renderer/hooks/useVimMode.ts` | React hook for integrating vim mode into input components |
| `tests/unit/services/vim-mode.service.test.ts` | Vim mode service tests |
| `tests/unit/services/vim-commands.test.ts` | Vim command tests |
| `tests/unit/hooks/useVimMode.test.ts` | Vim hook tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claudeVimMode?: boolean` to AppSettings |
| `src/main/index.ts` | Add persistence for claudeVimMode setting |
| `src/renderer/components/claude/ClaudeInputArea.tsx` (or equivalent input) | Integrate useVimMode hook |
| `src/renderer/components/settings/SettingsForm.tsx` | Add vim mode toggle |
| `src/renderer/stores/useSettingsStore.ts` | Add claudeVimMode field |

### Interfaces

```typescript
// src/renderer/services/vim-mode.service.ts
type VimMode = 'insert' | 'command';

interface VimState {
  mode: VimMode;
  enabled: boolean;
  register: string;      // yanked text (single register for simplicity)
  count: number;         // numeric prefix (e.g., 3dd)
  pendingOperator: string | null;  // operator waiting for motion (d, y, c)
}

interface VimModeService {
  /** Get current vim state */
  getState(): VimState;
  /** Enable or disable vim mode */
  setEnabled(enabled: boolean): void;
  /** Handle a key event, returns true if event was consumed */
  handleKeyDown(event: KeyboardEvent, textarea: HTMLTextAreaElement): boolean;
  /** Subscribe to state changes */
  onStateChange(callback: (state: VimState) => void): () => void;
  /** Reset state (e.g., on focus loss) */
  reset(): void;
}

// src/renderer/services/vim-commands.ts
interface VimCommand {
  key: string;           // key or key sequence
  mode: 'command';       // only applies in command mode
  action: (state: VimState, textarea: HTMLTextAreaElement, count: number) => VimState;
  description: string;
}

interface VimMotion {
  key: string;
  action: (textarea: HTMLTextAreaElement, count: number) => void; // moves cursor
  description: string;
}

// src/renderer/hooks/useVimMode.ts
interface UseVimModeResult {
  vimEnabled: boolean;
  vimMode: VimMode;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  toggleVim: () => void;
}

// src/renderer/components/claude/ClaudeVimIndicator.tsx
interface VimIndicatorProps {
  enabled: boolean;
  mode: VimMode;
}
```

---

## Implementation Tasks

### Task 1: Implement VimModeService (State Machine)
**File:** `src/renderer/services/vim-mode.service.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** None

Core vim state machine:
- State: `{ mode, enabled, register, count, pendingOperator }`
- `setEnabled(bool)`: Toggle vim mode, reset to insert mode when enabled
- `handleKeyDown(event, textarea)`:
  - If not enabled: return false (don't consume event)
  - If insert mode:
    - Esc: Switch to command mode, return true
    - All other keys: return false (pass through to textarea)
  - If command mode:
    - Parse key into command
    - Handle numeric prefix (1-9 set count, 0 is motion)
    - Handle operator-pending state (d, y, c waiting for motion)
    - Execute command, update state
    - return true (consume event, preventDefault)
- Event subscription system for UI updates
- Reset: Clear pending operator, count, switch to insert mode

### Task 2: Implement Vim Commands
**File:** `src/renderer/services/vim-commands.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Task 1

Implement standard vim commands operating on textarea:

**Mode Switches:**
- `i`: Enter insert mode at cursor position
- `a`: Enter insert mode after cursor position
- `I`: Enter insert mode at beginning of line
- `A`: Enter insert mode at end of line
- `o`: Insert new line below, enter insert mode
- `O`: Insert new line above, enter insert mode

**Motions (move cursor):**
- `h`: Move cursor left (respects count)
- `l`: Move cursor right (respects count)
- `j`: Move cursor down one line (respects count)
- `k`: Move cursor up one line (respects count)
- `w`: Move to next word start
- `b`: Move to previous word start
- `0`: Move to beginning of line
- `$`: Move to end of line
- `gg`: Move to beginning of text
- `G`: Move to end of text

**Edit Commands:**
- `x`: Delete character at cursor
- `dd`: Delete current line (store in register)
- `yy`: Yank (copy) current line to register
- `p`: Paste register content after cursor
- `P`: Paste register content before cursor
- `cc`: Change (delete) current line, enter insert mode
- `cw`: Change word (delete to next word boundary, enter insert mode)
- `u`: Undo (trigger textarea undo if possible, or use execCommand)

**Textarea Manipulation Helpers:**
- `getLineStart(textarea)`: Get start index of current line
- `getLineEnd(textarea)`: Get end index of current line
- `getCurrentLine(textarea)`: Get text of current line
- `deleteLine(textarea)`: Remove current line
- `insertText(textarea, text, position)`: Insert text at position

### Task 3: Create useVimMode Hook
**File:** `src/renderer/hooks/useVimMode.ts`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Tasks 1, 2

React hook for vim mode integration:
- Read `claudeVimMode` from settings store
- Create/manage `VimModeService` instance
- Provide `handleKeyDown` callback for textarea `onKeyDown`
- Provide `vimEnabled` and `vimMode` state for UI
- Provide `toggleVim()` function for /vim command
- Subscribe to VimModeService state changes
- Cleanup on unmount

### Task 4: Create ClaudeVimIndicator Component
**File:** `src/renderer/components/claude/ClaudeVimIndicator.tsx`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Mode indicator display:
- When vim disabled: render nothing
- When vim enabled, insert mode: Show `-- INSERT --` in green
- When vim enabled, command mode: Show `-- COMMAND --` in blue/yellow
- Position: Bottom-left of input area, inline with other indicators
- Small, unobtrusive styling matching existing UI
- Transition animation on mode change (subtle color fade)

### Task 5: Integrate Vim Mode into Claude Input
**File:** `src/renderer/components/claude/ClaudeInputArea.tsx` (or equivalent)
**Complexity:** Medium
**Estimated Time:** 30 min
**Dependencies:** Tasks 3, 4

Wire vim mode into the existing input component:
- Call `useVimMode()` hook
- Attach `handleKeyDown` to textarea/input `onKeyDown` event
- Render `ClaudeVimIndicator` below/beside the input
- When vim is in command mode, optionally change cursor style (block cursor via CSS)
- Ensure Enter key behavior:
  - Insert mode: Send message (existing behavior)
  - Command mode: Do not send (vim `Enter` = move down in command mode)
- Ensure `/vim` command works (calls `toggleVim()`)

### Task 6: Register /vim Slash Command
**File:** Slash command registry
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** Task 3

- `/vim`: Toggle vim mode on/off
- When toggled on: Show confirmation message "Vim mode enabled. Press Esc for command mode."
- When toggled off: Show confirmation "Vim mode disabled."
- Persist the toggle to `claudeVimMode` setting

### Task 7: Update AppSettings and Settings UI
**Files:** `src/main/ipc/channels.ts`, `src/renderer/components/settings/SettingsForm.tsx`, `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** None

- Add `claudeVimMode?: boolean` (default false) to AppSettings
- Add persistence in `settings:update` handler
- Add vim mode toggle to SettingsForm under "Input" or "Editor" section
- Label: "Enable Vim Mode" with description "Use vim key bindings in the Claude input area"

### Task 8: Write Unit Tests - VimModeService
**File:** `tests/unit/services/vim-mode.service.test.ts`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** Task 1

Test the state machine:
- Enable/disable toggles mode correctly
- Esc in insert mode switches to command mode
- i in command mode switches to insert mode
- a, I, A, o, O mode switches
- Keys in insert mode are not consumed (handleKeyDown returns false)
- Keys in command mode are consumed (handleKeyDown returns true)
- State change callbacks fire on mode switch
- Reset clears state
- Disabled mode passes all keys through

### Task 9: Write Unit Tests - Vim Commands
**File:** `tests/unit/services/vim-commands.test.ts`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** Task 2

Test each vim command with a mock textarea:
- h/l: cursor moves left/right, respects bounds
- j/k: cursor moves down/up lines
- w/b: word motion forward/backward
- 0/$: line start/end
- gg/G: document start/end
- dd: deletes line, stores in register
- yy: copies line to register without deleting
- p/P: pastes register after/before cursor
- x: deletes character at cursor
- cc/cw: delete and enter insert mode
- Numeric prefix: 3dd deletes 3 lines, 5j moves 5 lines down
- Operator-pending: d + motion (dw, d$, d0)

### Task 10: Write Unit Tests - Hook and Integration
**File:** `tests/unit/hooks/useVimMode.test.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** Task 3

Test the React hook:
- Hook reads vim mode from settings store
- toggleVim() updates settings
- handleKeyDown delegates to VimModeService
- Component unmount cleans up subscription

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 35-45 | 80%+ lines and branches |
| Integration Tests | 2 | Full vim editing flow in textarea |
| Mock Requirements | HTMLTextAreaElement, settings store, keyboard events |

### Key Test Scenarios
1. Vim mode disabled: all keys pass through unchanged
2. Insert mode: typing works normally, only Esc is intercepted
3. Command mode: all navigation keys work correctly
4. Mode switching: Esc -> command, i -> insert, repeated toggling
5. dd deletes the current line and stores in register
6. yy + p copies and pastes a line
7. Numeric prefix: 3j moves 3 lines down
8. Operator-pending: dw deletes a word
9. /vim command toggles mode and persists
10. Mode indicator shows correct mode
11. Enter in command mode does not send message
12. Enter in insert mode sends message normally

---

## BAS Quality Gates

| Phase | Gate | Pass Criteria |
|-------|------|---------------|
| 1 | Linting | ESLint + Prettier: 0 errors |
| 2 | Structure | All imports resolve, types valid |
| 3 | Build | TypeScript compilation: 0 errors |
| 4 | Testing | All tests pass (unit + integration) |
| 5 | Coverage | 80%+ lines and branches |
| 6 | Review | DRA approval |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 29:

- [ ] /vim command - Enter vim mode with alternating insert/command modes
- [ ] Insert mode - Type text normally
- [ ] Command mode - Navigate and issue vim-style commands
- [ ] Mode switching - Toggle between insert and command modes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Key conflicts with existing shortcuts | Medium | Medium | Vim mode only intercepts in command mode; insert mode is transparent |
| Textarea API limitations for cursor manipulation | Medium | Medium | Use selectionStart/selectionEnd API, test across browsers/Electron |
| Enter key conflict (send vs vim enter) | Medium | High | Clear rule: insert mode Enter = send, command mode Enter = motion |
| Undo/Redo not working with textarea | Medium | Low | Use document.execCommand('undo') or maintain own undo stack |
| Complex vim commands (visual mode, macros) out of scope | Low | Low | Document supported subset, defer advanced features |

---

## Notes

- This implementation targets a practical vim subset for the Claude chat input, not a full vim emulator. The scope is intentionally limited to the most commonly used commands.
- Visual mode (v, V, Ctrl+V) is explicitly out of scope for this WO. It can be added later as an enhancement.
- Macros (q, @) are out of scope.
- The key implementation challenge is textarea cursor manipulation. `HTMLTextAreaElement` provides `selectionStart`, `selectionEnd`, and `setSelectionRange()` which are sufficient for all planned motions.
- For line-based operations (j, k, dd, yy), the implementation needs to calculate line boundaries from the text content by finding newline characters.
- The `execCommand('insertText', ...)` API can be used for text insertion that integrates with the browser's undo stack, but it is deprecated. An alternative is maintaining a custom undo stack.
- Monaco editor's built-in vim mode (via `monaco-vim` package) is separate from this feature. This WO targets the chat input area only, not the code editor.
- The Enter key behavior is critical: In insert mode, Enter should send the message (existing behavior). In command mode, Enter should move the cursor down (vim behavior). This distinction must be clearly implemented and tested.
