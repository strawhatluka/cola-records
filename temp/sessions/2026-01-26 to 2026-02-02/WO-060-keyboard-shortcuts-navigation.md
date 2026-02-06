# WO-060: Keyboard Shortcuts & Navigation

**Status:** PENDING
**Complexity:** 4/10
**Priority:** MEDIUM
**Phase:** 3 - UI & UX Features
**Dependencies:** None
**Category:** Audit Checklist Section 3 - Keyboard Shortcuts
**Estimated Time:** 3-4 hours (including BAS gates)

---

## Objective

Implement a comprehensive keyboard shortcut system for Claude Code integration, including focus toggling between editor and Claude, new conversation shortcuts, @mention insertion from editor, extended thinking and permission mode toggles, and a configurable shortcut registry for user customization.

---

## Background

### Current State (What Exists)
- **useKeyboardShortcuts.ts**: Global keyboard shortcut hook for the application
- **useIDEKeyboardShortcuts.ts**: IDE-specific keyboard shortcuts
- **KeyboardShortcutsHelp.tsx**: Modal showing available shortcuts
- **ClaudeInputArea.tsx**: Handles Enter/Shift+Enter for send/newline, Up/Down for history navigation
- **useClaudeStore**: Has `toggleExtendedThinking()`, `setPermissionMode()`, `newConversation()` actions
- **Existing shortcuts**: Standard IDE shortcuts (Ctrl+S save, Ctrl+P file picker, etc.)

### What Is Missing (From Audit Checklist Section 3)
1. Ctrl+Esc - Toggle focus between editor and Claude's prompt box
2. Ctrl+Shift+Esc - Open new conversation in a new tab/context
3. Alt+K - Insert @-mention reference from current editor selection into prompt
4. Ctrl+N - New conversation (when Claude panel is focused; configurable)
5. Extended thinking toggle shortcut (Alt+T)
6. Permission mode toggle shortcut (Shift+Tab equivalent)
7. Configurable shortcut system (users can remap keys)

---

## Acceptance Criteria

- [ ] AC-1: Ctrl+Esc toggles focus between the active Monaco editor and the Claude input textarea
- [ ] AC-2: Ctrl+Shift+Esc starts a new conversation and focuses the Claude input
- [ ] AC-3: Alt+K inserts an @-mention for the current file and selection into the Claude prompt
- [ ] AC-4: Ctrl+N starts a new conversation when the Claude panel is focused (configurable via setting)
- [ ] AC-5: Alt+T toggles extended thinking on/off with visual feedback
- [ ] AC-6: Shift+Tab in Claude input cycles through permission modes (Normal -> Plan -> Auto-accept -> Normal)
- [ ] AC-7: A shortcut registry allows users to view and customize key bindings
- [ ] AC-8: KeyboardShortcutsHelp.tsx is updated to show all new Claude-specific shortcuts
- [ ] AC-9: All shortcuts have unit tests with >= 80% coverage
- [ ] AC-10: Shortcuts do not conflict with existing IDE or browser shortcuts

---

## Technical Design

### Architecture

The shortcut system uses a centralized registry pattern:

1. **Registry Layer** - A `ShortcutRegistry` that maps shortcut IDs to key combinations and handlers
2. **Listener Layer** - A global keyboard event listener that dispatches to registered handlers
3. **Configuration Layer** - User-customizable key bindings stored in settings

```
User presses Ctrl+Esc
  |
  v
Global keydown listener (useClaudeKeyboardShortcuts hook)
  |
  v
ShortcutRegistry.dispatch('claude:toggle-focus')
  |
  v
Handler: toggle focus between Monaco and ClaudeInputArea
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/hooks/useClaudeKeyboardShortcuts.ts` | Claude-specific keyboard shortcut hook | ~200 lines |
| `src/renderer/components/ide/claude/shortcut-registry.ts` | Shortcut registry with ID-to-keybinding mapping | ~150 lines |
| `src/renderer/hooks/__tests__/useClaudeKeyboardShortcuts.test.ts` | Shortcut hook tests | ~250 lines |
| `src/renderer/components/ide/claude/__tests__/shortcut-registry.test.ts` | Registry tests | ~120 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/hooks/useIDEKeyboardShortcuts.ts` | Integrate Claude shortcut hook; add Ctrl+Esc, Ctrl+Shift+Esc, Alt+K handlers |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Add Shift+Tab handler for permission mode cycling; expose focus method via ref |
| `src/renderer/components/ide/editor/MonacoEditor.tsx` | Expose focus/blur methods; emit current file+selection for Alt+K |
| `src/renderer/components/ide/KeyboardShortcutsHelp.tsx` | Add Claude shortcut section to the help modal |
| `src/renderer/stores/useClaudeStore.ts` | Add `claudeInputFocused: boolean`, `setClaudeInputFocused` for focus tracking |
| `src/renderer/stores/useSettingsStore.ts` | Add `enableNewConversationShortcut: boolean` (default: true) and `customShortcuts: Record<string, string>` |

### Interfaces

```typescript
// shortcut-registry.ts
interface ShortcutDefinition {
  id: string;                           // Unique shortcut ID
  label: string;                        // Human-readable name
  description: string;                  // What the shortcut does
  defaultKeybinding: string;            // Default key combo: "Ctrl+Esc"
  category: 'claude' | 'navigation' | 'editing';
  handler: () => void;                  // Action to execute
  enabled: boolean;                     // Can be disabled via settings
  when?: 'claudeFocused' | 'editorFocused' | 'always'; // Context condition
}

