# WO-057: Status Indicators & Notifications

**Status:** PENDING
**Complexity:** 5/10
**Priority:** MEDIUM
**Phase:** 3 - UI & UX Features
**Dependencies:** WO-046 (Hooks System - for custom spinner messages from hooks)
**Category:** Audit Checklist Section 24 - Status Indicators & Notifications
**Estimated Time:** 4-5 hours (including BAS gates)

---

## Objective

Implement a comprehensive status indicator and notification system for the Claude integration, including tab status dots, enhanced spinner with tips and custom messages, a notification subsystem for permission/idle/auth events, and a verbose mode toggle for debugging visibility.

---

## Background

### Current State (What Exists)
- **ClaudePanel.tsx**: Contains a `StatusIndicator` component showing three states:
  - Starting (yellow dot + "Starting...")
  - Thinking (pulsing dot + "Thinking...")
  - Ready (green dot + "Ready")
- **ClaudeSpinner.tsx**: Basic loading spinner (referenced in plan but lives within ClaudePanel)
- **useClaudeStore**: Tracks `loading`, `containerReady`, `containerStarting` states
- **IPC events**: `claude:status-changed` fires when container state changes
- **Sonner toasts**: Toast notification library already installed and configured via `Toaster.tsx`

### What Is Missing (From Audit Checklist Section 24)
1. Tab status dots (blue = permission pending, orange = Claude finished while tab was hidden)
2. Custom spinner messages from hooks (hooks set `statusMessage` during execution)
3. Spinner tips (helpful tips during loading, toggleable via `spinnerTipsEnabled` setting)
4. Permission notification (notify when Claude needs permission approval)
5. Idle notification (notify when Claude has been idle/waiting)
6. Auth success notification (notify on successful authentication)
7. Verbose mode toggle (Ctrl+O equivalent - see hook output, reasoning, detailed logs)
8. Debug mode display

---

## Acceptance Criteria

- [ ] AC-1: A colored dot appears on the Claude tab/panel header: blue when permission is pending, orange when Claude finished while the panel was not focused
- [ ] AC-2: The spinner displays rotating helpful tips during loading when `spinnerTipsEnabled` is true in settings
- [ ] AC-3: Hooks can set a custom `statusMessage` that replaces the default spinner text during hook execution
- [ ] AC-4: A toast notification appears when Claude needs permission approval and the Claude panel is not focused
- [ ] AC-5: A toast notification appears when Claude has been idle/waiting for user input for > 30 seconds
- [ ] AC-6: A toast notification appears on successful authentication/API key validation
- [ ] AC-7: A verbose mode toggle (button or keyboard shortcut) shows/hides detailed hook output and reasoning in the message stream
- [ ] AC-8: All status dots, tips, and notifications respect the application theme (dark/light)
- [ ] AC-9: All components have unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The status system has three subsystems:

1. **Tab Status Dots** - Visual indicators on the Claude panel header reflecting current state
2. **Enhanced Spinner** - Spinner with configurable tips and custom hook messages
3. **Notification System** - Toast-based notifications for out-of-focus events using Sonner

```
ClaudePanel Header
  +-- TabStatusDot (blue/orange/none)

ClaudePanel Body (during loading)
  +-- ClaudeSpinner
       +-- SpinnerTip (rotating tips text)
       +-- CustomStatusMessage (from hooks)

Notification System (via Sonner toasts)
  +-- PermissionNotification
  +-- IdleNotification
  +-- AuthNotification

Verbose Mode (toggle in panel toolbar)
  +-- VerboseLogStream (shows hook output, reasoning)
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/components/ide/claude/ClaudeTabStatusDot.tsx` | Colored dot indicator for Claude panel tab | ~60 lines |
| `src/renderer/components/ide/claude/ClaudeSpinnerTips.tsx` | Enhanced spinner with rotating tips and custom messages | ~120 lines |
| `src/renderer/components/ide/claude/ClaudeNotifications.tsx` | Notification manager for permission, idle, auth events | ~150 lines |
| `src/renderer/components/ide/claude/ClaudeVerboseToggle.tsx` | Toggle button for verbose mode with log display | ~80 lines |
| `src/renderer/components/ide/claude/spinner-tips-data.ts` | Collection of helpful tip strings for spinner rotation | ~60 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeTabStatusDot.test.tsx` | Tab status dot tests | ~80 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeSpinnerTips.test.tsx` | Spinner tips tests | ~100 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeNotifications.test.tsx` | Notification tests | ~120 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeVerboseToggle.test.tsx` | Verbose toggle tests | ~80 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Replace inline StatusIndicator with ClaudeTabStatusDot; add ClaudeSpinnerTips during loading; add ClaudeVerboseToggle to toolbar; integrate ClaudeNotifications |
| `src/renderer/stores/useClaudeStore.ts` | Add `spinnerMessage`, `verboseMode`, `panelFocused`, `tabStatus` state fields and actions |
| `src/renderer/stores/useSettingsStore.ts` | Add `spinnerTipsEnabled` setting (default: true) |
| `src/main/ipc/channels.ts` | Add `ClaudeNotificationType` type; extend `ClaudeStreamEvent` with `statusMessage` field |

