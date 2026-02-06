# TRA Implementation Plan: Claude Box Gap Closure

**Plan Date:** 2026-01-31
**Planner:** TRA (Work Planner)
**Input:** JUNO Gap Analysis (23 gaps across 8 categories)
**Scale:** Large (4 stop points)
**Phases:** 4 phases, 28 tasks

---

## Phase Overview

| Phase | Focus | WO | Tasks | Gaps Covered |
|-------|-------|-----|-------|-------------|
| 1 | Store & Backend Foundations | WO-020 | T1-T7 | GAP-05,06,07,08,04,21,22 |
| 2 | File Mentions & Diff System | WO-021 | T8-T14 | GAP-09,10,11,12,13,16,17 |
| 3 | Slash Commands & Context Management | WO-022 | T15-T21 | GAP-01,02,03,18,23,14,15 |
| 4 | Integration, Polish & Deferred Features | WO-023 | T22-T28 | GAP-19,20 + integration testing + unit tests |

---

## STOP POINT 1: Requirements Confirmed
> Confirm gap priorities and scope before implementation begins.

---

## Phase 1: Store & Backend Foundations (WO-020)

Foundation work — state management fixes, new permission mode, model selection, and abort/cancel infrastructure.

### T1: `activeToolCalls` Map in Store (GAP-05)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Add `activeToolCalls: Map<string, { toolName: string; toolInput: Record<string, unknown>; status: 'running' | 'complete' | 'error' }>` to state, update `tool_use` case to add entry, update `tool_result` case to mark complete
- `tests/renderer/stores/useClaudeStore.test.ts` — Add assertions for activeToolCalls lifecycle

**Acceptance Criteria:**
- [ ] `activeToolCalls` Map exists in store state
- [ ] Populated on `tool_use` events, updated on `tool_result` events
- [ ] Cleared on `clearMessages()` and `reset()`
- [ ] Tests pass

### T2: `historyIndex` Moved to Store (GAP-06)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Add `historyIndex: number` state field, add `setHistoryIndex` action
- `src/renderer/components/ide/claude/ClaudeInputArea.tsx` — Remove local `useState(-1)` for historyIndex, accept `historyIndex` and `onHistoryIndexChange` props, use store value
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Pass `historyIndex` and `onHistoryIndexChange` from store to ClaudeInputArea
- `tests/renderer/stores/useClaudeStore.test.ts` — Test historyIndex state
- `tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx` — Update tests for new props

**Acceptance Criteria:**
- [ ] `historyIndex` removed from ClaudeInputArea local state
- [ ] Store manages historyIndex globally
- [ ] Up/Down navigation still works
- [ ] Tests pass

