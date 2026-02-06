# ORCHESTRATOR WORK ORDER #037
## Type: IMPLEMENTATION
## Configuration Quick Wins — Hardware Acceleration Phase 1

---

## MISSION OBJECTIVE

Apply all configuration-only performance optimizations identified in the JUNO Hardware Acceleration audit. These are low-risk, high-impact changes that require no architectural modifications — only config additions, pragma lines, and memoization wrappers.

**Implementation Goal:** 14 audit items resolved (DB-001..005, DB-006, GPU-001..007, BUILD-001..003, RENDER-001, RENDER-002, RENDER-005, RENDER-007, RENDER-008, RENDER-010) across 8 consolidated tasks.
**Based On:** JUNO Audit `trinity/reports/AUDIT-JUNO-HARDWARE-ACCELERATION-2026-01-31.md` and TRA Plan `trinity/plans/TRA-PLAN-HARDWARE-ACCELERATION-2026-01-31.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/database/database.service.ts
    changes: Add 5 SQLite performance pragmas
    risk: LOW

  - path: src/main/index.ts
    changes: Transaction wrapper (DB-006), GPU flags (GPU-001..003), BrowserWindow config (GPU-004..007), ready-to-show pattern (GPU-006)
    risk: LOW

  - path: vite.config.ts
    changes: Add build target, mermaid chunk, syntax-highlighter chunk
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeMessage.tsx
    changes: React.memo wrapper, memoize ReactMarkdown components, memoize TextWithFileLinks regex
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/layout/Sidebar.tsx - Narrow transition-all to transition-[width]
  - src/renderer/components/ide/claude/ClaudeToolCall.tsx - React.memo + useMemo for AnsiText
  - src/renderer/components/ide/claude/ClaudeSpinner.tsx - will-change: transform
  - src/renderer/components/ide/terminal/XTermWrapper.tsx - will-change: contents
```

### Changes Required

#### Change Set 1: SQLite Performance Pragmas (T-001) — DB-001..005
**Files:** `src/main/database/database.service.ts`
**Current State:** Only 2 pragmas: `foreign_keys = ON` and `journal_mode = WAL`
**Target State:** 7 pragmas total including `synchronous = NORMAL`, `cache_size`, `mmap_size`, `temp_store`, `busy_timeout`
**Implementation:**
```typescript
// After existing journal_mode = WAL:
this.db.pragma('synchronous = NORMAL');    // DB-001: 2-5x faster writes
this.db.pragma('cache_size = -16384');     // DB-002: 16MB page cache
this.db.pragma('mmap_size = 268435456');   // DB-003: 256MB mmap
this.db.pragma('temp_store = MEMORY');     // DB-004: in-memory temp tables
this.db.pragma('busy_timeout = 5000');     // DB-005: 5s busy retry
```

#### Change Set 2: Transaction Wrapper (T-002) — DB-006
**Files:** `src/main/index.ts` (lines 489-494)
**Current State:** Each message saved with individual auto-commit
**Target State:** All messages wrapped in single transaction
**Implementation:**
```typescript
handleIpc('claude:conversations:save', async (_event, conversation, messages) => {
  const db = database.getDb();
  const saveAll = db.transaction(() => {
    database.saveConversation(conversation);
    for (const msg of messages) {
      database.saveMessage(msg);
    }
  });
  saveAll();
});
```

#### Change Set 3: GPU + BrowserWindow Config (T-003, T-004, T-005) — GPU-001..007
**Files:** `src/main/index.ts` (lines 617-648)
**Current State:** No GPU flags, default BrowserWindow config, no ready-to-show
**Target State:** GPU rasterization enabled, zero-copy, background throttling disabled, v8 cache, spellcheck off, ready-to-show pattern
**Implementation:**
```typescript
// Before app.on('ready', ...):
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// BrowserWindow constructor:
mainWindow = new BrowserWindow({
  show: false,
  width: 1200,
  height: 800,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: preloadPath,
    backgroundThrottling: false,
    v8CacheOptions: 'bypassHeatCheck',
    spellcheck: false,
  },
});
mainWindow.once('ready-to-show', () => { mainWindow?.show(); });
```

#### Change Set 4: Vite Build Optimization (T-006, T-007, T-008) — BUILD-001..003
**Files:** `vite.config.ts`
**Current State:** No target, only 3 manual chunks (monaco, vendor, pdf)
**Target State:** ES2022 target, 5 manual chunks (+mermaid, +syntax)
**Implementation:**
```typescript
build: {
  target: 'es2022',
  outDir: 'dist/renderer',
  emptyOutDir: true,
  rollupOptions: {
    output: {
      manualChunks: {
        monaco: ['@monaco-editor/react', 'monaco-editor'],
        vendor: ['react', 'react-dom', 'zustand'],
        pdf: ['react-pdf', 'pdfjs-dist'],
        mermaid: ['mermaid'],
        syntax: ['react-syntax-highlighter'],
      },
    },
  },
},
```

#### Change Set 5: CSS Optimizations (T-009, T-010) — RENDER-007, RENDER-008
**Files:** Sidebar.tsx, ClaudeSpinner.tsx, XTermWrapper.tsx
**Current State:** `transition-all`, no `will-change` hints
**Target State:** Narrowed transition, GPU compositor hints on animated elements

