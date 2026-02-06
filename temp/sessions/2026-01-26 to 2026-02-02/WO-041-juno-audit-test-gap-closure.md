# ORCHESTRATOR WORK ORDER #041
## Type: IMPLEMENTATION
## JUNO Audit Test Coverage Gap Closure (WO-037 through WO-039)

---

## MISSION OBJECTIVE

Close all test coverage gaps identified by JUNO audits of Hardware Acceleration work orders WO-037, WO-038, and WO-039. Implementation scored 38/38 (100%) but test coverage is only 21%. Fix stale tests, update broken mocks, create missing test files, and add targeted tests for every untested performance optimization.

**Implementation Goal:** Raise test coverage from 8/38 (21%) to 28+/38 (≥74%) — covering all unit-testable audit items. Infrastructure-only items (DB pragmas, GPU flags, Electron config, build settings) are excluded as they cannot be meaningfully unit-tested.
**Based On:** JUNO Audit Reports for WO-037, WO-038, WO-039, WO-040 (2026-02-01)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/main/services/checkpoint.service.test.ts
    changes: Rewrite all fs/zlib mocks from sync to async (fs.promises.*, callback zlib)
    risk: HIGH

  - path: tests/main/services/claude-container.service.test.ts
    changes: Add stream event batching tests (THREAD-006) + Buffer[] NDJSON tests (THREAD-007)
    risk: MEDIUM

  - path: tests/renderer/stores/useClaudeStore.test.ts
    changes: Add RAF batching tests for pendingTextContent/flushPendingText (RENDER-003)
    risk: MEDIUM

New_Files:
  - path: tests/main/workers/fuzzy-search.worker.test.ts
    changes: Full test suite for fuzzy-search worker (THREAD-004)
    risk: MEDIUM

  - path: tests/renderer/components/ide/terminal/XTermWrapper.test.tsx
    changes: Tests for WebGL renderer, canvas fallback, ResizeObserver debounce (XTERM-001/002/003)
    risk: MEDIUM

Supporting_Files:
  - path: tests/renderer/components/layout/Sidebar.test.tsx
    changes: Fix stale assertion line 216 (transition-all → transition-[width])
    risk: LOW

  - path: tests/main/services/filesystem.service.test.ts
    changes: Add maxDepth/hasChildren tests in readDirectory describe block (THREAD-003)
    risk: LOW

  - path: tests/main/services/search.service.test.ts
    changes: Add partial-line lineBuffer test (THREAD-005)
    risk: LOW
