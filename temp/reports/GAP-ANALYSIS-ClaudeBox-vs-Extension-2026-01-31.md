# JUNO Gap Analysis: Claude Box vs VS Code Claude Code Extension

**Audit Date:** 2026-01-31
**Auditor:** JUNO (Quality Auditor)
**Scope:** Feature-by-feature comparison of our Claude Box against the VS Code Claude Code extension
**Verdict:** 23 functionality gaps identified across 8 categories

---

## 1. Slash Commands

### VS Code Extension Commands
| Command | Description | Our Status |
|---------|-------------|------------|
| `/clear` | Clear conversation | IMPLEMENTED |
| `/cost` | Show token usage | IMPLEMENTED (as `/cost` injecting ClaudeCostDisplay) |
| `/new` | New conversation | IMPLEMENTED |
| `/history` | Browse past conversations | IMPLEMENTED |
| `/compact` | Compact context window (summarize + reduce tokens) | **MISSING** |
| `/model` | Switch Claude model (Sonnet/Opus/Haiku) | **MISSING** |
| `/config` | Access configuration settings | **MISSING** |
| `/bug` | Report a bug | NOT IN SCOPE |
| `/init` | Initialize CLAUDE.md | NOT IN SCOPE |
| `/terminal-setup` | Set up terminal integration | NOT IN SCOPE |
| `/review` | Review code with git diff | NOT IN SCOPE |
| `/pr-comments` | Address PR comments | NOT IN SCOPE |
| Custom slash commands | User-defined commands from CLAUDE.md | NOT IN SCOPE |

### Gaps (3)
- **GAP-01: `/compact` command** — Context compaction to reduce token usage by summarizing older messages
- **GAP-02: `/model` command** — Model selection (Sonnet 4, Opus 4, Haiku) with display in UI
- **GAP-03: `/config` command** — Open Claude-specific settings panel

---

## 2. Permission Modes

### VS Code Extension Modes
| Mode | Description | Our Status |
|------|-------------|------------|
| `default` (Normal) | Ask before file edits and bash commands | IMPLEMENTED as `normal` |
| `plan` | Claude plans but doesn't execute without approval | IMPLEMENTED as `plan` |
| `acceptEdits` | Auto-approve file edits, still ask for bash | **MISSING** |
| `bypassPermissions` | Auto-approve everything (yolo mode) | IMPLEMENTED as `auto` |

### Gaps (1)
- **GAP-04: `acceptEdits` permission mode** — Auto-approve file edits while still requiring approval for shell commands. Our `auto` mode approves everything, there's no intermediate mode.

---

## 3. Store State Gaps

### VS Code Extension State Features
| Feature | Description | Our Status |
|---------|-------------|------------|
| Active tool calls tracking | Map of currently running tool calls | **MISSING** — tool calls tracked only as messages in `messages[]` array. No separate `activeToolCalls` Map for quick status lookup |
| History index in store | Global message history navigation index | **MISSING** — `historyIndex` is local state in `ClaudeInputArea` (useState), not in Zustand store |
| Selected model | Current model selection (sonnet/opus/haiku) | **MISSING** — No model selection state |
| Extended thinking toggle | Enable/disable extended thinking | **MISSING** — No toggle, thinking events just appear |
| Conversation search | Search across all conversations | PARTIAL — Search exists in `ClaudeConversationHistory` but only filters by title, no full-text search |

### Gaps (4)
- **GAP-05: `activeToolCalls` in store** — `Map<string, { toolName, toolInput, status }>` for tracking in-progress tool calls separately from the message stream
- **GAP-06: `historyIndex` in store** — Move from component-local `useState(-1)` to Zustand store for cross-component access
- **GAP-07: `selectedModel` in store** — Track current model selection with IPC to pass model choice to container
- **GAP-08: `extendedThinkingEnabled` in store** — Toggle for enabling/disabling extended thinking with IPC support

---

## 4. File Mentions (@-mentions)

