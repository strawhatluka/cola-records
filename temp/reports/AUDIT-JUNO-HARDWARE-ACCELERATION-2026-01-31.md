# JUNO Audit Report: Hardware Acceleration & Performance Optimization

**Audit Date:** 2026-01-31
**Auditor:** JUNO (Quality Auditor)
**Scope:** Full codebase audit — Electron main process, renderer process, build configuration, database, IPC, and all services
**Verdict:** 31 optimization opportunities identified across 6 categories

---

## Executive Summary

The codebase has **zero explicit hardware acceleration configuration**. Electron's defaults provide basic GPU compositing, but no flags are set to enable advanced GPU features. The terminal (XTerm) runs on the default canvas renderer without WebGL. Monaco editor uses DOM rendering. Several main-thread-blocking operations exist that could be offloaded to worker threads or made asynchronous.

**Priority breakdown:**
- **P0 (Critical):** 6 items — main thread blocking, streaming render pressure
- **P1 (High):** 8 items — GPU acceleration, memory efficiency
- **P2 (Medium):** 10 items — database tuning, build optimization, IPC efficiency
- **P3 (Low):** 7 items — polish, startup experience, minor throughput

---

## Category 1: Electron GPU & Hardware Acceleration

### Current State

**File:** [index.ts](src/main/index.ts) (lines 617-625)

```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: preloadPath,
  },
});
```

- No `app.commandLine.appendSwitch()` calls anywhere in codebase
- No `app.disableHardwareAcceleration()` (good — hardware acceleration is ON by default)
- No `backgroundThrottling` configuration
- No `v8CacheOptions` for JavaScript pre-compilation
- No `show: false` + `ready-to-show` pattern (causes white flash on startup)

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| GPU-001 | P1 | Add `app.commandLine.appendSwitch('enable-gpu-rasterization')` | Enables GPU-accelerated CSS painting for all layers |
| GPU-002 | P1 | Add `app.commandLine.appendSwitch('enable-zero-copy')` | Zero-copy GPU texture uploads, reduces memory bandwidth |
| GPU-003 | P2 | Add `app.commandLine.appendSwitch('ignore-gpu-blocklist')` | Enables GPU on hardware Chromium normally blocks |
| GPU-004 | P2 | Set `backgroundThrottling: false` on BrowserWindow | Prevents throttling of terminal/Claude streaming when window loses focus |
| GPU-005 | P3 | Set `webPreferences.v8CacheOptions: 'bypassHeatCheck'` | Pre-compiles JS for faster subsequent launches |
| GPU-006 | P3 | Implement `show: false` + `ready-to-show` pattern | Eliminates white flash on startup |
| GPU-007 | P3 | Set `webPreferences.spellcheck: false` | Removes unnecessary spellcheck overhead in code editor |

---

## Category 2: XTerm WebGL Renderer

### Current State

**File:** [XTermWrapper.tsx](src/renderer/components/ide/terminal/XTermWrapper.tsx)

The terminal uses **only the default canvas renderer**. No WebGL addon is installed or configured.

```typescript
const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  theme: { /* colors */ },
  allowProposedApi: true,
});
// Addons: FitAddon, WebLinksAddon, SearchAddon only
```

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| XTERM-001 | P1 | Install `@xterm/addon-webgl` and attach WebGL renderer | GPU-accelerated terminal rendering — 2-5x faster for high-throughput output (build logs, large git diffs) |
| XTERM-002 | P1 | Add fallback to canvas renderer if WebGL context creation fails | Graceful degradation on unsupported hardware |
| XTERM-003 | P2 | Debounce ResizeObserver `fitAddon.fit()` calls (lines 136-150) | Prevents layout thrashing during panel resize drag |

**Implementation sketch:**
```typescript
import { WebglAddon } from '@xterm/addon-webgl';

// After term.open(container):
try {
  const webgl = new WebglAddon();
  webgl.onContextLoss(() => { webgl.dispose(); });
  term.loadAddon(webgl);
} catch {
  // Falls back to default canvas renderer
}
```

---

## Category 3: Renderer Performance (Streaming & Rendering)

### Current State — Critical Hotspots

#### P0: Claude Streaming Re-render Storm

