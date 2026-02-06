# ORCHESTRATOR WORK ORDER #010
## Type: IMPLEMENTATION
## Test Coverage for Hardware Acceleration & Worker Thread (WO-008 + WO-009)

---

## MISSION OBJECTIVE

Add comprehensive test coverage for all changes introduced by WO-008 (hardware acceleration) and WO-009 (worker thread migration + dependency cleanup). Tests must verify the optimizations work correctly without breaking existing behavior. This work order executes AFTER WO-008 and WO-009 are complete.

**Implementation Goal:** ≥80% coverage on all new/modified code from WO-008 and WO-009. Zero test duplication with existing 63 test files.
**Based On:** WO-008 (hardware acceleration), WO-009 (worker thread + cleanup), JUNO Audit (2026-02-04)
**Dependency:** WO-008 and WO-009 must be complete before WO-010 execution begins.

---

## EXISTING TEST INVENTORY (Do NOT Duplicate)

### Already Tested — Discord Components
| File | Tests | Covers |
|------|-------|--------|
| `MessageItem.test.tsx` | 8 | Rendering, avatar, timestamp, attachments, embeds, reactions, fallback name, system messages |
| `ChannelList.test.tsx` | 7 | Category grouping, icons, click handlers, forum channels, sorting |
| `ServerList.test.tsx` | 7 | DM button, guild icons, initials fallback, active indicator, click handlers |
| `DiscordMarkdown.test.tsx` | 13 | Bold, italic, strikethrough, underline, code, blockquote, spoiler, emotes, links, empty content |

### Already Tested — UI & Layout
| File | Tests | Covers |
|------|-------|--------|
| `Sidebar.test.tsx` | 6 | Nav items, title, collapse labels, click handlers, active screen |
| `ThemeToggle.test.tsx` | 6 | Button render, icons, dropdown, setTheme calls |

### Already Tested — Services
| File | Tests | Covers |
|------|-------|--------|
| `contribution-scanner.service.test.ts` | 11 | scanDirectory (empty, subdirs), scanRepository (valid repo, issue extraction, non-git, PR status, error), getIssueTitle |

### NOT Tested (No Test Files Exist)
| Component | Status |
|-----------|--------|
| `EmojiPicker.tsx` | No test file |
| `StickerPicker.tsx` | No test file |
| `GifPicker.tsx` | No test file |
| `MessageList.tsx` | No test file |
| `Progress.tsx` | No test file |
| Worker thread scripts | N/A (created by WO-009) |
| Scanner pool manager | N/A (created by WO-009) |
| Electron GPU config | No test file |

---

## TRA COMPLEXITY ANALYSIS

| Task | Complexity | Risk | Rationale |
|------|-----------|------|-----------|
| Test React.memo on MessageItem | 4 (Medium) | LOW | Verify render count with React Profiler or spy |
| Test React.memo on ChannelItem | 3 (Low) | LOW | Same pattern as MessageItem |
| Test useMemo on DiscordMarkdown | 3 (Low) | LOW | Verify tokenize called once per content |
| Test useCallback stability in MessageList | 4 (Medium) | MEDIUM | Verify callback identity across renders |
| Test RAF scroll throttling (EmojiPicker) | 5 (Medium) | MEDIUM | Mock requestAnimationFrame, verify throttle |
| Test RAF scroll throttling (StickerPicker) | 3 (Low) | LOW | Same pattern as EmojiPicker |
| Test loading="lazy" on images | 2 (Low) | LOW | getAttribute check per component |
| Test CSS transition classes | 2 (Low) | LOW | className assertions |
| Test Electron GPU switches | 3 (Low) | LOW | Mock app.commandLine, verify calls |
| Test accordion max-height keyframes | 2 (Low) | LOW | Verify config object |
| Test worker script scanning logic | 6 (Medium-High) | HIGH | Mock worker_threads, message protocol |
| Test scanner pool manager | 5 (Medium) | HIGH | Mock Worker class, lifecycle, timeout |
| Test refactored scanner service | 4 (Medium) | MEDIUM | Mock pool, verify delegation |

**Overall Complexity: 5 (Medium)**
**Total Scale:** LARGE (13 test areas, 10+ new test files)
**Stop Points:** 3 (after WO-008 tests, after WO-009 tests, final coverage check)