### VS Code Extension @-mention Features
| Feature | Description | Our Status |
|---------|-------------|------------|
| `@filename` basic mention | Insert file reference into prompt | PARTIAL — UI renders popup but `onFileMention` is NOT wired up in `ClaudePanel` |
| `@file#L5-L10` line range | Reference specific lines of a file | **MISSING** |
| `@terminal:name` | Reference terminal output | **MISSING** |
| File tree IPC for search | Backend endpoint to search project files | **MISSING** — No IPC handler exists for fuzzy file search from Claude panel |
| Fuzzy file search | Fuzzy matching for file names | **MISSING** |

### Gaps (3)
- **GAP-09: Wire up `onFileMention`** — `ClaudePanel` needs to pass `onFileMention` prop to `ClaudeInputArea` with an IPC-backed file search function
- **GAP-10: Line range support** — Parse `@file#L5-L10` syntax, resolve to file content slice, include in prompt context
- **GAP-11: File search IPC handler** — New IPC channel `claude:search-files` that does fuzzy file path matching against the project tree

---

## 5. Inline Diffs (ClaudeDiff)

### VS Code Extension Diff Features
| Feature | Description | Our Status |
|---------|-------------|------------|
| Inline diff display | Show file changes as unified/side-by-side diff | **MISSING** — No `ClaudeDiff` component exists |
| Accept/reject diff | Per-hunk accept or reject of changes | **MISSING** |
| Diff from Edit tool results | Parse Edit tool output into diff view | **MISSING** |

### Gaps (2)
- **GAP-12: `ClaudeDiff` component** — Renders unified diff view from Edit tool results with syntax highlighting
- **GAP-13: Accept/reject per diff hunk** — Buttons on each diff hunk to accept or reject individual changes (sends response back to container)

---

## 6. Keyboard Shortcuts

### VS Code Extension Shortcuts
| Shortcut | Action | Our Status |
|----------|--------|------------|
| `Ctrl+L` / `Cmd+L` | Focus Claude input | IMPLEMENTED |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Clear conversation | IMPLEMENTED |
| `Escape` | Close overlays | IMPLEMENTED |
| `Enter` | Send message | IMPLEMENTED |
| `Shift+Enter` | New line | IMPLEMENTED |
| `Up/Down` at cursor pos 0 | History navigation | IMPLEMENTED |
| `/` at input start | Slash commands | IMPLEMENTED |
| `@` in input | File mentions | IMPLEMENTED (UI only, not wired) |
| `Cmd+N` / `Ctrl+N` | New conversation | **MISSING** |
| `Cmd+Esc` / `Ctrl+Esc` | Toggle Claude panel focus | **MISSING** |

### Gaps (2)
- **GAP-14: `Cmd+N` / `Ctrl+N` shortcut** — Keyboard shortcut for new conversation
- **GAP-15: `Cmd+Esc` / `Ctrl+Esc` shortcut** — Toggle focus between Claude panel and editor

---

## 7. UI/UX Features

### VS Code Extension UI Features
| Feature | Description | Our Status |
|---------|-------------|------------|
| Streaming cursor | Blinking cursor during streaming | IMPLEMENTED (pulse animation) |
| Message hover actions | Copy, timestamp on hover | IMPLEMENTED |
| Whimsical spinner | Random gerund status messages | IMPLEMENTED |
| Claude Orange theme | Brand colors throughout | IMPLEMENTED |
| GFM Markdown | Tables, checkboxes, strikethrough | IMPLEMENTED |
| Code blocks with syntax highlight | Language label + copy button | IMPLEMENTED |
| Collapsible thinking blocks | Expand/collapse reasoning | IMPLEMENTED |
| Collapsible tool calls | Expand/collapse tool details | IMPLEMENTED |
| Empty state | Sparkles icon + prompt text | IMPLEMENTED |
| Checkpoints (rewind) | Rewind conversation to previous state, undo file changes | **MISSING** |
| Conversation forking | Fork conversation from a checkpoint | **MISSING** |
| Interrupt/cancel | Stop Claude mid-response | **MISSING** |
| Message retry | Retry the last message | **MISSING** |
| Token count per message | Show tokens used per individual message | **MISSING** |

