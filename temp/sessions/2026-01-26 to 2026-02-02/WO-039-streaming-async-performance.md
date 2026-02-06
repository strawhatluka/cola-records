# ORCHESTRATOR WORK ORDER #039
## Type: IMPLEMENTATION
## Streaming & Async Performance — Hardware Acceleration Phase 3

---

## MISSION OBJECTIVE

Eliminate main-thread blocking operations and reduce IPC flooding during Claude streaming. This is the highest-risk phase: it modifies hot paths in the checkpoint service, Claude container streaming, ripgrep search, file system service, and the renderer's state management. All sync I/O becomes async, all per-event IPC becomes batched at 60fps.

**Implementation Goal:** 10 audit items resolved (THREAD-001 through THREAD-007, RENDER-003, BUILD-004) across 8 consolidated tasks.
**Based On:** JUNO Audit `trinity/reports/AUDIT-JUNO-HARDWARE-ACCELERATION-2026-01-31.md` and TRA Plan `trinity/plans/TRA-PLAN-HARDWARE-ACCELERATION-2026-01-31.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/checkpoint.service.ts
    changes: Replace gzipSync/readFileSync with async, parallelize snapshotting
    risk: HIGH

  - path: src/main/services/claude-container.service.ts
    changes: Batch stream events at 60fps, Buffer[] for NDJSON parsing
    risk: HIGH

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Batch streaming state updates via requestAnimationFrame
    risk: HIGH

  - path: src/main/services/search.service.ts
    changes: Stream-parse ripgrep stdout line-by-line
    risk: MEDIUM

  - path: src/main/services/filesystem.service.ts
    changes: Add maxDepth parameter to readDirectory
    risk: MEDIUM

Supporting_Files:
  - src/main/index.ts - ArrayBuffer transfer for binary IPC, worker thread for fuzzy search
  - src/main/preload.ts - Support for ArrayBuffer transfer
  - src/main/workers/fuzzy-search.worker.ts - NEW FILE: worker thread for fuzzy file search
```

### Changes Required

#### Change Set 1: Async Checkpoint Service (T-019, T-020, T-028) — THREAD-001, THREAD-002
**Files:** `src/main/services/checkpoint.service.ts`
**Current State:** `gzipSync`/`readFileSync`/`gunzipSync` block main thread; files snapshotted sequentially
**Target State:** Fully async compression/decompression; parallel file snapshotting with `Promise.all`
**Implementation:**
```typescript
private async compressContent(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(Buffer.from(content, 'utf-8'), (err, result) => {
      if (err) reject(err); else resolve(result);
    });
  });
}

private async snapshotFile(filePath: string): Promise<{ content: Buffer; size: number }> {
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  const compressed = await this.compressContent(raw);
  return { content: compressed, size: Buffer.byteLength(raw, 'utf-8') };
}

// In createBatchCheckpoint:
const snapshots = await Promise.all(
  affectedFiles.map(async (filePath) => {
    try {
      const { content, size } = await this.snapshotFile(filePath);
      return { filePath, content, size };
    } catch { return null; }
  })
);
```

#### Change Set 2: Stream Event Batching + Buffer NDJSON (T-021, T-023) — THREAD-006, THREAD-007
**Files:** `src/main/services/claude-container.service.ts`
**Current State:** IPC message sent per NDJSON token; `lineBuffer += chunk.toString()` creates GC pressure
**Target State:** Events batched at 16ms intervals (~60fps); Buffer[] array with Buffer.concat
**Implementation:**
```typescript
// Stream event batching:
private streamEventQueue: ClaudeStreamEvent[] = [];
private streamFlushTimer: NodeJS.Timeout | null = null;

private emitStreamEvent(event: ClaudeStreamEvent): void {
  this.streamEventQueue.push(event);
  if (!this.streamFlushTimer) {
    this.streamFlushTimer = setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        for (const evt of this.streamEventQueue) {
          this.mainWindow.webContents.send('claude:stream-chunk', evt);
        }
      }
      this.streamEventQueue = [];
      this.streamFlushTimer = null;
    }, 16);
  }
}

// Buffer[] NDJSON parsing:
const buffers: Buffer[] = [];
res.on('data', (chunk: Buffer) => {
  buffers.push(chunk);
  const combined = Buffer.concat(buffers).toString();
  const lines = combined.split('\n');
  const lastLine = lines.pop() || '';
  buffers.length = 0;
  if (lastLine) buffers.push(Buffer.from(lastLine));
  for (const line of lines) { /* process */ }
});
```