---

## IMPLEMENTATION SCOPE

### Test Files to Create
```yaml
WO-008_Tests:
  # React.memo / useMemo / useCallback
  - path: tests/renderer/components/discord/MessageItem.memo.test.tsx
    purpose: Verify React.memo prevents unnecessary re-renders
    complexity: 4

  - path: tests/renderer/components/discord/ChannelList.memo.test.tsx
    purpose: Verify ChannelItem React.memo
    complexity: 3

  - path: tests/renderer/components/discord/DiscordMarkdown.memo.test.tsx
    purpose: Verify useMemo prevents re-tokenization
    complexity: 3

  - path: tests/renderer/components/discord/MessageList.callbacks.test.tsx
    purpose: Verify useCallback stability for MessageItem props
    complexity: 4

  # Scroll throttling
  - path: tests/renderer/components/discord/EmojiPicker.scroll.test.tsx
    purpose: Verify RAF-throttled scroll handler
    complexity: 5

  - path: tests/renderer/components/discord/StickerPicker.scroll.test.tsx
    purpose: Verify RAF-throttled scroll handler
    complexity: 3

  # Image lazy loading
  - path: tests/renderer/components/discord/image-lazy-loading.test.tsx
    purpose: Verify loading="lazy" on all Discord component images
    complexity: 2

  - path: tests/renderer/components/spotify/image-lazy-loading.test.tsx
    purpose: Verify loading="lazy" on all Spotify component images
    complexity: 2

  # CSS optimizations
  - path: tests/renderer/components/css-transitions.test.tsx
    purpose: Verify transition-all replaced, will-change present
    complexity: 2

  # Tailwind config
  - path: tests/config/tailwind-accordion.test.ts
    purpose: Verify accordion keyframes use max-height
    complexity: 2

  # Electron GPU
  - path: tests/main/electron-gpu-config.test.ts
    purpose: Verify GPU command-line switches are set
    complexity: 3

WO-009_Tests:
  # Worker thread
  - path: tests/main/workers/contribution-scanner.worker.test.ts
    purpose: Verify worker scanning logic, message protocol, parallel scanning
    complexity: 6

  - path: tests/main/workers/scanner-pool.test.ts
    purpose: Verify pool lifecycle, timeout, error handling, graceful shutdown
    complexity: 5

  # Refactored scanner service
  - path: tests/main/services/contribution-scanner.service.refactored.test.ts
    purpose: Verify service delegates to worker pool (update existing test patterns)
    complexity: 4
```

### Existing Test Files to Update
```yaml
Updates:
  - path: tests/main/services/contribution-scanner.service.test.ts
    changes: May need mock updates if service API changes internally
    risk: LOW (public API stays same per WO-009)
```

---

## IMPLEMENTATION APPROACH

### Phase 1: WO-008 Tests — React Memoization
**Complexity: 3-4 | Risk: LOW-MEDIUM**

Test that React.memo, useMemo, and useCallback optimizations actually prevent unnecessary work.

#### 1A: MessageItem React.memo Test
**File:** `tests/renderer/components/discord/MessageItem.memo.test.tsx`

- [ ] 1A.1 Test: MessageItem does not re-render when parent re-renders with same props
  ```tsx
  // Strategy: Render MessageItem, capture render count, trigger parent re-render
  // with identical props, verify render count unchanged
  const renderSpy = vi.fn();
  // Use a wrapper that re-renders but passes same message object
  // Verify renderSpy called only once (initial render)
  ```

- [ ] 1A.2 Test: MessageItem re-renders when `message` prop changes (content update)

- [ ] 1A.3 Test: MessageItem re-renders when `message` prop changes (new reactions)

- [ ] 1A.4 Test: MessageItem does NOT re-render when parent provides stable callbacks
  - Verify that `onReply`, `onEdit`, `onDelete`, `onReactionToggle`, `onEmojiPick` identity stays stable across renders

- [ ] 1A.5 Test: MessageItem DOES re-render when `currentUserId` changes

#### 1B: ChannelItem React.memo Test
**File:** `tests/renderer/components/discord/ChannelList.memo.test.tsx`

