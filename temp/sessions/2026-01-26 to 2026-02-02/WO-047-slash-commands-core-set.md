# WO-047: Slash Commands - Core Set

**Phase:** 1 - Foundation & Infrastructure
**Priority:** HIGH
**Complexity:** 5/10
**Dependencies:** WO-042 (Settings Hierarchy), WO-043 (CLAUDE.md Hierarchy)
**Estimated Tasks:** 12
**Category References:** S4 Built-in Slash Commands

---

## Objective

Implement the 20 missing core slash commands to achieve parity with Claude Code's built-in command set. Each command requires a handler in the main process, registration in the slash command registry, and appropriate UI in the renderer. Some commands open interactive panels, others execute actions, and some display information.

---

## Background

**Current State:**
- `ClaudeSlashCommands.tsx` has 7 built-in commands: `/clear`, `/cost`, `/new`, `/history`, `/compact`, `/model`, `/config`
- Commands are defined as static array `BUILTIN_COMMANDS` with name, description, and icon
- Command execution is handled in `useClaudeStore.ts` via `sendMessage()` with special `/command` prefix
- No command registry pattern (commands are hardcoded)
- Custom commands from `.claude/commands/` are appended via props

**Target State:**
- 27 total built-in commands (7 existing + 20 new)
- Command registry pattern for extensible command management
- Each command has: name, description, icon, handler, optional interactive UI
- Commands organized by category for `/help` display

**Missing Commands (20):**
1. `/help` - Display all commands
2. `/clear` - Already exists (verify behavior: free context window)
3. `/compact` - Already exists (add focus instructions support)
4. `/config` - Already exists (verify opens settings)
5. `/model` - Already exists (verify model switching)
6. `/permissions` - Interactive permissions view (from WO-045)
7. `/allowed-tools` - Tool permissions (from WO-045)
8. `/context` - Context usage grid
9. `/cost` - Already exists (enhance with full breakdown)
10. `/status` - Account/system status
11. `/doctor` - Installation health check
12. `/review` - Code review of current changes
13. `/rename` - Rename current session
14. `/resume` - Resume previous conversation with picker
15. `/export` - Export conversation
16. `/vim` - Enter vim mode (placeholder for WO-067)
17. `/theme` - Theme picker (placeholder for WO-066)
18. `/sandbox` - Enable sandboxed bash
19. `/output-style` - Configure response formatting
20. `/privacy-settings` - Data sharing controls

---

## Acceptance Criteria

- [ ] `/help` displays all available commands organized by category (Session, Config, Context, Monitoring, Workflow, Terminal)
- [ ] `/clear` clears conversation and frees context window (verify existing behavior)
- [ ] `/compact` supports optional focus instructions: `/compact focus on authentication`
- [ ] `/config` opens interactive settings panel (verify existing behavior)
- [ ] `/model` switches models mid-session (verify existing behavior)
- [ ] `/context` displays context usage as a visual grid with warnings
- [ ] `/cost` shows full breakdown: total cost, API duration, wall duration, token counts
- [ ] `/status` displays account status, API connectivity, system info
- [ ] `/doctor` runs installation health checks (API key valid, container status, dependencies)
- [ ] `/review` triggers code review of current git changes
- [ ] `/rename` prompts for session name and renames current conversation
- [ ] `/resume` shows interactive picker with past conversations
- [ ] `/export` exports conversation to file or clipboard
- [ ] `/vim` enters vim mode (can be placeholder that shows "coming soon" until WO-067)
- [ ] `/theme` opens theme picker (can be placeholder until WO-066)
- [ ] `/sandbox` enables sandboxed bash execution mode
- [ ] `/output-style` lets user configure response format preferences
- [ ] `/privacy-settings` shows data sharing controls
- [ ] `/permissions` opens permissions management (delegates to WO-045)
- [ ] `/allowed-tools` manages tool allowlist (delegates to WO-045)
- [ ] All commands appear in the slash command dropdown with icons
- [ ] Command registry pattern allows easy addition of future commands
- [ ] Unit tests cover each command handler
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
SlashCommandRegistry (shared)
  |-- register(command: SlashCommandDef) -> add to registry
  |-- getAll() -> all registered commands
  |-- getByName(name) -> lookup
  |-- getByCategory(cat) -> filter by category
  |-- execute(name, args, context) -> run handler

SlashCommandDef:
  name: string
  description: string
  category: CommandCategory
  icon: string (lucide icon name)
  handler: (args: string, context: CommandContext) => Promise<CommandResult>
  interactive?: boolean (opens UI panel)
