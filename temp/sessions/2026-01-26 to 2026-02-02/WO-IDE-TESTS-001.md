# WO-IDE-TESTS-001: Development/IDE Page Test Coverage

**Created:** 2026-01-29
**Priority:** HIGH
**Status:** PENDING
**Source:** JUNO Audit of Development/IDE Page
**Target Coverage:** >= 80%

---

## Objective

Create comprehensive test coverage for the Development/IDE page, covering all frontend components, Zustand stores, custom hooks, IPC handlers, and backend services. The IDE page currently has **ZERO test coverage** across all categories.

---

## JUNO Audit Findings

### Current State
- **24 test files** exist in the project (676 tests passing)
- **0 test files** exist for IDE/Development page components
- **0 test files** exist for IDE-related stores (5 stores)
- **0 test files** exist for IDE-related hooks (2 hooks)
- **0 test files** exist for core IDE backend services (5 services)

### Gap Analysis

| Category | Files Needing Tests | Estimated Tests | Priority |
|----------|-------------------|-----------------|----------|
| Zustand Stores | 5 | ~200 | CRITICAL |
| Backend Services | 5 | ~150 | CRITICAL |
| IDE Components | 11+ | ~150 | HIGH |
| Custom Hooks | 2 | ~40 | HIGH |
| IPC Handlers | 30+ channels | ~60 | MEDIUM |

---

## Task Breakdown

### Task 1: useIDEStore Tests
**File:** `tests/renderer/stores/useIDEStore.test.ts`
**Source:** `src/renderer/stores/useIDEStore.ts`

Test coverage for:
- Panel size management (save, reset, get defaults)
- Focused panel state transitions
- Clipboard operations (set, clear, copy/cut modes)
- Selected for compare state
- Skip delete confirmation management
- localStorage persistence

**Estimated tests:** ~25

---

### Task 2: useCodeEditorStore Tests
**File:** `tests/renderer/stores/useCodeEditorStore.test.ts`
**Source:** `src/renderer/stores/useCodeEditorStore.ts`

Test coverage for:
- File opening (normal, preview, side-by-side, diff mode)
- Tab management (switch, close, close all, close others)
- Content modification tracking
- Save file (single and save all)
- Reload file from disk
- Rename file handling
- Split editor toggle
- IPC interactions (fs:read-file, fs:write-file)

**Estimated tests:** ~45

---

### Task 3: useFileTreeStore Tests
**File:** `tests/renderer/stores/useFileTreeStore.test.ts`
**Source:** `src/renderer/stores/useFileTreeStore.ts`

Test coverage for:
- Load tree from root path
- Node expand/collapse toggling
- Node selection
- Git status integration
- Git ignore cache warming
- Tree refresh
- Add/remove node operations
- IPC interactions (fs:read-directory, git:status, gitignore:is-ignored)

**Estimated tests:** ~35

---

### Task 4: useGitStore Tests
**File:** `tests/renderer/stores/useGitStore.test.ts`
**Source:** `src/renderer/stores/useGitStore.ts`

Test coverage for:
- Repository path management
- Fetch status, log, branches
- Stage/unstage files
- Commit with message
- Push/pull operations
- Branch checkout and creation
- Diff fetching
- Debounced refresh
- Error handling for all operations
- IPC interactions (git:status, git:log, git:add, git:commit, git:push, git:pull, git:checkout, git:create-branch)

**Estimated tests:** ~50

---

### Task 5: useTerminalStore Tests
**File:** `tests/renderer/stores/useTerminalStore.test.ts`
**Source:** `src/renderer/stores/useTerminalStore.ts`

Test coverage for:
- Session creation and management
- Active session switching
- Session close and cleanup
- Terminal clear and restart
- Initial session creation for projects
- Multiple session tracking
- IPC interactions (terminal:spawn, terminal:write, terminal:kill)

**Estimated tests:** ~30

---

### Task 6: useIDEInitialization Hook Tests
**File:** `tests/renderer/hooks/useIDEInitialization.test.ts`
**Source:** `src/renderer/hooks/useIDEInitialization.ts`

Test coverage for:
- Initialization sequence (loadTree -> fetchStatus -> fetchBranches -> createSession)
- Loading state management
- Error handling during initialization
- Store interactions

**Estimated tests:** ~15

---

### Task 7: useIDEKeyboardShortcuts Hook Tests
**File:** `tests/renderer/hooks/useIDEKeyboardShortcuts.test.ts`
**Source:** `src/renderer/hooks/useIDEKeyboardShortcuts.ts`