- [ ] 1B.1 Test: ChannelItem does not re-render when sibling channels change
- [ ] 1B.2 Test: ChannelItem re-renders when its own channel data changes
- [ ] 1B.3 Test: ChannelItem re-renders when active state changes

#### 1C: DiscordMarkdown useMemo Test
**File:** `tests/renderer/components/discord/DiscordMarkdown.memo.test.tsx`

- [ ] 1C.1 Test: tokenize function called once on initial render
  ```tsx
  // Strategy: Spy on the tokenize function (or the regex exec)
  // Render DiscordMarkdown with content, force parent re-render
  // Verify tokenize NOT called again if content unchanged
  ```

- [ ] 1C.2 Test: tokenize function called again when content prop changes

- [ ] 1C.3 Test: InlineMarkdown sub-component uses memoized tokens

#### 1D: MessageList useCallback Test
**File:** `tests/renderer/components/discord/MessageList.callbacks.test.tsx`

- [ ] 1D.1 Test: onReactionToggle callback identity is stable across renders
- [ ] 1D.2 Test: onReply callback identity is stable across renders
- [ ] 1D.3 Test: onEdit callback identity is stable across renders
- [ ] 1D.4 Test: onDelete callback identity is stable across renders
- [ ] 1D.5 Test: onEmojiPick callback identity is stable across renders

**⏸️ STOP POINT 1:** User runs tests. All memoization tests pass.

---

### Phase 2: WO-008 Tests — Scroll Throttling
**Complexity: 5 | Risk: MEDIUM**

Test that EmojiPicker and StickerPicker scroll handlers are throttled via requestAnimationFrame.

#### 2A: EmojiPicker Scroll Throttle Test
**File:** `tests/renderer/components/discord/EmojiPicker.scroll.test.tsx`

- [ ] 2A.1 Test: scroll handler uses requestAnimationFrame (not called synchronously)
  ```tsx
  // Strategy: Mock requestAnimationFrame
  // Trigger multiple scroll events rapidly
  // Verify rAF called once per frame, not once per event
  const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
  // Fire 10 scroll events
  // Verify rafSpy called ≤2 times (not 10)
  ```

- [ ] 2A.2 Test: active section still updates correctly after throttled scroll

- [ ] 2A.3 Test: cleanup cancels pending requestAnimationFrame on unmount
  ```tsx
  // Strategy: Spy on cancelAnimationFrame
  // Unmount component
  // Verify cancelAnimationFrame called
  ```

- [ ] 2A.4 Test: rapid scroll events don't cause state update storm

#### 2B: StickerPicker Scroll Throttle Test
**File:** `tests/renderer/components/discord/StickerPicker.scroll.test.tsx`

- [ ] 2B.1 Test: scroll handler uses requestAnimationFrame
- [ ] 2B.2 Test: active section updates correctly after throttle
- [ ] 2B.3 Test: cleanup cancels pending rAF on unmount

---

### Phase 3: WO-008 Tests — Image Lazy Loading
**Complexity: 2 | Risk: LOW**

Verify `loading="lazy"` attribute is present on all `<img>` tags in modified components.

#### 3A: Discord Image Lazy Loading
**File:** `tests/renderer/components/discord/image-lazy-loading.test.tsx`

- [ ] 3A.1 Test: MessageItem avatar has `loading="lazy"`
- [ ] 3A.2 Test: MessageItem sticker image has `loading="lazy"`
- [ ] 3A.3 Test: DiscordMarkdown emote images have `loading="lazy"`
- [ ] 3A.4 Test: ServerList guild icon has `loading="lazy"`
- [ ] 3A.5 Test: EmbedRenderer images have `loading="lazy"`
- [ ] 3A.6 Test: EmojiPicker emoji images have `loading="lazy"`
- [ ] 3A.7 Test: GifPicker gif images have `loading="lazy"` (already present — regression test)
- [ ] 3A.8 Test: StickerPicker sticker images have `loading="lazy"` (already present — regression test)
- [ ] 3A.9 Test: ReactionBar emoji images have `loading="lazy"`
- [ ] 3A.10 Test: PollRenderer emoji images have `loading="lazy"`
- [ ] 3A.11 Test: AttachmentRenderer image has `loading="lazy"`

