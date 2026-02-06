# WO-043: CLAUDE.md Hierarchy & Memory System

**Phase:** 1 - Foundation & Infrastructure
**Priority:** CRITICAL
**Complexity:** 6/10
**Dependencies:** None
**Estimated Tasks:** 11
**Category References:** S11 Context & Memory Management

---

## Objective

Implement the full CLAUDE.md hierarchy system with global (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md`), and local (`./CLAUDE.local.md`) memory files, recursive parent directory discovery, subtree discovery, import syntax (`@path/to/import`), `.claude/rules/` directory support, and the `/memory` and `/init` slash commands. This provides Claude with persistent project context that survives across sessions.

---

## Background

**Current State:**
- The project has a `CLAUDE.md` file at the repo root and `trinity/CLAUDE.md` as a child context
- These files are referenced in the system prompt instructions but are not dynamically loaded at runtime
- No `~/.claude/CLAUDE.md` global memory file support
- No `CLAUDE.local.md` for private project preferences
- No recursive parent directory discovery
- No subtree discovery (loading CLAUDE.md from subdirectories when files in those dirs are accessed)
- No import syntax (`@path/to/import`)
- No `.claude/rules/` directory scanning
- No `/memory` or `/init` slash commands
- The system prompt is set via `claudeSystemPrompt` in AppSettings

**Target State:**
- Full 3-tier CLAUDE.md hierarchy with automatic discovery and loading
- Import syntax for modular context files
- Rules directory for organized instruction files
- `/memory` command to edit memory files
- `/init` command to auto-generate CLAUDE.md from codebase analysis
- Merged context injected into Claude's system prompt dynamically

---

## Acceptance Criteria

- [ ] `~/.claude/CLAUDE.md` is loaded as global user memory on session start
- [ ] `./CLAUDE.md` at project root is loaded as project memory
- [ ] `./CLAUDE.local.md` is loaded as local memory (auto-added to .gitignore)
- [ ] Memory files merge in order: global -> project -> local (all included, not overridden)
- [ ] Recursive parent discovery walks from cwd upward, collecting CLAUDE.md files at each level
- [ ] Subtree discovery loads CLAUDE.md from subdirectories when Claude accesses files in those directories
- [ ] Import syntax `@path/to/import` in any CLAUDE.md resolves and includes the referenced file content
- [ ] `.claude/rules/` directory is scanned; all `.md` files are included as rule context
- [ ] `/memory` slash command opens an editor/dialog to edit CLAUDE.md files (with tier selection)
- [ ] `/init` slash command analyzes the codebase and generates a starter CLAUDE.md
- [ ] Merged context is injected into the Claude system prompt before each query
- [ ] Circular import detection prevents infinite loops
- [ ] Missing files are silently skipped (no errors)
- [ ] Unit tests cover discovery, import resolution, merge, and commands
- [ ] Coverage >= 80% lines and branches

---

## Technical Design

### Architecture

```
ClaudeMemoryService (main process)
  |-- discoverHierarchy(projectPath) -> finds all CLAUDE.md files
  |   |-- walkParents(cwd) -> collect CLAUDE.md from each parent dir
  |   |-- loadGlobal() -> ~/.claude/CLAUDE.md
  |   |-- loadProject(root) -> ./CLAUDE.md
  |   |-- loadLocal(root) -> ./CLAUDE.local.md
  |   |-- scanRules(root) -> .claude/rules/*.md
  |-- resolveImports(content) -> process @path/to/import
  |-- mergeContext(files[]) -> concatenated context string
  |-- subtreeDiscovery(filePath) -> check for CLAUDE.md in file's directory
  |-- generateInit(projectPath) -> analyze codebase, produce CLAUDE.md template
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/claude-memory.service.ts` | Main service: discover, load, merge, resolve imports |
| `src/shared/types/claude-memory.types.ts` | TypeScript interfaces for memory system |
| `tests/main/services/claude-memory.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claude:memory:get`, `claude:memory:update`, `claude:memory:init` channels |
| `src/main/ipc/handlers.ts` | Register memory IPC handlers |
| `src/main/services/claude-container.service.ts` | Inject merged memory context into system prompt before queries |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Add `/memory` and `/init` commands to BUILTIN_COMMANDS |
| `src/renderer/stores/useClaudeStore.ts` | Add memory context state, handle `/memory` and `/init` command execution |

### Key Interfaces/Types

```typescript
// src/shared/types/claude-memory.types.ts

export type MemoryTier = 'global' | 'project' | 'local' | 'rules' | 'subtree' | 'import';

export interface MemoryFile {
  tier: MemoryTier;
  filePath: string;
  content: string;
  /** Files imported via @path/to/import */
  imports: MemoryFile[];
}

