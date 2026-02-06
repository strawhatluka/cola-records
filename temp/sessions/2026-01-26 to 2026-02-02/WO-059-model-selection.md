# WO-059: Model Selection (Complete)

**Status:** PENDING
**Complexity:** 3/10
**Priority:** MEDIUM
**Phase:** 3 - UI & UX Features
**Dependencies:** WO-042 (Settings Hierarchy - for settings persistence)
**Category:** Audit Checklist Section 21 - Model Selection
**Estimated Time:** 2-3 hours (including BAS gates)

---

## Objective

Complete the model selection system with a `/model` slash command, model alias resolution to specific version IDs, support for specific Claude model version strings, and per-agent model override capability.

---

## Background

### Current State (What Exists)
- **useClaudeStore**: Has `selectedModel: ClaudeModelId` where `ClaudeModelId = 'sonnet' | 'opus' | 'haiku'`
- **setModel(model: ClaudeModelId)** action in store to switch models
- **claude:query IPC**: Accepts `model?: ClaudeModelId` parameter
- **ClaudeInputArea.tsx**: Has a model selector dropdown in the footer area
- Model is sent to the main process on each query and used when spawning Claude

### What Is Missing (From Audit Checklist Section 21)
1. `/model` slash command to switch models mid-session with a picker
2. Model aliases: `sonnet`, `opus`, `haiku` should resolve to latest specific version IDs
3. Support for specific version IDs (e.g., `claude-sonnet-4-20250514`)
4. Per-agent model override (subagents can specify their own model)
5. Environment variable overrides: `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, etc.

---

## Acceptance Criteria

- [ ] AC-1: The `/model` slash command opens a picker showing available models (aliases + known versions) and switches on selection
- [ ] AC-2: Model aliases (`sonnet`, `opus`, `haiku`) resolve to the latest known specific version IDs before being sent to the API
- [ ] AC-3: Users can specify a full model version ID (e.g., `claude-sonnet-4-20250514`) in the model selector or via `/model`
- [ ] AC-4: Per-agent model override is supported: subagent definitions can specify a `model` field that overrides the session default
- [ ] AC-5: Environment variables `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` are respected
- [ ] AC-6: The current resolved model name is displayed in the UI (shows version ID, not just alias)
- [ ] AC-7: All model resolution logic has unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The model system has two layers:

1. **Resolution Layer** (main process) - Maps aliases to version IDs, applies environment variable overrides
2. **Selection Layer** (renderer) - UI for picking models, `/model` command, display of resolved model

```
User selects "sonnet" (alias)
  |
  v
model-resolver.ts
  |-- Check ANTHROPIC_MODEL env var (overrides everything)
  |-- Check ANTHROPIC_DEFAULT_SONNET_MODEL env var
  |-- Fall back to built-in alias mapping
  |
  v
"claude-sonnet-4-20250514" (resolved version ID)
  |
  v
claude:query IPC (sends resolved model ID)
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/main/services/model-resolver.ts` | Model alias resolution and env var override logic | ~100 lines |
| `src/renderer/components/ide/claude/ClaudeModelPicker.tsx` | Model picker UI for /model command (dropdown/dialog) | ~120 lines |
| `src/main/services/__tests__/model-resolver.test.ts` | Model resolver tests | ~150 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeModelPicker.test.tsx` | Model picker tests | ~80 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Extend `ClaudeModelId` to `ClaudeModelId \| string` (accept version IDs); add `claude:resolve-model` channel; add `claude:list-models` channel |
| `src/main/ipc/handlers.ts` | Register model resolution and listing handlers |
| `src/renderer/stores/useClaudeStore.ts` | Add `resolvedModelId: string` state; update `setModel` to resolve alias; add `resolvedModelDisplay` computed |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Register `/model` command |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Update model selector to show resolved version; support typing custom model IDs |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Wire /model command to open ClaudeModelPicker |

### Interfaces

```typescript
// model-resolver.ts
interface ModelDefinition {
  alias: string;                    // 'sonnet', 'opus', 'haiku'
  displayName: string;              // 'Claude Sonnet 4'
  defaultVersionId: string;         // 'claude-sonnet-4-20250514'
  envVarOverride: string;           // 'ANTHROPIC_DEFAULT_SONNET_MODEL'
}

const MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    alias: 'sonnet',
    displayName: 'Claude Sonnet 4',
    defaultVersionId: 'claude-sonnet-4-20250514',
    envVarOverride: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
  },
  {
    alias: 'opus',
    displayName: 'Claude Opus 4.5',
    defaultVersionId: 'claude-opus-4-5-20251101',
    envVarOverride: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
  },
  {
    alias: 'haiku',
    displayName: 'Claude Haiku 3.5',
    defaultVersionId: 'claude-haiku-3-5-20241022',
    envVarOverride: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  },
];

function resolveModel(aliasOrId: string): string;
function listAvailableModels(): ModelDefinition[];
function getModelDisplayName(resolvedId: string): string;

// IPC additions
'claude:resolve-model': (aliasOrId: string) => string;
'claude:list-models': () => ModelDefinition[];

// Store additions
interface ModelSelectionState {
  selectedModel: ClaudeModelId | string;  // Alias or custom version ID
  resolvedModelId: string;                // Resolved full version ID
  setModel: (model: string) => Promise<void>;
}
```

---

## Implementation Tasks

