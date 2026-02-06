# WO-046: Full Hooks System

**Phase:** 1 - Foundation & Infrastructure
**Priority:** HIGH
**Complexity:** 9/10
**Dependencies:** WO-042 (Settings Hierarchy & Configuration System)
**Estimated Tasks:** 15
**Category References:** S13 Hooks System

---

## Objective

Implement the complete hooks system with 12 event types, 3 hook types (command, prompt, agent), matcher patterns, exit code handling, JSON output processing, decision control per event type, async hooks, configurable timeouts, hooks from 4 configuration sources, the `/hooks` interactive menu, and parallel execution. This is the most complex work order in Phase 1 and provides the extensibility backbone for the entire Claude integration.

---

## Background

**Current State:**
- `ClaudeHook` interface in `src/main/ipc/channels.ts` (lines 148-157) has only `toolPattern`, `command`, `timing` ('pre'|'post'), and `enabled` fields
- Hooks stored in `AppSettings.claudeHooks` as a simple array
- No event type system (only pre/post tool)
- No prompt or agent hook types (only command)
- No matcher patterns (only exact tool name or '*')
- No exit code handling or JSON output parsing
- No decision control (allow/deny/block)
- No async hooks
- No timeout configuration
- No multi-source hook loading
- No `/hooks` interactive menu
- No parallel execution
- Current hook stream event type exists: `'hook_result'` in `ClaudeStreamEvent`

**Target State:**
- 12 lifecycle event types covering the full session lifecycle
- 3 hook executor types with distinct capabilities
- Regex-based matcher patterns
- Exit code protocol (0=success, 2=blocking error)
- JSON output with decision control fields
- Async hook support for non-blocking execution
- Configurable timeouts per handler
- Hooks loaded from user, project, local, and plugin sources
- Interactive `/hooks` management menu
- Parallel execution of matching hooks

---

## Acceptance Criteria

- [ ] All 12 event types fire at correct lifecycle points: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, PreCompact, SessionEnd
- [ ] Command hooks execute shell commands with JSON on stdin and parse exit codes
- [ ] Prompt hooks send single-turn prompts to Claude for yes/no evaluation
- [ ] Agent hooks spawn subagents with tool access (Read, Grep, Glob) for multi-turn verification
- [ ] Matcher patterns filter hooks by regex (e.g., `Edit|Write`, `mcp__memory__.*`)
- [ ] Exit code 0 = success (stdout parsed as JSON); exit code 2 = blocking error (stderr shown)
- [ ] JSON output fields work: `continue`, `stopReason`, `systemMessage`, `suppressOutput`, `additionalContext`
- [ ] Decision control per event: PreToolUse supports `permissionDecision`, PostToolUse supports `decision: block`, Stop supports `decision: block`, UserPromptSubmit supports `decision: block`
- [ ] `updatedInput` field in PreToolUse modifies tool parameters before execution
- [ ] Async hooks (`async: true`) run in background without blocking Claude
- [ ] Hook timeout is configurable per handler (defaults: 600s command, 30s prompt, 60s agent)
- [ ] Hooks loaded from 4 sources: user settings, project settings, local settings, plugin hooks
- [ ] `/hooks` interactive menu shows hooks by source with add/delete options
- [ ] `$CLAUDE_PROJECT_DIR` environment variable set for hook commands
- [ ] `disableAllHooks` toggle prevents all hooks from firing
- [ ] Hook snapshot captured at startup; external changes require review
- [ ] Multiple matching hooks execute in parallel
- [ ] Unit tests cover each event type, hook type, matchers, decisions, timeouts
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
HooksEngine (main process)
  |-- loadHooks(settingsHierarchy) -> merge hooks from all 4 sources
  |-- snapshotHooks() -> capture hook config at session start
  |-- fireEvent(eventType, context) -> find matching hooks, execute
  |   |-- matchHooks(eventType, matchers) -> filter by event + regex
  |   |-- executeParallel(hooks[], context) -> run all matching hooks
  |   |-- processResults(results[]) -> aggregate decisions
  |
  |-- CommandHookExecutor
  |   |-- spawn(command, stdinJson) -> execute shell, read exit code + stdout
  |
  |-- PromptHookExecutor
  |   |-- evaluate(prompt, context) -> single-turn Claude query
  |
  |-- AgentHookExecutor
  |   |-- spawn(prompt, tools[]) -> multi-turn subagent with restricted tools
  |
  |-- HookTimeoutManager
  |   |-- setTimeout(hookId, ms) -> kill hook after timeout
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/hooks-engine.service.ts` | Core hooks engine: load, match, fire, execute |
| `src/main/services/hooks/command-executor.ts` | Shell command hook executor |
| `src/main/services/hooks/prompt-executor.ts` | Prompt hook executor (single-turn Claude query) |
| `src/main/services/hooks/agent-executor.ts` | Agent hook executor (multi-turn subagent) |
| `src/shared/types/hooks.types.ts` | TypeScript interfaces for hooks system |
| `src/renderer/components/ide/claude/ClaudeHooksManager.tsx` | Interactive hooks management UI |
| `tests/main/services/hooks-engine.service.test.ts` | Unit tests for engine |
| `tests/main/services/hooks/command-executor.test.ts` | Tests for command executor |
| `tests/main/services/hooks/prompt-executor.test.ts` | Tests for prompt executor |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add hook management channels; update `ClaudeHook` type or replace with new types |
| `src/main/ipc/handlers.ts` | Register hooks IPC handlers |
| `src/main/services/claude-container.service.ts` | Fire hook events at each lifecycle point |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Add `/hooks` command |
| `src/renderer/stores/useClaudeStore.ts` | Add hooks state and management methods |

### Key Interfaces/Types

```typescript
// src/shared/types/hooks.types.ts