**File:** [useClaudeStore.ts](src/renderer/stores/useClaudeStore.ts) (lines 271-453)

Every streaming text chunk triggers:
1. `set((state) => ({ messages: state.messages.map(...) }))` — creates new array, maps ALL messages
2. All `ClaudeMessage` components re-render (no `React.memo`)
3. Each re-render re-parses markdown via `ReactMarkdown` with inline `components` object
4. Each re-render re-runs `SyntaxHighlighter` (Prism tokenization) for code blocks

**Result:** During fast streaming, hundreds of renders per second with O(n) message re-renders per chunk.

#### P0: Non-virtualized Message List

**File:** [ClaudePanel.tsx](src/renderer/components/ide/claude/ClaudePanel.tsx) (lines 408-469)

Messages rendered with `.map()` in a plain `overflow-y-auto` div. Long conversations with tool calls, code blocks, and markdown accumulate in the DOM without virtualization.

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| RENDER-001 | P0 | Wrap `ClaudeMessage` in `React.memo` | Prevents O(n) re-renders on each streaming chunk |
| RENDER-002 | P0 | Memoize the `components` object passed to `ReactMarkdown` in `ClaudeMessage` (line 174) | Prevents ReactMarkdown from re-registering component overrides every render |
| RENDER-003 | P0 | Batch streaming state updates (accumulate chunks, flush at 60fps via requestAnimationFrame) | Reduces state updates from hundreds/sec to 60/sec |
| RENDER-004 | P1 | Virtualize Claude message list with `react-window` (already a dependency) | Keeps only visible messages in DOM |
| RENDER-005 | P1 | Memoize `AnsiText` ANSI parsing in `ClaudeToolCall` (line 23) | Prevents re-parsing on every parent re-render |
| RENDER-006 | P1 | Virtualize `SearchPanel` results (lines 224-265) | Large search result sets currently render all DOM nodes |
| RENDER-007 | P2 | Add `will-change: transform` to animated elements (sidebar, spinners) | Promotes elements to compositor layers for GPU rendering |
| RENDER-008 | P2 | Narrow `Sidebar` `transition-all duration-300` to `transition-[width] duration-300` | Prevents GPU from animating all properties |
| RENDER-009 | P2 | Split `ClaudePanel` (~30 store selectors) into sub-components | Reduces re-render surface area |
| RENDER-010 | P3 | Memoize `TextWithFileLinks` regex matching in `ClaudeMessage` (line 17) | Prevents regex scan on every render |

---

## Category 4: Main Process — Thread Blocking & Worker Threads

### Current State

**Zero worker threads** in the entire codebase. All CPU-intensive work runs on the main Electron process, blocking the UI event loop.

### Critical Blocking Operations

| Operation | File | Lines | Issue |
|-----------|------|-------|-------|
| `gzipSync` / `readFileSync` | [checkpoint.service.ts](src/main/services/checkpoint.service.ts) | 152-169 | Synchronous file read + gzip compression blocks main thread |
| Recursive `readDirectory` | [filesystem.service.ts](src/main/services/filesystem.service.ts) | 26-71 | Eagerly loads entire file tree with stat() per entry |
| Fuzzy file search | [index.ts](src/main/index.ts) | 507-565 | JavaScript fuzzy matching on main thread |
| Ripgrep stdout buffering | [search.service.ts](src/main/services/search.service.ts) | 84-89 | Accumulates entire stdout as single string |
| NDJSON string concatenation | [claude-container.service.ts](src/main/services/claude-container.service.ts) | 263 | Repeated `lineBuffer += chunk.toString()` creates GC pressure |
| Stream event IPC flooding | [claude-container.service.ts](src/main/services/claude-container.service.ts) | 476-479 | IPC message per NDJSON token during streaming |

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| THREAD-001 | P0 | Replace `gzipSync`/`readFileSync` with async `zlib.gzip`/`fs.promises.readFile` in checkpoint service | Unblocks main thread during checkpoint creation |
| THREAD-002 | P0 | Parallelize file snapshotting with `Promise.all` in `createBatchCheckpoint` (line 48) | N files snapshotted concurrently instead of sequentially |
| THREAD-003 | P1 | Add lazy loading / depth limit to `readDirectory` | Prevents multi-second freeze on large projects |
| THREAD-004 | P1 | Offload fuzzy file search (`claude:search-files`) to worker thread | Unblocks main thread during typing |
| THREAD-005 | P2 | Stream-parse ripgrep stdout line-by-line instead of buffering | Reduces memory from O(output) to O(line) |
| THREAD-006 | P2 | Batch Claude stream events (like terminal batches at 16ms/60fps) | Reduces IPC calls from hundreds/sec to 60/sec |
| THREAD-007 | P2 | Use `Buffer[]` array + `Buffer.concat` instead of string concatenation for NDJSON parsing | Reduces GC pressure during long responses |