export interface MemoryHierarchy {
  global: MemoryFile | null;       // ~/.claude/CLAUDE.md
  project: MemoryFile | null;      // ./CLAUDE.md
  local: MemoryFile | null;        // ./CLAUDE.local.md
  parents: MemoryFile[];           // CLAUDE.md files from parent directories
  rules: MemoryFile[];             // .claude/rules/*.md
  subtrees: MemoryFile[];          // CLAUDE.md from accessed subdirectories
  mergedContent: string;           // Final concatenated context
}

export interface MemoryInitResult {
  generatedContent: string;
  filePath: string;
  filesAnalyzed: number;
}
```

---

## Implementation Tasks

### Task 1: Define Memory Type Interfaces
- **Type:** Implementation
- **Files:** `src/shared/types/claude-memory.types.ts`
- **Details:** Create `MemoryTier`, `MemoryFile`, `MemoryHierarchy`, `MemoryInitResult` types. Export all for use in main and renderer processes.
- **Test:** Type compilation check.

### Task 2: Implement Global Memory Loader
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Create `ClaudeMemoryService` class. Implement `loadGlobal(): MemoryFile | null` that reads `~/.claude/CLAUDE.md` using `os.homedir()`. Return null if file doesn't exist. Handle read errors gracefully.
- **Test:** Load existing file; handle missing file; handle read error.

### Task 3: Implement Project & Local Memory Loader
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `loadProject(projectRoot: string)` and `loadLocal(projectRoot: string)`. Load `CLAUDE.md` and `CLAUDE.local.md` from project root. For local file, ensure it's listed in `.gitignore` (create/append if needed).
- **Test:** Load both files; auto-gitignore local file; handle missing files.

### Task 4: Implement Recursive Parent Discovery
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `walkParents(startDir: string): MemoryFile[]` that walks up from `startDir` to filesystem root, collecting any `CLAUDE.md` file found at each level. Skip the project root (handled separately). Stop at filesystem root or after 20 levels (safety limit).
- **Test:** Create CLAUDE.md files in parent dirs; verify discovery order (closest first); verify depth limit.

### Task 5: Implement Import Syntax Resolution
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `resolveImports(content: string, basePath: string, visited: Set<string>): string` that scans for lines matching `@path/to/import` pattern, reads the referenced file relative to `basePath`, and replaces the import line with the file content. Use `visited` set for circular import detection (log warning and skip circular refs). Support both absolute and relative paths.
- **Test:** Single import; nested imports; circular import detection; missing import file.

### Task 6: Implement Rules Directory Scanner
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `scanRules(projectRoot: string): MemoryFile[]` that reads all `.md` files in `.claude/rules/` directory. Sort alphabetically for deterministic order. Process imports in each rule file.
- **Test:** Scan directory with multiple rule files; empty directory; missing directory.

### Task 7: Implement Subtree Discovery
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `discoverSubtree(filePath: string): MemoryFile | null` that checks if the directory containing `filePath` has a `CLAUDE.md` file. Cache discovered subtrees to avoid redundant reads. This is called lazily when Claude reads files in subdirectories.
- **Test:** File in dir with CLAUDE.md; file in dir without; caching behavior.

### Task 8: Implement Context Merger
- **Type:** Implementation
- **Files:** `src/main/services/claude-memory.service.ts`
- **Details:** Implement `buildHierarchy(projectRoot: string): MemoryHierarchy` that calls all loaders, resolves imports in each, and produces the final `mergedContent` string. Merge order: global context first, then parent contexts (furthest ancestor first), then project, then local, then rules, then subtrees. Separate sections with markdown headers indicating the source.
- **Test:** Full hierarchy build with all tiers populated; partial tiers; empty project.

### Task 9: Register IPC Channels
- **Type:** Implementation
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- **Details:** Add channels: `'claude:memory:get': (projectPath: string) => MemoryHierarchy`, `'claude:memory:update': (tier: MemoryTier, content: string) => void`, `'claude:memory:init': (projectPath: string) => MemoryInitResult`. Register handlers delegating to `ClaudeMemoryService`.
- **Test:** IPC round-trip for get, update, init.

### Task 10: Integrate with System Prompt
- **Type:** Implementation
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** Before each Claude query, call `ClaudeMemoryService.buildHierarchy()` and prepend the `mergedContent` to the system prompt. Cache the result and invalidate when memory files change (use simple timestamp check or file watcher from WO-042 pattern).
- **Test:** Verify system prompt includes memory content; verify cache invalidation.

### Task 11: Add /memory and /init Slash Commands
- **Type:** Implementation
- **Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add `/memory` to BUILTIN_COMMANDS (icon: Brain or BookOpen). When selected, show a dialog/modal listing all memory tiers with their current content and an edit button for each. Add `/init` command that calls `claude:memory:init` IPC and displays the generated content with a "Save" button. Handle the `/init` command by analyzing: package.json, directory structure, README, existing CLAUDE.md.
- **Test:** Slash command appears in list; /memory opens editor; /init generates content.

---

## Testing Requirements

- **Unit Tests:** 20+ test cases for discovery, loading, imports, merging
- **Integration Tests:** 5+ test cases for IPC and system prompt injection
- **Coverage Target:** >= 80% lines and branches
- **Test Framework:** Vitest
- **Mocking:** Mock filesystem operations, `os.homedir()`, IPC invoke

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

**S11 Context & Memory Management:**
- [ ] User memory (`~/.claude/CLAUDE.md`) - Global preferences across all projects
- [ ] Project memory (`./CLAUDE.md`) - Team shared context in repository root
- [ ] Local project memory (`./CLAUDE.local.md`) - Private project preferences; auto-gitignore
- [ ] Recursive parent discovery - reads CLAUDE.md recursively up directory tree
- [ ] Subtree discovery - CLAUDE.md in subdirectories loaded when Claude reads files in those subtrees
- [ ] Import syntax - `@path/to/import` in CLAUDE.md imports additional context files
- [ ] `.claude/rules/` directory - Organize instructions into multiple focused rule files
- [ ] `/memory` - Edit CLAUDE.md files directly
- [ ] `/init` - Auto-generate CLAUDE.md by analyzing codebase
- [ ] `/context` - View context usage and warnings (partial - context tracking)

**S4 Built-in Slash Commands:**
- [ ] `/memory` - Edit CLAUDE.md memory files
- [ ] `/init` - Initialize project with auto-generated CLAUDE.md

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large CLAUDE.md files consuming too much context | Medium | Medium | Add content size limit (e.g., 50KB total); warn when approaching limit |
| Circular imports causing infinite loops | Medium | High | Visited set tracking; max import depth of 10 |
| Slow filesystem walks on deep directory trees | Low | Low | Safety limit of 20 parent levels; cache results |
| .gitignore modification conflicts | Low | Medium | Check if entry already exists before appending |

---

## Notes

- This work order is a dependency for WO-047 (Slash Commands which includes `/memory` and `/init`).
- The `# quick memory` CLI shortcut (prefix text with # to add to CLAUDE.md) is deferred since Cola Records is a GUI app. The `/memory` command serves the same purpose.
- Subtree discovery is lazy (triggered when Claude reads files) rather than eager (scanning all subdirectories on startup) for performance.
- The `/init` command's codebase analysis is a best-effort heuristic: read package.json for tech stack, scan directory structure for architecture patterns, check for README.md content.
