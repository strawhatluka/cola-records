# ORCHESTRATOR WORK ORDER #009
## Type: IMPLEMENTATION
## Contribution Scanner Worker Thread & Dead Dependency Cleanup

---

## MISSION OBJECTIVE

Migrate the contribution scanner service from the Electron main thread to a dedicated Worker Thread, eliminating UI blocking during directory scans. Additionally, remove 6 dead dependencies that inflate install size with zero usage.

**Implementation Goal:** Contribution scanning runs entirely off the main thread. Main process remains responsive during scans. All 6 dead packages removed from package.json. Zero behavioral regressions.
**Based On:** JUNO Hardware Acceleration Audit Finding #10 (2026-02-04), Dead Dependencies table from same audit. Deferred from WO-008.

---

## TRA COMPLEXITY ANALYSIS

| Task | Complexity | Risk | Rationale |
|------|-----------|------|-----------|
| Create scanner worker script | 6 (Medium-High) | HIGH | Must replicate service logic in worker context |
| Refactor IPC handlers to use worker | 5 (Medium) | HIGH | Main thread ↔ worker communication, error handling |
| Pass GitHub API credentials to worker | 4 (Medium) | MEDIUM | Token must be available in worker, security consideration |
| Handle worker lifecycle | 4 (Medium) | MEDIUM | Spawn, terminate, error recovery, crash handling |
| Parallelize repo scanning in worker | 3 (Low-Medium) | MEDIUM | Replace sequential loop with Promise.all/pool |
| Replace sync FS calls with async | 2 (Low) | LOW | readdirSync → readdir, statSync → stat |
| Remove dead dependencies | 1 (Low) | LOW | npm uninstall, verify no breakage |
| Update existing tests | 4 (Medium) | MEDIUM | Mock worker communication instead of service calls |

**Overall Complexity: 7 (High)**
**Total Scale:** LARGE
**Stop Points:** 4 (requirements ✓, design ✓, plan ✓, final)

---

## IMPLEMENTATION SCOPE

### Architecture Overview

```
CURRENT ARCHITECTURE (blocking):
═══════════════════════════════════════════
Renderer ──invoke──→ IPC Handler ──await──→ contributionScannerService.scanDirectory()
                     (main thread)          ├─ fs.readdirSync()          ← BLOCKS
                                            ├─ for (dir of dirs) {       ← SEQUENTIAL
                                            │    await scanRepository()
                                            │    ├─ git.checkIsRepo()
                                            │    ├─ git.revparse()
                                            │    ├─ git.getRemotes()
                                            │    ├─ validateRemotes()   ← NETWORK (500-2000ms)
                                            │    ├─ fs.statSync()       ← BLOCKS
                                            │    └─ checkPRStatus()    ← NETWORK (500-2000ms)
                                            │  }
                                            └─ Database sync            ← Must stay in main

TARGET ARCHITECTURE (non-blocking):
═══════════════════════════════════════════
Renderer ──invoke──→ IPC Handler ──postMessage──→ Worker Thread
                     (main thread)                 ├─ fs.readdir()        ← ASYNC
                     │                             ├─ Promise.allSettled() ← PARALLEL
                     │                             │    scanRepository()
                     │                             │    ├─ git operations
                     │                             │    ├─ GitHub API calls
                     │                             │    └─ fs.stat()       ← ASYNC
                     │                             └─ postMessage(results)
                     │ ←──── onMessage(results) ───┘
                     │
                     ├─ Database sync (stays in main thread)
                     └─ return Contribution[] to renderer
```

### Files to Create
```yaml
New_Files:
  - path: src/main/workers/contribution-scanner.worker.ts
    purpose: Worker thread script containing scanning logic
    risk: HIGH

  - path: src/main/workers/scanner-pool.ts
    purpose: Worker lifecycle manager (spawn, communicate, terminate)
    risk: HIGH
```

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/contribution-scanner.service.ts
    changes: Refactor to delegate to worker thread, keep as API surface
    risk: HIGH

  - path: src/main/index.ts
    changes: IPC handlers use refactored scanner service (minimal change)
    risk: MEDIUM

  - path: package.json
    changes: Remove 6 dead dependencies
    risk: LOW

