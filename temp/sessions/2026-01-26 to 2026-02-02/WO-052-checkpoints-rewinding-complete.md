# WO-052: Checkpoints & Rewinding (Complete)

**Status:** PLANNED
**Complexity:** 5/10
**Priority:** HIGH
**Phase:** 2 - Advanced Systems
**Dependencies:** None (extends existing checkpoint infrastructure)
**Category:** Audit Section 8 - Checkpoints & Rewinding
**Estimated Time:** 6-8 hours
**Created:** 2026-02-01

---

## Objective

Complete the checkpoints and rewinding feature set by adding rewind-on-hover over conversation messages (with three rewind options), improved fork conversation UI, and proper checkpoint scope documentation. The existing checkpoint infrastructure (list, create, restore, delete, fork, branch switcher) is preserved and extended.

---

## Background

The checkpoint system was implemented in WO-024/WO-025 and includes: SQLite-backed checkpoint storage, file snapshots with zlib compression, checkpoint creation per user prompt, list/create/restore/delete operations, conversation forking from checkpoints, and a branch switcher UI. The missing features are user-facing rewind interactions that appear on hover over messages in the conversation.

### Current State (Implemented)
- `ClaudeCheckpoint` type with id, conversationId, messageId, label, checkpointType, messageIndex, createdAt
- `ClaudeFileSnapshot` type for file state capture
- IPC channels: `claude:checkpoints:list`, `claude:checkpoints:create`, `claude:checkpoints:restore`, `claude:checkpoints:delete`
- IPC channel: `claude:conversation:fork`
- `useClaudeStore` has: checkpoints, checkpointLoading, branches, currentBranchId
- Store actions: loadCheckpoints, createCheckpoint, restoreCheckpoint, deleteCheckpoint, forkFromCheckpoint, loadBranches, switchBranch
- Branch switcher component exists

### Missing Features (This WO)
- Rewind button on hover over any assistant message in conversation
- Three-option rewind menu: Fork Conversation, Rewind Code, Fork + Rewind Code
- Improved fork conversation UI showing branch lineage
- Visual checkpoint indicators on messages that have checkpoints
- Smooth transitions when rewinding (message truncation, code restoration)

---

## Acceptance Criteria

1. Hovering over any assistant message reveals a rewind button (clock/undo icon)
2. Clicking the rewind button shows a dropdown with three options:
   - "Fork conversation from here" - Creates new branch keeping all code changes
   - "Rewind code to here" - Restores file state to this point, keeps conversation
   - "Fork and rewind code" - Creates new branch AND restores file state
3. Messages with associated checkpoints show a subtle checkpoint indicator (dot or icon)
4. Fork conversation creates a new branch visible in the branch switcher
5. Rewind code restores files to the checkpoint state and shows which files were restored
6. Fork + rewind combines both operations atomically
7. Smooth visual transition: messages after the rewind point fade or are removed appropriately
8. Branch switcher updated to show lineage (parent conversation label)
9. Unit tests cover all three rewind options, edge cases, and UI interactions
10. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
Existing Infrastructure (preserved):
  CheckpointService (main) -- SQLite storage, file snapshots
  useClaudeStore (renderer) -- checkpoint/branch state
  ClaudeBranchSwitcher (renderer) -- branch list UI

New/Modified:
  ClaudeMessage.tsx -- Add rewind button on hover
  RewindMenu.tsx -- Three-option dropdown component
  CheckpointIndicator.tsx -- Visual indicator on checkpoint messages
  useClaudeStore.ts -- Add rewindToMessage action
  ClaudeBranchSwitcher.tsx -- Show branch lineage
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/claude/RewindMenu.tsx` | Dropdown menu with three rewind options |
| `src/renderer/components/claude/CheckpointIndicator.tsx` | Small icon/dot showing a message has an associated checkpoint |
| `tests/unit/components/claude/RewindMenu.test.tsx` | RewindMenu component tests |
| `tests/unit/components/claude/CheckpointIndicator.test.tsx` | CheckpointIndicator tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/claude/ClaudeMessage.tsx` | Add hover state, rewind button, checkpoint indicator |
| `src/renderer/components/claude/ClaudeBranchSwitcher.tsx` | Show parent branch label, lineage indicator |
| `src/renderer/stores/useClaudeStore.ts` | Add `rewindToMessage`, `forkAndRewind` actions |
| `src/main/ipc/channels.ts` | Add `claude:checkpoints:rewind-code` channel (restore + keep conversation) |
| `src/main/ipc/handlers.ts` | Register rewind-code handler |
| `src/main/services/checkpoint.service.ts` | Add `rewindCodeOnly` method (restore files without truncating conversation) |

### Interfaces

```typescript
// New types added to channels.ts

export interface RewindOption {
  type: 'fork' | 'rewind-code' | 'fork-and-rewind';
  label: string;
  description: string;
  icon: string;
}

export interface RewindResult {
  success: boolean;
  /** Files that were restored (for rewind-code and fork-and-rewind) */
  restoredFiles?: string[];
  /** New conversation created (for fork and fork-and-rewind) */
  newConversation?: ClaudeConversation;
  /** Message index to truncate conversation display to */
  truncateToIndex?: number;
}

// New IPC channel
// 'claude:checkpoints:rewind-code': (checkpointId: string) => RewindResult
// Restores file state to checkpoint without truncating conversation messages
```

---

## Implementation Tasks