#### Change Set 3: Renderer Stream Batching (T-022) — RENDER-003
**Files:** `src/renderer/stores/useClaudeStore.ts`
**Current State:** Each streaming text chunk triggers `set()` → full `.map()` of all messages
**Target State:** Chunks accumulated, flushed at 60fps via requestAnimationFrame
**Implementation:**
```typescript
let pendingTextContent = '';
let pendingRafId: number | null = null;

case 'text': {
  pendingTextContent += chunk.content || '';
  if (!pendingRafId) {
    pendingRafId = requestAnimationFrame(() => {
      const text = pendingTextContent;
      pendingTextContent = '';
      pendingRafId = null;
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + text }
            : msg
        ),
      }));
    });
  }
  break;
}
```

#### Change Set 4: Stream-Parse Ripgrep (T-024) — THREAD-005
**Files:** `src/main/services/search.service.ts`
**Current State:** Accumulates entire stdout as single string
**Target State:** Line-by-line incremental parsing
**Implementation:**
```typescript
let lineBuffer = '';
rgProcess.stdout.on('data', (data) => {
  lineBuffer += data.toString();
  const lines = lineBuffer.split('\n');
  lineBuffer = lines.pop() || '';
  for (const line of lines) {
    // Parse and accumulate search results incrementally
  }
});
```

#### Change Set 5: Lazy readDirectory (T-025) — THREAD-003
**Files:** `src/main/services/filesystem.service.ts`
**Current State:** Eagerly loads entire file tree recursively with stat() per entry
**Target State:** Depth-limited loading (default 2 levels), lazy expansion
**Implementation:**
```typescript
async readDirectory(dirPath: string, maxDepth: number = Infinity, currentDepth: number = 0): Promise<FileNode[]> {
  if (entry.isDirectory()) {
    if (currentDepth < maxDepth) {
      node.children = await this.readDirectory(fullPath, maxDepth, currentDepth + 1);
    } else {
      node.children = [];
      node.hasChildren = true;
    }
  }
}
```

#### Change Set 6: ArrayBuffer Transfer (T-026) — BUILD-004
**Files:** `src/main/index.ts`, `src/main/preload.ts`
**Current State:** Binary files transferred via structured clone (copy)
**Target State:** Zero-copy ArrayBuffer transfer for large binary files

#### Change Set 7: Worker Thread for Fuzzy Search (T-027) — THREAD-004
**Files:** New `src/main/workers/fuzzy-search.worker.ts`, `src/main/index.ts`
**Current State:** Fuzzy file search runs on main thread, blocking UI event loop
**Target State:** Search offloaded to worker thread

---

## IMPLEMENTATION APPROACH

### Step 1: Checkpoint Service Async (T-019, T-020, T-028)
- [ ] Replace `gzipSync` with async `zlib.gzip` wrapper
- [ ] Replace `readFileSync` with `fs.promises.readFile`
- [ ] Replace `gunzipSync` with async `zlib.gunzip`
- [ ] Replace sequential snapshot loop with `Promise.all`
- [ ] Run checkpoint-related tests
- [ ] Verify checkpoint create/restore works end-to-end

### Step 2: Stream Batching — Main Process (T-021, T-023)
- [ ] Add `streamEventQueue` and `streamFlushTimer` to ClaudeContainerService
- [ ] Replace direct `webContents.send` with batched `emitStreamEvent`
- [ ] Replace string concatenation with `Buffer[]` + `Buffer.concat`
- [ ] Ensure flush on stream end (clear timer, send remaining events)
- [ ] Run claude-container tests

### Step 3: Stream Batching — Renderer (T-022)
- [ ] Add `pendingTextContent` accumulator and `pendingRafId` to stream handler
- [ ] Replace per-chunk `set()` with `requestAnimationFrame` batch
- [ ] Ensure final flush on stream end (cancel RAF, apply remaining text)
- [ ] Run claude store tests

### Step 4: Ripgrep Stream Parsing (T-024)
- [ ] Replace `stdout += data.toString()` with line-by-line parsing
- [ ] Handle incomplete lines at end of stream
- [ ] Run search service tests

### Step 5: Lazy readDirectory (T-025)
- [ ] Add `maxDepth` and `currentDepth` parameters
- [ ] Add `hasChildren` hint for UI lazy loading
- [ ] Update `FileNode` type if needed
- [ ] Run filesystem tests

### Step 6: ArrayBuffer Transfer (T-026)
- [ ] Modify binary file IPC to return ArrayBuffer
- [ ] Update preload bridge
- [ ] Test with binary file reading

### Step 7: Worker Thread for Fuzzy Search (T-027)
- [ ] Create `src/main/workers/fuzzy-search.worker.ts`
- [ ] Move `walk()` function and fuzzy matching logic to worker
- [ ] Replace main-thread handler with worker spawn
- [ ] Verify Vite main build handles worker file
- [ ] Test fuzzy search functionality