#### Change Set 6: React Memoization (T-011, T-012, T-013, T-014) — RENDER-001, 002, 005, 010
**Files:** ClaudeMessage.tsx, ClaudeToolCall.tsx
**Current State:** No React.memo, inline ReactMarkdown components, no useMemo on regex/ANSI parsing
**Target State:** ClaudeMessage wrapped in React.memo, static markdown components extracted, AnsiText memoized, TextWithFileLinks regex memoized

---

## IMPLEMENTATION APPROACH

### Step 1: Backend Configuration (T-001, T-002, T-003, T-004, T-005)
- [ ] Add SQLite pragmas to database.service.ts
- [ ] Add transaction wrapper for conversation save in index.ts
- [ ] Add GPU command-line switches before app.on('ready')
- [ ] Update BrowserWindow config (backgroundThrottling, v8CacheOptions, spellcheck)
- [ ] Implement show:false + ready-to-show pattern
- [ ] Verify app starts correctly with new config

### Step 2: Build Configuration (T-006, T-007, T-008)
- [ ] Add build.target: 'es2022' to vite.config.ts
- [ ] Add mermaid manual chunk
- [ ] Add react-syntax-highlighter manual chunk
- [ ] Verify build succeeds with chunk splitting

### Step 3: CSS Optimizations (T-009, T-010)
- [ ] Change Sidebar transition-all to transition-[width]
- [ ] Add will-change: transform to ClaudeSpinner
- [ ] Add will-change-[width] to Sidebar
- [ ] Add will-change: contents to terminal container

### Step 4: React Memoization (T-011, T-012, T-013, T-014)
- [ ] Wrap ClaudeMessage in React.memo
- [ ] Extract static markdown components to module-level const
- [ ] Memoize dynamic markdown components with useMemo
- [ ] Wrap AnsiText in React.memo + useMemo for parsing
- [ ] Memoize TextWithFileLinks regex with useMemo
- [ ] Run tests to verify no regressions

### Step 5: Validation
- [ ] Run full test suite — all tests pass
- [ ] Run build — production build succeeds
- [ ] Verify chunk splitting produces expected output files

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PERF-PHASE1-IMPLEMENTATION-COMPLETE-2026-01-31.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - 14 audit items resolved via configuration changes
2. **Changes Applied** - Detailed list with file:line diffs
3. **Test Results** - Full test suite results
4. **Metrics** - Build output comparison (chunk sizes), pragma verification
5. **Rollback Plan** - Revert individual config lines
6. **Next Steps** - Proceed to Phase 2 (WO-038)

### Evidence to Provide
- File diff statistics
- Build output showing new chunks (mermaid, syntax)
- Test output showing all passing
- SQLite pragma verification query results

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `PERF-PHASE1-IMPLEMENTATION-COMPLETE-2026-01-31.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-037-configuration-quick-wins.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-037-configuration-quick-wins.md`
   - [ ] Completion report exists in: `trinity/reports/PERF-PHASE1-IMPLEMENTATION-COMPLETE-2026-01-31.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 14 audit items (DB-001..006, GPU-001..007, BUILD-001..003, RENDER-001/002/005/007/008/010) are implemented
- [ ] No regressions introduced — all existing tests pass
- [ ] Production build succeeds with new chunk splitting
- [ ] App launches correctly with GPU flags and ready-to-show pattern
- [ ] Implementation report submitted to trinity/reports/

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, etc.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond config/memoization additions
- [ ] Introduce new dependencies (Phase 1 is config-only)

### DO:
- [ ] Follow existing code patterns
- [ ] Maintain consistent style
- [ ] Test after each change set
- [ ] Report completion to LUKA for git operations

---

## ROLLBACK STRATEGY

If issues arise:
1. **SQLite pragmas:** Remove added pragma lines — defaults restored automatically
2. **GPU flags:** Remove `app.commandLine.appendSwitch` lines
3. **BrowserWindow config:** Revert to original config object
4. **Vite chunks:** Remove added entries from manualChunks
5. **Memoization:** Remove React.memo wrappers and useMemo calls

**Critical Files Backup:** `src/main/index.ts`, `src/main/database/database.service.ts`, `src/renderer/components/ide/claude/ClaudeMessage.tsx`

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-01-31)
**Key Findings:** Zero explicit hardware acceleration config, no React.memo on hot components, only 2 SQLite pragmas, no build target optimization
**Root Causes Being Fixed:** Missing performance configuration, unnecessary re-renders, suboptimal SQLite defaults, oversized initial bundle
**Expected Impact:** 2-5x faster DB writes, reduced bundle size, eliminated streaming re-render storm, GPU-accelerated CSS painting

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
**Implementation Scope:** COMPREHENSIVE — 14 items, 8 consolidated tasks
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** LOW — All changes are additive config, no behavioral modifications
**Risk Factors:**
- `ignore-gpu-blocklist` may cause issues on some hardware
- `mmap_size` only suitable for 64-bit platforms

**Mitigation:**
- Electron targets 64-bit only — mmap is safe
- GPU blocklist flag adds broader compatibility, not less

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
