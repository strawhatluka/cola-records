# WO-042: Settings Hierarchy & Configuration System

**Phase:** 1 - Foundation & Infrastructure
**Priority:** CRITICAL
**Complexity:** 7/10
**Dependencies:** None
**Estimated Tasks:** 12
**Category References:** S10 Permissions, S11 Context, S19 Settings

---

## Objective

Implement a 3-tier settings file hierarchy (`~/.claude/settings.json` -> `.claude/settings.json` -> `.claude/settings.local.json`) with merge logic, environment variable resolution, JSON schema validation, and live reload via file watchers. This replaces the current flat `AppSettings` stored in SQLite with a hierarchical system that mirrors Claude Code's native configuration model.

---

## Background

**Current State:**
- Settings are stored in a single SQLite table via `settings:get` / `settings:update` IPC channels
- `AppSettings` interface in `src/main/ipc/channels.ts` (lines 159-175) has ~15 fields
- `useSettingsStore` in the renderer consumes the flat settings object
- `SettingsForm.tsx` provides UI for editing settings
- No file-based settings hierarchy exists
- No environment variable resolution for settings
- No file watcher for live reload
- No JSON schema validation

**Target State:**
- 3-tier file-based settings with merge precedence: local > project > user
- 50+ settings fields matching Claude Code VS Code extension
- Environment variable support for all `ANTHROPIC_*`, `CLAUDE_CODE_*`, and `BASH_*` env vars
- JSON schema for autocomplete and validation
- File watcher for live reload when settings files change on disk
- Backwards-compatible migration from SQLite settings

---

## Acceptance Criteria

- [ ] `~/.claude/settings.json` is loaded as user-level settings on startup
- [ ] `.claude/settings.json` (relative to project root) is loaded as project-level settings
- [ ] `.claude/settings.local.json` is loaded as local-level settings
- [ ] Settings merge follows local > project > user precedence (deep merge for objects, replace for primitives)
- [ ] All 50+ settings from audit S19 are defined in the TypeScript interface
- [ ] Environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `BASH_DEFAULT_TIMEOUT_MS`, `DISABLE_TELEMETRY`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_API_KEY`, `ENABLE_LSP_TOOL`, etc.) override file-based settings
- [ ] JSON schema file exists at `src/main/services/settings-schema.json` for validation
- [ ] File watcher detects changes to any of the 3 settings files and triggers reload
- [ ] IPC channels `settings:hierarchy:get`, `settings:hierarchy:update`, `settings:hierarchy:watch` are registered
- [ ] Existing `settings:get` and `settings:update` channels remain functional (backwards compat)
- [ ] `useSettingsStore` consumes hierarchical settings transparently
- [ ] Settings form displays which tier a setting comes from (user/project/local)
- [ ] Invalid settings produce validation errors, not crashes
- [ ] Unit tests cover merge logic, env var resolution, file watching, validation
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
SettingsHierarchyService (main process)
  |-- loads ~/.claude/settings.json (user tier)
  |-- loads .claude/settings.json (project tier)
  |-- loads .claude/settings.local.json (local tier)
  |-- resolves environment variables
  |-- validates against JSON schema
  |-- deep-merges with precedence
  |-- watches files for changes
  |-- exposes via IPC channels
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/settings-hierarchy.service.ts` | Main service: load, merge, validate, watch settings files |
| `src/main/services/settings-schema.json` | JSON schema defining all 50+ settings |
| `src/shared/types/settings-hierarchy.types.ts` | TypeScript interfaces for hierarchical settings |
| `tests/main/services/settings-hierarchy.service.test.ts` | Unit tests for the service |
| `tests/shared/types/settings-hierarchy.types.test.ts` | Type validation tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `settings:hierarchy:get`, `settings:hierarchy:update`, `settings:hierarchy:watch` channels; expand `AppSettings` or add `HierarchicalSettings` type |
| `src/main/ipc/handlers.ts` | Register IPC handlers for new channels |
| `src/renderer/stores/useSettingsStore.ts` | Consume hierarchical settings, expose tier info |
| `src/renderer/components/settings/SettingsForm.tsx` | Display tier indicators, add new settings fields |
| `src/renderer/ipc/client.ts` | Add typed client methods for new channels |

### Key Interfaces/Types