#### 3B: Spotify Image Lazy Loading
**File:** `tests/renderer/components/spotify/image-lazy-loading.test.tsx`

- [ ] 3B.1 Test: NowPlaying album art has `loading="lazy"`
- [ ] 3B.2 Test: PlaylistPanel thumbnail has `loading="lazy"`
- [ ] 3B.3 Test: SearchPanel thumbnail has `loading="lazy"`

#### 3C: Other Image Lazy Loading (in existing test files — add assertions)
- [ ] 3C.1 Test: PullRequestDetailModal avatar images have `loading="lazy"` (extend existing test)
- [ ] 3C.2 Test: DevelopmentIssueDetailModal avatar image has `loading="lazy"` (extend existing test)

---

### Phase 4: WO-008 Tests — CSS Optimizations
**Complexity: 2 | Risk: LOW**

Verify CSS class replacements and will-change hints.

#### 4A: CSS Transition Classes
**File:** `tests/renderer/components/css-transitions.test.tsx`

- [ ] 4A.1 Test: Sidebar collapsed uses `transition-[width]`, NOT `transition-all`
- [ ] 4A.2 Test: Sidebar has `will-change-[width]` class
- [ ] 4A.3 Test: ThemeToggle sun icon uses `transition-transform`, NOT `transition-all`
- [ ] 4A.4 Test: ThemeToggle moon icon uses `transition-transform`, NOT `transition-all`
- [ ] 4A.5 Test: ThemeToggle icons have `will-change-transform` class
- [ ] 4A.6 Test: Progress indicator uses `transition-transform`, NOT `transition-all`
- [ ] 4A.7 Test: Progress indicator has `will-change-transform` class
- [ ] 4A.8 Test: GifPicker category button uses `transition-[filter]`, NOT `transition-all`
- [ ] 4A.9 Test: ServerList DM button uses specific transition, NOT `transition-all`
- [ ] 4A.10 Test: ServerList guild button uses specific transition, NOT `transition-all`

#### 4B: Tailwind Accordion Config
**File:** `tests/config/tailwind-accordion.test.ts`

- [ ] 4B.1 Test: accordion-down keyframes use `max-height`, NOT `height`
  ```ts
  // Strategy: Import tailwind config, inspect keyframes object
  import config from '../../tailwind.config.js';
  const keyframes = config.theme.extend.keyframes;
  expect(keyframes['accordion-down'].from).toHaveProperty('max-height');
  expect(keyframes['accordion-down'].from).not.toHaveProperty('height');
  ```

- [ ] 4B.2 Test: accordion-up keyframes use `max-height`, NOT `height`
- [ ] 4B.3 Test: accordion keyframes include `overflow: hidden`

---

### Phase 5: WO-008 Tests — Electron GPU Configuration
**Complexity: 3 | Risk: LOW**

#### 5A: Electron GPU Switches
**File:** `tests/main/electron-gpu-config.test.ts`

- [ ] 5A.1 Test: `app.commandLine.appendSwitch('enable-gpu-rasterization')` is called
  ```ts
  // Strategy: Mock electron app module
  // Import main/index.ts (or the relevant startup module)
  // Verify app.commandLine.appendSwitch called with expected flags
  ```

- [ ] 5A.2 Test: `app.commandLine.appendSwitch('enable-zero-copy')` is called
- [ ] 5A.3 Test: GPU switches are set BEFORE app.on('ready')

**⏸️ STOP POINT 2:** User runs tests. All WO-008 tests pass.

---

### Phase 6: WO-009 Tests — Worker Script
**Complexity: 6 | Risk: HIGH**

Test the contribution scanner worker script's scanning logic and message protocol.

#### 6A: Worker Script Logic
**File:** `tests/main/workers/contribution-scanner.worker.test.ts`

- [ ] 6A.1 Test: worker responds with `{ type: 'result', data: [...] }` on successful scan
  ```ts
  // Strategy: Mock parentPort, simple-git, fs/promises, Octokit
  // Send { type: 'scan', directoryPath: '/test', githubToken: 'token' }
  // Verify parentPort.postMessage called with result type
  ```

- [ ] 6A.2 Test: worker responds with `{ type: 'error', message: '...' }` on failure

- [ ] 6A.3 Test: worker uses async FS (readdir, not readdirSync)