Supporting_Files:
  - path: vite.main.config.mts (or equivalent)
    changes: May need worker script bundling configuration
    risk: MEDIUM

  - path: tests/main/services/contribution-scanner.service.test.ts
    changes: Update mocks for worker-based architecture
    risk: MEDIUM
```

---

## CURRENT STATE ANALYSIS

### Contribution Scanner Service
- **File:** `src/main/services/contribution-scanner.service.ts`
- **Pattern:** Singleton class (`export const contributionScannerService = new ContributionScannerService()`)
- **Methods:**
  - `scanDirectory(directoryPath: string): Promise<ScannedContribution[]>` — entry point
  - `scanRepository(repoPath: string): Promise<ScannedContribution | null>` — per-repo scan
  - `validateRemotes(originUrl, upstreamUrl): Promise<{ isFork, remotesValid }>` — GitHub API
  - `extractRepoInfo(url: string): { owner, repo } | null` — regex, sync
  - `getIssueTitle(owner, repo, issueNumber): Promise<string | undefined>` — GitHub API (unused)

### Blocking Points
| Type | Location | Call | Impact |
|------|----------|------|--------|
| Sync FS | Line 39 | `fs.existsSync(directoryPath)` | Blocks main thread |
| Sync FS | Line 44 | `fs.readdirSync(directoryPath)` | Blocks main thread |
| Sync FS | Line 120 | `fs.statSync(repoPath)` | Blocks main thread |
| Sequential | Lines 48-54 | `for...await scanRepository()` | Scans repos one-by-one |
| Network | Line ~103 | `validateRemotes()` → GitHub API | 500-2000ms per repo |
| Network | Line ~132 | `checkPRStatus()` → GitHub API | 500-2000ms per repo |

### Cross-Service Dependencies
- **`gitHubRestService`** — used for `getRepository()` and `checkPRStatus()`
- **`simple-git`** — used for `checkIsRepo()`, `revparse()`, `getRemotes()`
- **`fs`** and **`path`** — Node built-ins
- **Database** — NOT used in scanner; sync happens in IPC handler (main/index.ts lines 183-220)

### IPC Integration
| Channel | Handler Location | Calls |
|---------|-----------------|-------|
| `contribution:scan-directory` | main/index.ts:178-223 | scanner → database sync → return |
| `project:scan-directory` | main/index.ts:255-299 | scanner → database sync → return |

### Renderer Callers
| Screen | File | Trigger |
|--------|------|---------|
| ContributionsScreen | screens/ContributionsScreen.tsx:19-35 | useEffect on mount |
| ProjectsScreen | screens/ProjectsScreen.tsx:17-33 | useEffect on mount |
| ProfessionalProjectsScreen | screens/ProfessionalProjectsScreen.tsx:17-33 | useEffect on mount |

---

## IMPLEMENTATION APPROACH

### Phase 1: Create Worker Script
**Complexity: 6 | Risk: HIGH**

Extract scanning logic into a standalone worker script that can run in a `worker_threads` Worker.

- [ ] 1.1 Create `src/main/workers/contribution-scanner.worker.ts`
  - Import `parentPort`, `workerData` from `worker_threads`
  - Import `simple-git`, `fs/promises`, `path`
  - Copy `scanRepository()`, `validateRemotes()`, `extractRepoInfo()` as standalone functions
  - Replace `fs.readdirSync` → `fs.readdir` (from `fs/promises`)
  - Replace `fs.statSync` → `fs.stat` (from `fs/promises`)
  - Replace `fs.existsSync` → `fs.access` with try/catch (from `fs/promises`)
  - Replace sequential `for` loop with `Promise.allSettled()` for parallel repo scanning
  - Listen for messages on `parentPort`:
    ```ts
    parentPort?.on('message', async (msg) => {
      if (msg.type === 'scan') {
        const results = await scanDirectory(msg.directoryPath, msg.githubToken);
        parentPort?.postMessage({ type: 'result', data: results });
      }
    });
    ```
  - GitHub API calls: Create a minimal Octokit client inside worker using passed token (not the full gitHubRestService singleton — that has state we don't need)

- [ ] 1.2 Handle GitHub token passing
  - Worker receives token via `workerData` or message payload
  - Create lightweight `checkPRStatus()` and `getRepository()` wrappers using `@octokit/rest` directly
  - Do NOT import `gitHubRestService` in worker (singleton pattern won't work across threads)

- [ ] 1.3 Define message protocol types
  ```ts
  // Worker message types
  type ScanRequest = { type: 'scan'; directoryPath: string; githubToken: string | null };
  type ScanResponse = { type: 'result'; data: ScannedContribution[] };
  type ScanError = { type: 'error'; message: string };
  type WorkerMessage = ScanRequest;
  type WorkerResponse = ScanResponse | ScanError;
  ```

**⏸️ STOP POINT 1:** Review worker script structure before proceeding.

---

### Phase 2: Create Worker Pool Manager
**Complexity: 4 | Risk: MEDIUM**

Create a manager class that handles worker lifecycle.

- [ ] 2.1 Create `src/main/workers/scanner-pool.ts`
  ```ts
  import { Worker } from 'worker_threads';

  class ScannerPool {
    private worker: Worker | null = null;

    async scan(directoryPath: string, githubToken: string | null): Promise<ScannedContribution[]> {
      return new Promise((resolve, reject) => {
        const worker = new Worker(workerScriptPath);
        this.worker = worker;

        worker.on('message', (msg: WorkerResponse) => {
          if (msg.type === 'result') resolve(msg.data);
          if (msg.type === 'error') reject(new Error(msg.message));
          worker.terminate();
          this.worker = null;
        });

        worker.on('error', (err) => {
          reject(err);
          this.worker = null;
        });

        worker.on('exit', (code) => {
          if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
          this.worker = null;
        });

        worker.postMessage({ type: 'scan', directoryPath, githubToken });
      });
    }

    terminate() {
      this.worker?.terminate();
      this.worker = null;
    }
  }

  export const scannerPool = new ScannerPool();
  ```

- [ ] 2.2 Handle worker script path resolution
  - Dev mode: point to compiled worker script in `.vite/build/`
  - Production: point to worker script in packaged app `__dirname`
  - Follow the same pattern as `preloadPath` in `createWindow()`

- [ ] 2.3 Add timeout protection
  - If worker doesn't respond within 30 seconds, terminate and reject
  - Prevents zombie workers from hung GitHub API calls

---

### Phase 3: Refactor Scanner Service
**Complexity: 5 | Risk: HIGH**

Refactor the existing service to delegate to the worker pool while maintaining the same public API.

- [ ] 3.1 Refactor `contribution-scanner.service.ts`
  - Keep the class and singleton export (API surface stays identical)
  - Replace `scanDirectory()` body with worker delegation:
    ```ts
    async scanDirectory(directoryPath: string): Promise<ScannedContribution[]> {
      const token = gitHubRestService.getToken(); // or however token is accessed
      return scannerPool.scan(directoryPath, token);
    }
    ```
  - Keep `extractRepoInfo()` as a utility (may be used elsewhere)
  - Remove `scanRepository()`, `validateRemotes()`, `getIssueTitle()` from main thread (moved to worker)

- [ ] 3.2 Verify IPC handlers need NO changes
  - `main/index.ts` handlers call `contributionScannerService.scanDirectory()` — same API
  - Database sync logic stays in IPC handler (already in main thread)
  - Renderer callers are completely unaffected

- [ ] 3.3 Add graceful shutdown
  - On `app.on('before-quit')`, call `scannerPool.terminate()`
  - Prevents orphaned workers on app exit

**⏸️ STOP POINT 2:** User runs tests. Verify contributions screen, projects screen, professional projects screen all still scan and display correctly.

---

### Phase 4: Vite Worker Bundling Configuration
**Complexity: 3 | Risk: MEDIUM**

Ensure the worker script is correctly bundled for both dev and production.

- [ ] 4.1 Check current Vite main process config
  - Determine how main process TS is compiled (vite.main.config.mts or similar)
  - Worker scripts may need a separate entry point or `?worker` suffix

- [ ] 4.2 Configure worker script compilation
  - Option A: Add worker as additional entry in Vite config
  - Option B: Use `new Worker(new URL('./workers/scanner.worker.ts', import.meta.url))` pattern
  - Option C: Pre-compile worker separately

- [ ] 4.3 Verify worker loads correctly in both dev and packaged builds

---

### Phase 5: Performance Optimization in Worker
**Complexity: 3 | Risk: LOW**

Now that scanning is off main thread, optimize the scanning itself.

- [ ] 5.1 Parallelize repo scanning
  - Replace sequential `for` loop with `Promise.allSettled()`:
    ```ts
    const results = await Promise.allSettled(
      directories.map(dir => scanRepository(path.join(directoryPath, dir), githubToken))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ScannedContribution | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((c): c is ScannedContribution => c !== null);
    ```
  - Consider concurrency limit (max 5 parallel GitHub API calls) to avoid rate limiting

- [ ] 5.2 Replace all sync FS calls with async equivalents
  - `fs.existsSync()` → `fs.access()` with try/catch
  - `fs.readdirSync()` → `fs.readdir()`
  - `fs.statSync()` → `fs.stat()`

- [ ] 5.3 Remove unused `getIssueTitle()` method (never called, `issueTitle` always `undefined`)

**⏸️ STOP POINT 3:** User runs tests. Full verification of all scanning flows.

---

### Phase 6: Dead Dependency Cleanup
**Complexity: 1 | Risk: LOW**

Remove 6 packages with zero imports in `src/`.

- [ ] 6.1 Remove xterm packages:
  ```bash
  npm uninstall @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links
  ```

- [ ] 6.2 Remove PDF packages:
  ```bash
  npm uninstall pdfjs-dist react-pdf
  ```

- [ ] 6.3 Remove `TerminalSkeleton.tsx` — orphaned component (no imports reference it)

- [ ] 6.4 Verify build succeeds after removal

**⏸️ STOP POINT 4 (FINAL):** User runs tests. Full regression check.

---

### Phase 7: Update Tests
**Complexity: 4 | Risk: MEDIUM**

Update existing test mocks to work with the worker-based architecture.

- [ ] 7.1 Check if `contribution-scanner.service.test.ts` exists
  - If yes: update mocks to account for worker delegation
  - If no: consider adding basic tests for the refactored service

- [ ] 7.2 Verify all existing tests still pass with the new architecture
  - IPC handler tests should work unchanged (they mock the service)
  - Renderer tests should work unchanged (they mock IPC invoke)

---

## SEQUENCING & PARALLELIZATION

```json
{
  "tasks": [
    {
      "id": "P1",
      "description": "Create worker script with scanning logic",
      "dependencies": [],
      "complexity": 6,
      "basGates": ["lint", "build"]
    },
    {
      "id": "P2",
      "description": "Create worker pool manager",
      "dependencies": ["P1"],
      "complexity": 4,
      "basGates": ["lint", "build"]
    },
    {
      "id": "P3",
      "description": "Refactor scanner service to use worker pool",
      "dependencies": ["P2"],
      "complexity": 5,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P4",
      "description": "Configure Vite worker bundling",
      "dependencies": ["P1"],
      "complexity": 3,
      "basGates": ["build"]
    },
    {
      "id": "P5",
      "description": "Parallelize repo scanning + async FS in worker",
      "dependencies": ["P3"],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P6",
      "description": "Remove 6 dead dependencies + orphaned TerminalSkeleton",
      "dependencies": [],
      "complexity": 1,
      "basGates": ["build", "test"]
    },
    {
      "id": "P7",
      "description": "Update test mocks for worker architecture",
      "dependencies": ["P3"],
      "complexity": 4,
      "basGates": ["lint", "test"]
    }
  ],
  "sequence": ["P1", "P2", "P4", "P3", "P5", "P7", "P6"],
  "parallelizable": [
    ["P1"],
    ["P2", "P4"],
    ["P3"],
    ["P5", "P7"],
    ["P6"]
  ],
  "stopPoints": [
    "After P1 (worker script review)",
    "After P3 (integration — user tests scanning flows)",
    "After P5+P7 (performance + tests — user tests)",
    "After P6 (dependency cleanup — user tests final)"
  ],
  "deferred": []
}
```

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `WORKER-THREAD-CLEANUP-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Worker thread migration + dependency cleanup
2. **Changes Applied** - New files created, files modified, dependencies removed
3. **Architecture Diagram** - Before/after scanning flow
4. **Test Results** - User-confirmed test pass at each stop point
5. **Metrics** - Files changed, dependencies removed, scanning parallelism achieved
6. **Rollback Plan** - Revert to direct scanning if worker issues arise

### Evidence to Provide
- File diff statistics
- Worker message protocol documentation
- Dependency size reduction (before/after `node_modules` size)
- Confirmation of scanning behavior on all 3 screens

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `WORKER-THREAD-CLEANUP-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-009-worker-thread-and-cleanup.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-009-worker-thread-and-cleanup.md`
   - [ ] Completion report exists in: `trinity/reports/WORKER-THREAD-CLEANUP-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Contribution scanning runs in a Worker Thread, not blocking the main process
- [ ] All 3 screens (Contributions, Projects, Professional Projects) scan and display correctly
- [ ] Repo scanning is parallelized (Promise.allSettled instead of sequential for loop)
- [ ] All sync FS calls replaced with async equivalents
- [ ] Worker has timeout protection (30s) and graceful shutdown
- [ ] 6 dead dependencies removed from package.json
- [ ] TerminalSkeleton.tsx orphan removed
- [ ] All existing tests pass (user-verified at each stop point)
- [ ] No behavioral regressions on any screen
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### ⚠️ CRITICAL RESTRICTIONS - TEST EXECUTION FORBIDDEN

Only LUKA runs `npm test`. Do NOT execute test commands. Prepare changes and wait for user confirmation at each stop point.

### Do NOT:
- [ ] Import the full `gitHubRestService` singleton in the worker (won't work across threads)
- [ ] Move database operations to the worker thread (SQLite locking issues)
- [ ] Change the IPC channel API surface (renderer callers must not change)
- [ ] Change the `ScannedContribution` interface
- [ ] Perform ANY git operations
- [ ] Run `npm test` or any test commands

### DO:
- [ ] Keep the scanner service's public API identical
- [ ] Create a lightweight Octokit wrapper in the worker for GitHub API calls
- [ ] Handle worker crashes gracefully (fall back to error, not crash app)
- [ ] Add timeout protection for hung workers
- [ ] Clean up workers on app exit
- [ ] Test worker path resolution for both dev and production builds

---

## ROLLBACK STRATEGY

**Phase 1-5 Rollback (Worker Thread):**
1. Delete `src/main/workers/contribution-scanner.worker.ts`
2. Delete `src/main/workers/scanner-pool.ts`
3. Restore original `contribution-scanner.service.ts` from git
4. Remove any Vite config changes for worker bundling
5. Scanning reverts to main-thread blocking (original behavior)

**Phase 6 Rollback (Dependencies):**
1. `npm install @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links pdfjs-dist react-pdf`
2. Restore `TerminalSkeleton.tsx` from git

**Critical Files Backup:** LUKA manages via git. All changes are revertible.

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-02-04)
**Key Findings:**
- Finding #10: Contribution scanner blocks main process with sequential scanning, sync FS calls, and network-latency GitHub API calls
- Finding #11: Synchronous SQLite (NOT addressed here — architectural constraint of better-sqlite3)
- Dead Dependencies: 6 packages installed with zero imports

**Root Causes Being Fixed:**
- `fs.readdirSync()` and `fs.statSync()` blocking main thread
- Sequential `for...await` loop scanning repos one-by-one
- GitHub API network latency (500-2000ms per call) blocking main thread event loop
- 6 dead packages inflating install size

**Expected Impact:**
- Main thread remains responsive during contribution scanning
- Parallel repo scanning reduces total scan time by 2-5x for multi-repo directories
- ~50MB+ reduction in node_modules from dead dependency removal

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** HIGH
**Risk Factors:**
- Worker thread communication adds complexity (message serialization, error propagation)
- GitHub token must be safely passed to worker (no persistent storage in worker)
- Vite bundling of worker scripts may require config investigation
- Worker path resolution differs between dev and packaged builds
- simple-git may have worker thread compatibility considerations

**Mitigation:**
- Keep scanner service API surface identical (refactor internals only)
- Lightweight Octokit in worker (token passed per-message, not stored)
- Test worker in both dev and packaged builds at stop point 2
- Add timeout + crash recovery for worker resilience
- Database operations remain in main thread (no SQLite locking risk)

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