```typescript
// src/shared/types/settings-hierarchy.types.ts

/** Which tier a setting value originated from */
export type SettingsTier = 'user' | 'project' | 'local' | 'env' | 'default';

/** Full Claude Code settings schema */
export interface ClaudeSettings {
  // Model & API
  model?: string;
  maxTokens?: number;

  // Permissions
  permissions?: {
    allowedTools?: string[];
    deny?: string[];
    defaultMode?: 'normal' | 'plan' | 'acceptEdits' | 'bypassPermissions';
    disableBypassPermissionsMode?: boolean;
    additionalDirectories?: string[];
  };

  // Hooks
  hooks?: Record<string, HookConfig[]>;

  // Environment
  env?: Record<string, string>;

  // Session
  cleanupPeriodDays?: number;

  // Attribution
  attribution?: {
    commits?: boolean;
    pullRequests?: boolean;
  };

  // Display
  spinnerTipsEnabled?: boolean;

  // Tools
  disallowedTools?: string[];
  disableAllHooks?: boolean;

  // Web
  webSearchEnabled?: boolean;

  // API Key
  apiKeyHelper?: string;
}

/** Resolved settings with tier provenance */
export interface ResolvedSettings {
  values: ClaudeSettings;
  tiers: Record<string, SettingsTier>; // dot-path -> tier that provided the value
}

/** Settings file watcher event */
export interface SettingsChangeEvent {
  tier: SettingsTier;
  filePath: string;
  newValues: Partial<ClaudeSettings>;
}
```

---

## Implementation Tasks

### Task 1: Define Settings Type Interfaces
- **Type:** Implementation
- **Files:** `src/shared/types/settings-hierarchy.types.ts`
- **Details:** Create comprehensive TypeScript interfaces for all 50+ settings fields from audit S19. Include `ClaudeSettings`, `ResolvedSettings`, `SettingsTier`, `SettingsChangeEvent`. Map every setting from the audit checklist S19 to a typed field.
- **Test:** Type compilation check; ensure all 50+ fields from S19 are present.

### Task 2: Create JSON Schema
- **Type:** Implementation
- **Files:** `src/main/services/settings-schema.json`
- **Details:** Create JSON schema that mirrors `ClaudeSettings` interface. Include descriptions, defaults, enums for constrained values. This schema enables validation and future autocomplete support.
- **Test:** Validate known-good and known-bad settings objects against the schema.

### Task 3: Implement Settings File Loader
- **Type:** Implementation
- **Files:** `src/main/services/settings-hierarchy.service.ts`
- **Details:** Create `SettingsHierarchyService` class. Implement `loadTier(filePath: string): Partial<ClaudeSettings>` that reads a JSON file, validates against schema, returns parsed settings. Handle file-not-found gracefully (return empty). Handle malformed JSON with error logging.
- **Test:** Load valid file, missing file, malformed file, partially valid file.

### Task 4: Implement Deep Merge Logic
- **Type:** Implementation
- **Files:** `src/main/services/settings-hierarchy.service.ts`
- **Details:** Implement `mergeSettings(user, project, local): ResolvedSettings` that deep-merges three tiers. For objects, merge recursively. For arrays, replace (local array wins over project). For primitives, replace. Track which tier provided each value in the `tiers` map using dot-path keys.
- **Test:** Merge 3 tiers with overlapping keys; verify precedence is local > project > user. Verify nested object merge. Verify array replacement.

### Task 5: Implement Environment Variable Resolution
- **Type:** Implementation
- **Files:** `src/main/services/settings-hierarchy.service.ts`
- **Details:** Implement `resolveEnvVars(settings: ResolvedSettings): ResolvedSettings` that checks for environment variables and overrides corresponding settings. Map: `ANTHROPIC_BASE_URL` -> `env.ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` -> `model`, `ANTHROPIC_AUTH_TOKEN` -> `env.ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS` -> `maxTokens`, `BASH_DEFAULT_TIMEOUT_MS` -> `env.BASH_DEFAULT_TIMEOUT_MS`, `MAX_THINKING_TOKENS` -> env, `CLAUDE_CODE_OAUTH_TOKEN` -> auth, `CLAUDE_CODE_API_KEY` -> auth, `ENABLE_LSP_TOOL` -> feature flag, `DISABLE_TELEMETRY` -> flag.
- **Test:** Set env vars, verify they override file-based values. Verify tier tracking shows 'env'.

### Task 6: Implement File Watcher
- **Type:** Implementation
- **Files:** `src/main/services/settings-hierarchy.service.ts`
- **Details:** Use `fs.watch` or `chokidar` to watch all 3 settings file paths. On change, reload the changed tier, re-merge, and emit a `SettingsChangeEvent`. Debounce to avoid rapid-fire reloads (300ms). Handle watcher errors gracefully.
- **Test:** Write to a settings file, verify change event fires. Verify debounce. Verify error handling when file becomes unreadable.

### Task 7: Register IPC Channels
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add channel type signatures: `'settings:hierarchy:get': () => ResolvedSettings`, `'settings:hierarchy:update': (tier: SettingsTier, path: string, value: unknown) => ResolvedSettings`, `'settings:hierarchy:watch': () => void` (starts watching). Register handlers that delegate to `SettingsHierarchyService`. Keep existing `settings:get` and `settings:update` functional by reading from/writing to the legacy SQLite store and also syncing to the local tier file.
- **Test:** IPC round-trip tests for get, update, watch.

