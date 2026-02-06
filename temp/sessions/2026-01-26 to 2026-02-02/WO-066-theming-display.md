# WO-066: Theming & Display

**Status:** PENDING
**Complexity:** 4/10
**Priority:** LOW
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 36 - Theming & Display
**Dependencies:** None
**Estimated Time:** 4 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Implement the /theme command with an interactive theme picker, a syntax highlighting toggle, the /output-style command for configuring Claude's response formatting, and spinner tips configuration. This extends the existing basic light/dark/system theme support into a complete theming system.

---

## Background

### Current State
- Basic theme support exists: light, dark, system modes via `settings.theme` in AppSettings
- `ThemeProvider` (`src/renderer/providers/ThemeProvider.tsx`) manages theme state
- `claude-theme.ts` exists with Tailwind CSS constants for Claude-specific theming
- `SettingsForm.tsx` has a theme selector dropdown (light/dark/system)
- Monaco editor used for code editing with built-in theme support
- No `/theme` slash command
- No interactive theme picker
- No syntax highlighting toggle
- No `/output-style` command
- No spinner tips configuration (spinnerTipsEnabled setting)

### Target State
- `/theme` slash command opens an interactive theme picker with preview
- Syntax highlighting toggle (on/off) for Claude's code output
- `/output-style` slash command to configure Claude response formatting (verbose, concise, markdown, plain)
- Spinner tips (helpful tips shown during loading) with `spinnerTipsEnabled` setting
- App theme follows system theme changes reactively

---

## Acceptance Criteria

- [ ] AC-1: `/theme` command opens an interactive picker with available themes
- [ ] AC-2: Theme picker shows preview of each theme before applying
- [ ] AC-3: Syntax highlighting can be toggled on/off for Claude code output
- [ ] AC-4: `/output-style` command allows choosing response format (verbose/concise/markdown/plain)
- [ ] AC-5: Output style preference persisted and applied to Claude's system prompt
- [ ] AC-6: Spinner tips display helpful tips during loading when `spinnerTipsEnabled` is true
- [ ] AC-7: `spinnerTipsEnabled` setting persisted and configurable in settings UI
- [ ] AC-8: Monaco editor theme syncs with app theme selection
- [ ] AC-9: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
Theme System:
  /theme command -> ThemePicker component (modal/dropdown)
    -> Preview pane showing theme colors
    -> Apply: update settings.theme + ThemeProvider + Monaco editor theme
    -> Persist to settings

Output Style:
  /output-style command -> OutputStylePicker component
    -> Options: verbose, concise, markdown, plain
    -> Persist to settings
    -> Inject into Claude system prompt as formatting instruction

Spinner Tips:
  Loading indicator component -> Check spinnerTipsEnabled
    -> If enabled, show random tip from tips collection
    -> Rotate tips on interval (5 seconds)

Syntax Highlighting:
  Toggle setting -> claudeSyntaxHighlighting in AppSettings
    -> When off: render Claude code blocks as plain text (monospace, no colors)
    -> When on: render with syntax highlighting (default)
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/claude/ClaudeThemePicker.tsx` | Interactive theme picker with preview |
| `src/renderer/components/claude/ClaudeOutputStylePicker.tsx` | Output style selection component |
| `src/renderer/components/claude/ClaudeSpinnerTips.tsx` | Spinner tips display component |
| `src/renderer/data/spinner-tips.ts` | Collection of helpful tips for spinner display |
| `tests/unit/components/ClaudeThemePicker.test.tsx` | Theme picker tests |
| `tests/unit/components/ClaudeOutputStylePicker.test.tsx` | Output style tests |
| `tests/unit/components/ClaudeSpinnerTips.test.tsx` | Spinner tips tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claudeOutputStyle`, `claudeSyntaxHighlighting`, `spinnerTipsEnabled` to AppSettings |
| `src/main/index.ts` | Add settings persistence for new fields |
| `src/renderer/providers/ThemeProvider.tsx` | Extend to support additional theme variants, Monaco sync |
| `src/renderer/components/settings/SettingsForm.tsx` | Add syntax highlighting toggle, spinner tips toggle, output style selector |
| `src/renderer/stores/useSettingsStore.ts` | Add new setting fields |
| `src/renderer/components/claude/ClaudeMessage.tsx` (or equivalent) | Respect syntaxHighlighting setting for code blocks |