- [ ] 6A.4 Test: worker scans repositories in parallel (Promise.allSettled)
  ```ts
  // Strategy: Mock 3 repo directories
  // Verify all 3 scanRepository calls start before any complete
  // (check call order vs resolution order)
  ```

- [ ] 6A.5 Test: worker handles empty directory (no subdirectories)

- [ ] 6A.6 Test: worker handles non-existent directory gracefully

- [ ] 6A.7 Test: worker creates lightweight Octokit with provided token

- [ ] 6A.8 Test: worker returns ScannedContribution[] matching expected interface

- [ ] 6A.9 Test: worker extracts issue number from branch name (same logic as original)

- [ ] 6A.10 Test: worker checks PR status when both remotes exist

#### 6B: Worker Message Protocol
- [ ] 6B.1 Test: worker ignores unknown message types (no crash)
- [ ] 6B.2 Test: worker handles null githubToken (skip GitHub API calls, still scan git)

---

### Phase 7: WO-009 Tests — Scanner Pool Manager
**Complexity: 5 | Risk: HIGH**

#### 7A: Scanner Pool Lifecycle
**File:** `tests/main/workers/scanner-pool.test.ts`

- [ ] 7A.1 Test: `scan()` creates a Worker and sends scan message
  ```ts
  // Strategy: Mock worker_threads.Worker class
  const MockWorker = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }));
  ```

- [ ] 7A.2 Test: `scan()` resolves with data when worker sends result message

- [ ] 7A.3 Test: `scan()` rejects when worker sends error message

- [ ] 7A.4 Test: `scan()` rejects when worker exits with non-zero code

- [ ] 7A.5 Test: `scan()` rejects when worker emits error event

- [ ] 7A.6 Test: worker is terminated after result is received

- [ ] 7A.7 Test: `terminate()` kills the active worker

#### 7B: Scanner Pool Timeout
- [ ] 7B.1 Test: `scan()` rejects after 30 second timeout if worker is unresponsive
  ```ts
  // Strategy: Use vi.useFakeTimers()
  // Call scan() but never send a response from mock worker
  // Advance timers by 30000ms
  // Verify promise rejected with timeout error
  ```

- [ ] 7B.2 Test: timed-out worker is terminated

- [ ] 7B.3 Test: subsequent scan works after previous timeout

#### 7C: Scanner Pool Error Recovery
- [ ] 7C.1 Test: pool recovers after worker crash (can scan again)
- [ ] 7C.2 Test: concurrent scan requests are handled (queue or reject)

---

### Phase 8: WO-009 Tests — Refactored Scanner Service
**Complexity: 4 | Risk: MEDIUM**

#### 8A: Service Delegation
**File:** `tests/main/services/contribution-scanner.service.refactored.test.ts`

- [ ] 8A.1 Test: `scanDirectory()` delegates to scanner pool
  ```ts
  // Strategy: Mock scannerPool.scan()
  // Call contributionScannerService.scanDirectory('/path')
  // Verify scannerPool.scan called with path and token
  ```

- [ ] 8A.2 Test: `scanDirectory()` passes GitHub token from gitHubRestService

- [ ] 8A.3 Test: `scanDirectory()` returns ScannedContribution[] from pool

- [ ] 8A.4 Test: `scanDirectory()` propagates pool errors to caller

- [ ] 8A.5 Test: `extractRepoInfo()` still works (utility method unchanged)

- [ ] 8A.6 Test: service singleton export still functions

**NOTE:** The existing `contribution-scanner.service.test.ts` (11 tests) may need its mocks updated if the internal implementation changes. Evaluate during execution — if the public API is identical, existing tests should pass without modification.

**⏸️ STOP POINT 3 (FINAL):** User runs full test suite. All tests pass. Check coverage ≥80% on modified files.

---

## SEQUENCING & PARALLELIZATION

