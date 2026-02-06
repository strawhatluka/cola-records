# Claude Box vs Claude Code Extension -- Comprehensive Parity Audit

**Auditor:** JUNO (Quality Auditor)
**Date:** 2026-01-31
**Scope:** Complete gap analysis of the Cola Records "Claude Box" implementation vs real Claude Code VS Code extension
**Total Features Audited:** 56
**Status:** SIGNIFICANT GAPS IDENTIFIED

---

## Executive Summary

| Category | Implemented | Partial | Missing | Total |
|----------|------------|---------|---------|-------|
| Core Chat | 6 | 2 | 1 | 9 |
| Tool Use & Permissions | 5 | 3 | 1 | 9 |
| Context & Input | 4 | 1 | 2 | 7 |
| Code Integration | 3 | 1 | 1 | 5 |
| Checkpoints & History | 5 | 0 | 0 | 5 |
| Settings & Configuration | 3 | 1 | 3 | 7 |
| UI/UX | 7 | 1 | 1 | 9 |
| Advanced | 1 | 0 | 4 | 5 |
| **TOTAL** | **34** | **9** | **13** | **56** |

**Compliance Score: 68.75%** (34 fully + 9 partial at 0.5 weight = 38.5/56)

**Rating: FAIR -- Notable gaps remain before feature parity is achieved.**

---

## SECTION 1: IMPLEMENTED (34 Features)

These features exist and function correctly based on code analysis.

### Core Chat

| # | Feature | Evidence |
|---|---------|----------|
| 1 | Multi-turn conversation | `useClaudeStore.ts` -- `sendMessage()` maintains message array, conversation persisted to SQLite via `saveCurrentConversation()`. Session continuity via `currentSessionId` in `server.ts`. |
| 2 | Streaming responses | `claude-container.service.ts:228-260` -- NDJSON stream parsing with `res.on('data')` chunked processing. Store updates per-chunk in `useClaudeStore.ts:256-264`. Cursor animation in `ClaudeMessage.tsx:200`. |
| 3 | Extended thinking | `ClaudeThinking.tsx` -- Collapsible thinking display. Toggle in `ClaudeContextBar.tsx:71-81`. Stream event handler at `useClaudeStore.ts:313-324`. |
| 4 | Model selection | `ClaudeContextBar.tsx:63-70` -- Cycles through sonnet/opus/haiku. Stored in `selectedModel` state. Passed to `query()` at `useClaudeStore.ts:421`. |
| 5 | Conversation history | `ClaudeConversationHistory.tsx` -- Full history panel with search, date grouping (Today/Yesterday/7 days/Older), delete, switch. SQLite persistence via `claude_conversations` + `claude_messages` tables. |
| 6 | Stop/abort | `ClaudeInputArea.tsx:245-251` -- Stop button (Square icon) shown during loading. `abortQuery()` in store calls `claude:abort` IPC. `claudeContainerService.abort()` destroys the HTTP request. |

### Tool Use & Permissions

| # | Feature | Evidence |
|---|---------|----------|
| 10 | File read display | `ClaudeToolCall.tsx` -- Shows Read tool with FileText icon, file path summary, expandable JSON input/result. |
| 11 | File write/create display | `ClaudeToolCall.tsx` -- Write tool with FilePlus icon, `getToolSummary()` shows file path. |
| 12 | File edit display | `ClaudeToolCall.tsx` -- Edit tool with Pencil icon, diff rendering via `ClaudeDiff.tsx` when `old_string` and `new_string` are available. |
| 16 | Permission system | `ClaudePermission.tsx` -- Full permission prompt UI with Allow/Deny buttons, tool details expansion. `respondToPermission()` in store sends response via IPC. |
| 17 | Tool call display | `ClaudeToolCall.tsx` -- Complete tool call cards with icon, name, summary, status indicator (spinner/check/X), expandable input/output. |

### Context & Input