```

---

## IMPLEMENTATION APPROACH

### Task 1 (T-033): Fix Sidebar stale assertion [P0]
**File:** `tests/renderer/components/layout/Sidebar.test.tsx`
**Audit ID:** RENDER-008
- [ ] Line 216: Change `transition-all` to `transition-[width]`
- [ ] Verify assertion matches actual Sidebar.tsx className

### Task 2 (T-034): Rewrite checkpoint.service.test.ts mocks [P0]
**File:** `tests/main/services/checkpoint.service.test.ts` (325 lines)
**Audit IDs:** THREAD-001, THREAD-002
- [ ] Replace `vi.mock('fs')` sync mocks (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) with async `fs.promises.*` mocks (`readFile`, `writeFile`, `mkdir`, `access`)
- [ ] Replace sync `zlib.gzipSync`/`gunzipSync` references with callback-based `zlib.gzip`/`zlib.gunzip` mocks
- [ ] Update all `mockReturnValue()` calls on fs mocks to `mockResolvedValue()`
- [ ] Add `await` to all service method calls that are now async
- [ ] Add test: parallel snapshotting verifies `Promise.all` is used (THREAD-002)
- [ ] Verify all 14 existing tests pass with corrected mocks

### Task 3 (T-035): Create fuzzy-search.worker.test.ts [P0]
**File:** `tests/main/workers/fuzzy-search.worker.test.ts` (NEW)
**Audit ID:** THREAD-004
**Source:** `src/main/workers/fuzzy-search.worker.ts` (67 lines)
- [ ] Mock `worker_threads` `parentPort`
- [ ] Test `walk()` function: traverses directory, respects depth limit (max 8), skips node_modules/.git
- [ ] Test fuzzy match scoring: character-by-character matching, score calculation
- [ ] Test `parentPort.on('message')`: posts sorted results (max 20), handles empty input
- [ ] Test timeout/error edge cases

### Task 4 (T-036): Add maxDepth/hasChildren tests [P1]
**File:** `tests/main/services/filesystem.service.test.ts`
**Audit ID:** THREAD-003
**Insert:** Inside `readDirectory` describe block (before line 97)
- [ ] Test: `maxDepth=0` returns entries with `hasChildren: true` and `children: []` for directories
- [ ] Test: `maxDepth=1` recurses one level only
- [ ] Test: Default maxDepth=3 recurses up to 3 levels
- [ ] Test: Files at depth limit still returned (only directory recursion is limited)

### Task 5 (T-037): Add stream event batching tests [P1]
**File:** `tests/main/services/claude-container.service.test.ts`
**Audit ID:** THREAD-006
**Insert:** After checkpoint batching block (after line 1034)
- [ ] Test: Multiple rapid `emitStreamEvent()` calls are coalesced into a single 16ms flush
- [ ] Test: `done` and `error` events bypass the queue and flush immediately
- [ ] Test: `flushStreamEvents()` clears the timer and empties the queue
- [ ] Test: Timer uses 16ms interval (mock setTimeout)
- [ ] Use `vi.useFakeTimers()` for precise timer control

### Task 6 (T-038): Add RAF batching tests [P1]
**File:** `tests/renderer/stores/useClaudeStore.test.ts`
**Audit ID:** RENDER-003
**Insert:** After Stream Event Handlers block (before line 1195)
- [ ] Mock `requestAnimationFrame` and `cancelAnimationFrame` via `vi.stubGlobal`
- [ ] Test: Multiple `type: 'text'` stream chunks accumulate in pendingTextContent
- [ ] Test: RAF is scheduled only once (not per chunk)
- [ ] Test: `flushPendingText` applies accumulated text to assistant message
- [ ] Test: `done` event calls `cancelAnimationFrame` then `flushPendingText` (no text lost)
- [ ] Reuse `setupStreamCapture()` helper from line 1032

### Task 7 (T-039): Create XTermWrapper.test.tsx [P1]
**File:** `tests/renderer/components/ide/terminal/XTermWrapper.test.tsx` (NEW)
**Audit IDs:** XTERM-001, XTERM-002, XTERM-003
- [ ] Mock xterm imports: `Terminal`, `WebglAddon`, `CanvasAddon`, `FitAddon`, `WebLinksAddon`, `Unicode11Addon`
- [ ] Test XTERM-001: WebGL renderer addon is loaded on mount
- [ ] Test XTERM-002: Falls back to CanvasAddon if WebGL context creation throws
- [ ] Test XTERM-003: ResizeObserver `fitAddon.fit()` calls are debounced (not called on every resize event)
- [ ] Test: Unicode11 addon loaded and activated
- [ ] Test: WebLinks addon loaded

### Task 8 (T-040): Add partial-line lineBuffer test [P2]
**File:** `tests/main/services/search.service.test.ts`
**Audit ID:** THREAD-005
**Insert:** Before line 320 (inside `search` describe block)
- [ ] Test: Emit data chunk that splits a JSON line mid-byte across two `data` events
- [ ] Verify: Partial first chunk buffered, second chunk completes the line, result parsed correctly

### Task 9 (T-041): Add fs:read-file-binary ArrayBuffer test [P2]
**File:** `tests/main/services/` (identify correct file or add to index.test.ts)
**Audit ID:** BUILD-004
- [ ] Test: `fs:read-file-binary` IPC handler returns ArrayBuffer (not Buffer)
- [ ] Test: byte offset and length are correctly sliced from underlying Buffer

### Task 10 (T-042): Add Buffer[] NDJSON concat test [P2]
**File:** `tests/main/services/claude-container.service.test.ts`
**Audit ID:** THREAD-007
**Insert:** After stream batching tests (Task 5)
- [ ] Test: Partial NDJSON chunk accumulation across multiple `data` events
- [ ] Test: Buffer.concat correctly reassembles split JSON lines
- [ ] Test: Remaining buffer content processed on `end` event

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TEST-GAP-CLOSURE-IMPLEMENTATION-COMPLETE-2026-02-01.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list per task (T-033 through T-042)
3. **Test Results** - Number of new/fixed tests per file
4. **Coverage Delta** - Before/after coverage percentages
5. **Rollback Plan** - How to revert if needed
6. **Audit ID Mapping** - Which audit IDs now have test coverage

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- New test count per file
- Audit ID → test mapping table

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `TEST-GAP-CLOSURE-IMPLEMENTATION-COMPLETE-2026-02-01.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-041-juno-audit-test-gap-closure.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-041-juno-audit-test-gap-closure.md`
   - [ ] Completion report exists in: `trinity/reports/TEST-GAP-CLOSURE-IMPLEMENTATION-COMPLETE-2026-02-01.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report → `trinity/archive/reports/YYYY-MM-DD/`