---

## Category 5: SQLite Database Performance

### Current State

**File:** [database.service.ts](src/main/database/database.service.ts) (lines 29-32)

```typescript
this.db.pragma('foreign_keys = ON');
this.db.pragma('journal_mode = WAL');
```

Only 2 pragmas set. WAL mode is configured (good), but many performance pragmas are missing.

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| DB-001 | P0 | Add `pragma synchronous = NORMAL` | 2-5x faster writes; safe with WAL mode |
| DB-002 | P1 | Add `pragma cache_size = -16384` (16MB) | Larger page cache for BLOB-heavy workload |
| DB-003 | P1 | Add `pragma mmap_size = 268435456` (256MB) | Memory-mapped I/O for dramatically faster reads |
| DB-004 | P2 | Add `pragma temp_store = MEMORY` | In-memory temp tables instead of disk |
| DB-005 | P2 | Add `pragma busy_timeout = 5000` | Prevents write failures under concurrency |
| DB-006 | P2 | Wrap `claude:conversations:save` message loop in `db.transaction()` ([index.ts](src/main/index.ts) line 489) | 1 transaction instead of N auto-commits |

---

## Category 6: Build & IPC Optimization

### Current State

**File:** [vite.config.ts](vite.config.ts)

Manual chunk splitting for Monaco, vendor, and PDF. No target specified, no CSS code splitting.

**File:** [forge.config.ts](forge.config.ts)

ASAR packaging enabled. No platform-specific optimization.

### Recommendations

| ID | Priority | Recommendation | Impact |
|----|----------|----------------|--------|
| BUILD-001 | P2 | Add `build.target: 'es2022'` to Vite renderer config | Smaller output for Electron's V8 (no unnecessary polyfills) |
| BUILD-002 | P2 | Split `mermaid` into its own manual chunk (1.5MB+) | Reduces initial bundle; loaded only when markdown viewer opens |
| BUILD-003 | P2 | Split `react-syntax-highlighter` into its own chunk | Large library loaded only when code blocks render |
| BUILD-004 | P3 | Use transferable `ArrayBuffer` for `fs:read-file-binary` IPC | Zero-copy binary transfer instead of structured clone copy |
| BUILD-005 | P3 | Resolve full `docker.exe` path once at startup, use `shell: false` | Eliminates extra shell process per Docker command |

---

## Summary Matrix

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| GPU & Electron Config | 0 | 2 | 2 | 3 | 7 |
| XTerm WebGL | 0 | 2 | 1 | 0 | 3 |
| Renderer Performance | 3 | 3 | 3 | 1 | 10 |
| Main Thread / Workers | 2 | 2 | 3 | 0 | 7 |
| SQLite Database | 1 | 2 | 3 | 0 | 6 |
| Build & IPC | 0 | 0 | 3 | 2 | 5 |
| **Total** | **6** | **11** | **15** | **6** | **38** |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (No architectural changes)
1. **DB-001** — Add `synchronous = NORMAL` pragma (1 line)
2. **DB-002, DB-003, DB-004, DB-005** — Add remaining SQLite pragmas (4 lines)
3. **GPU-001, GPU-002** — Add GPU rasterization and zero-copy flags (2 lines)
4. **GPU-004** — Set `backgroundThrottling: false` (1 line)
5. **GPU-007** — Disable spellcheck (1 line)
6. **RENDER-001** — Wrap `ClaudeMessage` in `React.memo` (1 line)
7. **RENDER-002** — Memoize `ReactMarkdown` components object (extract to module-level const)
8. **DB-006** — Wrap conversation save in transaction (3 lines)

