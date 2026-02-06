# WO-044: Project & User Custom Commands

**Phase:** 1 - Foundation & Infrastructure
**Priority:** CRITICAL
**Complexity:** 6/10
**Dependencies:** None
**Estimated Tasks:** 11
**Category References:** S5 Custom Commands & Skills

---

## Objective

Implement the full custom commands system that scans `.claude/commands/` (project-level) and `~/.claude/commands/` (user-level) directories for markdown command files, supports nested directories, `$ARGUMENTS` placeholder replacement, YAML frontmatter parsing, `@path/to/file` references, and the `/commands` slash command to list all available commands. This replaces the current static `ClaudeCustomCommand` system stored in AppSettings.

---

## Background

**Current State:**
- `ClaudeCustomCommand` interface in `src/main/ipc/channels.ts` (line 132-137) has `name`, `description`, `prompt` fields
- Custom commands are stored in `AppSettings.claudeCustomCommands` in SQLite
- `ClaudeSlashCommands.tsx` merges built-in and custom commands with a Zap icon
- No file-based command scanning from `.claude/commands/` or `~/.claude/commands/`
- No nested directory support
- No `$ARGUMENTS` placeholder
- No YAML frontmatter parsing
- No `@path/to/file` reference resolution
- The `.claude/` directory currently has 20 command files (Trinity agent commands) but they are not dynamically scanned

**Target State:**
- File-based command discovery from two directories with nested folder support
- YAML frontmatter for metadata (name, description, allowed-tools, etc.)
- `$ARGUMENTS` substitution at execution time
- `@file` references resolved to file content
- Project commands override user commands with same name
- `/commands` lists all available commands with source indicators

---

## Acceptance Criteria

- [ ] `.claude/commands/` directory is scanned recursively for `.md` files
- [ ] `~/.claude/commands/` directory is scanned recursively for `.md` files
- [ ] Nested directories map to colon-separated names (e.g., `planning/design.md` -> `/planning:design`)
- [ ] YAML frontmatter is parsed for `name`, `description`, and other metadata fields
- [ ] `$ARGUMENTS` placeholder in command body is replaced with user-provided arguments
- [ ] `@path/to/file` references in command body are resolved to file content
- [ ] Project commands override user commands with the same name
- [ ] `/commands` slash command lists all available commands with [Project] / [User] labels
- [ ] `/{custom-command-name}` execution works for any discovered command
- [ ] Commands with arguments work: `/{cmd} arg1 arg2` replaces `$ARGUMENTS` with `arg1 arg2`
- [ ] IPC channels `claude:commands:list` and `claude:commands:execute` are registered
- [ ] `ClaudeSlashCommands.tsx` displays custom commands from file scanning
- [ ] File watcher detects new/changed/deleted command files and updates the list
- [ ] Unit tests cover scanning, parsing, argument substitution, file references
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
CustomCommandsService (main process)
  |-- scanDirectory(path, scope) -> recursively find .md files
  |-- parseCommand(filePath) -> extract frontmatter + body
  |-- resolveFileRefs(body, basePath) -> replace @file references
  |-- substituteArguments(body, args) -> replace $ARGUMENTS
  |-- mergeCommands(project[], user[]) -> project overrides user
  |-- watchDirectories() -> detect changes
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/custom-commands.service.ts` | Command scanner, parser, executor |
| `src/shared/types/custom-commands.types.ts` | TypeScript interfaces |
| `tests/main/services/custom-commands.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claude:commands:list`, `claude:commands:execute` channels; update or extend `ClaudeCustomCommand` type |
| `src/main/ipc/handlers.ts` | Register command IPC handlers |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Replace static custom command list with dynamic file-scanned commands |
| `src/renderer/stores/useClaudeStore.ts` | Add `loadCustomCommands()` method; handle `/commands` execution |
| `src/renderer/ipc/client.ts` | Add typed client methods for new channels |

### Key Interfaces/Types

```typescript
// src/shared/types/custom-commands.types.ts

export type CommandScope = 'project' | 'user';

export interface CommandFrontmatter {
  name?: string;
  description?: string;
  'allowed-tools'?: string[];
  model?: string;
}

export interface CustomCommand {
  /** Slash command name (e.g., "planning:design") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Raw markdown body (before $ARGUMENTS substitution) */
  body: string;
  /** Parsed YAML frontmatter */
  frontmatter: CommandFrontmatter;
  /** Source scope */
  scope: CommandScope;
  /** Absolute file path */
  filePath: string;
  /** Whether the command body contains $ARGUMENTS */
  hasArguments: boolean;
}

export interface CommandExecutionRequest {
  commandName: string;
  arguments: string;
  projectPath: string;
}

