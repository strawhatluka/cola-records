# WO-048: Skills System

**Phase:** 1 - Foundation & Infrastructure
**Priority:** MEDIUM
**Complexity:** 7/10
**Dependencies:** WO-044 (Project & User Custom Commands)
**Estimated Tasks:** 10
**Category References:** S5 Custom Commands & Skills

---

## Objective

Implement the Skills system that extends custom commands with `.claude/skills/{name}/SKILL.md` files, YAML frontmatter (name, description, hooks, once), automatic skill loading based on description matching, supporting files within skill directories, skill-scoped lifecycle hooks, and the `/skills` slash command. Skills merge with commands to form a unified slash command experience.

---

## Background

**Current State:**
- WO-044 (dependency) implements the custom commands system from `.claude/commands/`
- No `.claude/skills/` directory support
- No SKILL.md file format
- No automatic skill loading based on context
- No skill-scoped hooks
- No supporting files in skill directories
- The `ClaudeCustomCommand` type has `name`, `description`, `prompt` but no `hooks`, `once`, or auto-load capability
- The `.claude/` directory exists in the project but has no `skills/` subdirectory

**Target State:**
- Skills directory scanned for SKILL.md files
- YAML frontmatter provides metadata including hooks and once flag
- Claude automatically loads relevant skills based on description matching against the current task
- Supporting files (templates, configs) available to skills
- Skill-scoped hooks that activate/deactivate with the skill
- Skills and commands merged into unified slash command registry
- `/skills` command lists all available skills with load status

---

## Acceptance Criteria

- [ ] `.claude/skills/{name}/SKILL.md` files are discovered and parsed
- [ ] YAML frontmatter fields work: `name`, `description`, `hooks`, `once`
- [ ] Skill `name` becomes a slash command (e.g., `/review` from `.claude/skills/review/SKILL.md`)
- [ ] Skill `description` is used for auto-loading: Claude evaluates if skill is relevant to current task
- [ ] Auto-loading injects skill content into Claude's context when relevant
- [ ] `hooks` frontmatter field registers skill-scoped hooks that activate when skill loads and deactivate when skill unloads
- [ ] `once` flag causes hook to run only once per session then auto-remove
- [ ] Supporting files in skill directory (e.g., `templates/`, `configs/`) are accessible via `@` references within SKILL.md
- [ ] Skills merge with commands from WO-044: same-name command and skill both create a single slash command
- [ ] `/skills` command lists all skills with name, description, loaded/unloaded status
- [ ] Skills from `.claude/skills/` take project scope
- [ ] Unit tests cover parsing, auto-loading, hook scoping, merging
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
SkillsService (extends CustomCommandsService from WO-044)
  |-- scanSkills(projectPath) -> find SKILL.md files
  |-- parseSkill(skillDir) -> parse SKILL.md with frontmatter
  |-- evaluateRelevance(skill, currentContext) -> should skill auto-load?
  |-- loadSkill(skill) -> inject context, activate hooks
  |-- unloadSkill(skill) -> remove context, deactivate hooks
  |-- mergeWithCommands(skills[], commands[]) -> unified registry
  |
  |-- SkillHookManager
  |   |-- activateHooks(skill) -> register skill's hooks with HooksEngine
  |   |-- deactivateHooks(skill) -> unregister skill's hooks
  |   |-- handleOnce(hook) -> run once, then auto-remove
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/skills.service.ts` | Skill scanner, parser, auto-loader, hook manager |
| `src/shared/types/skills.types.ts` | TypeScript interfaces for skills |
| `src/renderer/components/ide/claude/ClaudeSkillsList.tsx` | Skills list UI component |
| `tests/main/services/skills.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claude:skills:list`, `claude:skills:load`, `claude:skills:unload` channels |
| `src/main/ipc/handlers.ts` | Register skills IPC handlers |
| `src/main/services/custom-commands.service.ts` | Expose merge point for skills integration |
| `src/main/services/hooks-engine.service.ts` | Add `registerScopedHooks()` and `unregisterScopedHooks()` for skill lifecycle |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Add `/skills` command; merge skill commands into dropdown |
| `src/renderer/stores/useClaudeStore.ts` | Add skills state management |

### Key Interfaces/Types

```typescript
// src/shared/types/skills.types.ts