export type HookEventType =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'PreCompact'
  | 'SessionEnd';

export type HookType = 'command' | 'prompt' | 'agent';

export type HookSource = 'user' | 'project' | 'local' | 'plugin';

export interface HookHandler {
  /** Shell command, prompt text, or agent prompt */
  command?: string;
  prompt?: string;
  /** Type of hook executor */
  type: HookType;
  /** Timeout in seconds (defaults: command=600, prompt=30, agent=60) */
  timeout?: number;
  /** Run in background without blocking */
  async?: boolean;
  /** Custom spinner message during execution */
  statusMessage?: string;
  /** Run only once per session then remove (skills only) */
  once?: boolean;
}

export interface HookConfig {
  /** Event type to match */
  event: HookEventType;
  /** Regex matcher patterns for event-specific filtering */
  matchers?: string[];
  /** One or more handlers to execute */
  handlers: HookHandler[];
  /** Source of this hook configuration */
  source: HookSource;
}

export interface HookContext {
  /** Event type */
  event: HookEventType;
  /** Tool name (for tool events) */
  toolName?: string;
  /** Tool input (for tool events) */
  toolInput?: Record<string, unknown>;
  /** Tool output (for PostToolUse) */
  toolOutput?: string;
  /** Session ID */
  sessionId: string;
  /** Project directory */
  projectDir: string;
}

export interface HookResult {
  /** Hook that produced this result */
  hook: HookConfig;
  /** Handler that ran */
  handler: HookHandler;
  /** Exit code (command hooks) */
  exitCode?: number;
  /** Parsed JSON output */
  output?: HookOutput;
  /** Error message if failed */
  error?: string;
  /** Whether hook completed within timeout */
  timedOut: boolean;
}

export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  additionalContext?: string;
  /** PreToolUse decision control */
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  /** PostToolUse/Stop decision control */
  decision?: 'block';
  reason?: string;
  updatedMCPToolOutput?: string;
  /** PermissionRequest control */
  behavior?: 'allow' | 'deny';
  updatedPermissions?: Record<string, unknown>;
  message?: string;
  interrupt?: boolean;
}

