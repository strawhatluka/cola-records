# WO-068: Onboarding Flow

**Status:** PLANNED
**Complexity:** 4/10
**Priority:** MEDIUM
**Phase:** 5 - Onboarding, Error Handling & CLI Parity
**Dependencies:** WO-047 (Slash Commands - Core Set)
**Category:** Audit Section 37 - Onboarding
**Estimated Time:** 4-5 hours
**Created:** 2026-02-01

---

## Objective

Implement a first-launch onboarding experience that guides new users through Cola Records' Claude Code features via an interactive checklist walkthrough. The onboarding should be dismissible, re-openable, and persisted through settings.

---

## Background

Cola Records currently has no onboarding flow for new users. When a user opens the Claude panel for the first time, they see a blank conversation with no guidance on available features, slash commands, @mentions, permissions, or keyboard shortcuts. The Claude Code VS Code extension provides a "Learn Claude Code" checklist on first launch with clickable "Show me" items that navigate users to relevant features. This work order replicates that experience within the Electron app context.

### Current State
- No onboarding component exists
- No `hideOnboarding` setting exists
- No walkthrough or guided tour functionality
- Users must discover features through trial and error or documentation

### Target State
- First-launch checklist appears in Claude panel on initial use
- Checklist items with "Show me" actions that navigate to relevant features
- Dismiss with X button to close the checklist
- `hideOnboarding` setting persisted to prevent re-display
- "Open Walkthrough" command to re-access onboarding at any time
- Setting toggle to re-enable onboarding after dismissal

---

## Acceptance Criteria

- [ ] AC-1: On first launch (no `hideOnboarding` setting or `hideOnboarding === false`), the onboarding checklist renders at the top of the Claude panel
- [ ] AC-2: Checklist displays 6-8 walkthrough items covering: sending a message, using slash commands, @mentioning files, using keyboard shortcuts, managing permissions, viewing conversation history, using extended thinking, and reviewing costs
- [ ] AC-3: Each checklist item has a "Show me" button that navigates to or highlights the relevant feature
- [ ] AC-4: Clicking X on the checklist dismisses it and sets `hideOnboarding = true` in settings
- [ ] AC-5: An "Open Walkthrough" action is available (via slash command `/walkthrough` and through the settings panel) to re-display the onboarding
- [ ] AC-6: Re-enabling onboarding (unchecking `hideOnboarding` in settings) causes the checklist to appear again on next Claude panel mount
- [ ] AC-7: Checklist items track completion state (checked/unchecked) persisted in local storage
- [ ] AC-8: Onboarding renders correctly in both light and dark themes
- [ ] AC-9: All new code has unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The onboarding system is a renderer-only feature with settings persistence through the existing settings store and IPC layer. It consists of a React component that conditionally renders based on a settings flag, with checklist state stored in localStorage for completion tracking.

```
Renderer Process:
  OnboardingChecklist.tsx (new)
    -> reads hideOnboarding from useSettingsStore
    -> reads completion state from localStorage
    -> renders checklist items with "Show me" actions
    -> dispatches navigation/highlight actions

  ClaudePanel.tsx (modified)
    -> conditionally renders OnboardingChecklist at top

  ClaudeSlashCommands (modified)
    -> adds /walkthrough command

  useSettingsStore (modified)
    -> adds hideOnboarding field
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/components/claude/OnboardingChecklist.tsx` | Main onboarding checklist component | ~250 lines |
| `src/renderer/components/claude/OnboardingChecklistItem.tsx` | Individual checklist item with "Show me" button | ~80 lines |
| `src/renderer/components/claude/__tests__/OnboardingChecklist.test.tsx` | Unit tests for onboarding checklist | ~200 lines |
| `src/renderer/components/claude/__tests__/OnboardingChecklistItem.test.tsx` | Unit tests for checklist item | ~100 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/claude/ClaudePanel.tsx` | Add conditional rendering of OnboardingChecklist at top of panel |
| `src/renderer/stores/useSettingsStore.ts` | Add `hideOnboarding: boolean` field to settings state and actions |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/walkthrough` slash command |
| `src/main/ipc/channels.ts` | Add `hideOnboarding` to settings channel types if not already present |

### Interfaces

```typescript
// Onboarding checklist item definition
interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  showMeAction: () => void;
  completed: boolean;
}

// Onboarding checklist props
interface OnboardingChecklistProps {
  onDismiss: () => void;
}

// Onboarding checklist item props
interface OnboardingChecklistItemProps {
  item: OnboardingItem;
  onShowMe: () => void;
  onToggleComplete: (id: string) => void;
}

// Settings store additions
interface SettingsState {
  // ... existing fields
  hideOnboarding: boolean;
  setHideOnboarding: (hide: boolean) => void;
}

// LocalStorage key for completion tracking
const ONBOARDING_COMPLETION_KEY = 'cola-records-onboarding-completion';
```

---

## Implementation Tasks

### Task 1: Add hideOnboarding to Settings Store
- **Type:** MODIFY
- **Files:** `src/renderer/stores/useSettingsStore.ts`, `src/main/ipc/channels.ts`
- **Details:** Add `hideOnboarding: boolean` field (default `false`) to the settings store. Add `setHideOnboarding` action that persists the value via the `settings:update` IPC channel. Ensure the field is loaded on app start via `settings:get`.
- **Test:** Verify setting is persisted and loaded correctly. Verify default is `false`.

