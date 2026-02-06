# WO-045: Full Permissions System

**Phase:** 1 - Foundation & Infrastructure
**Priority:** CRITICAL
**Complexity:** 8/10
**Dependencies:** WO-042 (Settings Hierarchy & Configuration System)
**Estimated Tasks:** 13
**Category References:** S10 Permissions System

---

## Objective

Implement the complete permissions system with 4 permission modes (Normal, Plan, AcceptEdits, Bypass), a rule evaluation engine supporting Allow/Ask/Deny rules with deny > ask > allow precedence, wildcard pattern matching for tool names, "Always Allow" persistence, `/allowed-tools` and `/permissions` slash commands, and integration with the settings hierarchy for config file allowlists. This replaces the current simple `ClaudePermissionMode` and `ClaudeToolPermission[]` system.

---

## Background

**Current State:**
- `ClaudePermissionMode` type in channels.ts: `'normal' | 'plan' | 'acceptEdits' | 'auto'`
- `ClaudeToolPermission` interface: `{ toolName: string; allowed: boolean }`
- `savedToolPermissions` array in Claude store
- `ClaudePermission.tsx` component shows permission dialogs with Accept/Reject
- Permission mode can be toggled via `setPermissionMode()`
- No wildcard pattern matching
- No deny > ask > allow evaluation order
- No "Always Allow" option in permission dialog
- No `/allowed-tools` or `/permissions` slash commands
- No integration with settings hierarchy file allowlists
- `disableBypassPermissionsMode` not implemented

**Target State:**
- Full 4-mode state machine with proper enforcement
- Rule-based evaluation with deny > ask > allow precedence
- Wildcard patterns: `Bash(npm run *)`, `mcp__server__*`, `Write(src/*)`
- "Always Allow" button in permission dialog that persists to settings
- `/allowed-tools` and `/permissions` interactive commands
- Settings file allowlist integration (from WO-042)
- `disableBypassPermissionsMode` managed setting support
- Mode indicator in prompt box with click-to-switch

---

## Acceptance Criteria

- [ ] 4 permission modes work correctly: Normal (ask each time), Plan (read-only), AcceptEdits (auto-accept file edits), Bypass (auto-accept all)
- [ ] Permission rules support 3 types: Allow (auto-approve), Ask (prompt user), Deny (block entirely)
- [ ] Rule evaluation follows deny > ask > allow precedence
- [ ] Wildcard patterns work for tool names: `Bash(npm run *)`, `mcp__*__*`, `Write(src/**)`
- [ ] Tool-specific permissions work: `Read`, `Write`, `Edit`, `Bash(command:*)`, `WebFetch(domain)`
- [ ] "Always Allow" button in permission dialog adds tool to allowlist in `.claude/settings.local.json`
- [ ] `/allowed-tools` command lists allowed tools and supports `add`/`remove` operations
- [ ] `/permissions` command shows interactive permissions management view
- [ ] Permission rules from settings hierarchy (user, project, local) are loaded and merged
- [ ] `disableBypassPermissionsMode` setting prevents enabling bypass mode
- [ ] Mode toggle accessible via prompt box indicator (click to cycle)
- [ ] Plan mode enforces read-only (blocks Write, Edit, Bash write operations)
- [ ] AcceptEdits mode auto-approves Write and Edit but still asks for Bash
- [ ] Bypass mode auto-approves everything (with prominent warning)
- [ ] Unit tests cover rule evaluation, wildcards, mode transitions, persistence
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
PermissionsEngine (main process)
  |-- loadRules(settingsHierarchy) -> merge allow/deny rules from all tiers
  |-- evaluatePermission(toolName, toolInput, mode) -> Allow | Ask | Deny
  |   |-- checkDenyRules(toolName) -> if match, return Deny
  |   |-- checkAskRules(toolName) -> if match, return Ask
  |   |-- checkAllowRules(toolName) -> if match, return Allow
  |   |-- applyModeOverrides(mode) -> mode-specific logic
  |-- matchPattern(pattern, toolName) -> wildcard matching
  |-- addToAllowlist(toolPattern, tier) -> persist to settings file
  |-- removeFromAllowlist(toolPattern, tier) -> remove from settings file
  |-- setMode(mode) -> state machine transition
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/permissions-engine.service.ts` | Permission evaluation, rule matching, mode state machine |
| `src/shared/types/permissions.types.ts` | TypeScript interfaces for permissions system |
| `tests/main/services/permissions-engine.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claude:permissions:evaluate`, `claude:permissions:allowed-tools`, `claude:permissions:set-mode` channels; update `ClaudePermissionMode` to include `'bypassPermissions'` |
| `src/main/ipc/handlers.ts` | Register permissions IPC handlers |
| `src/main/services/claude-container.service.ts` | Integrate permission evaluation before tool execution |
| `src/renderer/components/ide/claude/ClaudePermission.tsx` | Add "Always Allow" button; show rule-based info |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Update mode indicator with click-to-cycle and bypass warning |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Add `/allowed-tools` and `/permissions` commands |
| `src/renderer/stores/useClaudeStore.ts` | Update permission state management |

### Key Interfaces/Types

```typescript
// src/shared/types/permissions.types.ts