export interface HooksState {
  hooks: HookConfig[];
  disabled: boolean;
  snapshotTaken: boolean;
}
```

---

## Implementation Tasks

### Task 1: Define Hooks Type Interfaces
- **Type:** Implementation
- **Files:** `src/shared/types/hooks.types.ts`
- **Details:** Create all interfaces: `HookEventType`, `HookType`, `HookSource`, `HookHandler`, `HookConfig`, `HookContext`, `HookResult`, `HookOutput`, `HooksState`. These are comprehensive types that cover the full audit checklist for S13.
- **Test:** Type compilation check.

### Task 2: Implement Hook Configuration Loader
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** Create `HooksEngine` class. Implement `loadHooks(settingsHierarchy: ResolvedSettings): HookConfig[]` that reads hooks from all 4 sources. From settings hierarchy, read `hooks` object where keys are event types and values are handler arrays. Label each hook with its source. Check `disableAllHooks` toggle.
- **Test:** Load from each source; merge from multiple sources; disabled toggle.

### Task 3: Implement Hook Snapshot
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** Implement `snapshotHooks(): void` that captures the current hook configuration at session start. If hooks change externally during a session, the engine detects the change and prompts for review before applying. Store snapshot as a deep copy.
- **Test:** Snapshot captured; external change detected; review prompt.

### Task 4: Implement Regex Matcher System
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** Implement `matchHooks(event: HookEventType, context: HookContext): HookConfig[]` that filters hooks by event type, then applies regex matchers against the relevant context field (tool name for tool events, session type for SessionStart, etc.). Return all matching hooks. Handle invalid regex gracefully (log warning, skip).
- **Test:** Event type filtering; regex matching for tool names; matchers for SessionStart (startup/resume/clear/compact); invalid regex.

### Task 5: Implement Command Hook Executor
- **Type:** Implementation
- **Files:** `src/main/services/hooks/command-executor.ts`
- **Details:** Implement `CommandHookExecutor.execute(handler: HookHandler, context: HookContext): Promise<HookResult>`. Spawn a child process with `handler.command`. Write JSON context to stdin. Set `$CLAUDE_PROJECT_DIR` in env. Read stdout and stderr. Parse exit code: 0 = parse stdout as JSON `HookOutput`; 2 = blocking error, use stderr as error message; other = non-blocking error. Apply timeout. Kill process on timeout.
- **Test:** Exit code 0 with JSON output; exit code 2 with error; timeout; env vars set; stdin JSON.

### Task 6: Implement Prompt Hook Executor
- **Type:** Implementation
- **Files:** `src/main/services/hooks/prompt-executor.ts`
- **Details:** Implement `PromptHookExecutor.execute(handler: HookHandler, context: HookContext): Promise<HookResult>`. Send a single-turn prompt to Claude (using the existing query infrastructure) with the handler's prompt text and context. Parse Claude's response as a yes/no decision. Apply timeout (default 30s).
- **Test:** Prompt returns yes; returns no; timeout; error response.

### Task 7: Implement Agent Hook Executor
- **Type:** Implementation
- **Files:** `src/main/services/hooks/agent-executor.ts`
- **Details:** Implement `AgentHookExecutor.execute(handler: HookHandler, context: HookContext): Promise<HookResult>`. Spawn a subagent with restricted tools (Read, Grep, Glob only) to perform multi-turn verification. The agent runs the handler's prompt and returns a structured result. Apply timeout (default 60s).
- **Test:** Agent completes within timeout; timeout; tool restrictions enforced.

### Task 8: Implement Parallel Event Dispatcher
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** Implement `fireEvent(event: HookEventType, context: HookContext): Promise<HookResult[]>`. Find all matching hooks, deduplicate identical handlers, execute all in parallel using `Promise.allSettled()`. Collect results. Process aggregated decisions (if any hook returns deny, overall decision is deny).
- **Test:** Multiple hooks fire in parallel; deduplication; aggregated decisions; partial failures.

### Task 9: Implement Decision Processor
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** Implement `processDecisions(event: HookEventType, results: HookResult[]): HookOutput` that aggregates decision output from multiple hooks. For PreToolUse: if any result has `permissionDecision: 'deny'`, overall is deny. For Stop: if any result has `decision: 'block'`, Claude continues. Handle `continue: false` -> stop Claude. Handle `systemMessage` -> show to user. Handle `additionalContext` -> inject into Claude's context. Handle `updatedInput` -> modify tool parameters (only from first hook that provides it).
- **Test:** Deny overrides allow; block forces continue; systemMessage displayed; updatedInput applied.

### Task 10: Implement Async Hook Support
- **Type:** Implementation
- **Files:** `src/main/services/hooks-engine.service.ts`
- **Details:** For hooks with `async: true`, fire the hook but don't await the result. Store the result promise and deliver output on the next Claude turn as additional context. Track async hooks in a map of pending results.
- **Test:** Async hook doesn't block; result delivered on next turn; multiple async hooks.

### Task 11: Integrate with Claude Container Service
- **Type:** Implementation
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** Fire hooks at each lifecycle point: `SessionStart` on container start, `UserPromptSubmit` before processing, `PreToolUse`/`PostToolUse`/`PostToolUseFailure` around tool calls (modify existing tool execution flow), `PermissionRequest` before showing permission dialog, `Stop` when Claude finishes, `PreCompact` before compaction, `SessionEnd` on container stop. Apply decision results (block tool calls, modify inputs, stop execution).
- **Test:** Each event fires at correct point; decisions are applied; blocking works.

### Task 12: Register IPC Channels
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add channels: `'claude:hooks:get-state': () => HooksState`, `'claude:hooks:add': (hook: HookConfig) => void`, `'claude:hooks:remove': (index: number, source: HookSource) => void`, `'claude:hooks:toggle-all': (disabled: boolean) => void`. Register handlers.
- **Test:** IPC round-trip for all channels.

### Task 13: Create Hooks Manager UI
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeHooksManager.tsx`
- **Details:** Create interactive hooks management component. Show hooks grouped by source: [User], [Project], [Local], [Plugin]. Each hook shows event type, matchers, handler type, and enabled state. Add button to create new hooks (only for local source). Delete button for user-created hooks. Plugin hooks are read-only. Show hook execution log (last N results).
- **Test:** Hooks display by source; add new hook; delete hook; plugin hooks read-only.