| # | Feature | Evidence |
|---|---------|----------|
| 19 | File mentions (@file) | `ClaudeInputArea.tsx:79-94` -- Detects `@query` pattern, calls `onFileMention()` which invokes `claude:search-files` IPC. Popup with fuzzy results shown. Line range support `@file#L10-L20` in `useClaudeStore.ts:204-224`. |
| 22 | Context bar | `ClaudeContextBar.tsx` -- Shows permission mode (Normal/Plan/Accept Edits/Auto), model selector, thinking toggle, context % progress bar. |
| 23 | Slash commands | `ClaudeSlashCommands.tsx` -- 7 commands: /clear, /cost, /new, /history, /compact, /model, /config. Keyboard navigation, filtering. |
| 27 | Code blocks with syntax highlighting | `CodeBlock.tsx` -- Uses `react-syntax-highlighter` with Prism + oneDark theme. Language header bar, line numbers for blocks >10 lines. |

### Code Integration

| # | Feature | Evidence |
|---|---------|----------|
| 24 | Inline diffs | `ClaudeDiff.tsx` -- Full unified diff viewer using `diff` library. Shows add/remove lines with line numbers, hunk headers, +/- stats, accept/reject per-hunk buttons. |
| 27 | Code blocks with highlighting | `CodeBlock.tsx` -- Prism-based syntax highlighting, custom Claude-themed styling. |
| 28 | Copy code blocks | `CodeBlock.tsx:33-37` -- Copy button in header bar with Copied! confirmation. |

### Checkpoints & History

| # | Feature | Evidence |
|---|---------|----------|
| 29 | Auto-checkpoints | `claude-container.service.ts:342-355` -- Auto-checkpoint fires for Edit/Write tool uses. `checkpointService.createCheckpoint()` called with affected files. |
| 30 | Checkpoint timeline | `ClaudeCheckpoints.tsx` -- Visual timeline with dots and connectors. Shows label, file count, relative time, manual/auto badge. Newest-first display. |
| 31 | Rewind | `ClaudeCheckpoints.tsx` + `ClaudePanel.tsx:460-497` -- Confirmation dialog, file restoration via `checkpointService.restoreCheckpoint()`, message truncation. |
| 32 | Conversation forking | `database.service.ts:590-667` -- Full fork logic: creates new conversation, copies messages up to checkpoint, copies file snapshots. Branch label support. |
| 33 | Branch switching | `ClaudeBranchSwitcher.tsx` -- Tree view with parent/child hierarchy, active indicator, switch on click. `switchBranch()` loads conversation and branches. |

### Settings & Configuration

| # | Feature | Evidence |
|---|---------|----------|
| 34 | API key configuration | `SettingsForm.tsx:211-225` -- API key input field with password mask, saved to SQLite settings table. |
| 35 | OAuth token support | `SettingsForm.tsx:196-209` -- OAuth token field. Container service at `claude-container.service.ts:120-124` passes `CLAUDE_CODE_OAUTH_TOKEN` env var. |
| 36 | Model preferences | `useClaudeStore.ts:129` -- Default model is `sonnet`. Can be changed via context bar or `/model` slash command. |

### UI/UX

| # | Feature | Evidence |
|---|---------|----------|
| 41 | Keyboard shortcuts | `ClaudePanel.tsx:130-171` -- Ctrl+L (focus), Ctrl+Shift+L (clear), Ctrl+N (new), Escape (close overlays). `ClaudeInputArea.tsx:189-192` -- Enter to send, Shift+Enter for newline. Arrow up/down for history. |
| 42 | Auto-scroll | `ClaudePanel.tsx:125-127` -- `messagesEndRef.scrollIntoView({ behavior: 'smooth' })` on messages/permissions/costMessages changes. |
| 44 | Theme support | `claude-theme.ts` -- Complete dark theme palette (Claude Orange brand). All components use consistent theme tokens. |
| 45 | Loading states | `ClaudeSpinner.tsx` -- Animated spinner with rotating fun messages ("Forging...", "Marinating...", etc.), tool-specific messages. Status indicator in header. |
| 46 | Error handling | `ClaudePanel.tsx:374-378` -- Error banner display. Store handles errors from IPC calls, streaming, container startup. |
| 47 | Token usage display | `ClaudeCostDisplay.tsx` -- Grid showing input/output/total tokens + context %. `ClaudeContextBar.tsx:84-95` -- Context bar progress meter. |
| 49 | Status indicators | `StatusIndicator` in `ClaudePanel.tsx:19-61` -- 4 states: Starting (yellow pulse), Thinking (orange pulse), Ready (green), Offline (red). |