### Interfaces

```typescript
// Tab status types
type TabStatus = 'none' | 'permission-pending' | 'finished-hidden';

// Spinner tip
interface SpinnerTip {
  text: string;
  category: 'shortcut' | 'feature' | 'workflow';
}

// Notification types
type ClaudeNotificationType =
  | 'permission_prompt'
  | 'idle_prompt'
  | 'auth_success'
  | 'elicitation_dialog';

interface ClaudeNotification {
  type: ClaudeNotificationType;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

// Store additions
interface ClaudeStatusExtensions {
  // Spinner
  spinnerMessage: string | null;       // Custom message from hooks
  setSpinnerMessage: (msg: string | null) => void;

  // Verbose mode
  verboseMode: boolean;
  verboseLogs: string[];
  toggleVerboseMode: () => void;
  addVerboseLog: (log: string) => void;

  // Panel focus tracking
  panelFocused: boolean;
  setPanelFocused: (focused: boolean) => void;

  // Tab status
  tabStatus: TabStatus;
  setTabStatus: (status: TabStatus) => void;
}
```

---

## Implementation Tasks

### T1: Tab Status Dot Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeTabStatusDot.tsx`
- Render a small colored circle (8px) in the Claude panel header
- Blue dot (`bg-blue-500`) when `tabStatus === 'permission-pending'`
- Orange dot (`bg-orange-500`) when `tabStatus === 'finished-hidden'`
- No dot (hidden) when `tabStatus === 'none'`
- Animate with subtle pulse for permission-pending state
- Read `tabStatus` from useClaudeStore

### T2: Tab Status Logic (30 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Add `panelFocused: boolean` (default: true) and `tabStatus: TabStatus` (default: 'none')
- When `claude:permission:request` event fires and `panelFocused === false`:
  - Set `tabStatus` to `'permission-pending'`
- When Claude finishes responding (`loading` goes from true to false) and `panelFocused === false`:
  - Set `tabStatus` to `'finished-hidden'`
- When panel gains focus (`setPanelFocused(true)`):
  - Reset `tabStatus` to `'none'`

### T3: Spinner Tips Data (15 min)
**File:** `src/renderer/components/ide/claude/spinner-tips-data.ts`
- Array of 20-30 helpful tips organized by category:
  - Shortcuts: "Press Ctrl+Esc to toggle focus between editor and Claude"
  - Features: "Use @file#5-10 to reference specific line ranges"
  - Workflow: "Claude creates checkpoints before each change - you can rewind anytime"
- Export typed array of `SpinnerTip` objects

### T4: Enhanced Spinner Component (45 min)
**File:** `src/renderer/components/ide/claude/ClaudeSpinnerTips.tsx`
- Animated spinner icon (using existing spinner or lucide-react `Loader2`)
- Primary text: `spinnerMessage` from store (if set by hook) OR default "Thinking..."
- Secondary text: rotating tip from spinner-tips-data (changes every 5 seconds)
- Tips only shown when `spinnerTipsEnabled` setting is true
- Smooth fade transition between tips
- Compact design that fits within the Claude panel loading area

### T5: Notification Manager (60 min)
**File:** `src/renderer/components/ide/claude/ClaudeNotifications.tsx`
- Hook-based component (`useClaudeNotifications`) that subscribes to store events
- Permission notification: when `pendingPermissions` array gets a new item and panel is not focused
  - Sonner toast with "Claude needs permission" message and "Go to Claude" action button
- Idle notification: when Claude has been idle (not loading, no recent messages) for 30+ seconds
  - Sonner toast with "Claude is waiting for your input"
- Auth notification: on successful API key validation or OAuth flow
  - Sonner toast with "Successfully authenticated"
- Each notification respects `panelFocused` - only fires when panel is not in view
- Configurable notification types (future: per-type enable/disable in settings)

### T6: Verbose Mode Toggle (45 min)
**File:** `src/renderer/components/ide/claude/ClaudeVerboseToggle.tsx`
- Toggle button in the Claude panel toolbar (eye icon from lucide-react)
- When active, shows a collapsible log section below messages:
  - Hook execution logs (hook name, timing, output)
  - Reasoning/thinking summaries
  - Tool use details (input/output)