### Interfaces

```typescript
// Theme options
type AppTheme = 'light' | 'dark' | 'system';

// Extended theme with sub-variants (future)
interface ThemeConfig {
  id: string;
  name: string;
  base: 'light' | 'dark';
  colors: {
    background: string;
    foreground: string;
    accent: string;
    border: string;
    codeBackground: string;
  };
  monacoTheme: string; // Monaco theme ID to apply
}

// Output style options
type ClaudeOutputStyle = 'verbose' | 'concise' | 'markdown' | 'plain';

// New AppSettings fields
interface AppSettings {
  // ... existing
  claudeOutputStyle?: ClaudeOutputStyle;      // default 'markdown'
  claudeSyntaxHighlighting?: boolean;          // default true
  spinnerTipsEnabled?: boolean;                // default true
}

// Spinner tip
interface SpinnerTip {
  text: string;
  category: 'shortcut' | 'feature' | 'tip' | 'fun';
}

// Theme picker props
interface ThemePickerProps {
  currentTheme: AppTheme;
  onSelect: (theme: AppTheme) => void;
  onClose: () => void;
}

// Output style picker props
interface OutputStylePickerProps {
  currentStyle: ClaudeOutputStyle;
  onSelect: (style: ClaudeOutputStyle) => void;
  onClose: () => void;
}
```

---

## Implementation Tasks

### Task 1: Create Spinner Tips Data
**File:** `src/renderer/data/spinner-tips.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Create a collection of helpful tips:
- 30-50 tips covering shortcuts, features, and best practices
- Categories: shortcut tips, feature discovery, productivity tips
- Examples: "Press Shift+Enter for multi-line input", "Use @file.ts to reference files", "Try /compact to free up context space"
- Export as typed array of `SpinnerTip` objects

### Task 2: Create ClaudeSpinnerTips Component
**File:** `src/renderer/components/claude/ClaudeSpinnerTips.tsx`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 1

Implement spinner tips display:
- Show a random tip from the collection
- Rotate to a new tip every 5 seconds (configurable)
- Fade transition between tips
- Only visible when `spinnerTipsEnabled` is true in settings
- Display below or alongside the loading spinner
- Use subtle styling (muted text color, small font)

### Task 3: Create ClaudeThemePicker Component
**File:** `src/renderer/components/claude/ClaudeThemePicker.tsx`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** None

Implement interactive theme picker:
- Modal or dropdown with theme options (Light, Dark, System)
- Preview pane showing color swatches for each theme
- Click to select, immediate preview (apply temporarily)
- Confirm/Apply button to persist selection
- Cancel to revert to previous theme
- Keyboard navigation (arrow keys, Enter to select)
- Integrate with existing ThemeProvider for applying themes

### Task 4: Create ClaudeOutputStylePicker Component
**File:** `src/renderer/components/claude/ClaudeOutputStylePicker.tsx`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** None

Implement output style selection:
- Options: Verbose (detailed explanations), Concise (brief responses), Markdown (rich formatting), Plain (minimal formatting)
- Description for each option explaining the difference
- Current selection highlighted
- Persist to `claudeOutputStyle` setting
- The selected style is injected into Claude's system prompt as a formatting instruction

### Task 5: Implement Syntax Highlighting Toggle
**File:** `src/renderer/components/claude/ClaudeMessage.tsx` (or code block renderer)
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** None

Add syntax highlighting toggle:
- Read `claudeSyntaxHighlighting` from settings store
- When enabled (default): render code blocks with syntax highlighting (existing behavior)
- When disabled: render code blocks as plain monospace text (no color, no language detection)
- Toggle accessible via settings UI and keyboard shortcut

### Task 6: Sync Monaco Editor Theme
**File:** `src/renderer/providers/ThemeProvider.tsx`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Ensure Monaco editor follows app theme:
- When theme changes, update Monaco editor theme via `monaco.editor.setTheme()`
- Light theme -> `'vs'` Monaco theme
- Dark theme -> `'vs-dark'` Monaco theme
- System theme -> follow OS preference and map accordingly
- Emit theme change event for any components that need to react

### Task 7: Register /theme and /output-style Slash Commands
**File:** Slash command registry (main process or renderer)
**Complexity:** Low
**Estimated Time:** 25 min
**Dependencies:** Tasks 3, 4

- `/theme`: Opens ClaudeThemePicker component
- `/output-style`: Opens ClaudeOutputStylePicker component
- Register both commands in the slash command registry with descriptions
- `/theme` description: "Choose a color theme for the interface"
- `/output-style` description: "Configure how Claude formats responses"

### Task 8: Update AppSettings and Settings UI
**Files:** `src/main/ipc/channels.ts`, `src/renderer/components/settings/SettingsForm.tsx`, `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 25 min
**Dependencies:** Tasks 1-7