### Advanced

| # | Feature | Evidence |
|---|---------|----------|
| 53 | CLAUDE.md support | Container mounts project at `/workspace` which includes CLAUDE.md. The Claude Agent SDK inside the container reads CLAUDE.md automatically. |

---

## SECTION 2: PARTIALLY IMPLEMENTED (9 Features)

These features exist but are incomplete or have significant limitations.

### GAP-001: Streaming is text-only from container
- **Feature:** #2 Streaming responses (partial -- tool/thinking events fabricated client-side)
- **Current State:** The `server.ts` container only extracts `text` blocks from assistant messages (line 138-139). Tool use events, thinking blocks, and usage data are NOT streamed from the container. The client-side store synthesizes tool_use/thinking/usage events from the stream, but the container's `for await (const message of response)` loop only emits `{ type: "text", content }`.
- **What's Missing:** The container server needs to emit `tool_use`, `tool_result`, `thinking`, `usage`, and `error` event types from the SDK response. Currently it only emits `text` and `done`.
- **Affected Files:** `docker/claude-container/server.ts` (lines 122-143)
- **Priority:** CRITICAL

### GAP-002: Permission system is UI-only (not enforced)
- **Feature:** #16 Permission system + #18 Auto-approve mode
- **Current State:** The container has `allowAll: CanUseTool` (server.ts:10-13) which auto-approves ALL tool uses inside the container. The permission UI on the frontend (`ClaudePermission.tsx`) renders approval prompts, and `respondToPermission()` calls `claude:permission:respond` IPC, but `claudeContainerService.respondToPermission()` uses a `pendingPermissions` Map that is never populated by the actual container flow. The container runs tools first, THEN the client gets notified.
- **What's Missing:** Bi-directional permission flow: container must PAUSE before tool execution, send permission request to Electron, wait for approval, then proceed. Current architecture is fire-and-forget.
- **Affected Files:** `docker/claude-container/server.ts`, `src/main/services/claude-container.service.ts` (lines 416-448, 462-469)
- **Priority:** CRITICAL

### GAP-003: Model selection not passed to container
- **Feature:** #4 Model selection
- **Current State:** The `query()` method passes `model` to the container (line 200-202 of service), but the container's `/query` endpoint reads `options.model` (server.ts:107) while the Electron service sends it as a top-level `model` field in the body. The body is `{ prompt, model?, thinking? }` but the server reads `body.options.model`. They don't match.
- **What's Missing:** Either the service needs to wrap model/thinking in `options` object, or the server needs to read `body.model` directly.
- **Affected Files:** `src/main/services/claude-container.service.ts:199-202`, `docker/claude-container/server.ts:68-69,107`
- **Priority:** HIGH

### GAP-004: Conversation compaction is naive
- **Feature:** #6 Conversation compaction
- **Current State:** `compactConversation()` in store builds a text dump and sends to `claude:compact` IPC, which calls `claudeContainerService.compact()`. This sends the text as a new prompt asking Claude to summarize. The real Claude Code extension uses the SDK's built-in conversation compaction which summarizes AND preserves the conversation context window.
- **What's Missing:** Real compaction should use the SDK's native `/compact` or conversation summary API, not send the entire conversation as a new prompt. Current approach starts a fresh context (loses conversational state).
- **Affected Files:** `src/main/services/claude-container.service.ts:475-562`, `src/renderer/stores/useClaudeStore.ts:700-737`
- **Priority:** HIGH