export interface SkillFrontmatter {
  /** Skill name (becomes slash command name) */
  name: string;
  /** Description for auto-loading relevance matching */
  description: string;
  /** Skill-scoped hooks activated when skill loads */
  hooks?: SkillHookDef[];
  /** If true, hooks run only once per session */
  once?: boolean;
}

export interface SkillHookDef {
  /** Hook event type */
  event: string;
  /** Hook type */
  type: 'command' | 'prompt' | 'agent';
  /** Command/prompt/agent definition */
  command?: string;
  prompt?: string;
  /** Matcher patterns */
  matchers?: string[];
}

export interface Skill {
  /** Skill name from frontmatter or directory name */
  name: string;
  /** Description for auto-loading */
  description: string;
  /** Parsed SKILL.md body (markdown instructions) */
  body: string;
  /** YAML frontmatter */
  frontmatter: SkillFrontmatter;
  /** Absolute path to skill directory */
  directoryPath: string;
  /** Absolute path to SKILL.md */
  filePath: string;
  /** Supporting files in skill directory */
  supportingFiles: string[];
  /** Whether skill is currently loaded into context */
  loaded: boolean;
  /** Scope */
  scope: 'project';
}

export interface SkillsState {
  skills: Skill[];
  autoLoadEnabled: boolean;
}
```

---

## Implementation Tasks

### Task 1: Define Skills Type Interfaces
- **Type:** Implementation
- **Files:** `src/shared/types/skills.types.ts`
- **Details:** Create `SkillFrontmatter`, `SkillHookDef`, `Skill`, `SkillsState` types.
- **Test:** Type compilation check.

### Task 2: Implement Skills Directory Scanner
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`
- **Details:** Create `SkillsService` class. Implement `scanSkills(projectPath: string): Skill[]` that scans `.claude/skills/` for subdirectories containing `SKILL.md`. For each skill directory, collect supporting files (any non-SKILL.md files). Return array of `Skill` objects with `loaded: false` initially.
- **Test:** Scan with skills; empty directory; missing directory; skill with supporting files.

### Task 3: Implement SKILL.md Parser
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`
- **Details:** Implement `parseSkill(skillDir: string): Skill` that reads `SKILL.md`, extracts YAML frontmatter (name, description, hooks, once), and separates the markdown body. Use directory name as fallback for `name` if not in frontmatter. Resolve `@` file references in body relative to skill directory.
- **Test:** Valid frontmatter; missing frontmatter; hooks in frontmatter; @file references to supporting files.

### Task 4: Implement Auto-Loading Logic
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`
- **Details:** Implement `evaluateRelevance(skill: Skill, currentContext: string): boolean` that determines if a skill should be auto-loaded based on its description field. Strategy: use keyword matching between skill description and the current user prompt/conversation context. If the description mentions technologies, file types, or patterns that appear in the current context, mark as relevant. This is a heuristic approach -- more sophisticated matching can be added later.
- **Test:** Relevant skill matches; irrelevant skill doesn't; edge cases (empty description, empty context).

### Task 5: Implement Skill Loading/Unloading
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`
- **Details:** Implement `loadSkill(skill: Skill): void` that injects the skill's body content into Claude's context (via system prompt append), activates skill-scoped hooks, and sets `loaded: true`. Implement `unloadSkill(skill: Skill): void` that removes the context, deactivates hooks, and sets `loaded: false`.
- **Test:** Load injects context; unload removes context; hooks activate/deactivate; state updates.

### Task 6: Implement Skill-Scoped Hooks
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`, `src/main/services/hooks-engine.service.ts`
- **Details:** When a skill loads, register its `hooks` from frontmatter with the HooksEngine using a skill-specific scope ID. When the skill unloads, unregister those hooks. For `once: true`, wrap the hook to auto-unregister after first execution. Add `registerScopedHooks(scopeId, hooks[])` and `unregisterScopedHooks(scopeId)` to HooksEngine.
- **Test:** Hooks register on load; unregister on unload; once flag auto-removes.