### Phase 2: GPU Rendering
1. **XTERM-001, XTERM-002** — Install and configure `@xterm/addon-webgl` with fallback
2. **RENDER-007** — Add `will-change: transform` to animated elements
3. **RENDER-008** — Narrow sidebar transition property
4. **GPU-006** — Implement `show: false` + `ready-to-show` startup pattern

### Phase 3: Async & Threading
1. **THREAD-001, THREAD-002** — Make checkpoint service fully async
2. **THREAD-006** — Batch Claude stream events at 60fps
3. **RENDER-003** — Batch streaming state updates in store
4. **THREAD-003** — Lazy-load file tree with depth limit
5. **THREAD-005** — Stream-parse ripgrep output

### Phase 4: Virtualization & Architecture
1. **RENDER-004** — Virtualize Claude message list
2. **RENDER-006** — Virtualize search results
3. **RENDER-009** — Split ClaudePanel into sub-components
4. **THREAD-004** — Worker thread for fuzzy file search
5. **BUILD-001, BUILD-002, BUILD-003** — Build optimization and chunk splitting

---

## Appendix: Files Audited

### Main Process
- `src/main/index.ts` — Entry point, IPC handlers, BrowserWindow config
- `src/main/database/database.service.ts` — SQLite configuration and queries
- `src/main/database/schema.ts` — Table definitions and indexes
- `src/main/services/claude-container.service.ts` — Docker management, NDJSON streaming
- `src/main/services/checkpoint.service.ts` — File snapshots, gzip compression
- `src/main/services/filesystem.service.ts` — File tree loading, file read/write
- `src/main/services/search.service.ts` — Ripgrep integration, fallback search
- `src/main/services/git.service.ts` — SimpleGit operations
- `src/main/services/terminal.service.ts` — PTY management, data batching
- `src/main/services/filewatcher.service.ts` — Chokidar file watching
- `src/main/preload.ts` — IPC bridge

### Renderer Process
- `src/renderer/stores/useClaudeStore.ts` — Claude state, streaming handler
- `src/renderer/stores/useCodeEditorStore.ts` — Editor state, file content
- `src/renderer/stores/useFileTreeStore.ts` — File tree, git status, gitignore cache
- `src/renderer/stores/useTerminalStore.ts` — Terminal sessions
- `src/renderer/stores/useIDEStore.ts` — IDE layout persistence
- `src/renderer/components/ide/claude/ClaudePanel.tsx` — Chat panel, message list
- `src/renderer/components/ide/claude/ClaudeMessage.tsx` — Message rendering, markdown
- `src/renderer/components/ide/claude/ClaudeToolCall.tsx` — Tool call display, ANSI parsing
- `src/renderer/components/ide/claude/CodeBlock.tsx` — Syntax highlighting
- `src/renderer/components/ide/editor/CodeEditorPanel.tsx` — Editor container, lazy loading
- `src/renderer/components/ide/editor/MonacoEditor.tsx` — Monaco wrapper
- `src/renderer/components/ide/editor/DiffEditor.tsx` — Diff viewer
- `src/renderer/components/ide/editor/ImageViewer.tsx` — Image display
- `src/renderer/components/ide/editor/PdfViewer.tsx` — PDF rendering
- `src/renderer/components/ide/editor/MarkdownViewer.tsx` — Markdown + Mermaid
- `src/renderer/components/ide/terminal/XTermWrapper.tsx` — Terminal component
- `src/renderer/components/ide/file-tree/FileTreePanel.tsx` — Virtualized file tree
- `src/renderer/components/ide/file-tree/FileTreeNode.tsx` — Tree node
- `src/renderer/components/ide/search/SearchPanel.tsx` — Search UI
- `src/renderer/components/contributions/ContributionList.tsx` — Contribution grid
- `src/renderer/components/layout/Sidebar.tsx` — Navigation sidebar

### Build Configuration
- `vite.config.ts` — Renderer Vite config
- `vite.main.config.ts` — Main process Vite config
- `vite.preload.config.ts` — Preload Vite config
- `forge.config.ts` — Electron Forge packaging
- `tailwind.config.js` — Tailwind CSS config
- `package.json` — Dependencies and scripts