### GAP-005: Bash command tool not displayed distinctly
- **Feature:** #13 Bash commands
- **Current State:** Bash tool calls are displayed in `ClaudeToolCall.tsx` with a Terminal icon. However, the tool result is shown as a plain `CodeBlock` with `language="text"`. Real Claude Code shows bash output with ANSI color rendering, exit codes, and stderr separately.
- **What's Missing:** ANSI color rendering in bash output, exit code display, stderr/stdout separation.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeToolCall.tsx:100-112`
- **Priority:** MEDIUM

### GAP-006: Search/grep tool call display is generic
- **Feature:** #14 Search/grep + #15 Glob
- **Current State:** Both are shown in `ClaudeToolCall.tsx` with a Search icon. Results are displayed as raw text in a CodeBlock. The real extension shows search results with file paths, line numbers, and matched text highlighted.
- **What's Missing:** Rich search result rendering with clickable file paths and syntax highlighting.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeToolCall.tsx`
- **Priority:** MEDIUM

### GAP-007: Copy message only copies raw text
- **Feature:** #9 Copy messages
- **Current State:** `ClaudeMessage.tsx:25-29` copies `content` as plain text. For messages with markdown, code blocks, or tool calls, the copied text is the raw markdown source, not the rendered/formatted output.
- **What's Missing:** Option to copy as formatted text or just code blocks within the message.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeMessage.tsx`
- **Priority:** LOW

### GAP-008: Extended thinking toggle not persisted
- **Feature:** #37 Extended thinking toggle
- **Current State:** `extendedThinkingEnabled` defaults to `true` in store and can be toggled via context bar, but the preference is not saved to database settings. It resets to `true` on app restart.
- **What's Missing:** Persist to SQLite settings table like other preferences.
- **Affected Files:** `src/renderer/stores/useClaudeStore.ts:130`, `src/renderer/components/settings/SettingsForm.tsx`
- **Priority:** LOW

### GAP-009: Per-message token badges only on hover
- **Feature:** #48 Per-message token badges
- **Current State:** `ClaudeMessage.tsx:223-227` shows token counts only when hovering over the message. Real Claude Code shows token badges persistently (at least for the most recent exchange).
- **What's Missing:** Persistent display option, or at minimum always-visible on the last exchange.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeMessage.tsx`
- **Priority:** LOW

---

## SECTION 3: NOT IMPLEMENTED (13 Features)

These features are completely absent from the codebase.

### GAP-010: Message retry
- **Feature:** #7 Message retry
- **Current State:** `retryLastMessage()` exists in the store (line 673-698) and the retry button renders in `ClaudeMessage.tsx:204-210` for the last assistant message. HOWEVER, the retry function removes the user message and re-sends it, but because the container uses `currentSessionId` for conversation continuity (server.ts:113-115), the retried message is sent into the SAME session which already has the previous response in context. This is NOT a true retry -- it's sending the same message again to get a second response appended to the conversation.
- **What's Needed:** Server-side support to reset the session back to before the last turn, then re-query. The container's `currentSessionId` would need to be reset or a new session started from a snapshot.
- **Affected Files:** `docker/claude-container/server.ts`, `src/renderer/stores/useClaudeStore.ts:673-698`
- **Priority:** HIGH

### GAP-011: Image input (paste/attach)
- **Feature:** #20 Image input
- **Current State:** No image handling anywhere in the codebase. The `ClaudeInputArea` only handles text. No paste event handler for images, no file picker for images, no drag-and-drop image support.
- **What's Needed:** Image paste handler in textarea, image preview in input area, base64 encoding and multimodal message format sent to container, container must forward image data to Claude API.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`, `src/main/services/claude-container.service.ts`, `docker/claude-container/server.ts`
- **Priority:** HIGH