### Task 7: Implement Skills-Commands Merger
- **Type:** Implementation
- **Files:** `src/main/services/skills.service.ts`, `src/main/services/custom-commands.service.ts`
- **Details:** Implement `mergeWithCommands(skills: Skill[], commands: CustomCommand[]): (Skill | CustomCommand)[]` that creates a unified list. When a skill and command have the same name, merge them (skill body appended to command prompt). Skills without matching commands become standalone slash commands. Commands without matching skills remain unchanged.
- **Test:** Skill-only; command-only; merge same name; different names.

### Task 8: Register IPC Channels and /skills Command
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`, `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`
- **Details:** Add channels: `'claude:skills:list': (projectPath: string) => Skill[]`, `'claude:skills:load': (skillName: string) => void`, `'claude:skills:unload': (skillName: string) => void`. Add `/skills` to BUILTIN_COMMANDS. When executed, show the `ClaudeSkillsList` component.
- **Test:** IPC round-trip; /skills appears in dropdown.

### Task 9: Create Skills List UI
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSkillsList.tsx`
- **Details:** Create component that lists all skills with: name, description, loaded/unloaded toggle, supporting files count. Toggle loads/unloads a skill via IPC. Show skill body content in an expandable section. Indicate which skills were auto-loaded.
- **Test:** List renders; toggle works; expandable content; auto-load indicator.

### Task 10: Write Unit Tests
- **Type:** Test
- **Files:** `tests/main/services/skills.service.test.ts`
- **Details:** Tests for: directory scanning (with/without skills), SKILL.md parsing (frontmatter variants, @file refs), auto-loading (relevance matching), load/unload (context injection, hook activation), once flag, merger (skill+command overlap, standalone), IPC round-trips.
- **Test:** All tests pass; coverage >= 80%.

---

## Testing Requirements

- **Unit Tests:** 20+ test cases covering scanning, parsing, auto-loading, hooks, merging
- **Integration Tests:** 5+ test cases for IPC and hook engine integration
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock filesystem, HooksEngine, CustomCommandsService, IPC

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
- [ ] Skills directory - `.claude/skills/{name}/SKILL.md` files
- [ ] SKILL.md format - YAML frontmatter (name, description) + markdown content
- [ ] Automatic skill loading - Claude loads skills when relevant based on description
- [ ] Skill frontmatter: name - becomes the slash command name
- [ ] Skill frontmatter: description - helps Claude decide when to auto-load
- [ ] Skill frontmatter: hooks - lifecycle hooks scoped to skill's lifetime
- [ ] Skill frontmatter: once - if true, hook runs only once per session
- [ ] Supporting files - skills can include additional files in their directory
- [ ] Slash commands merged into skills - command and skill both create single command

**S4 Built-in Slash Commands:**
- [ ] /skills - List available Skills and their status

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Auto-loading irrelevant skills wasting context | Medium | Medium | Conservative keyword matching; user can manually unload; show auto-load indicator |
| Skill hooks conflicting with global hooks | Low | Medium | Scoped hooks have clear lifecycle; document behavior |
| Large supporting file directories | Low | Low | Don't auto-read supporting files; only make them available for @references |
| SKILL.md parsing errors breaking all skills | Low | Medium | Parse each skill independently; skip malformed; log errors |

---

## Notes

- This work order depends on WO-044 (Custom Commands) for the command scanning and parsing infrastructure.
- It also depends on WO-046 (Hooks) for the scoped hook registration, but WO-046 can be implemented concurrently since only the `registerScopedHooks`/`unregisterScopedHooks` API is needed from it.
- Auto-loading is a heuristic and will improve over time. Initial implementation uses simple keyword overlap between skill description and current context.
- User-level skills (`~/.claude/skills/`) are not part of the current Claude Code spec but could be added as an enhancement.
- The auto-loading evaluation runs on each user prompt (not continuously), checking if newly mentioned topics match any unloaded skill descriptions.