```json
{
  "tasks": [
    {
      "id": "P1A",
      "description": "MessageItem React.memo tests (5 tests)",
      "dependencies": ["WO-008 Phase 3"],
      "complexity": 4,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P1B",
      "description": "ChannelItem React.memo tests (3 tests)",
      "dependencies": ["WO-008 Phase 3"],
      "complexity": 3,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P1C",
      "description": "DiscordMarkdown useMemo tests (3 tests)",
      "dependencies": ["WO-008 Phase 3"],
      "complexity": 3,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P1D",
      "description": "MessageList useCallback stability tests (5 tests)",
      "dependencies": ["WO-008 Phase 3"],
      "complexity": 4,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P2A",
      "description": "EmojiPicker scroll throttle tests (4 tests)",
      "dependencies": ["WO-008 Phase 4"],
      "complexity": 5,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P2B",
      "description": "StickerPicker scroll throttle tests (3 tests)",
      "dependencies": ["WO-008 Phase 4"],
      "complexity": 3,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P3",
      "description": "Image lazy loading tests — Discord + Spotify (14+ tests)",
      "dependencies": ["WO-008 Phase 1"],
      "complexity": 2,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P4A",
      "description": "CSS transition + will-change class tests (10 tests)",
      "dependencies": ["WO-008 Phase 2"],
      "complexity": 2,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P4B",
      "description": "Tailwind accordion config tests (3 tests)",
      "dependencies": ["WO-008 Phase 2"],
      "complexity": 2,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P5",
      "description": "Electron GPU config tests (3 tests)",
      "dependencies": ["WO-008 Phase 5"],
      "complexity": 3,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P6A",
      "description": "Worker script logic tests (10 tests)",
      "dependencies": ["WO-009 Phase 1"],
      "complexity": 6,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P6B",
      "description": "Worker message protocol tests (2 tests)",
      "dependencies": ["WO-009 Phase 1"],
      "complexity": 3,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P7",
      "description": "Scanner pool manager tests (10 tests)",
      "dependencies": ["WO-009 Phase 2"],
      "complexity": 5,
      "basGates": ["lint", "test"]
    },
    {
      "id": "P8",
      "description": "Refactored scanner service delegation tests (6 tests)",
      "dependencies": ["WO-009 Phase 3"],
      "complexity": 4,
      "basGates": ["lint", "test"]
    }
  ],
  "sequence": ["P3", "P4A", "P4B", "P1A", "P1B", "P1C", "P1D", "P2A", "P2B", "P5", "P6A", "P6B", "P7", "P8"],
  "parallelizable": [
    ["P3", "P4A", "P4B"],
    ["P1A", "P1B", "P1C", "P1D"],
    ["P2A", "P2B", "P5"],
    ["P6A", "P6B"],
    ["P7", "P8"]
  ],
  "stopPoints": [
    "After Phases 1-5 (all WO-008 tests) — user runs test suite",
    "After Phases 6-8 (all WO-009 tests) — user runs test suite",
    "Final coverage check — user runs npm run test:coverage"
  ],
  "deferred": []
}
```

---

## TEST COUNT SUMMARY

| Phase | Area | New Tests | New Files |
|-------|------|-----------|-----------|
| P1A | MessageItem memo | 5 | 1 |
| P1B | ChannelItem memo | 3 | 1 |
| P1C | DiscordMarkdown useMemo | 3 | 1 |
| P1D | MessageList callbacks | 5 | 1 |
| P2A | EmojiPicker scroll | 4 | 1 |
| P2B | StickerPicker scroll | 3 | 1 |
| P3 | Image lazy loading | 14 | 2 |
| P4A | CSS transitions | 10 | 1 |
| P4B | Tailwind config | 3 | 1 |
| P5 | Electron GPU | 3 | 1 |
| P6 | Worker script | 12 | 1 |
| P7 | Scanner pool | 10 | 1 |
| P8 | Refactored service | 6 | 1 |
| **TOTAL** | | **~81 tests** | **14 files** |

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `HW-ACCEL-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Test coverage added for WO-008 + WO-009
2. **Test Files Created** - Full list with test counts per file
3. **Coverage Report** - Before/after coverage percentages for modified files
4. **Test Results** - User-confirmed full suite pass
5. **Duplication Check** - Confirmation no tests duplicate existing 63 files
6. **Next Steps** - Any remaining coverage gaps

### Evidence to Provide
- Number of new test files created
- Number of new test cases
- Coverage percentages for each modified file
- Full test suite pass confirmation

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `HW-ACCEL-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-010-hw-accel-test-coverage.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-010-hw-accel-test-coverage.md`
   - [ ] Completion report exists in: `trinity/reports/HW-ACCEL-TEST-COVERAGE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All ~81 new tests pass