- Reads `verboseMode` and `verboseLogs` from useClaudeStore
- Toggle action: `toggleVerboseMode()`
- Logs displayed in a monospace font, scrollable container

### T7: Store Extensions (30 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Add all fields from `ClaudeStatusExtensions` interface
- Wire `spinnerMessage` to be set from `ClaudeStreamEvent.statusMessage` in stream handler
- Wire `verboseLogs` to capture hook_result and thinking events when verbose mode is on
- Add `addVerboseLog()` that appends timestamped log entries (max 500 entries, ring buffer)

### T8: Panel Integration (30 min)
**File:** `src/renderer/components/ide/claude/ClaudePanel.tsx`
- Replace inline `StatusIndicator` with `ClaudeTabStatusDot` in panel header
- Replace simple loading indicator with `ClaudeSpinnerTips` during loading state
- Add `ClaudeVerboseToggle` to panel toolbar (next to existing controls)
- Mount `ClaudeNotifications` as an effect-only component
- Track panel focus via `onFocus`/`onBlur` events calling `setPanelFocused()`

### T9: Settings Integration (15 min)
**File:** `src/renderer/stores/useSettingsStore.ts`
- Add `spinnerTipsEnabled: boolean` (default: true) to settings
- Persist to settings storage via IPC

### T10: Component Tests (60 min)
**Files:** Multiple test files
- ClaudeTabStatusDot: renders correct color for each status, hidden when 'none', pulse animation
- ClaudeSpinnerTips: shows tips when enabled, hides when disabled, rotates every 5s, shows custom message
- ClaudeNotifications: fires toast for permission when unfocused, fires idle toast after timeout, fires auth toast
- ClaudeVerboseToggle: toggles mode, shows/hides log section, displays log entries

---

## Testing Requirements

### Unit Tests
- ClaudeTabStatusDot: color mapping, visibility, animation class
- ClaudeSpinnerTips: tip rotation timing, custom message override, settings toggle
- ClaudeNotifications: toast triggers for each notification type, focus-aware behavior
- ClaudeVerboseToggle: toggle state, log rendering, max log cap
- Store extensions: state transitions for tabStatus, verbose mode, spinner message

### Integration Tests
- Permission event -> tab dot turns blue -> panel focus -> dot clears
- Loading complete while unfocused -> tab dot turns orange -> focus -> clears
- Hook sets statusMessage -> spinner shows custom message -> hook completes -> reverts

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

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 24:

- [ ] `Tab status dots` - Blue dot = permission pending; orange dot = Claude finished (T1, T2)
- [ ] `Spinner/loading indicator` - Shows when Claude is processing (T4, existing)
- [ ] `Custom spinner messages` - Hooks can set custom statusMessage during execution (T4, T7)
- [ ] `Spinner tips` - Helpful tips during loading, toggleable via spinnerTipsEnabled (T3, T4, T9)
- [ ] `Permission notification` - Notification when Claude needs permission approval (T5)
- [ ] `Idle notification` - Notification when Claude has been idle (T5)
- [ ] `Auth success notification` - Notification on successful authentication (T5)
- [ ] `Verbose mode (Ctrl+O)` - Toggle to see hook output, reasoning, and detailed logs (T6, T7)
- [ ] `Notification hooks` - Custom handlers for permission_prompt, idle_prompt, auth_success (T5)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Too many toast notifications annoy the user | Medium | Medium | Only fire toasts when panel is unfocused; add cooldown period (min 30s between same type) |
| Verbose log buffer grows unbounded | Medium | Medium | Ring buffer with 500 entry cap; oldest entries dropped |
| Panel focus detection unreliable in complex layouts | Low | Medium | Use document.hasFocus() as fallback; track visibility via IntersectionObserver |
| Spinner tip rotation causes layout shifts | Low | Low | Fixed-height container for tip text; fade transitions prevent jarring changes |

---

## Notes

- The tab status dot system mirrors VS Code's approach where a small indicator on the tab communicates state without requiring the user to have the panel open.
- Spinner tips should be educational and help users discover features. Rotate every 5 seconds with a smooth crossfade animation.
- The verbose mode toggle is a development/debugging aid. When hooks system (WO-046) is not yet implemented, verbose mode shows tool_use details and thinking content.
- Notification sounds are intentionally not included - this is a visual-only notification system using Sonner toasts.
- The idle notification timeout (30 seconds) should be configurable in a future iteration.
- Hook statusMessage integration requires WO-046. Until then, the `spinnerMessage` field will only show default text. The component is designed to work with or without hooks.