Test coverage for:
- Ctrl+S (save file)
- Ctrl+Shift+S (save all)
- Ctrl+W (close tab)
- Ctrl+` (toggle terminal)
- Ctrl+B (toggle file tree)
- Shortcut registration and cleanup

**Estimated tests:** ~20

---

### Task 8: IDELayout Component Tests
**File:** `tests/renderer/components/ide/IDELayout.test.tsx`
**Source:** `src/renderer/components/ide/IDELayout.tsx`

Test coverage for:
- Renders main layout structure
- Sidebar view switching (file tree, search, git)
- Panel visibility management
- Back navigation callback
- Contribution info display

**Estimated tests:** ~15

---

### Task 9: IDEAppBar Component Tests
**File:** `tests/renderer/components/ide/IDEAppBar.test.tsx`
**Source:** `src/renderer/components/ide/IDEAppBar.tsx`

Test coverage for:
- Renders navigation elements
- Back button triggers callback
- Sidebar toggle buttons
- Branch display
- Contribution info rendering

**Estimated tests:** ~12

---

### Task 10: EditorTabBar Component Tests
**File:** `tests/renderer/components/ide/editor/EditorTabBar.test.tsx`
**Source:** `src/renderer/components/ide/editor/EditorTabBar.tsx`

Test coverage for:
- Renders open file tabs
- Active tab highlighting
- Modified indicator display
- Close tab button
- Tab click to switch files
- Close all / close others context actions
- Empty state (no files open)

**Estimated tests:** ~20

---

### Task 11: TerminalPanel Component Tests
**File:** `tests/renderer/components/ide/terminal/TerminalPanel.test.tsx`
**Source:** `src/renderer/components/ide/terminal/TerminalPanel.tsx`

Test coverage for:
- Renders terminal area
- Session tab display
- New terminal button
- Session switching
- Terminal controls (clear, restart, close)

**Estimated tests:** ~15

---

### Task 12: GitService Backend Tests
**File:** `tests/main/services/git.service.test.ts`
**Source:** `src/main/services/git.service.ts`

Test coverage for:
- getStatus, getLog, getBranches
- add, commit, push, pull
- checkout, createBranch
- clone, init
- getRemoteUrl, addRemote, fetch
- getCurrentBranch, isRepository
- Error handling for all operations
- simple-git mock integration

**Estimated tests:** ~40

---

### Task 13: TerminalService Backend Tests
**File:** `tests/main/services/terminal.service.test.ts`
**Source:** `src/main/services/terminal.service.ts`

Test coverage for:
- spawn session with CWD
- write data to session
- resize terminal
- kill session
- killAll sessions
- getActiveSessions, getSessionCount
- Main window reference management
- IPC event forwarding (terminal:data, terminal:exit, terminal:error)
- node-pty mock integration

**Estimated tests:** ~25

---

### Task 14: SearchService Backend Tests
**File:** `tests/main/services/search.service.test.ts`
**Source:** `src/main/services/search.service.ts`

Test coverage for:
- Basic text search
- Case-sensitive search
- Whole word matching
- Regex search
- Include/exclude patterns
- Result formatting
- Ripgrep integration/fallback
- Empty results handling
- Error handling

**Estimated tests:** ~20

---

### Task 15: FileSystemService Backend Tests
**File:** `tests/main/services/filesystem.service.test.ts`
**Source:** `src/main/services/filesystem.service.ts`

Test coverage for:
- readDirectory (returns FileNode[])
- readFile (returns FileContent)
- writeFile, deleteFile
- createDirectory
- copyFile, copyDirectory
- moveFile (rename)
- exists, isDirectory, getStats
- Path utilities (getExtension, getBaseName, getDirName, joinPaths, normalizePath, resolvePath)
- Error handling for missing files/directories

**Estimated tests:** ~35

---

### Task 16: GitIgnoreService Backend Tests
**File:** `tests/main/services/gitignore.service.test.ts`
**Source:** `src/main/services/gitignore.service.ts`

Test coverage for:
- isIgnored for files and directories
- getPatterns parsing
- Nested .gitignore support
- Default ignore patterns
- Cache behavior

**Estimated tests:** ~15

---

## Acceptance Criteria

1. All 16 tasks produce passing test files
2. Each test file follows existing patterns (see `tests/renderer/stores/useSettingsStore.test.ts` and `tests/main/ipc/contribution-handlers.test.ts` for reference)
3. Total new tests: ~400+
4. All 676 existing tests continue to pass
5. No production code changes required
6. Mock patterns consistent with existing test infrastructure

## Technical Notes

- Monaco Editor and xterm.js require mocking (no DOM rendering in jsdom)
- node-pty requires native module mocking (similar to better-sqlite3 pattern)
- Use `vi.mock()` for IPC client: `vi.mock('../../ipc/client', () => ({ ipc: { invoke: vi.fn() } }))`
- Use `renderHook` from `@testing-library/react` for store/hook tests
- Use `describe.skipIf()` for tests requiring native modules
- Reference `tests/setup.ts` for existing mock infrastructure

## Recommended Execution Order

**Phase 1 - Stores (Tasks 1-5):** Foundation for all other tests
**Phase 2 - Hooks (Tasks 6-7):** Depend on stores
**Phase 3 - Components (Tasks 8-11):** Depend on stores and hooks
**Phase 4 - Backend Services (Tasks 12-16):** Independent, can parallelize