### GAP-012: Drag and drop files
- **Feature:** #21 Drag and drop files
- **Current State:** No drag-and-drop handlers on the Claude panel. Cannot drag files from the file tree into the chat.
- **What's Needed:** `onDragOver`/`onDrop` handlers on `ClaudePanel.tsx`, file content extraction, injection as `@file` mention or inline context.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudePanel.tsx`, `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- **Priority:** MEDIUM

### GAP-013: Open file from chat
- **Feature:** #26 Open file from chat
- **Current State:** File paths in assistant messages render as plain text or inline code. Clicking a file path does nothing. The real Claude Code extension makes file paths clickable -- clicking opens the file in the editor.
- **What's Needed:** Parse file paths in assistant messages, render as clickable links, on click open file in Monaco editor tab via the IDE's file opening mechanism.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeMessage.tsx`, integration with `useCodeEditorStore`
- **Priority:** HIGH

### GAP-014: Apply changes button
- **Feature:** #25 Apply changes (one-click apply suggested code changes)
- **Current State:** The `ClaudeDiff.tsx` has accept/reject hunk buttons (`onAcceptHunk`/`onRejectHunk` props), but these are never wired up. The `ClaudeToolCall.tsx` passes NO handlers for accept/reject. The buttons appear but clicking them only sets local state (accepted/rejected label) without actually applying or reverting the change in the file system.
- **What's Needed:** Wire `onAcceptHunk`/`onRejectHunk` to actually apply edits via `fs:write-file` IPC. For suggested (non-tool) code changes in chat, add an "Apply" button that creates the file or edits it.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeDiff.tsx`, `src/renderer/components/ide/claude/ClaudeToolCall.tsx`
- **Priority:** HIGH

### GAP-015: Custom system prompt
- **Feature:** #39 Custom system prompt
- **Current State:** No custom system prompt field in settings or anywhere in the UI. The container sends prompts directly to the SDK without prepending user-defined instructions.
- **What's Needed:** Settings field for custom system prompt, persist to database, prepend to queries or pass as system message to the SDK.
- **Affected Files:** `src/renderer/components/settings/SettingsForm.tsx`, `src/main/services/claude-container.service.ts`, `docker/claude-container/server.ts`
- **Priority:** MEDIUM

### GAP-016: Max tokens configuration
- **Feature:** #40 Max tokens configuration
- **Current State:** No max token setting anywhere. The container uses SDK defaults. The user cannot limit output length.
- **What's Needed:** Settings field for max output tokens, pass to container query options.
- **Affected Files:** `src/renderer/components/settings/SettingsForm.tsx`, `src/main/ipc/channels.ts`, `docker/claude-container/server.ts`
- **Priority:** MEDIUM

### GAP-017: Permission preference persistence
- **Feature:** #38 Permission preferences (configure auto-approve rules)
- **Current State:** `permissionMode` (normal/plan/acceptEdits/auto) exists in the store but resets to `normal` on app restart. No per-tool-type approval rules. No "always allow this tool" option.
- **What's Needed:** Persist permission mode to settings. Per-tool auto-approve rules (e.g., always allow Read, prompt for Bash). Remember "always allow for this session" choices.
- **Affected Files:** `src/renderer/stores/useClaudeStore.ts`, `src/renderer/components/settings/SettingsForm.tsx`
- **Priority:** MEDIUM

### GAP-018: MCP (Model Context Protocol) servers
- **Feature:** #50 MCP servers
- **Current State:** No MCP support anywhere. The container runs the Claude Agent SDK directly. No MCP server configuration, no MCP tool registration, no MCP connection management.
- **What's Needed:** MCP server configuration UI, container support for connecting to MCP servers, tool routing through MCP protocol.
- **Affected Files:** New files needed across settings, container, and IPC layers
- **Priority:** HIGH