- Session summary → `trinity/archive/sessions/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 10 tasks (T-033 through T-042) are implemented
- [ ] Stale Sidebar assertion fixed (no test failures from RENDER-008)
- [ ] checkpoint.service.test.ts mocks correctly target async APIs
- [ ] fuzzy-search.worker.test.ts created with ≥5 tests
- [ ] XTermWrapper.test.tsx created with ≥5 tests
- [ ] All new tests pass (LUKA runs `npm test`)
- [ ] No regressions in existing tests
- [ ] Implementation report submitted to trinity/reports/

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations.

**ALSO FORBIDDEN:**
- `npm test` — Only LUKA runs tests
- `npm run build` — Only LUKA runs builds
- `npm install` — Only LUKA manages dependencies

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Report completion to LUKA with summary of changes
3. LUKA will handle ALL git operations and test runs

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond test coverage requirements
- [ ] Modify source implementation files (only test files)
- [ ] Perform ANY git operations
- [ ] Run npm test/build/install

### DO:
- [ ] Follow existing test patterns in each file
- [ ] Reuse existing mock helpers (setupStreamCapture, createMockProcess, etc.)
- [ ] Use vi.useFakeTimers() for timer-dependent tests
- [ ] Use vi.stubGlobal() for RAF mocking
- [ ] Match existing describe/test naming conventions

---

## ROLLBACK STRATEGY

If issues arise:
1. Each task modifies a separate test file — rollback is per-file
2. New files (T-035, T-039) can simply be deleted
3. Modified files can be reverted to pre-WO-041 state via git

**Critical Files Backup:** checkpoint.service.test.ts (highest risk — full mock rewrite)

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit Reports (WO-037 through WO-040), 2026-02-01
**Key Findings:**
- 38/38 implementation items PASS (100%)
- Only 8/38 items have full test coverage (21%)
- 4/38 have partial coverage, 26/38 have no coverage
- checkpoint.service.test.ts mocks are fundamentally broken (sync vs async)
- Sidebar.test.tsx has stale assertion that will FAIL
- Two entirely new files need test suites (fuzzy-search worker, XTermWrapper)

**Root Causes Being Fixed:**
- Stale test assertions after implementation changes
- Mock API mismatch (sync mocks for async implementation)
- Missing test files for new components
- Missing test cases for new optimization features

**Expected Impact:** 26 audit items gain test coverage, 0 test regressions

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All 10 tasks must be implemented
**Risk Level:** MEDIUM
**Risk Factors:**
- checkpoint.service.test.ts mock rewrite could break existing passing tests
- XTermWrapper mocking complexity (xterm addons with WebGL context)
- RAF mocking in jsdom environment may require careful stubbing

**Mitigation:**
- Verify each checkpoint test individually after mock migration
- Use minimal xterm mocks that only test our addon loading logic
- Use vi.stubGlobal for RAF rather than trying to polyfill

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