export interface CommandExecutionResult {
  /** Resolved prompt to send to Claude */
  resolvedPrompt: string;
  /** Command metadata */
  command: CustomCommand;
}
```

---

## Implementation Tasks

### Task 1: Define Custom Command Types
- **Type:** Implementation
- **Files:** `src/shared/types/custom-commands.types.ts`
- **Details:** Create `CommandScope`, `CommandFrontmatter`, `CustomCommand`, `CommandExecutionRequest`, `CommandExecutionResult` types.
- **Test:** Type compilation check.

### Task 2: Implement Directory Scanner
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Create `CustomCommandsService` class. Implement `scanDirectory(dirPath: string, scope: CommandScope): CustomCommand[]` that recursively walks the directory, finds all `.md` files, and builds command names from relative paths (nested dirs use `:` separator). Handle missing directories gracefully (return empty array).
- **Test:** Scan with files at root; nested dirs; empty dir; missing dir.

### Task 3: Implement YAML Frontmatter Parser
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Implement `parseCommand(filePath: string, scope: CommandScope): CustomCommand` that reads a markdown file, extracts YAML frontmatter (content between `---` delimiters at file start), parses it with a YAML parser (use `yaml` npm package or simple regex for basic cases), and separates the body. If no frontmatter, the entire file is the body. Use filename (sans `.md`) as default name if not in frontmatter.
- **Test:** File with frontmatter; without frontmatter; malformed frontmatter; empty file.

### Task 4: Implement $ARGUMENTS Substitution
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Implement `substituteArguments(body: string, args: string): string` that replaces all occurrences of `$ARGUMENTS` in the body with the provided arguments string. If `$ARGUMENTS` is not present and args are provided, append args at the end. Set `hasArguments` flag during parsing.
- **Test:** Body with $ARGUMENTS; multiple occurrences; no placeholder with args; empty args.

### Task 5: Implement @file Reference Resolution
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Implement `resolveFileRefs(body: string, basePath: string): string` that scans for `@path/to/file` patterns in the body and replaces them with the file content. Resolve paths relative to the project root. Handle missing files by inserting a `[File not found: path]` placeholder. Limit total resolved content to 100KB to prevent context overflow.
- **Test:** Single @file; multiple refs; missing file; oversized file; relative and absolute paths.

### Task 6: Implement Command Merger
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Implement `loadAllCommands(projectPath: string): CustomCommand[]` that scans both project (`.claude/commands/`) and user (`~/.claude/commands/`) directories, then merges. Project commands override user commands with the same name. Return sorted array.
- **Test:** Project-only; user-only; both with overlap; both with unique commands.

### Task 7: Implement Command Executor
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Implement `executeCommand(request: CommandExecutionRequest): CommandExecutionResult` that finds the command by name, substitutes `$ARGUMENTS`, resolves `@file` references, and returns the resolved prompt ready to send to Claude.
- **Test:** Execute with args; without args; with file refs; unknown command name.

### Task 8: Implement File Watcher
- **Type:** Implementation
- **Files:** `src/main/services/custom-commands.service.ts`
- **Details:** Watch both command directories for file changes (add/modify/delete). On change, re-scan and emit updated command list. Debounce 300ms.
- **Test:** Add a command file; modify; delete; verify list updates.

### Task 9: Register IPC Channels
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add channels: `'claude:commands:list': (projectPath: string) => CustomCommand[]`, `'claude:commands:execute': (request: CommandExecutionRequest) => CommandExecutionResult`. Register handlers.
- **Test:** IPC round-trip for list and execute.

### Task 10: Update ClaudeSlashCommands.tsx
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Replace static `customCommands` prop with dynamic loading via `claude:commands:list` IPC. Display custom commands with [Project] / [User] scope badge. Add `/commands` to BUILTIN_COMMANDS list. When a custom command is selected, if it has `$ARGUMENTS`, prompt user for arguments before executing. Handle the execution flow: select command -> substitute args -> resolve refs -> send resolved prompt to Claude.
- **Test:** Commands appear in dropdown; scope badges display; argument prompt works; execution sends correct prompt.

### Task 11: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/custom-commands.service.test.ts`
- **Details:** Comprehensive tests: directory scanning (recursive, nested, missing), frontmatter parsing (valid, missing, malformed), $ARGUMENTS substitution (present, absent, multiple), @file resolution (valid, missing, oversized), merger (overlap, unique), executor (full flow), file watcher (add/modify/delete).
- **Test:** All tests pass; coverage >= 80%.

---

## Testing Requirements

- **Unit Tests:** 20+ test cases covering scanner, parser, substitution, resolution, merger
- **Integration Tests:** 5+ test cases for IPC round-trips
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock filesystem, `os.homedir()`, IPC invoke

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

**S5 Custom Commands & Skills:**
- [ ] Project-level commands - Markdown files in `.claude/commands/` directory
- [ ] Nested command directories - subdirectories map to colon-separated names
- [ ] $ARGUMENTS placeholder - replaced with user-provided arguments
- [ ] Bash execution in commands - commands can include bash code blocks
- [ ] File references in commands - `@path/to/file` syntax
- [ ] YAML frontmatter - optional metadata (name, description, configuration)
- [ ] User-level commands - `~/.claude/commands/` available across all projects
- [ ] Same format as project commands - all features supported

**S4 Built-in Slash Commands:**
- [ ] `/commands` - List all available slash commands including custom ones
- [ ] `/{custom-command-name}` - Execute any custom command

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large number of command files causing slow scanning | Low | Low | Cache scan results; re-scan only on file change |
| @file references loading very large files | Medium | Medium | 100KB content limit per resolved prompt |
| YAML frontmatter parsing errors | Low | Low | Graceful fallback to no-frontmatter mode |
| Command name collisions between Trinity agents and user commands | Medium | Low | Trinity agent commands in `.claude/commands/` are included as project commands; document naming conventions |

---

## Notes

- This work order is a dependency for WO-048 (Skills System) which extends the command concept.
- The existing 20 command files in `.claude/commands/` (Trinity agent commands) will automatically become available as slash commands after this work order.
- Bash execution within commands (running code blocks) is tracked as a capability but the primary mechanism is sending the resolved command body as a prompt to Claude, which then decides whether to use the Bash tool.
- The `yaml` npm package should be added as a dependency if not already present; alternatively, a simple regex-based parser can handle basic frontmatter without an external dependency.