### GAP-019: Custom slash commands
- **Feature:** #51 Custom slash commands
- **Current State:** Only the 7 hardcoded slash commands exist in `ClaudeSlashCommands.tsx`. No way for users to define custom commands.
- **What's Needed:** Custom command definition UI or file-based configuration, command execution engine, integration with slash command menu.
- **Affected Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, new config files
- **Priority:** LOW

### GAP-020: Hooks (pre/post tool execution)
- **Feature:** #52 Hooks
- **Current State:** No hook system. Tools execute without pre/post hooks. The real Claude Code extension supports `trinity-hooks/` or `.claude/hooks/` for running scripts before/after tool execution.
- **What's Needed:** Hook configuration, hook execution engine in the container, pre-tool and post-tool callback mechanism.
- **Affected Files:** `docker/claude-container/server.ts`, new hook execution service
- **Priority:** LOW

### GAP-021: Web search
- **Feature:** #55 Web search
- **Current State:** No web search capability. The container can only use the standard Claude Agent SDK tools (file operations, bash, search/grep within the project).
- **What's Needed:** Web search tool integration in the container, either via a built-in tool or MCP server.
- **Affected Files:** `docker/claude-container/server.ts`
- **Priority:** LOW

### GAP-022: Task delegation (sub-agents)
- **Feature:** #56 Task delegation
- **Current State:** No sub-agent support. All queries go to a single Claude session. The real Claude Code can spawn sub-agents for complex tasks (the "Task" tool).
- **What's Needed:** Sub-agent spawning mechanism in the container, task tracking, result aggregation.
- **Affected Files:** `docker/claude-container/server.ts`, `src/main/services/claude-container.service.ts`
- **Priority:** MEDIUM

---

## SECTION 4: ARCHITECTURAL ISSUES

These are structural problems that affect multiple features and require design-level changes.

### ARCH-001: Container server only emits text events (CRITICAL)

**Problem:** The `server.ts` in the Docker container only extracts `text` content blocks from SDK responses (lines 136-141). All other event types (tool_use, tool_result, thinking, usage, error) are silently dropped. The client-side store has handlers for all these events but never receives them from the container.

**Impact:** Tool call displays are based on guesswork/fabrication, not actual tool execution data. Thinking content never arrives. Token usage is never reported by the container. This is the single biggest gap -- the entire rich streaming experience is broken.

**Root Cause:** The `for await (const message of response)` loop in server.ts iterates over SDK messages but only processes `message.type === "assistant"` with text blocks. The SDK emits many other message types (tool_use, tool_result, system events, etc.) that are ignored.

**Fix Required:** Expand the loop to emit all event types:
- `tool_use` events with tool name, input
- `tool_result` events with output
- `thinking` blocks
- `usage` events with token counts
- Proper error events

### ARCH-002: Permission flow is one-way (CRITICAL)

**Problem:** The container auto-approves ALL tool uses (`allowAll` on line 10-13 of server.ts). The frontend permission UI is decorative -- it renders prompts but the tools have already executed. There is no mechanism for the container to pause, ask the Electron host for permission, and wait for a response.

**Impact:** The Normal, Plan, and Accept Edits permission modes are non-functional. Users see permission prompts AFTER tools have already run. This defeats the purpose of the permission system.

**Fix Required:** Implement a WebSocket or long-poll channel between the container and Electron host for bi-directional permission flow. The container's `canUseTool` function must:
1. Send a permission request to Electron via the streaming channel
2. Wait for the Electron host to respond (approved/denied)
3. Return the approval/denial to the SDK

### ARCH-003: Single session, no conversation isolation (HIGH)

**Problem:** The container maintains a single `currentSessionId` (server.ts:18). All queries from the Electron app share this one session. There is no concept of multiple conversations at the container level -- only at the Electron client level.