### Task 1: Rewind Code IPC Channel and Service Method
- **Type:** FEATURE
- **Files:** `src/main/ipc/channels.ts`, `src/main/services/checkpoint.service.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add `claude:checkpoints:rewind-code` IPC channel. Implement `rewindCodeOnly(checkpointId)` in CheckpointService that restores file snapshots to disk without modifying the conversation message history. Return `RewindResult` with the list of restored files. This differs from `restore` which also truncates messages. Register the handler in handlers.ts.
- **Test:** Test file restoration without message truncation, verify files match snapshot state

### Task 2: Store Rewind Actions
- **Type:** FEATURE
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add three new actions mapped to the three rewind options. `forkFromMessage(messageId)`: finds the checkpoint associated with the message, calls `claude:conversation:fork`, updates branches state. `rewindCodeToMessage(messageId)`: finds checkpoint, calls `claude:checkpoints:rewind-code`, shows success notification with restored file list. `forkAndRewindFromMessage(messageId)`: calls fork first, then rewind-code on the original conversation, updates branches state. Add helper: `findCheckpointForMessage(messageId)` that finds the nearest checkpoint at or before the given message index.
- **Test:** Test each action with mocked IPC, test checkpoint lookup logic

### Task 3: CheckpointIndicator Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/CheckpointIndicator.tsx`
- **Details:** Small component rendering a subtle dot or checkpoint icon next to messages that have associated checkpoints. Accept `checkpoint: ClaudeCheckpoint | null` prop. When checkpoint exists: show a small blue dot or clock icon. Tooltip on hover shows checkpoint label and timestamp. Clicking the indicator scrolls to or highlights the checkpoint in the checkpoints panel.
- **Test:** `tests/unit/components/claude/CheckpointIndicator.test.tsx` - Render with/without checkpoint, tooltip content, click handler

### Task 4: RewindMenu Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/RewindMenu.tsx`
- **Details:** Dropdown menu component triggered by the rewind button. Three options: (1) "Fork conversation from here" with git-branch icon and description "Start a new branch keeping all code changes", (2) "Rewind code to here" with undo icon and description "Restore files to this point, keep conversation", (3) "Fork and rewind code" with git-merge icon and description "New branch with files restored to this point". Each option calls the corresponding store action. Menu positioned relative to the trigger button, closes on outside click. Disabled state when no checkpoint is available for the message.
- **Test:** `tests/unit/components/claude/RewindMenu.test.tsx` - Render all options, click handlers, disabled state, outside click close

### Task 5: ClaudeMessage Rewind Integration
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeMessage.tsx`
- **Details:** Add hover state tracking to each message. On hover over assistant messages, show a rewind button (clock/undo icon) in the top-right corner of the message. Clicking the button opens RewindMenu positioned below the button. Add CheckpointIndicator next to the message timestamp for messages with checkpoints. Use `checkpoints` from store to determine which messages have checkpoints. Only show rewind button on assistant messages (not user messages, system messages, or tool results).
- **Test:** Test hover reveals button, click opens menu, checkpoint indicator appears for correct messages

### Task 6: Branch Switcher Lineage Display
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeBranchSwitcher.tsx`
- **Details:** Enhance branch switcher to show parent conversation lineage. Each branch entry now shows: branch label, parent conversation title (if forked), creation timestamp, message count. Forked branches show a small "forked from: [parent]" subtitle. Visual tree structure with indentation or connecting lines for nested forks. Current branch highlighted with accent color.
- **Test:** Render with forked branches, lineage display, current branch highlighting

### Task 7: Rewind Visual Transitions
- **Type:** UI
- **Files:** `src/renderer/stores/useClaudeStore.ts`, `src/renderer/components/claude/ClaudeMessage.tsx`
- **Details:** When rewind-code is performed, add a visual notification showing "Restored X files to checkpoint state" with the file list. When fork is performed, show "Created branch: [label]" notification. When fork-and-rewind is performed, show both notifications sequentially. Messages do not disappear on rewind-code (conversation preserved). On fork, the UI switches to the new branch automatically.
- **Test:** Test notification display for each rewind type, branch auto-switch on fork

---

## Testing Requirements

- **Unit Tests:** CheckpointIndicator, RewindMenu, store actions (fork, rewind-code, fork-and-rewind)
- **Integration Tests:** Full rewind flow from hover to file restoration, fork + branch switch flow
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock CheckpointService for file operations, mock IPC for store actions, mock useClaudeStore for component tests
- **Edge Cases:** Message with no checkpoint (nearest checkpoint lookup), first message (no prior checkpoint), multiple rapid rewinds, rewind during active streaming, empty checkpoint (no file snapshots)

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for checkpoint integrity, UX flow correctness |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 8 (Checkpoints & Rewinding):

- [x] Automatic checkpoint creation (existing)
- [ ] Rewind button on hover over messages (3 options)
- [ ] Fork conversation from here
- [ ] Rewind code to here
- [ ] Fork conversation and rewind code
- [x] Checkpoint scope (existing - local to session)

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| File restoration conflicts with unsaved editor changes | MEDIUM | MEDIUM | Prompt user to save before rewind, or auto-save |
| Rewind during active streaming causes state corruption | HIGH | LOW | Disable rewind button while streaming is active |
| Nearest checkpoint lookup returns stale checkpoint | MEDIUM | LOW | Always use the most recent checkpoint at or before message index |
| Branch proliferation (too many forks) | LOW | LOW | Show fork count, allow bulk delete of branches |

---

## Notes

- This work order has NO external dependencies since it extends the existing checkpoint infrastructure from WO-024/WO-025.
- The existing IPC channels (`claude:checkpoints:list/create/restore/delete`, `claude:conversation:fork`) remain unchanged.
- The new `claude:checkpoints:rewind-code` channel provides a "restore files only" mode distinct from the existing `claude:checkpoints:restore` which also truncates conversation state.
- The "Esc Esc" CLI shortcut for quick rewind is not applicable to our Electron GUI. The hover-based rewind menu provides the equivalent UX.
- Checkpoint indicators on messages provide visual feedback about which points in the conversation have file state snapshots available.