### Task 8: Backwards-Compatible Migration
- **Type:** Implementation
- **Files:** `src/main/services/settings-hierarchy.service.ts`
- **Details:** On first load, if `.claude/settings.local.json` does not exist but SQLite has settings, export SQLite settings to `.claude/settings.local.json`. Map existing `AppSettings` fields to `ClaudeSettings` fields. After migration, both paths work.
- **Test:** Start with SQLite-only settings, verify migration creates local file. Verify both old and new IPC channels return consistent data.

### Task 9: Update useSettingsStore
- **Type:** Implementation
- **Files:** `src/renderer/stores/useSettingsStore.ts`, `src/renderer/ipc/client.ts`
- **Details:** Add `loadHierarchicalSettings()` method that calls `settings:hierarchy:get`. Expose `resolvedSettings: ResolvedSettings` state. Keep existing `settings` state for backwards compat. Listen for `settings:hierarchy:changed` events to auto-update.
- **Test:** Store loads hierarchical settings on init. Store updates on change event.

### Task 10: Update SettingsForm UI
- **Type:** Implementation
- **Files:** `src/renderer/components/settings/SettingsForm.tsx`
- **Details:** Add tier indicator badges (User / Project / Local / Env) next to each setting showing where the value comes from. Add new settings fields for the expanded 50+ settings. Group settings by category (Model & API, Permissions, Hooks, Display, etc.).
- **Test:** Render form, verify tier badges display correctly. Verify new fields are editable.

### Task 11: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/settings-hierarchy.service.test.ts`
- **Details:** Comprehensive tests for: file loading (valid, missing, malformed), deep merge (nested objects, arrays, primitives, precedence), env var resolution (each mapped var), file watching (change detection, debounce), schema validation (valid, invalid, partial), migration (SQLite to file).
- **Test:** All tests pass. Coverage >= 80%.

### Task 12: Write Integration Tests
- **Type:** Test
- **Files:** `tests/integration/settings-hierarchy.integration.test.ts`
- **Details:** End-to-end tests: IPC round-trip for get/update, settings change propagation from file write to store update, migration from SQLite to file hierarchy.
- **Test:** All integration tests pass.

---

## Testing Requirements

- **Unit Tests:** 25+ test cases covering all service methods
- **Integration Tests:** 5+ test cases for IPC round-trips and store sync
- **Coverage Target:** >= 80% lines and branches for all new files
- **Test Framework:** Vitest (project standard)
- **Mocking:** Mock `fs` operations, `process.env`, IPC invoke

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
- [ ] User settings - `~/.claude/settings.json`
- [ ] Project settings - `.claude/settings.json`
- [ ] Local settings - `.claude/settings.local.json`
- [ ] Config file allowlist in `.claude/settings.json`

**S11 Context & Memory:**
- [ ] Schema import - `"$schema"` support for autocomplete

**S19 Settings & Configuration:**
- [ ] selectedModel, useTerminal, initialPermissionMode, preferredLocation
- [ ] autosave, useCtrlEnterToSend, enableNewConversationShortcut, hideOnboarding
- [ ] respectGitIgnore, environmentVariables, disableLoginPrompt
- [ ] allowDangerouslySkipPermissions, claudeProcessWrapper
- [ ] model, maxTokens, permissions.allowedTools, permissions.deny
- [ ] permissions.defaultMode, permissions.disableBypassPermissionsMode
- [ ] permissions.additionalDirectories, hooks, env
- [ ] cleanupPeriodDays, attribution.commits, attribution.pullRequests
- [ ] spinnerTipsEnabled, disallowedTools, disableAllHooks
- [ ] User settings file location (`~/.claude/settings.json`)
- [ ] Project settings file location (`.claude/settings.json`)
- [ ] Local settings file location (`.claude/settings.local.json`)
- [ ] ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL
- [ ] ANTHROPIC_DEFAULT_SONNET_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL, ANTHROPIC_DEFAULT_HAIKU_MODEL
- [ ] CLAUDE_CODE_MAX_OUTPUT_TOKENS, BASH_DEFAULT_TIMEOUT_MS
- [ ] DISABLE_NON_ESSENTIAL_MODEL_CALLS, DISABLE_TELEMETRY
- [ ] CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, ENABLE_LSP_TOOL
- [ ] MAX_THINKING_TOKENS, CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_API_KEY

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing settings on migration | Medium | High | Backwards-compatible migration; keep SQLite path working during transition |
| File permission errors reading ~/.claude/ | Low | Medium | Graceful fallback to defaults; clear error messages |
| Race condition between file watcher and manual save | Medium | Low | Debounce watcher; lock during save operations |
| Env var conflicts with file settings | Low | Low | Clear precedence: env > local > project > user |

---

## Notes

- This work order is a dependency for WO-045 (Permissions), WO-046 (Hooks), WO-047 (Slash Commands), and many Phase 2+ work orders.
- The managed settings tier (organization-level) is deferred to a later work order since Cola Records does not have an enterprise admin system yet.
- Legacy `~/.claude.json` support is not included; it can be added in a follow-up if needed.
- The `$schema` field in settings files is passthrough (not consumed by the service but preserved for external editors).