**Impact:**
- Starting a "new conversation" in the UI still sends to the same container session
- Switching conversations in the history loads messages from SQLite but the container context still has the old session
- Compaction replaces UI messages but the container still has full history
- Retry sends into the same session (gets duplicate context)

**Fix Required:** The container needs conversation-scoped sessions. Options:
1. Support passing `conversationId` to the container and maintaining a map of sessions
2. Support a `/reset` endpoint to clear the current session
3. Pass `resume` parameter only when continuing an existing conversation, omit it for new ones

### ARCH-004: No Dockerfile for building on container start (MEDIUM)

**Problem:** The `ensureImageBuilt()` method (claude-container.service.ts:660-688) looks for the Dockerfile at `path.join(app.getAppPath(), 'docker', 'claude-container')`. In production builds, `app.getAppPath()` points to the asar archive, and the Docker context directory may not be accessible. The docker directory is currently in the git staging area (untracked `docker/` in git status) and may not be included in production builds.

**Impact:** The Docker image build may fail in production/packaged builds.

**Fix Required:** Ensure the `docker/` directory is included in the Electron Forge build configuration and properly extracted for Docker builds. Alternatively, pre-build and distribute the image.

### ARCH-005: No resizable Claude panel (LOW)

**Problem:** The Claude panel is rendered within the IDE layout but there's no resize handle. The real Claude Code extension allows resizing the panel width.

**Impact:** Users cannot adjust the Claude panel size to their preference.

**Fix Required:** Add a drag handle for panel resizing, persist size preference.

### ARCH-006: Multi-file edit tracking is incomplete (MEDIUM)

**Problem:** The auto-checkpoint system only captures files for Edit and Write tool calls (claude-container.service.ts:343, 452-457). But Claude often edits multiple files in a single turn. Each Edit/Write creates a separate checkpoint rather than a single checkpoint covering all files modified in one turn.

**Impact:** Rewinding may only restore some files from a multi-file edit, leaving the project in an inconsistent state.

**Fix Required:** Batch all file modifications in a single turn into one checkpoint. Track turn boundaries and create checkpoints at turn level, not individual tool level.

---

## SECTION 5: PRIORITY MATRIX

### CRITICAL (Must fix for any semblance of parity)

| Gap ID | Feature | Issue |
|--------|---------|-------|
| ARCH-001 | Container streaming | Server only emits text, drops all tool/thinking/usage events |
| ARCH-002 | Permission flow | Permissions are decorative, all tools auto-approved |
| ARCH-003 | Session isolation | Single shared session, no conversation boundaries |
| GAP-001 | Rich streaming | Client expects events that server never sends |
| GAP-002 | Permission enforcement | UI shows prompts but tools already executed |
| GAP-003 | Model selection | Body format mismatch between service and container |

### HIGH (Required for "same experience" parity)

| Gap ID | Feature | Issue |
|--------|---------|-------|
| GAP-004 | Compaction | Naive text dump instead of SDK-native compaction |
| GAP-010 | Message retry | Re-sends into same session, not a true retry |
| GAP-011 | Image input | No multimodal support at all |
| GAP-013 | Open file from chat | File paths are not clickable |
| GAP-014 | Apply changes | Diff accept/reject buttons are not wired up |
| GAP-018 | MCP servers | No MCP support |
| GAP-022 | Task delegation | No sub-agent spawning |

### MEDIUM (Important for full parity)

| Gap ID | Feature | Issue |
|--------|---------|-------|
| GAP-005 | Bash output | No ANSI rendering, no exit codes |
| GAP-006 | Search results | Generic text display, no rich formatting |
| GAP-012 | Drag and drop | Cannot drag files into chat |
| GAP-015 | Custom system prompt | No configuration option |
| GAP-016 | Max tokens | No output length control |
| GAP-017 | Permission persistence | Mode resets on restart |
| ARCH-004 | Docker in production | Image may not build from packaged app |
| ARCH-006 | Multi-file checkpoints | Each tool creates separate checkpoint |