export type PermissionMode = 'normal' | 'plan' | 'acceptEdits' | 'bypassPermissions';

export type PermissionDecision = 'allow' | 'ask' | 'deny';

export interface PermissionRule {
  /** Tool pattern with wildcards: "Bash(npm run *)", "Write", "mcp__*__*" */
  pattern: string;
  /** Rule type */
  decision: PermissionDecision;
  /** Where this rule comes from */
  source: 'user' | 'project' | 'local' | 'session';
}

export interface PermissionEvaluationRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
  currentMode: PermissionMode;
}

export interface PermissionEvaluationResult {
  decision: PermissionDecision;
  /** Which rule produced this decision */
  matchedRule: PermissionRule | null;
  /** Reason for the decision */
  reason: string;
}

export interface AllowedToolsConfig {
  /** Tools that are always allowed */
  allow: string[];
  /** Tools that always require asking */
  ask: string[];
  /** Tools that are always denied */
  deny: string[];
}

export interface PermissionsState {
  mode: PermissionMode;
  rules: PermissionRule[];
  sessionAllowlist: string[];
  disableBypassPermissionsMode: boolean;
}
```

---

## Implementation Tasks

### Task 1: Define Permissions Types
- **Type:** Implementation
- **Files:** `src/shared/types/permissions.types.ts`
- **Details:** Create all permission type interfaces: `PermissionMode`, `PermissionDecision`, `PermissionRule`, `PermissionEvaluationRequest`, `PermissionEvaluationResult`, `AllowedToolsConfig`, `PermissionsState`.
- **Test:** Type compilation check.

### Task 2: Implement Wildcard Pattern Matcher
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Create `PermissionsEngine` class. Implement `matchPattern(pattern: string, toolName: string): boolean`. Support `*` for any sequence of characters within a segment, `**` for recursive matching. Handle tool patterns with parameters: `Bash(npm run *)` matches `Bash(npm run test)`, `Bash(npm run build)`. Handle MCP patterns: `mcp__server__*` matches `mcp__server__search`, `mcp__server__list`. Handle path patterns in tool args: `Write(src/*)`.
- **Test:** Exact match; single wildcard; double wildcard; parameter matching; MCP patterns; no match.

### Task 3: Implement Rule Evaluation Engine
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Implement `evaluatePermission(request: PermissionEvaluationRequest): PermissionEvaluationResult`. Evaluation order: (1) Check deny rules first -- if any match, return Deny. (2) Check ask rules -- if any match, return Ask. (3) Check allow rules -- if any match, return Allow. (4) Default to Ask. Also apply mode overrides: Plan mode forces deny on write tools, AcceptEdits mode forces allow on Edit/Write, Bypass forces allow on everything.
- **Test:** Deny overrides allow; ask overrides allow; allow works; default is ask; mode overrides work.

### Task 4: Implement Mode State Machine
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Implement `setMode(mode: PermissionMode): boolean` with validation. Check `disableBypassPermissionsMode` setting before allowing bypass mode. Emit mode change events. Store current mode in memory (session-level, not persisted by default). Define valid mode transitions (all modes can transition to any other mode, except bypass if disabled).
- **Test:** All mode transitions; bypass blocked when disabled; event emission.

### Task 5: Implement Rules Loader from Settings
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Implement `loadRules(resolvedSettings: ResolvedSettings): PermissionRule[]` that reads `permissions.allowedTools` (-> allow rules), `permissions.deny` (-> deny rules), and `disallowedTools` (-> deny rules) from the hierarchical settings. Convert tool patterns to `PermissionRule` objects with appropriate source labels.
- **Test:** Load from each tier; merge rules from multiple tiers; empty settings.

### Task 6: Implement "Always Allow" Persistence
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Implement `addToAllowlist(toolPattern: string): void` that adds the pattern to `.claude/settings.local.json` under `permissions.allowedTools`. Read existing file, merge new entry, write back. Also maintain a session-level allowlist for temporary "allow for this session" decisions.
- **Test:** Add to empty file; add to existing file; avoid duplicates; session-level allowlist.

### Task 7: Implement Remove from Allowlist
- **Type:** Implementation
- **Files:** `src/main/services/permissions-engine.service.ts`
- **Details:** Implement `removeFromAllowlist(toolPattern: string): void` that removes the pattern from settings. Support removing from session allowlist too.
- **Test:** Remove existing; remove non-existent (no error); verify file updated.

### Task 8: Register IPC Channels
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add channels: `'claude:permissions:evaluate': (request: PermissionEvaluationRequest) => PermissionEvaluationResult`, `'claude:permissions:get-state': () => PermissionsState`, `'claude:permissions:set-mode': (mode: PermissionMode) => boolean`, `'claude:permissions:add-allowed': (pattern: string) => void`, `'claude:permissions:remove-allowed': (pattern: string) => void`. Register handlers.
- **Test:** IPC round-trip for all channels.

### Task 9: Integrate with Claude Container Service
- **Type:** Implementation
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** Before executing any tool call, call `PermissionsEngine.evaluatePermission()`. If result is `deny`, block the tool and return an error. If `ask`, send permission request to renderer (existing flow). If `allow`, proceed without asking. This replaces the current simple permission check.
- **Test:** Tool blocked by deny rule; tool auto-allowed by allow rule; tool prompts on ask.

### Task 10: Update Permission Dialog
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudePermission.tsx`
- **Details:** Add "Always Allow" button alongside Accept/Reject. When clicked, call `claude:permissions:add-allowed` IPC with the tool name pattern, then auto-accept the current request. Show which rule matched (if any) in the dialog. Add visual distinction between session-level and persistent allowlist.
- **Test:** Always Allow button appears; clicking persists to settings; rule info displayed.

### Task 11: Update Mode Indicator
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- **Details:** Update the permission mode indicator to be clickable and cycle through modes: Normal -> Plan -> AcceptEdits -> (Bypass if enabled). Show a prominent red warning when Bypass is active. Show tooltip with mode description. Use icons: Shield (Normal), Eye (Plan), FileEdit (AcceptEdits), AlertTriangle (Bypass).
- **Test:** Click cycles modes; bypass shows warning; tooltip displays.

### Task 12: Add /allowed-tools and /permissions Commands
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add `/allowed-tools` command that shows current allowlist and supports `add`/`remove` subcommands. Add `/permissions` command that opens an interactive panel showing all rules by tier, current mode, and management options. For `/allowed-tools add <pattern>`, parse the pattern from arguments.
- **Test:** Commands appear in slash menu; /allowed-tools lists tools; /permissions shows rules.

### Task 13: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/permissions-engine.service.test.ts`
- **Details:** Comprehensive tests: wildcard matching (15+ patterns), rule evaluation (deny > ask > allow precedence, all combinations), mode state machine (all transitions, bypass disabled), rules loading (from settings hierarchy), allowlist persistence (add, remove, dedup), integration scenarios (Plan mode blocks writes, AcceptEdits allows edits, Bypass allows all).
- **Test:** All tests pass; coverage >= 80%.

---

## Testing Requirements

- **Unit Tests:** 30+ test cases covering pattern matching, rule evaluation, mode transitions
- **Integration Tests:** 5+ test cases for IPC and container integration
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock settings hierarchy, filesystem, IPC invoke

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

**S10 Permissions System:**
- [ ] Normal mode (default) - asks permission before each action
- [ ] Plan mode - can analyze but not modify
- [ ] Accept Edits mode (acceptEdits) - auto-accepts file edit permissions
- [ ] Bypass Permissions mode (bypassPermissions) - auto-accepts all
- [ ] Mode indicator in prompt box - clickable indicator showing current mode
- [ ] Allow rules - tools run without manual approval
- [ ] Ask rules - prompt user for confirmation
- [ ] Deny rules - prevent tool use entirely
- [ ] Evaluation order - deny > ask > allow
- [ ] Interactive "Always Allow" - click in permission dialog to add to allowlist
- [ ] /allowed-tools add - add tools via chat command
- [ ] /permissions command - view and manage permissions interactively
- [ ] Config file allowlist - define in settings.json files
- [ ] Wildcard patterns - `Bash(npm run *)`, `mcp__server__*`
- [ ] Tool-specific permissions - `Read`, `Write`, `Edit`, `Bash(command:*)`, `WebFetch(domain)`
- [ ] disableBypassPermissionsMode - managed setting to prevent bypass mode
- [ ] additionalDirectories - allow-list for additional directories

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bypass mode security risk | High | High | Prominent red warning; disableBypassPermissionsMode setting; require confirmation dialog |
| Wildcard pattern too permissive | Medium | Medium | Document pattern syntax clearly; default to Ask for ambiguous cases |
| Permission evaluation performance overhead | Low | Low | Cache compiled patterns; evaluate lazily |
| Mode state corruption on crash | Low | Medium | Mode is session-level only; resets to Normal on restart |

---

## Notes

- This work order depends on WO-042 (Settings Hierarchy) for reading permission rules from settings files.
- The `PermissionMode` type is updated from `'auto'` to `'bypassPermissions'` to match Claude Code naming. The old `'auto'` value should be treated as an alias for backwards compatibility.
- Managed settings (organization-level) support for `disableBypassPermissionsMode` is implemented as a simple check in the mode state machine. Full managed settings infrastructure is deferred.
- The CLI flags `--allowedTools` and `--disallowedTools` are not implemented since Cola Records is a GUI app. Their equivalent functionality is provided through the settings files and slash commands.