- [ ] All 63 existing tests still pass (zero regressions)
- [ ] ≥80% coverage on all files modified by WO-008
- [ ] ≥80% coverage on all files created by WO-009
- [ ] No test duplication with existing test suite
- [ ] 14 new test files created in correct locations
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### ⚠️ CRITICAL RESTRICTIONS - TEST EXECUTION FORBIDDEN

Only LUKA runs `npm test`. Do NOT execute test commands.

### Test Pattern Guidelines

**Follow existing patterns from the codebase:**
- Use `vi.mock()` for module mocking (see ContributionCard.test.tsx for IPC mock pattern)
- Use `@testing-library/react` for component rendering
- Use `@testing-library/user-event` for interactions
- Use `vi.fn()` and `vi.spyOn()` for function mocking
- Use `// @vitest-environment node` header for main process tests
- Use `vi.useFakeTimers()` locally (NOT globally) for timer-dependent tests
- Follow `describe` → `beforeEach` → `it` structure

**React.memo Testing Pattern:**
```tsx
// Use a render counter ref to track re-renders
let renderCount = 0;
const TestWrapper = ({ triggerRerender }: { triggerRerender: number }) => {
  const stableMessage = useRef(mockMessage).current;
  const stableCallbacks = useRef({ onReply: vi.fn(), ... }).current;
  renderCount = 0; // reset before assertion
  return <MessageItem message={stableMessage} {...stableCallbacks} />;
};
// Re-render parent with new triggerRerender prop
// Assert renderCount === 0 (memo prevented re-render)
```

**RAF Throttle Testing Pattern:**
```tsx
const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
  .mockImplementation((cb) => { cb(0); return 1; });
// Fire multiple scroll events
// Assert rafSpy call count is throttled
```

### Do NOT:
- [ ] Duplicate existing test assertions from the 63 existing files
- [ ] Test implementation details that aren't part of WO-008/WO-009 changes
- [ ] Create integration/e2e tests (unit tests only)
- [ ] Mock at too low a level (mock the boundary, not internals)
- [ ] Perform ANY git operations
- [ ] Run `npm test` or any test commands

### DO:
- [ ] Follow existing test file naming patterns
- [ ] Place tests in the correct `tests/` subdirectory mirroring `src/`
- [ ] Use descriptive test names that explain what the optimization does
- [ ] Test both the "optimization works" case AND the "re-renders when it should" case
- [ ] Clean up timers and mocks in afterEach

---

## ROLLBACK STRATEGY

All changes are additive (new test files only). Rollback = delete the new test files.

No source code is modified by WO-010, so rollback carries zero risk to application functionality.

---

## CONTEXT FROM INVESTIGATION

**Source:** WO-008 (Hardware Acceleration), WO-009 (Worker Thread + Cleanup)
**Key Findings:**
- 63 existing test files cover rendering and basic interactions
- Zero existing tests cover memoization, lazy loading, CSS transitions, scroll throttling, or worker threads
- ~15% of WO-008/WO-009 changes have indirect coverage through existing tests
- Test patterns are well-established (vi.mock, testing-library, vitest globals)

**Root Causes Being Fixed:**
- No test coverage for performance optimizations = no regression safety net
- Worker thread architecture needs dedicated unit tests before it can be trusted
- CSS class changes need assertions to prevent `transition-all` from creeping back

**Expected Impact:**
- ~81 new test cases across 14 new files
- ≥80% coverage on all WO-008/WO-009 modified files
- Regression safety net for all performance optimizations

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified tests must be implemented
**Risk Level:** LOW (additive test files only, no source code changes)
**Risk Factors:**
- React.memo testing requires careful mock setup (stable vs unstable refs)
- Worker thread mocking can be tricky (parentPort, Worker class)
- RAF mocking may interact with vitest fake timers

**Mitigation:**
- Use established patterns from existing test suite
- Test memo behavior through render counting, not implementation inspection
- Use vi.spyOn for RAF/cancelRAF rather than full replacement
- Keep fake timers scoped to individual tests (lesson from WO-001)

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