interface ShortcutRegistry {
  shortcuts: Map<string, ShortcutDefinition>;
  register: (shortcut: ShortcutDefinition) => void;
  unregister: (id: string) => void;
  dispatch: (keyCombo: string, context: ShortcutContext) => boolean;
  getAll: () => ShortcutDefinition[];
  updateKeybinding: (id: string, newKeybinding: string) => void;
}

interface ShortcutContext {
  claudeFocused: boolean;
  editorFocused: boolean;
  inputFocused: boolean;                // Any text input focused
}

function createShortcutRegistry(): ShortcutRegistry;
function keyEventToCombo(event: KeyboardEvent): string;   // "Ctrl+Shift+Esc"
function comboMatches(combo: string, event: KeyboardEvent): boolean;

// Shortcut IDs
const CLAUDE_SHORTCUTS = {
  TOGGLE_FOCUS: 'claude:toggle-focus',           // Ctrl+Esc
  NEW_CONVERSATION: 'claude:new-conversation',   // Ctrl+Shift+Esc / Ctrl+N
  INSERT_MENTION: 'claude:insert-mention',       // Alt+K
  TOGGLE_THINKING: 'claude:toggle-thinking',     // Alt+T
  CYCLE_PERMISSION: 'claude:cycle-permission',   // Shift+Tab (in Claude input)
} as const;
```

---

## Implementation Tasks

### T1: Shortcut Registry (45 min)
**File:** `src/renderer/components/ide/claude/shortcut-registry.ts`
- Implement `ShortcutRegistry` class/object with Map-based storage
- `register()`: add shortcut definition, validate no key conflict
- `dispatch()`: find matching shortcut for key combo + context, execute handler
- `keyEventToCombo()`: convert KeyboardEvent to normalized string ("Ctrl+Shift+Esc")
  - Normalize: Ctrl (not Control), Alt (not Option), Shift, Meta/Cmd
  - Platform-aware: Cmd on macOS maps to Ctrl on Windows/Linux
- `comboMatches()`: compare combo string to KeyboardEvent
- `updateKeybinding()`: change the key combo for a shortcut ID
- `getAll()`: return all shortcuts for help display

### T2: Shortcut Registry Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/shortcut-registry.test.ts`
- Test register/unregister
- Test dispatch with matching combo
- Test dispatch with context conditions (claudeFocused vs editorFocused)
- Test keyEventToCombo normalization
- Test comboMatches for various key combos
- Test updateKeybinding
- Test conflict detection

### T3: Claude Keyboard Shortcuts Hook (60 min)
**File:** `src/renderer/hooks/useClaudeKeyboardShortcuts.ts`
- Create hook that registers all Claude shortcuts on mount, cleans up on unmount
- **Ctrl+Esc** (`TOGGLE_FOCUS`):
  - If Claude input focused: focus Monaco editor
  - If Monaco editor focused: focus Claude input
  - Use refs or DOM query to find and focus elements
- **Ctrl+Shift+Esc** (`NEW_CONVERSATION`):
  - Call `useClaudeStore.getState().newConversation()`
  - Focus Claude input after clearing
- **Alt+K** (`INSERT_MENTION`):
  - Get current file path and selection from `useCodeEditorStore`
  - Format as `@filename#L5-L10` (or just `@filename` if no selection)
  - Insert at cursor position in Claude input textarea
- **Alt+T** (`TOGGLE_THINKING`):
  - Call `useClaudeStore.getState().toggleExtendedThinking()`
  - Show brief toast: "Extended thinking: ON/OFF"
- **Ctrl+N** (`NEW_CONVERSATION` alternative):
  - Only active when `enableNewConversationShortcut` setting is true
  - Only when Claude panel is focused
  - Same action as Ctrl+Shift+Esc
- Global `keydown` event listener with `useEffect`

### T4: Shift+Tab Permission Mode Cycling (20 min)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- Add `onKeyDown` handler for Shift+Tab within the Claude textarea
- Cycle through: 'normal' -> 'plan' -> 'acceptEdits' -> 'normal'
- Call `setPermissionMode()` from useClaudeStore
- Show brief toast or inline indicator of new mode
- Prevent default Tab behavior when Shift is held

### T5: Monaco Focus Methods (20 min)
**File:** `src/renderer/components/ide/editor/MonacoEditor.tsx`
- Expose `focus()` method via `useImperativeHandle` or store action
- Add `useCodeEditorStore` action: `focusEditor()` and `getSelection()` returning `{ filePath, text, startLine, endLine }`
- These are consumed by Ctrl+Esc and Alt+K shortcuts