### Task 2: Create OnboardingChecklistItem Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/OnboardingChecklistItem.tsx`
- **Details:** Create a presentational component that renders a single checklist item with: checkbox (checked/unchecked), title text, description text, and a "Show me" button (styled as a link or small button). The checkbox toggles completion. The "Show me" button calls the provided action callback. Style with Tailwind CSS, matching the Claude panel aesthetic.
- **Test:** Renders title, description, checkbox state. "Show me" calls callback. Checkbox toggle calls onToggleComplete.

### Task 3: Create OnboardingChecklist Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/OnboardingChecklist.tsx`
- **Details:** Create the main onboarding checklist container. Includes: a header ("Learn Cola Records") with an X dismiss button, a list of 7 OnboardingChecklistItem components, and a progress indicator (e.g., "3/7 completed"). Checklist items:
  1. "Send your first message" - Show me: focuses the input area
  2. "Try a slash command" - Show me: opens the slash command menu
  3. "Reference a file with @mention" - Show me: types "@" in input
  4. "Use keyboard shortcuts" - Show me: opens keyboard shortcuts help modal
  5. "Manage permissions" - Show me: navigates to permissions (if available) or shows tooltip
  6. "Browse conversation history" - Show me: opens conversation history dropdown
  7. "Toggle extended thinking" - Show me: toggles the extended thinking switch
  Completion state stored in localStorage under `cola-records-onboarding-completion` as a JSON object `{ [itemId]: boolean }`.
- **Test:** Renders all items. Dismiss button calls onDismiss. Progress indicator updates. Completion state persists.

### Task 4: Integrate OnboardingChecklist into ClaudePanel
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudePanel.tsx`
- **Details:** At the top of the Claude panel content area (above the message list), conditionally render `<OnboardingChecklist />` when `hideOnboarding === false` from the settings store. Pass `onDismiss` callback that calls `setHideOnboarding(true)`. The checklist should be rendered inside a bordered container with slight padding and a subtle background color to distinguish it from the conversation area.
- **Test:** OnboardingChecklist renders when hideOnboarding is false. Does not render when true. Dismiss callback updates setting.

### Task 5: Register /walkthrough Slash Command
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`
- **Details:** Add a `/walkthrough` slash command to the command registry. When invoked, it sets `hideOnboarding = false` in the settings store, causing the onboarding checklist to re-appear. Command description: "Open the onboarding walkthrough checklist". Also consider adding an "Open Walkthrough" option in the settings screen.
- **Test:** Command appears in slash command list. Executing it sets hideOnboarding to false.

### Task 6: Write Unit Tests
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/__tests__/OnboardingChecklist.test.tsx`, `src/renderer/components/claude/__tests__/OnboardingChecklistItem.test.tsx`
- **Details:** Comprehensive unit tests covering:
  - OnboardingChecklist renders all 7 items
  - Dismiss button calls onDismiss and hides the checklist
  - "Show me" buttons trigger appropriate actions
  - Completion checkbox toggles and persists to localStorage
  - Progress indicator reflects completion count
  - Component does not render when hideOnboarding is true
  - /walkthrough command re-enables the checklist
  - Dark/light theme rendering (snapshot or class verification)
- **Test:** All tests pass. Coverage >= 80% for new files.

---

## Testing Requirements

### Unit Tests
- OnboardingChecklist component rendering and interaction
- OnboardingChecklistItem component rendering and callbacks
- Settings store hideOnboarding field persistence
- localStorage completion state management
- /walkthrough slash command registration and execution

### Integration Tests
- Full flow: first launch shows checklist, dismiss hides it, /walkthrough re-shows it
- "Show me" actions navigate to correct features
- Settings persistence across component unmount/remount

### Edge Cases
- localStorage unavailable (graceful fallback to in-memory state)
- Settings store not yet loaded (loading state handling)
- Rapid dismiss/re-open cycles
- All items completed state

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

From `CLAUDE-CODE-EXTENSION-AUDIT.md` Section 37 - Onboarding:

- [ ] **Learn Claude Code checklist** - First-launch walkthrough with clickable "Show me" items
- [ ] **Dismiss with X** - Close onboarding checklist
- [ ] **hideOnboarding setting** - Permanently hide onboarding checklist
- [ ] **Open Walkthrough** - Command palette command for guided tour (implemented as /walkthrough)
- [ ] **Reopen onboarding** - Uncheck hideOnboarding in settings to show again

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| "Show me" actions break if target components change | Medium | Low | Use stable store actions and component IDs rather than DOM selectors |
| localStorage quota exceeded | Very Low | Low | Onboarding state is < 1KB; fallback to in-memory |
| Settings migration conflict with existing settings | Low | Medium | Add hideOnboarding with default false, non-breaking addition |
| Onboarding items become outdated as features evolve | Medium | Low | Keep item list in a single config array for easy updates |

---

## Notes

- The onboarding checklist is intentionally lightweight and non-intrusive. It sits at the top of the Claude panel rather than being a modal overlay.
- "Show me" actions should use the most stable available mechanism (store actions, focus management) rather than fragile DOM manipulation.
- The checklist items should be defined in a configuration array so they can be easily updated as new features are added in future work orders.
- This work order depends on WO-047 (Slash Commands - Core Set) because the /walkthrough command needs to integrate with the slash command registry.
- Consider making the checklist items contextual in the future (e.g., showing different items based on which features the user has already used), but for this work order, a static list is sufficient.