```

### New Files

| File | Purpose |
|------|---------|
| `src/shared/types/slash-commands.types.ts` | Command registry types |
| `src/main/services/slash-command-registry.service.ts` | Command registry and handlers |
| `src/main/services/slash-commands/context-command.ts` | /context handler |
| `src/main/services/slash-commands/status-command.ts` | /status handler |
| `src/main/services/slash-commands/doctor-command.ts` | /doctor handler |
| `src/main/services/slash-commands/review-command.ts` | /review handler |
| `src/main/services/slash-commands/export-command.ts` | /export handler |
| `src/renderer/components/ide/claude/ClaudeContextGrid.tsx` | Context usage grid UI |
| `src/renderer/components/ide/claude/ClaudeExportDialog.tsx` | Export conversation dialog |
| `tests/main/services/slash-command-registry.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claude:command:execute` channel |
| `src/main/ipc/handlers.ts` | Register command execution handler |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Replace static array with registry-based commands; add categories |
| `src/renderer/stores/useClaudeStore.ts` | Update command execution to use registry; add `/rename` and `/resume` handlers |
| `src/renderer/components/ide/claude/ClaudeConversationHistory.tsx` | Support `/resume` interactive picker |

### Key Interfaces/Types

```typescript
// src/shared/types/slash-commands.types.ts

export type CommandCategory =
  | 'session'      // /clear, /compact, /new, /resume, /rename, /export
  | 'config'       // /config, /model, /permissions, /allowed-tools, /output-style, /privacy-settings, /theme
  | 'context'      // /context, /memory, /init
  | 'monitoring'   // /cost, /status, /doctor, /help
  | 'workflow'     // /review, /vim, /sandbox
  | 'custom';      // user/project commands

export interface SlashCommandDef {
  name: string;
  description: string;
  category: CommandCategory;
  /** Lucide icon name */
  icon: string;
  /** Whether this command opens an interactive UI panel */
  interactive: boolean;
  /** Whether this command accepts arguments */
  acceptsArgs: boolean;
  /** Argument placeholder text */
  argPlaceholder?: string;
}

export interface CommandContext {
  projectPath: string;
  conversationId: string | null;
  currentModel: string;
}

export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Text response to display in chat */
  message?: string;
  /** Whether to open an interactive panel */
  openPanel?: string;
  /** Data for the panel */
  panelData?: unknown;
  /** Whether this replaces the user's message (not sent to Claude) */
  handled: boolean;
}
```

---

## Implementation Tasks

### Task 1: Define Slash Command Types
- **Type:** Implementation
- **Files:** `src/shared/types/slash-commands.types.ts`
- **Details:** Create `CommandCategory`, `SlashCommandDef`, `CommandContext`, `CommandResult` types.
- **Test:** Type compilation check.

### Task 2: Create Command Registry Service
- **Type:** Implementation
- **Files:** `src/main/services/slash-command-registry.service.ts`
- **Details:** Create `SlashCommandRegistry` class with `register()`, `getAll()`, `getByName()`, `getByCategory()` methods. Register all 27 built-in commands with their definitions (name, description, category, icon, interactive flag). The registry holds definitions; handlers are separate.
- **Test:** Register commands; lookup by name; filter by category; list all.

### Task 3: Implement /help Command
- **Type:** Implementation
- **Files:** `src/main/services/slash-command-registry.service.ts`
- **Details:** `/help` handler returns all commands grouped by category. Format as markdown with headers per category and table of command name + description. Include custom commands from WO-044 if available.
- **Test:** Output includes all commands; grouped by category; custom commands included.

### Task 4: Implement /context Command
- **Type:** Implementation
- **Files:** `src/main/services/slash-commands/context-command.ts`, `src/renderer/components/ide/claude/ClaudeContextGrid.tsx`
- **Details:** `/context` handler calculates current context usage: tokens used, tokens remaining, percentage. Returns data for a visual grid display. Grid shows colored blocks (green = available, yellow = warning, red = full). Show warnings about excluded content (skills, large files). Uses token tracking from `useClaudeStore.tokenUsage`.
- **Test:** Context grid renders; colors change at thresholds; warnings display.

### Task 5: Implement /status and /doctor Commands
- **Type:** Implementation
- **Files:** `src/main/services/slash-commands/status-command.ts`, `src/main/services/slash-commands/doctor-command.ts`
- **Details:** `/status` shows: API connectivity (ping Anthropic API), current model, permission mode, active hooks count, MCP servers count, container status. `/doctor` runs diagnostics: check API key validity, check container health, check Node.js version, check disk space, check network connectivity to api.anthropic.com. Return results as markdown checklist with pass/fail indicators.
- **Test:** Status returns system info; doctor runs all checks; handles failures gracefully.

### Task 6: Implement /review Command
- **Type:** Implementation
- **Files:** `src/main/services/slash-commands/review-command.ts`
- **Details:** `/review` handler collects current git diff (staged + unstaged changes), formats as a code review prompt, and sends to Claude with instructions to review the changes for bugs, style issues, and improvements. Uses existing `git:status` IPC to get changed files and `fs:read-file` to read diff content.
- **Test:** Collects git changes; formats review prompt; handles no changes.

### Task 7: Implement /rename and /resume Commands
- **Type:** Implementation
- **Files:** `src/renderer/stores/useClaudeStore.ts`, `src/renderer/components/ide/claude/ClaudeConversationHistory.tsx`
- **Details:** `/rename` prompts for a new name via inline input, then updates the current conversation title via `claude:conversations:save` IPC. `/resume` opens the conversation history picker (existing `ClaudeConversationHistory` component) with enhanced search and time-based grouping (Today, Yesterday, Last 7 days, Older).
- **Test:** Rename updates title; resume shows picker; time grouping works.

### Task 8: Implement /export Command
- **Type:** Implementation
- **Files:** `src/main/services/slash-commands/export-command.ts`, `src/renderer/components/ide/claude/ClaudeExportDialog.tsx`
- **Details:** `/export` opens a dialog with export options: Copy to Clipboard (markdown format), Save to File (choose location via `dialog:open-directory`). Export includes full conversation with timestamps, tool calls, and thinking sections. Format as readable markdown.
- **Test:** Export to clipboard; export to file; format correct; all message types included.

### Task 9: Implement /sandbox, /output-style, /privacy-settings Commands
- **Type:** Implementation
- **Files:** `src/main/services/slash-command-registry.service.ts`
- **Details:** `/sandbox` toggles sandboxed bash mode (restricts bash to read-only or safe operations). Store as session-level flag. `/output-style` opens inline picker for response format: concise, detailed, code-focused. Store preference in settings. `/privacy-settings` shows current data sharing settings (telemetry, logging) with toggles.
- **Test:** Sandbox toggle works; output-style persists; privacy settings toggle.

### Task 10: Enhance /compact with Focus Instructions
- **Type:** Implementation
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Update the existing `/compact` handler to accept optional arguments after the command name. When user types `/compact focus on authentication logic`, extract "focus on authentication logic" as focus instructions and pass to the compaction prompt. The focus text is prepended to the compaction system prompt.
- **Test:** Compact without args (existing behavior); compact with focus text; focus text appears in compaction prompt.

### Task 11: Update ClaudeSlashCommands.tsx
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
- **Details:** Replace static `BUILTIN_COMMANDS` array with dynamic list from `SlashCommandRegistry` via IPC. Add category grouping in the dropdown (section headers). Update icons to match each command. Show argument placeholder for commands that accept args. Support keyboard navigation within categories.
- **Test:** All 27 commands appear; categories displayed; icons match; argument placeholder shown.

### Task 12: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/slash-command-registry.service.test.ts`
- **Details:** Tests for: registry (register, lookup, category filter), /help (format, completeness), /context (data calculation, grid thresholds), /status (API check, system info), /doctor (all diagnostics), /review (git diff collection, prompt format), /rename (title update), /export (markdown format, all message types), /compact with focus (argument extraction).
- **Test:** All tests pass; coverage >= 80%.