### Task 14: Add /hooks Slash Command
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add `/hooks` to BUILTIN_COMMANDS. When selected, open the ClaudeHooksManager component as a panel/modal.
- **Test:** Command appears in slash menu; opens hooks manager.

### Task 15: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/hooks-engine.service.test.ts`, `tests/main/services/hooks/command-executor.test.ts`, `tests/main/services/hooks/prompt-executor.test.ts`
- **Details:** Comprehensive tests: hook loading (all sources, disabled toggle), regex matching (15+ patterns), command execution (exit codes 0/2/other, timeout, JSON parsing), prompt execution (yes/no, timeout), parallel dispatch (multiple hooks, dedup), decision processing (deny overrides, block, systemMessage, updatedInput), async hooks (non-blocking, deferred delivery), snapshot (capture, change detection).
- **Test:** All tests pass; coverage >= 80%.

---

## Testing Requirements

- **Unit Tests:** 40+ test cases across engine, executors, and matchers
- **Integration Tests:** 5+ test cases for lifecycle integration
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock child_process.spawn, Claude query for prompt hooks, filesystem, IPC

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

**S13 Hooks System:**
- [ ] SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, PreCompact, SessionEnd
- [ ] Command hooks (type: "command") - shell command execution with JSON stdin
- [ ] Prompt hooks (type: "prompt") - single-turn AI evaluation
- [ ] Agent hooks (type: "agent") - subagent with tool access
- [ ] User-level hooks, Project-level hooks, Local hooks, Plugin hooks
- [ ] Matcher patterns - regex-based filtering
- [ ] Exit code 0 = success; Exit code 2 = blocking error
- [ ] JSON output: continue, stopReason, systemMessage, suppressOutput, additionalContext
- [ ] Decision control: PreToolUse (permissionDecision, updatedInput)
- [ ] Decision control: PermissionRequest (behavior, updatedPermissions)
- [ ] Decision control: PostToolUse (decision: block, updatedMCPToolOutput)
- [ ] Decision control: Stop/SubagentStop (decision: block)
- [ ] Decision control: UserPromptSubmit (decision: block)
- [ ] PreToolUse input modification - updatedInput field
- [ ] Async hooks - `async: true` for background execution
- [ ] Hook timeout - configurable per handler
- [ ] statusMessage - custom spinner message
- [ ] once flag - run once per session
- [ ] $CLAUDE_PROJECT_DIR environment variable
- [ ] /hooks interactive menu
- [ ] disableAllHooks toggle
- [ ] Hook snapshot at startup
- [ ] Parallel execution of matching hooks

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hook commands executing malicious code | High | Critical | Hooks run with user permissions; document security warnings; review before adding |
| Runaway hooks consuming resources | Medium | High | Timeout enforcement; kill on timeout; resource limits |
| Complex interaction between multiple hooks | Medium | Medium | Clear aggregation rules; log all hook executions for debugging |
| Prompt/Agent hook executor calling Claude recursively | Low | High | Limit recursion depth; prompt hooks are single-turn only; agent hooks have restricted tools |
| Hook snapshot drift during long sessions | Low | Low | Periodic snapshot refresh with diff notification |

---

## Notes

- This is the highest complexity work order in Phase 1 (9/10). Consider splitting into sub-work-orders if implementation reveals additional complexity.
- Prompt and agent hook executors depend on the existing Claude query infrastructure in `claude-container.service.ts`. They should use a separate, lightweight query path that doesn't trigger hooks themselves (prevent recursion).
- The `$CLAUDE_ENV_FILE` SessionStart-only feature (persist env vars for subsequent Bash commands) is a stretch goal and can be deferred if time is tight.
- Plugin hooks (`hooks/hooks.json` in plugin directory) are read-only in the `/hooks` menu. Full plugin support comes in WO-051.
- Skill/Agent frontmatter hooks are handled in WO-048 (Skills) and WO-050 (Subagents) respectively.