### Step 8: Validation
- [ ] Run full test suite — all tests pass
- [ ] Run build — production build succeeds
- [ ] Verify streaming still works correctly (batched but imperceptible delay)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PERF-PHASE3-IMPLEMENTATION-COMPLETE-2026-01-31.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Async operations, stream batching, worker threads
2. **Changes Applied** - Detailed diffs per service
3. **Test Results** - Full test suite results
4. **Metrics** - IPC message count reduction, main thread unblocking confirmation
5. **Rollback Plan** - Revert per-service changes
6. **Next Steps** - Proceed to Phase 4 (WO-040)

### Evidence to Provide
- File diff statistics
- Test output showing all passing
- Build verification
- Worker thread compilation confirmation

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `PERF-PHASE3-IMPLEMENTATION-COMPLETE-2026-01-31.md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-039-streaming-async-performance.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-039-streaming-async-performance.md`
   - [ ] Completion report exists in: `trinity/reports/PERF-PHASE3-IMPLEMENTATION-COMPLETE-2026-01-31.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All sync I/O in checkpoint service replaced with async equivalents
- [ ] File snapshotting runs in parallel via Promise.all
- [ ] Claude stream events batched at 16ms (60fps) in main process
- [ ] Renderer state updates batched via requestAnimationFrame
- [ ] NDJSON parsing uses Buffer[] instead of string concatenation
- [ ] Ripgrep stdout parsed line-by-line
- [ ] readDirectory supports depth limiting
- [ ] Fuzzy search runs in worker thread
- [ ] All existing tests pass — no regressions
- [ ] Production build succeeds
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, etc.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change streaming protocol/format (only batching behavior)
- [ ] Break existing checkpoint create/restore functionality
- [ ] Introduce visible latency in streaming (16ms is imperceptible)

### DO:
- [ ] Ensure all timers are cleaned up on stream end
- [ ] Handle edge cases (empty streams, aborted streams, context loss)
- [ ] Flush pending events/text before stream completion
- [ ] Test with real streaming scenarios where possible

---

## ROLLBACK STRATEGY

If issues arise:
1. **Checkpoint async:** Revert to `gzipSync`/`readFileSync` (sequential)
2. **Stream batching (main):** Remove timer, revert to direct `webContents.send`
3. **Stream batching (renderer):** Remove RAF, revert to per-chunk `set()`
4. **Buffer[] NDJSON:** Revert to `lineBuffer += chunk.toString()`
5. **Ripgrep streaming:** Revert to `stdout += data.toString()`
6. **Lazy readDirectory:** Remove maxDepth parameter, revert to full recursion
7. **Worker thread:** Remove worker file, revert to main-thread fuzzy search

**Critical Files Backup:** `checkpoint.service.ts`, `claude-container.service.ts`, `useClaudeStore.ts`, `search.service.ts`, `filesystem.service.ts`

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-01-31)
**Key Findings:** Zero worker threads in codebase; gzipSync/readFileSync block main thread; IPC floods hundreds of events/sec during streaming; string concatenation creates GC pressure; file tree loads entire project eagerly
**Root Causes Being Fixed:** Main thread blocking, IPC flooding, GC pressure, eager file tree loading
**Expected Impact:** Unblocked main thread during checkpoints, 94% fewer IPC calls during streaming, reduced GC pauses, faster initial file tree load

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
**Implementation Scope:** COMPREHENSIVE — 10 items, 8 tasks, highest-risk phase
**Completeness Required:** 100%
**Risk Level:** HIGH — Modifies hot paths in streaming, I/O, and state management
**Risk Factors:**
- Stream batching could introduce visible latency if interval too high
- Async checkpoint could change error handling behavior
- Worker thread requires Vite main build configuration for worker files
- Lazy readDirectory changes FileNode shape (may affect UI)

**Mitigation:**
- 16ms batch interval is below human perception threshold
- Async errors handled with try/catch matching original sync behavior
- Worker file compiled separately or inlined
- `hasChildren` field is additive — existing consumers unaffected

---

## DEPENDENCY CHAIN

```
T-019 (async compress) → T-020 (parallel snapshot) → T-028 (async decompress)
T-021 (batch main IPC) → T-022 (batch renderer state)  [coordinate main+renderer]
T-023 (Buffer[] NDJSON) — same file as T-021, apply sequentially
T-024 (ripgrep) — independent
T-025 (readDirectory) — independent
T-026 (ArrayBuffer) — independent
T-027 (worker thread) — independent
```

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