---

## Testing Requirements

- **Unit Tests:** 25+ test cases covering registry and individual command handlers
- **Integration Tests:** 5+ test cases for IPC round-trips and UI rendering
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock IPC invoke, git operations, filesystem, clipboard API

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix; 0 errors |
| 2 | Structure | All imports resolve; types valid; module structure correct |
| 3 | Build | TypeScript compilation (tsc); 0 errors |
| 4 | Testing | All unit + integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Final Review | Best practices; Design Doc adherence; DRA approval |

---

## Audit Checklist Items Addressed

From `CLAUDE-CODE-EXTENSION-AUDIT.md`:

**S4 Built-in Slash Commands:**
- [ ] /help - Display all available commands including custom commands
- [ ] /clear - Clear conversation history and start fresh; frees context window
- [ ] /compact - Compress history with optional focus instructions
- [ ] /config - Open interactive configuration/settings panel
- [ ] /model - Switch between Claude models mid-session
- [ ] /permissions - View and update tool permissions interactively
- [ ] /allowed-tools - Configure tool permissions interactively
- [ ] /context - View context usage as a colored grid
- [ ] /cost - Show API token usage statistics
- [ ] /status - View account and system statuses
- [ ] /doctor - Check Claude Code installation health
- [ ] /review - Request a code review of current changes
- [ ] /rename - Rename current session
- [ ] /resume - Resume a previous conversation; shows interactive picker
- [ ] /export - Export conversation to a file or clipboard
- [ ] /vim - Enter vim mode (placeholder)
- [ ] /theme - Theme picker (placeholder)
- [ ] /sandbox - Enable sandboxed bash execution
- [ ] /output-style - Configure how Claude formats responses
- [ ] /privacy-settings - Control data sharing and storage

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Command name collision with custom commands | Low | Low | Built-in commands take precedence; warn on collision |
| /doctor checks failing on different platforms | Medium | Low | Platform-specific checks with graceful degradation |
| /export producing very large files | Low | Low | Add size warning for conversations over 1MB |
| /review with no git changes confusing users | Low | Low | Show clear "no changes to review" message |

---

## Notes

- Commands `/permissions` and `/allowed-tools` are registered here but their handlers delegate to the `PermissionsEngine` from WO-045. If WO-045 is not complete, these commands show a "not yet available" message.
- Commands `/vim` and `/theme` are registered as placeholders with "coming in a future update" messages until WO-066 and WO-067 are complete.
- The `/memory` and `/init` commands are registered in WO-043 (CLAUDE.md Hierarchy), not here.
- The command registry pattern introduced here is reusable for WO-044 (Custom Commands) and WO-048 (Skills) to register their commands into the same registry.
- The `/exit` command from the audit is not needed since Cola Records is a GUI app (users close the panel instead).