### LOW (Nice to have)

| Gap ID | Feature | Issue |
|--------|---------|-------|
| GAP-007 | Copy formatting | Only copies raw markdown |
| GAP-008 | Thinking persistence | Toggle resets on restart |
| GAP-009 | Token badges | Only visible on hover |
| GAP-019 | Custom slash commands | Hardcoded only |
| GAP-020 | Hooks | No pre/post tool hooks |
| GAP-021 | Web search | Not available |
| ARCH-005 | Panel resizing | Fixed size |

---

## SECTION 6: RECOMMENDED IMPLEMENTATION ORDER

Based on dependency analysis and impact, the recommended order is:

### Phase 1: Fix the Foundation (CRITICAL)
1. **ARCH-001 + GAP-001**: Expand container server.ts to emit all NDJSON event types (tool_use, tool_result, thinking, usage, error). This is prerequisite for everything else.
2. **GAP-003**: Fix model/thinking body parameter mapping between service and container.
3. **ARCH-003**: Implement conversation-scoped sessions (pass conversationId, support reset).

### Phase 2: Real Permission System (CRITICAL)
4. **ARCH-002 + GAP-002**: Implement bi-directional permission flow. Container pauses on tool use, sends request to Electron, waits for response.

### Phase 3: Core UX Parity (HIGH)
5. **GAP-013**: Make file paths clickable (open in editor).
6. **GAP-014**: Wire up diff accept/reject to actual file operations.
7. **GAP-010**: Implement true retry (session rollback + re-query).
8. **GAP-004**: Use SDK-native compaction instead of naive text dump.

### Phase 4: Multimodal & Advanced (HIGH)
9. **GAP-011**: Image input support (paste, attach, drag).
10. **GAP-018**: MCP server support.
11. **GAP-022**: Sub-agent/task delegation.

### Phase 5: Polish (MEDIUM/LOW)
12. Remaining MEDIUM and LOW gaps.

---

## File Reference Index

| File | Purpose | Key Gaps |
|------|---------|----------|
| `docker/claude-container/server.ts` | Container NDJSON server | ARCH-001, ARCH-002, ARCH-003, GAP-001, GAP-002, GAP-003 |
| `src/main/services/claude-container.service.ts` | Electron-side container management | GAP-002, GAP-003, GAP-004 |
| `src/main/services/checkpoint.service.ts` | Checkpoint file snapshots | ARCH-006 |
| `src/main/database/schema.ts` | SQLite schema (v4) | -- |
| `src/main/database/database.service.ts` | Database operations | -- |
| `src/main/ipc/channels.ts` | IPC type definitions | GAP-011, GAP-016 |
| `src/main/index.ts` | IPC handler registration | -- |
| `src/renderer/stores/useClaudeStore.ts` | Zustand state management | GAP-004, GAP-010, GAP-017, ARCH-003 |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Main panel orchestrator | GAP-012, ARCH-005 |
| `src/renderer/components/ide/claude/ClaudeMessage.tsx` | Message rendering | GAP-007, GAP-009, GAP-013 |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Input handling | GAP-011, GAP-012 |
| `src/renderer/components/ide/claude/ClaudeToolCall.tsx` | Tool call display | GAP-005, GAP-006, GAP-014 |
| `src/renderer/components/ide/claude/ClaudeDiff.tsx` | Diff viewer | GAP-014 |
| `src/renderer/components/ide/claude/ClaudePermission.tsx` | Permission prompts | GAP-002 |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Slash commands | GAP-019 |
| `src/renderer/components/ide/claude/ClaudeContextBar.tsx` | Context/mode bar | GAP-008 |
| `src/renderer/components/settings/SettingsForm.tsx` | Settings UI | GAP-008, GAP-015, GAP-016, GAP-017 |

---

**Audit Complete.**
**JUNO -- Quality Auditor, Trinity Method v2.1.0**
**Generated:** 2026-01-31