### T3: `selectedModel` State + IPC (GAP-07, GAP-21)
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/main/ipc/channels.ts` — Add `ClaudeModelId` type (`'sonnet' | 'opus' | 'haiku'`), update `ClaudeQueryResponse` or add to `claude:query` signature
- `src/renderer/stores/useClaudeStore.ts` — Add `selectedModel: ClaudeModelId` state, `setModel` action, pass model in `sendMessage`
- `src/main/services/claude-container.service.ts` — Accept model parameter in `query()`, pass to container HTTP request
- `src/main/index.ts` — Update `claude:query` IPC handler to forward model
- `tests/renderer/stores/useClaudeStore.test.ts` — Test model selection

**Acceptance Criteria:**
- [ ] Model stored in Zustand state
- [ ] Model passed through IPC to container query
- [ ] Default model is `'sonnet'`
- [ ] Tests pass

### T4: `extendedThinkingEnabled` Toggle (GAP-08)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Add `extendedThinkingEnabled: boolean` state, `toggleExtendedThinking` action
- `src/main/services/claude-container.service.ts` — Pass thinking toggle in query body
- `tests/renderer/stores/useClaudeStore.test.ts` — Test toggle

**Acceptance Criteria:**
- [ ] Boolean toggle in store (default: `true`)
- [ ] Passed to container query request
- [ ] Tests pass

### T5: `acceptEdits` Permission Mode (GAP-04)
**Complexity:** 3 (Low-Medium)
**Files Modified:**
- `src/main/ipc/channels.ts` — Update `ClaudePermissionRequest` if needed for mode awareness
- `src/renderer/stores/useClaudeStore.ts` — Change `permissionMode` type to `'normal' | 'plan' | 'acceptEdits' | 'auto'`, update permission listener logic: in `acceptEdits` mode, auto-approve Read/Edit/Write/Glob but prompt for Bash
- `src/renderer/components/ide/claude/ClaudeContextBar.tsx` — Add 4th mode button `acceptEdits` with label "Accept Edits"
- `tests/renderer/stores/useClaudeStore.test.ts` — Test acceptEdits auto-approve logic

**Acceptance Criteria:**
- [ ] 4 permission modes: normal, plan, acceptEdits, auto
- [ ] `acceptEdits` auto-approves file operations, prompts for Bash
- [ ] Context bar shows 4 mode buttons
- [ ] Tests pass

### T6: Abort/Cancel IPC Channel (GAP-22)
**Complexity:** 5 (Medium)
**Files Modified:**
- `src/main/ipc/channels.ts` — Add `'claude:abort': () => void` channel
- `src/main/services/claude-container.service.ts` — Add `abort()` method that destroys the active HTTP request, add `activeRequest` ref to track in-progress query
- `src/main/index.ts` — Add `claude:abort` IPC handler
- `src/renderer/stores/useClaudeStore.ts` — Add `abortQuery` action that calls `ipc.invoke('claude:abort')` and resets loading state
- `tests/main/services/claude-container.service.test.ts` — Test abort behavior

**Acceptance Criteria:**
- [ ] `claude:abort` IPC channel defined and handled
- [ ] Active HTTP request tracked and abortable
- [ ] Store action resets loading state on abort
- [ ] Tests pass

### T7: Interrupt/Cancel UI Button (GAP-16)
**Complexity:** 3 (Low-Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Add stop/cancel button visible when `loading === true`, calls `abortQuery` from store
- `src/renderer/components/ide/claude/ClaudeInputArea.tsx` — When `loading` is true and `onAbort` prop exists, show stop button instead of send button
- `tests/renderer/components/ide/claude/ClaudePanel.test.tsx` — Test cancel button rendering and click

**Acceptance Criteria:**
- [ ] Stop button appears during streaming
- [ ] Click calls `abortQuery` store action
- [ ] Button disappears when loading ends
- [ ] Tests pass

**Phase 1 Dependencies:**
```
T1 ──┐
T2 ──┤
T3 ──┤── All independent, can be parallel
T4 ──┤
T5 ──┘
T6 ──→ T7 (abort IPC needed before UI button)
```

---

## STOP POINT 2: Design Approved
> Phase 1 foundations verified before building on them.

---

## Phase 2: File Mentions & Diff System (WO-021)

File search infrastructure, @-mention wiring, inline diffs, and message actions.

### T8: File Search IPC Handler (GAP-11)
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/main/ipc/channels.ts` — Add `'claude:search-files': (projectPath: string, query: string) => string[]` channel
- `src/main/index.ts` — Implement handler using `fs:read-directory` recursive walk with fuzzy matching (reuse existing file tree logic)
- Tests for the IPC handler

**Acceptance Criteria:**
- [ ] IPC channel returns file paths matching fuzzy query
- [ ] Limited to 20 results, sorted by relevance
- [ ] Respects .gitignore
- [ ] Tests pass