### Gaps (5)
- **GAP-16: Interrupt/cancel button** — Stop button to abort Claude mid-stream (sends abort signal to container, stops streaming)
- **GAP-17: Message retry** — Retry button on the last assistant message to regenerate response
- **GAP-18: Per-message token count** — Display input/output tokens on each assistant message (data already in `usageInputTokens`/`usageOutputTokens` fields but not rendered)
- **GAP-19: Checkpoints** — Snapshot conversation + file state, allow rewinding to previous checkpoint (complex, requires file state tracking)
- **GAP-20: Conversation forking** — Create a new conversation branch from a checkpoint (depends on GAP-19)

---

## 8. Backend / Container Enhancements

### VS Code Extension Backend Features
| Feature | Description | Our Status |
|---------|-------------|------------|
| NDJSON streaming protocol | Rich event types | IMPLEMENTED |
| Tool use events | tool_use, tool_result | IMPLEMENTED |
| Thinking events | Extended thinking | IMPLEMENTED |
| Token tracking | Per-query usage | IMPLEMENTED |
| Permission request/response | IPC channels | IMPLEMENTED |
| Conversation persistence | SQLite storage | IMPLEMENTED |
| Model selection passthrough | Send model choice to container | **MISSING** |
| Abort/cancel signal | Cancel in-progress query | **MISSING** |
| Context compaction endpoint | Summarize and compact context | **MISSING** |

### Gaps (3)
- **GAP-21: Model selection IPC** — New IPC channel or query parameter to pass selected model to container
- **GAP-22: Abort/cancel IPC** — New IPC channel `claude:abort` to cancel in-progress query (HTTP request abort + stream cleanup)
- **GAP-23: Context compaction** — Backend endpoint or logic to summarize conversation history and reduce token count

---

## Priority Classification

### P0 — Critical (core functionality gaps the user explicitly flagged)
| Gap | Description | Effort |
|-----|-------------|--------|
| GAP-05 | `activeToolCalls` in store | Low |
| GAP-06 | `historyIndex` in store | Low |
| GAP-09 | Wire up `onFileMention` | Medium |
| GAP-11 | File search IPC handler | Medium |
| GAP-12 | `ClaudeDiff` component | High |
| GAP-16 | Interrupt/cancel button | Medium |

### P1 — High (significant feature gaps)
| Gap | Description | Effort |
|-----|-------------|--------|
| GAP-01 | `/compact` command | High |
| GAP-02 | `/model` command | Medium |
| GAP-04 | `acceptEdits` permission mode | Low |
| GAP-07 | `selectedModel` in store | Low |
| GAP-08 | `extendedThinkingEnabled` in store | Low |
| GAP-10 | Line range @-mention support | Medium |
| GAP-13 | Accept/reject per diff hunk | High |
| GAP-17 | Message retry | Medium |
| GAP-18 | Per-message token count | Low |
| GAP-21 | Model selection IPC | Medium |
| GAP-22 | Abort/cancel IPC | Medium |
| GAP-23 | Context compaction backend | High |

### P2 — Medium (quality of life)
| Gap | Description | Effort |
|-----|-------------|--------|
| GAP-03 | `/config` command | Medium |
| GAP-14 | `Cmd+N` shortcut | Low |
| GAP-15 | `Cmd+Esc` toggle focus shortcut | Low |

### P3 — Low (advanced features, can defer)
| Gap | Description | Effort |
|-----|-------------|--------|
| GAP-19 | Checkpoints (rewind) | Very High |
| GAP-20 | Conversation forking | Very High |

---

## Summary

| Category | Implemented | Missing | Total |
|----------|-----------|---------|-------|
| Slash Commands | 4 | 3 | 7 in-scope |
| Permission Modes | 3 | 1 | 4 |
| Store State | 5 | 4 | 9 |
| File Mentions | 1 partial | 3 | 4 |
| Inline Diffs | 0 | 2 | 2 |
| Keyboard Shortcuts | 8 | 2 | 10 |
| UI/UX Features | 9 | 5 | 14 |
| Backend | 6 | 3 | 9 |
| **Total** | **36** | **23** | **59** |

**Coverage: 61% (36/59)**

The 23 gaps represent concrete, implementable features. Checkpoints and forking (GAP-19, GAP-20) are architecturally complex and could be deferred to a later phase. The remaining 21 gaps are all feasible within a phased implementation plan.