### T6: Keyboard Shortcuts Help Update (30 min)
**File:** `src/renderer/components/ide/KeyboardShortcutsHelp.tsx`
- Add "Claude" section to the shortcuts help modal
- List all Claude shortcuts with their key combos and descriptions
- Pull data from shortcut registry `getAll()` filtered by category 'claude'
- Show customized keybindings if user has changed defaults

### T7: Settings for Configurable Shortcuts (20 min)
**File:** `src/renderer/stores/useSettingsStore.ts`
- Add `enableNewConversationShortcut: boolean` (default: true)
- Add `customShortcuts: Record<string, string>` (shortcut ID -> custom keybinding)
- On store initialization, apply custom keybindings to shortcut registry via `updateKeybinding()`

### T8: IDE Shortcuts Integration (20 min)
**File:** `src/renderer/hooks/useIDEKeyboardShortcuts.ts`
- Call `useClaudeKeyboardShortcuts()` within the IDE shortcuts hook
- Ensure Claude shortcuts don't conflict with existing IDE shortcuts
- Prevent double-handling: if Claude shortcut matches, stop propagation

### T9: Store Updates (15 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Add `claudeInputFocused: boolean` state (default: false)
- Add `setClaudeInputFocused(focused: boolean)` action
- ClaudeInputArea sets this on focus/blur events

### T10: Shortcut Hook Tests (45 min)
**File:** `src/renderer/hooks/__tests__/useClaudeKeyboardShortcuts.test.ts`
- Test Ctrl+Esc toggles focus (mock DOM focus)
- Test Ctrl+Shift+Esc calls newConversation
- Test Alt+K inserts @mention with correct format
- Test Alt+T toggles thinking with toast
- Test Ctrl+N respects enableNewConversationShortcut setting
- Test Shift+Tab cycles permission modes
- Test shortcuts are cleaned up on unmount

---

## Testing Requirements

### Unit Tests
- shortcut-registry: register, dispatch, keyEventToCombo, comboMatches, conflicts, updateKeybinding
- useClaudeKeyboardShortcuts: each shortcut handler, context conditions, cleanup
- ClaudeInputArea Shift+Tab: mode cycling, toast display
- KeyboardShortcutsHelp: Claude section renders with correct shortcuts

### Integration Tests
- Ctrl+Esc focus toggle: editor focused -> Ctrl+Esc -> Claude focused -> Ctrl+Esc -> editor focused
- Alt+K mention insertion: select text in editor -> Alt+K -> text appears in Claude input as @mention
- Permission mode cycle: Shift+Tab cycles through all 3 modes and wraps

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

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 3:

- [ ] `Ctrl+Esc` - Toggle focus between editor and Claude's prompt box (T3)
- [ ] `Ctrl+Shift+Esc` - Open a new conversation in a new editor tab (T3)
- [ ] `Alt+K` - Insert @-mention reference from current editor selection (T3, T5)
- [ ] `Ctrl+N` - Start a new conversation when Claude panel is focused (T3, T7)
- [ ] `Shift+Enter` - Add new line in prompt without sending (existing, verify in T4)
- [ ] `Alt+T` - Toggle extended thinking on/off (T3)
- [ ] `Shift+Tab` - Toggle between permission modes (T4)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shortcut conflicts with OS or browser shortcuts | Medium | Medium | Test on Windows platform; avoid common OS shortcuts (Ctrl+C, Ctrl+V, etc.); Ctrl+Esc may conflict on some systems |
| Focus management between Monaco and textarea unreliable | Medium | Medium | Use DOM APIs with fallback; test with multiple editor tabs open |
| Shift+Tab conflicts with normal Tab behavior in textarea | Low | Low | Only intercept when Shift is pressed; regular Tab remains default |
| Custom keybinding format parsing errors | Low | Low | Validate format on save; fall back to defaults on parse error |

---

## Notes

- Ctrl+Esc is the primary focus toggle and must work reliably across all IDE states (editor open, no editor, terminal focused, etc.). The handler should gracefully no-op if the target element is not available.
- Alt+K captures the current Monaco editor selection. If no text is selected, it inserts `@currentfile.ts` without line ranges. If text is selected, it inserts `@currentfile.ts#L5-L10` with the selection range.
- The shortcut registry is designed to be extensible. Future work orders (WO-046 hooks, WO-061 plan mode) can register additional shortcuts without modifying this code.
- On macOS, Cmd should be used instead of Ctrl for most shortcuts. The `keyEventToCombo()` function normalizes this.
- The `enableNewConversationShortcut` setting exists because Ctrl+N is a common "new file" shortcut in many editors. Users who prefer Ctrl+N for file creation can disable it for Claude.
- Shift+Tab for permission mode cycling only activates when the Claude input textarea is focused. In other contexts, Shift+Tab retains its default behavior (reverse tab navigation).