- Add `claudeOutputStyle`, `claudeSyntaxHighlighting`, `spinnerTipsEnabled` to AppSettings
- Add persistence in `settings:update` handler
- Add to SettingsForm:
  - Syntax highlighting toggle (checkbox)
  - Spinner tips toggle (checkbox)
  - Output style dropdown (verbose/concise/markdown/plain)
- Group under "Display" or "Appearance" settings section

### Task 9: Inject Output Style into System Prompt
**File:** Claude system prompt construction (main process)
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** Task 8

- When building Claude's system prompt, append output style instruction based on setting:
  - verbose: "Provide detailed explanations with examples and context."
  - concise: "Be brief and to the point. Minimize explanation."
  - markdown: "Format responses using rich markdown with headers, lists, and code blocks."
  - plain: "Use minimal formatting. Avoid markdown syntax."

### Task 10: Write Unit Tests
**Files:** `tests/unit/components/ClaudeThemePicker.test.tsx`, `tests/unit/components/ClaudeOutputStylePicker.test.tsx`, `tests/unit/components/ClaudeSpinnerTips.test.tsx`
**Complexity:** Low
**Estimated Time:** 45 min
**Dependencies:** Tasks 1-9

Test coverage:
- ThemePicker: renders all options, selection callback, preview, keyboard navigation
- OutputStylePicker: renders all styles, selection callback, persists to settings
- SpinnerTips: renders a tip, rotates tips on interval, hidden when disabled
- Syntax highlighting: code blocks render with/without highlighting based on setting
- Monaco sync: theme change triggers Monaco theme update
- Settings persistence: new fields saved and loaded correctly

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 15-20 | 80%+ lines and branches |
| Integration Tests | 2 | Theme flow end-to-end, output style injection |
| Mock Requirements | ThemeProvider, Monaco editor API, settings store |

### Key Test Scenarios
1. Theme picker shows all options (light, dark, system)
2. Selecting a theme updates ThemeProvider and Monaco editor
3. Output style selection persists and loads correctly
4. Spinner tips rotate on interval when enabled
5. Spinner tips hidden when spinnerTipsEnabled is false
6. Syntax highlighting toggle affects code block rendering
7. System theme changes detected and applied
8. Output style injected into system prompt correctly

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

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 36:

- [ ] /theme command - Theme picker for syntax highlighting and colors
- [ ] Ctrl+T toggle - Toggle syntax highlighting on/off
- [ ] /output-style - Configure response formatting
- [ ] VS Code theme integration - Extension follows app's native theme settings
- [ ] Spinner tips - Configurable loading tips via spinnerTipsEnabled setting

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Theme preview causes flash of unstyled content | Low | Low | Apply theme to preview pane only, not global |
| Monaco theme sync causes editor flicker | Low | Low | Batch theme updates, use requestAnimationFrame |
| Spinner tips become stale/irrelevant | Low | Low | Review tips quarterly, keep them generic |
| Output style prompt injection conflicts with system prompt | Low | Medium | Append style instruction at end, clearly delimited |

---

## Notes

- This is one of the lower complexity work orders (4/10) since it primarily involves UI components and settings wiring, not complex backend logic.
- The existing `ThemeProvider` and `claude-theme.ts` provide a solid foundation. The main additions are the interactive picker components and new settings.
- Monaco editor themes are limited to built-in options (`vs`, `vs-dark`, `hc-black`, `hc-light`) unless custom themes are registered. For now, mapping to built-in themes is sufficient.
- The spinner tips feature is a nice UX touch that helps users discover features. The tips collection should be maintained as the application evolves.
- Output style is implemented via system prompt injection rather than response post-processing, which is simpler and more reliable.
- The syntax highlighting toggle affects Claude's code block rendering in the chat, not the Monaco editor's syntax highlighting (which is always on).