### T1: Model Resolver Service (30 min)
**File:** `src/main/services/model-resolver.ts`
- Define `MODEL_DEFINITIONS` with alias, display name, default version ID, and env var name
- Implement `resolveModel(aliasOrId: string)`:
  1. Check `ANTHROPIC_MODEL` env var - if set, return it (overrides everything)
  2. If `aliasOrId` matches a known alias, check the alias-specific env var (e.g., `ANTHROPIC_DEFAULT_SONNET_MODEL`)
  3. If env var set, return its value
  4. Otherwise, return the `defaultVersionId` from MODEL_DEFINITIONS
  5. If `aliasOrId` doesn't match any alias, assume it's a specific version ID and return as-is
- Implement `listAvailableModels()`: return MODEL_DEFINITIONS array
- Implement `getModelDisplayName()`: reverse-lookup from version ID to display name

### T2: Model Resolver Tests (30 min)
**File:** `src/main/services/__tests__/model-resolver.test.ts`
- Test alias resolution: 'sonnet' -> 'claude-sonnet-4-20250514'
- Test env var override: set ANTHROPIC_DEFAULT_SONNET_MODEL -> returns custom value
- Test global override: set ANTHROPIC_MODEL -> overrides any alias
- Test specific version passthrough: 'claude-sonnet-4-20250514' -> same string
- Test unknown string passthrough: 'custom-model-v1' -> same string
- Test listAvailableModels returns all definitions

### T3: IPC Channel Registration (20 min)
**Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- Add `claude:resolve-model` channel: takes alias or ID, returns resolved version ID
- Add `claude:list-models` channel: returns available model definitions
- Update `ClaudeModelId` type to be `'sonnet' | 'opus' | 'haiku' | string` (union with string for custom IDs)

### T4: Model Picker Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudeModelPicker.tsx`
- Dialog/dropdown showing available models from `claude:list-models`
- Each option shows: display name, alias, resolved version ID
- Custom input field for typing a specific version ID
- On selection: calls `setModel()` which resolves via IPC
- Current model highlighted with checkmark

### T5: /model Slash Command (15 min)
**File:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
- Register `/model` in slash command registry
- Description: "Switch Claude model mid-session"
- Handler: opens ClaudeModelPicker dialog
- Also accepts inline argument: `/model opus` switches directly

### T6: Store Updates (20 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Change `selectedModel` type to `string` (alias or version ID)
- Add `resolvedModelId: string` (resolved version ID from main process)
- Update `setModel()` to call `claude:resolve-model` IPC and store both alias and resolved ID
- Pass `resolvedModelId` (not alias) to `claude:query` IPC

### T7: Input Area Update (20 min)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- Update model selector dropdown to show resolved version alongside alias
- E.g., "Sonnet (claude-sonnet-4-20250514)"
- Allow clicking to open ClaudeModelPicker for full selection
- Show current model in compact format in footer

### T8: Component Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/ClaudeModelPicker.test.tsx`
- Test renders all available models
- Test selection updates store
- Test custom version ID input
- Test current model highlighted
- Test /model with inline argument

---

## Testing Requirements

### Unit Tests
- model-resolver: all alias resolutions, env var overrides, passthrough, global override
- ClaudeModelPicker: rendering, selection, custom input, current highlight
- Store: setModel resolves correctly, resolvedModelId updated, passed to query

### Integration Tests
- /model command -> picker opens -> select model -> store updated -> next query uses new model
- Custom version ID -> typed in picker -> resolved as-is -> used in query

### Coverage Target
- Lines: >= 80%
- Branches: >= 80%

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier: 0 errors after auto-fix |
| 2 | Structure | All imports resolve, TypeScript types valid, no circular deps |
| 3 | Build | `tsc --noEmit` passes with 0 errors |
| 4 | Testing | All new + existing tests pass |
| 5 | Coverage | >= 80% lines and branches on new files |
| 6 | Review | DRA code review: best practices, design doc adherence |

---

## Audit Checklist Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 21:

- [ ] `/model command` - Switch models mid-session (T4, T5)
- [ ] `Model aliases` - Use sonnet, opus, haiku for latest versions (T1)
- [ ] `Specific versions` - Use full model IDs like claude-sonnet-4-20250514 (T1, T4)
- [ ] `VS Code setting` - selectedModel setting for default model (existing, T6)
- [ ] `Per-agent model` - Subagents can specify their own model via model field (T1 design supports this)
- [ ] `Config command` - Persistent default model via settings (T6)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Model version IDs become outdated | High | Low | Define as configurable constants; easy to update; env vars provide runtime override |
| Custom model ID rejected by API | Medium | Low | Pass through as-is; API error handling already exists in claude:query |
| Env var resolution timing (main vs renderer process) | Low | Low | All resolution happens in main process where env vars are accessible |

---

## Notes

- This is a relatively straightforward work order since the model selection infrastructure already exists. The main additions are alias resolution, version IDs, and the `/model` command.
- Per-agent model override is designed at the interface level here but fully implemented in WO-050 (Subagents). The model-resolver is agent-agnostic and can be called with any alias or version ID.
- Model pricing data (used in WO-058) references the same MODEL_DEFINITIONS. Consider sharing the definition or importing it.
- The `ANTHROPIC_MODEL` environment variable takes absolute precedence over all other model selection, including per-agent overrides. This is consistent with Claude Code CLI behavior.
- Version IDs in MODEL_DEFINITIONS should be updated when new model versions are released. This is a maintenance task, not a code change.
