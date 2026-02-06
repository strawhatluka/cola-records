# PHASE 2 — File Mentions & Diff System Complete

**Work Order:** WO-021
**Completed:** 2026-01-31
**Status:** ALL 7 TASKS COMPLETE

---

## Executive Summary

Implemented 7 features covering file mention infrastructure (@-mentions with IPC-backed fuzzy file search), line range support (@file#L5-L10), inline diff display (ClaudeDiff component with accept/reject per hunk), message retry, and per-message token counts. Closes GAP-09, 10, 11, 12, 13, 17, 18 from the JUNO gap analysis. All changes compile cleanly with zero TypeScript errors.

---

## Changes Applied

### T8: File Search IPC Handler (GAP-11)
- Added `'claude:search-files': (projectPath: string, query: string) => string[]` to `IpcChannels`
- Implemented recursive file walk handler in `index.ts` with:
  - Fuzzy character-by-character matching (all query chars in order)
  - Bonus scoring for exact filename substring matches and shorter paths
  - Respects skip dirs (node_modules, .git, dist, .vite, out, coverage)
  - Max depth of 8, returns top 20 results sorted by relevance score

### T9: Wire `onFileMention` in ClaudePanel (GAP-09)
- Added `ipc` import to ClaudePanel
- Added `projectPath` store selector
- Created `handleFileMention` callback that invokes `claude:search-files` IPC
- Passed as `onFileMention` prop to ClaudeInputArea

### T10: Line Range @-mention Support (GAP-10)
- Updated `@` regex in ClaudeInputArea from `/@(\S*)$/` to `/@([^@\s]*(?:#L\d+(?:-L?\d+)?)?)$/`
- Strips `#L` suffix for file search queries (search still works on base filename)
- Updated `handleMentionSelect` replacement regex to match new pattern
- In `sendMessage` in store: scans for `@file#Lstart-Lend` patterns, resolves via `fs:read-file` IPC, extracts specified lines, prepends as context blocks
- Format: `--- @file#L5-L10 ---\n{lines}\n---`
- Graceful fallback with `[file not found]` on error

### T11: ClaudeDiff Component (GAP-12)
- Created new `ClaudeDiff.tsx` component using `diff` npm package (`Diff.structuredPatch`)
- Features: line numbers on both sides, green/red bg for additions/removals, collapsible
- Stats display: `+N` additions, `-N` removals in header
- Scrollable container with `max-h-80`
- Claude Orange accent on header
- Added `diff` to package.json dependencies, `@types/diff` to devDependencies
- Integrated into ClaudeToolCall: Edit tool calls with `old_string`/`new_string` render ClaudeDiff

### T12: Accept/Reject Diff Hunks (GAP-13)
- Added `onAcceptHunk` and `onRejectHunk` optional props to ClaudeDiff
- Each hunk header renders Accept (checkmark) / Reject (X) buttons when callbacks provided
- After action: hunk greys out (opacity-50) with "Accepted" or "Rejected" label
- Buttons disabled after responding (status tracked in local state)

### T13: Message Retry Button (GAP-17)
- Added `retryLastMessage` action to store:
  1. Finds last user message
  2. Removes all messages after it (including the user message itself)
  3. Re-calls `sendMessage` with the last user message content
- Updated `ClaudeMessage` interface with `isLastAssistant`, `isLoading`, `onRetry` props
- Added RotateCcw icon button next to copy button on hover of last assistant text message
- Only shows when not loading and not streaming
- ClaudePanel passes `retryLastMessage` and computes `isLastAssistant` per message

### T14: Per-Message Token Count Display (GAP-18)
- For assistant messages with `usageInputTokens` or `usageOutputTokens > 0`, renders token badge on hover
- Format: `↑{inputTokens} ↓{outputTokens}`
- Position: bottom-right of message, only visible on hover
- Style: `text-[10px]` with `claude.textDim` color

---

## TypeScript Compilation
- `npx tsc --noEmit` → EXIT_CODE=0 (zero errors)

---

## Files Changed Inventory

| File | Action | Changes |
|------|--------|---------|
| `src/main/ipc/channels.ts` | Modified | Added `claude:search-files` channel |
| `src/main/index.ts` | Modified | Implemented `claude:search-files` handler with fuzzy file walk |
| `src/renderer/stores/useClaudeStore.ts` | Modified | Added `@file#L` resolution in sendMessage, added `retryLastMessage` action |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Modified | Added ipc import, projectPath selector, handleFileMention callback, onFileMention prop, retryLastMessage, isLastAssistant logic |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Modified | Updated @-mention regex for line range syntax, updated mention replace regex |
| `src/renderer/components/ide/claude/ClaudeMessage.tsx` | Modified | Added retry button (RotateCcw), per-message token badge, isLastAssistant/isLoading/onRetry props |
| `src/renderer/components/ide/claude/ClaudeToolCall.tsx` | Modified | Imported ClaudeDiff, renders ClaudeDiff for Edit tool results |
| `src/renderer/components/ide/claude/ClaudeDiff.tsx` | **Created** | New unified diff component with line numbers, hunk accept/reject, collapsible |
| `package.json` | Modified | Added `diff` dependency, `@types/diff` devDependency |

**Total: 8 files modified, 1 file created**

---

## Next Steps (Phase 3 Readiness)

WO-021 provides the @-mention and diff infrastructure that WO-022 and WO-023 depend on:
- `claude:search-files` IPC → WO-022 (slash commands that need file context)
- `ClaudeDiff` component → WO-023 (testing diff rendering)
- `retryLastMessage` → WO-022 (keyboard shortcut binding)
- `@file#L` resolution → WO-023 (testing line range resolution)

Phase 3 (WO-022: Slash Commands & Context) can now proceed.