### T9: Wire Up `onFileMention` in ClaudePanel (GAP-09)
**Complexity:** 3 (Low-Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Add `handleFileMention` callback that calls `ipc.invoke('claude:search-files', projectPath, query)`, pass as `onFileMention` prop to ClaudeInputArea

**Acceptance Criteria:**
- [ ] `onFileMention` prop passed from ClaudePanel to ClaudeInputArea
- [ ] Typing `@` triggers file search via IPC
- [ ] Results appear in mention popup
- [ ] Selecting a file inserts `@filename` into input

### T10: Line Range @-mention Support (GAP-10)
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeInputArea.tsx` — Update `@` regex to capture `@file#L5-L10` pattern
- `src/renderer/stores/useClaudeStore.ts` — In `sendMessage`, parse `@file#Lstart-Lend` references, read file content via IPC, inject as context before the prompt

**Acceptance Criteria:**
- [ ] `@file#L5-L10` syntax parsed correctly
- [ ] File content for specified lines fetched via IPC and prepended to prompt
- [ ] Graceful fallback if file not found

### T11: `ClaudeDiff` Component (GAP-12)
**Complexity:** 7 (High)
**Files New:**
- `src/renderer/components/ide/claude/ClaudeDiff.tsx` — Unified diff renderer with syntax highlighting, line numbers, added/removed highlighting
**Files Modified:**
- `package.json` — Add `diff` npm package for generating unified diffs
- `src/renderer/components/ide/claude/ClaudeToolCall.tsx` — For Edit tool results, render ClaudeDiff instead of raw CodeBlock when diff data available

**Acceptance Criteria:**
- [ ] Renders unified diff with green (added) / red (removed) line highlighting
- [ ] Syntax highlighting within diff hunks
- [ ] Scrollable for large diffs
- [ ] Collapsible unchanged sections

### T12: Accept/Reject Diff Hunks (GAP-13)
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeDiff.tsx` — Add Accept/Reject buttons per hunk, callback to parent
- `src/renderer/components/ide/claude/ClaudeToolCall.tsx` — Handle accept/reject callbacks, send approval via permission IPC

**Acceptance Criteria:**
- [ ] Each diff hunk has Accept/Reject buttons
- [ ] Clicking Accept applies the change
- [ ] Clicking Reject skips the hunk
- [ ] Visual feedback after action (greyed out with status)

### T13: Message Retry Button (GAP-17)
**Complexity:** 3 (Low-Medium)
**Files Modified:**
- `src/renderer/stores/useClaudeStore.ts` — Add `retryLastMessage` action: removes last assistant message, resends last user message
- `src/renderer/components/ide/claude/ClaudeMessage.tsx` — Add retry icon button on last assistant message (visible on hover when not streaming)
- `tests/renderer/stores/useClaudeStore.test.ts` — Test retry action

**Acceptance Criteria:**
- [ ] Retry button visible on hover of last assistant message
- [ ] Clicking retry removes last response and resends
- [ ] Only visible when not currently loading
- [ ] Tests pass

### T14: Per-Message Token Count Display (GAP-18)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeMessage.tsx` — For assistant messages with `usageInputTokens`/`usageOutputTokens`, render small token badge on hover

**Acceptance Criteria:**
- [ ] Token count badge shows on hover for assistant messages
- [ ] Format: "↑123 ↓456 tokens"
- [ ] Only renders when usage data present

**Phase 2 Dependencies:**
```
T8 ──→ T9 (IPC handler needed before wiring)
T9 ──→ T10 (basic mention needed before line ranges)
T11 ──→ T12 (diff component needed before accept/reject)
T13 ─── independent
T14 ─── independent
```

**Parallelizable:** [T8, T11, T13, T14] can start simultaneously

---

## STOP POINT 3: Plan Approved
> Phase 2 file/diff system verified before context management.

---

## Phase 3: Slash Commands & Context Management (WO-022)

New slash commands, context compaction, keyboard shortcuts, and model selector UI.

### T15: `/compact` Slash Command (GAP-01)
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` — Add `/compact` to SLASH_COMMANDS array
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Handle `compact` in slash command handler: sends a summarization request to Claude, replaces conversation with summary
- `src/renderer/stores/useClaudeStore.ts` — Add `compactConversation` action
- `src/main/services/claude-container.service.ts` — New method or query variant for compaction

**Acceptance Criteria:**
- [ ] `/compact` appears in slash menu
- [ ] Selecting it triggers context compaction
- [ ] Messages replaced with a summary system message + compacted context
- [ ] Token usage / context percent reduced after compaction

### T16: `/model` Slash Command + Model Selector UI (GAP-02)
**Complexity:** 4 (Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` — Add `/model` to SLASH_COMMANDS
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Handle `model` slash command: show model picker overlay or cycle models
- `src/renderer/components/ide/claude/ClaudeContextBar.tsx` — Display current model name next to context percent (e.g., "Sonnet 32%")

**Acceptance Criteria:**
- [ ] `/model` appears in slash menu
- [ ] Selecting it shows model picker or cycles Sonnet→Opus→Haiku
- [ ] Current model displayed in context bar
- [ ] Model change persists in store

### T17: `/config` Slash Command (GAP-03)
**Complexity:** 3 (Low-Medium)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` — Add `/config` to SLASH_COMMANDS
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Handle `config` slash command: navigate to settings screen or open Claude settings panel

**Acceptance Criteria:**
- [ ] `/config` appears in slash menu
- [ ] Selecting it opens the settings screen (or Claude-specific settings)

### T18: Extended Thinking Toggle UI (GAP-08 UI part)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudeContextBar.tsx` — Add a toggle/icon button for extended thinking on/off, connected to store's `toggleExtendedThinking`

**Acceptance Criteria:**
- [ ] Brain icon toggle in context bar
- [ ] Visual state matches store value
- [ ] Clicking toggles `extendedThinkingEnabled` in store

### T19: Context Compaction Backend (GAP-23)
**Complexity:** 6 (Medium-High)
**Files Modified:**
- `src/main/services/claude-container.service.ts` — Add `compact()` method that sends conversation summary request to container
- `src/main/ipc/channels.ts` — Add `'claude:compact': () => ClaudeQueryResponse` channel
- `src/main/index.ts` — Add `claude:compact` IPC handler

**Acceptance Criteria:**
- [ ] Container receives compact request with current conversation
- [ ] Returns summarized context
- [ ] Frontend can replace messages with compacted version

### T20: `Cmd+N` / `Ctrl+N` Keyboard Shortcut (GAP-14)
**Complexity:** 1 (Low)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Add `Cmd+N` / `Ctrl+N` to keyboard handler, calls `newConversation()`

**Acceptance Criteria:**
- [ ] `Ctrl+N` / `Cmd+N` creates new conversation
- [ ] Prevents default browser behavior

### T21: `Cmd+Esc` / `Ctrl+Esc` Toggle Focus Shortcut (GAP-15)
**Complexity:** 2 (Low)
**Files Modified:**
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Add `Cmd+Esc` / `Ctrl+Esc` to keyboard handler for focus toggle

**Acceptance Criteria:**
- [ ] `Ctrl+Esc` / `Cmd+Esc` toggles focus between Claude input and editor
- [ ] Works when Claude panel is visible

**Phase 3 Dependencies:**
```
T15 ──→ T19 (frontend compact needs backend)
T16 ─── depends on T3 (model state from Phase 1)
T17 ─── independent
T18 ─── depends on T4 (thinking toggle state from Phase 1)
T20 ─── independent
T21 ─── independent
```

**Parallelizable:** [T16, T17, T18, T19, T20, T21] mostly independent

---

## Phase 4: Integration, Testing & Deferred Features (WO-023)

Unit tests for all new components, integration testing, and optional deferred features.

### T22: Unit Tests — ClaudeDiff
**Complexity:** 3
**Files New:** `tests/renderer/components/ide/claude/ClaudeDiff.test.tsx`

### T23: Unit Tests — File Search + @-mention Integration
**Complexity:** 3
**Files New:** `tests/main/ipc/claude-search-files.test.ts`
**Files Modified:** `tests/renderer/components/ide/claude/ClaudeInputArea.test.tsx`

### T24: Unit Tests — Abort/Cancel Flow
**Complexity:** 3
**Files Modified:** `tests/main/services/claude-container.service.test.ts`, `tests/renderer/stores/useClaudeStore.test.ts`

### T25: Unit Tests — New Slash Commands
**Complexity:** 2
**Files New:** `tests/renderer/components/ide/claude/ClaudeSlashCommands.test.tsx`

### T26: Integration Test — Full Panel with All New Features
**Complexity:** 4
**Files Modified:** `tests/renderer/components/ide/claude/ClaudePanel.test.tsx`

### T27: Checkpoints — Conversation State Snapshots (GAP-19)
**Complexity:** 9 (Very High)
**Status:** DEFERRED — Mark as follow-up WO
**Description:** Snapshot conversation state + file system state at key points. Allow rewinding to a previous checkpoint, restoring both messages and files.

### T28: Conversation Forking from Checkpoint (GAP-20)
**Complexity:** 8 (Very High)
**Status:** DEFERRED — Mark as follow-up WO (depends on T27)
**Description:** Create a new conversation branch from a checkpoint, keeping the parent conversation intact.

**Phase 4 Dependencies:**
```
T22 ─── depends on T11 (ClaudeDiff)
T23 ─── depends on T8, T9, T10
T24 ─── depends on T6, T7
T25 ─── depends on T15, T16, T17
T26 ─── depends on all previous
T27 ─── independent (deferred)
T28 ─── depends on T27 (deferred)
```

**Parallelizable:** [T22, T23, T24, T25] can run in parallel

---

## STOP POINT 4: Final Review
> All phases complete, full test pass, JUNO re-audit.

---

## Summary

```json
{
  "tasks": [
    { "id": "T1", "description": "activeToolCalls Map in store", "dependencies": [], "complexity": 2, "phase": 1 },
    { "id": "T2", "description": "historyIndex moved to store", "dependencies": [], "complexity": 2, "phase": 1 },
    { "id": "T3", "description": "selectedModel state + IPC", "dependencies": [], "complexity": 4, "phase": 1 },
    { "id": "T4", "description": "extendedThinkingEnabled toggle", "dependencies": [], "complexity": 2, "phase": 1 },
    { "id": "T5", "description": "acceptEdits permission mode", "dependencies": [], "complexity": 3, "phase": 1 },
    { "id": "T6", "description": "Abort/Cancel IPC channel", "dependencies": [], "complexity": 5, "phase": 1 },
    { "id": "T7", "description": "Interrupt/Cancel UI button", "dependencies": ["T6"], "complexity": 3, "phase": 1 },
    { "id": "T8", "description": "File search IPC handler", "dependencies": [], "complexity": 4, "phase": 2 },
    { "id": "T9", "description": "Wire up onFileMention", "dependencies": ["T8"], "complexity": 3, "phase": 2 },
    { "id": "T10", "description": "Line range @-mention support", "dependencies": ["T9"], "complexity": 4, "phase": 2 },
    { "id": "T11", "description": "ClaudeDiff component", "dependencies": [], "complexity": 7, "phase": 2 },
    { "id": "T12", "description": "Accept/Reject diff hunks", "dependencies": ["T11"], "complexity": 6, "phase": 2 },
    { "id": "T13", "description": "Message retry button", "dependencies": [], "complexity": 3, "phase": 2 },
    { "id": "T14", "description": "Per-message token count display", "dependencies": [], "complexity": 2, "phase": 2 },
    { "id": "T15", "description": "/compact slash command", "dependencies": ["T19"], "complexity": 6, "phase": 3 },
    { "id": "T16", "description": "/model slash command + UI", "dependencies": ["T3"], "complexity": 4, "phase": 3 },
    { "id": "T17", "description": "/config slash command", "dependencies": [], "complexity": 3, "phase": 3 },
    { "id": "T18", "description": "Extended thinking toggle UI", "dependencies": ["T4"], "complexity": 2, "phase": 3 },
    { "id": "T19", "description": "Context compaction backend", "dependencies": [], "complexity": 6, "phase": 3 },
    { "id": "T20", "description": "Cmd+N keyboard shortcut", "dependencies": [], "complexity": 1, "phase": 3 },
    { "id": "T21", "description": "Cmd+Esc toggle focus shortcut", "dependencies": [], "complexity": 2, "phase": 3 },
    { "id": "T22", "description": "Unit tests — ClaudeDiff", "dependencies": ["T11"], "complexity": 3, "phase": 4 },
    { "id": "T23", "description": "Unit tests — File search + @-mention", "dependencies": ["T8", "T9", "T10"], "complexity": 3, "phase": 4 },
    { "id": "T24", "description": "Unit tests — Abort/Cancel", "dependencies": ["T6", "T7"], "complexity": 3, "phase": 4 },
    { "id": "T25", "description": "Unit tests — Slash commands", "dependencies": ["T15", "T16", "T17"], "complexity": 2, "phase": 4 },
    { "id": "T26", "description": "Integration test — Full panel", "dependencies": ["T22", "T23", "T24", "T25"], "complexity": 4, "phase": 4 },
    { "id": "T27", "description": "Checkpoints (DEFERRED)", "dependencies": [], "complexity": 9, "phase": 4 },
    { "id": "T28", "description": "Conversation forking (DEFERRED)", "dependencies": ["T27"], "complexity": 8, "phase": 4 }
  ],
  "sequence": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,19,15,16,17,18,20,21,22,23,24,25,26],
  "parallelizable": [[1,2,3,4,5], [6], [7], [8,11,13,14], [9], [10,12], [19,16,17,18,20,21], [15], [22,23,24,25], [26]],
  "stopPoints": ["requirements", "design", "plan", "final"],
  "deferred": ["T27", "T28"]
}
```

### Effort Estimate by Phase
| Phase | Tasks | Complexity Sum |
|-------|-------|---------------|
| Phase 1 | T1-T7 | 21 |
| Phase 2 | T8-T14 | 29 |
| Phase 3 | T15-T21 | 24 |
| Phase 4 | T22-T26 | 15 |
| **Total (active)** | **26** | **89** |
| Deferred | T27-T28 | 17 |

### Work Order Mapping
| WO | Phase | Tasks | Description |
|----|-------|-------|-------------|
| WO-020 | 1 | T1-T7 | Store & Backend Foundations |
| WO-021 | 2 | T8-T14 | File Mentions & Diff System |
| WO-022 | 3 | T15-T21 | Slash Commands & Context Management |
| WO-023 | 4 | T22-T26 | Testing & Integration |
| WO-024 | (future) | T27-T28 | Checkpoints & Forking |
