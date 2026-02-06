# ORCHESTRATOR WORK ORDER #001
## Type: IMPLEMENTATION
## Integration Test Coverage — Spotify, Discord, Chrome/Code-Server

---

## MISSION OBJECTIVE

Implement comprehensive test coverage for all three AppBar integrations (Spotify, Discord, Chrome/Code-Server) which currently have zero test coverage. Tests span three layers: backend services (mocking HTTP), Zustand stores (mocking IPC), and UI components (mocking stores).

**Implementation Goal:** ~187 test cases across 28 tasks, 16 new test files + 2 extended files, achieving ≥80% coverage per file across all integration code.
**Based On:** JUNO audit of Spotify (agent abfa2b3), Discord (agent a84be62), and Chrome/Code-Server (agent a64ea52) completed 2026-02-04. TRA plan at `trinity/sessions/test-plan-integrations.md`.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: tests/mocks/factories.ts
    changes: Add 13 mock factory functions (3 Spotify + 10 Discord types)
    risk: LOW

  - path: tests/main/services/spotify.service.test.ts
    changes: New file — 31 test cases covering all 18 public methods
    risk: MEDIUM

  - path: tests/main/services/discord.service.test.ts
    changes: New file — 42 test cases covering all 40+ public methods
    risk: MEDIUM

  - path: tests/renderer/stores/useSpotifyStore.test.ts
    changes: New file — 22 test cases covering all 23 state fields/actions
    risk: MEDIUM

  - path: tests/renderer/stores/useDiscordStore.test.ts
    changes: New file — 39 test cases covering 34 actions + navigation state machine
    risk: HIGH

Supporting_Files:
  - tests/mocks/fetch-helpers.ts — New shared fetch mock utilities
  - tests/main/services/code-server.service.test.ts — Extend with 20 new test cases
  - tests/renderer/components/spotify/SpotifyPlayer.test.tsx — New
  - tests/renderer/components/spotify/PlaybackControls.test.tsx — New
  - tests/renderer/components/spotify/VolumeAndPanels.test.tsx — New
  - tests/renderer/components/discord/DiscordClient.test.tsx — New
  - tests/renderer/components/discord/Navigation.test.tsx — New
  - tests/renderer/components/discord/Messages.test.tsx — New
  - tests/renderer/components/discord/ForumAndPoll.test.tsx — New
  - tests/renderer/components/discord/Pickers.test.tsx — New
  - tests/renderer/components/discord/Renderers.test.tsx — New
  - tests/renderer/components/layout/ChromeButton.test.tsx — New
  - tests/main/ipc/shell-launch.test.ts — New
```

### Changes Required

#### Change Set 1: Shared Test Infrastructure (Phase A — Tasks 1-3)
**Files:** `tests/mocks/factories.ts`, `tests/mocks/fetch-helpers.ts`
**Current State:** factories.ts exists but has no Spotify or Discord factories
**Target State:** 13 factory functions + reusable fetch mock helpers
**Implementation:**
```typescript
// factories.ts additions
export function createMockSpotifyTrack(overrides?: Partial<SpotifyTrack>): SpotifyTrack { ... }
export function createMockSpotifyPlaybackState(overrides?: Partial<SpotifyPlaybackState>): SpotifyPlaybackState { ... }
export function createMockSpotifyPlaylist(overrides?: Partial<SpotifyPlaylist>): SpotifyPlaylist { ... }
export function createMockDiscordUser(overrides?: Partial<DiscordUser>): DiscordUser { ... }
export function createMockDiscordGuild(overrides?: Partial<DiscordGuild>): DiscordGuild { ... }
export function createMockDiscordChannel(overrides?: Partial<DiscordChannel>): DiscordChannel { ... }
// ... 7 more Discord factories

// fetch-helpers.ts
export function createMockFetchResponse(status: number, body: unknown, headers?: Record<string, string>): Response { ... }
export function createMockFetchError(status: number, statusText: string): Response { ... }
```

#### Change Set 2: Backend Service Tests (Phases B, D, F — Tasks 4-6, 9-12, 17-18)
**Files:** `tests/main/services/spotify.service.test.ts`, `tests/main/services/discord.service.test.ts`, `tests/main/services/code-server.service.test.ts`
**Current State:** No Spotify or Discord service tests. code-server has basic tests.
**Target State:** 93 test cases across 3 service test files
**Implementation:**
- Mock `secureStorage`, `database`, global `fetch` for service tests
- Test OAuth2 PKCE flow, token refresh, 401 retry for Spotify
- Test rate limit 429 retry, token fallback, FormData attachments for Discord
- Test JSONC parser, Docker lifecycle, concurrent start guard for Code-Server

#### Change Set 3: Store Tests (Phases C, E — Tasks 7-8, 13-16)
**Files:** `tests/renderer/stores/useSpotifyStore.test.ts`, `tests/renderer/stores/useDiscordStore.test.ts`
**Current State:** No store tests for either integration
**Target State:** 61 test cases across 2 store test files
**Implementation:**
- Mock IPC client (`ipc.invoke`) matching existing patterns in `useSettingsStore.test.ts`
- Test debounced volume with `vi.useFakeTimers`
- Test progress interpolation (client-side time calculation)
- Test Discord's 5-state view machine: dms → server → messages → forum → thread
- Test navigation: goBack from thread→forum, messages→server, messages→dms

#### Change Set 4: UI Component Tests (Phases G, H, I — Tasks 19-28)
**Files:** 10 new test files in `tests/renderer/components/`
**Current State:** No integration UI component tests
**Target State:** ~33 test suites covering all 27+ components
**Implementation:**
- Mock stores via Zustand `setState`
- Use `@testing-library/react` for rendering and interactions
- Use `vi.useFakeTimers` for polling intervals (3s Spotify, 10s Discord)
- Test DiscordMarkdown parser (bold, italic, code, emotes, mentions, timestamps, URLs)

---

## IMPLEMENTATION APPROACH

### Step 1: Shared Infrastructure (Phase A)
- [ ] Add Spotify mock factories to `tests/mocks/factories.ts` (Task 1)
- [ ] Add Discord mock factories to `tests/mocks/factories.ts` (Task 2)
- [ ] Create `tests/mocks/fetch-helpers.ts` with reusable response helpers (Task 3)
- [ ] **STOP POINT 2 (Design):** Verify factories compile and follow existing patterns

### Step 2: Service Layer Tests (Phases B, D, F)
- [ ] SpotifyService — auth flow, PKCE, token refresh (Task 4 — 8 cases)
- [ ] SpotifyService — playback controls, library, 401 retry (Task 5 — 15 cases)
- [ ] SpotifyService — playlists, search, queue, cleanup (Task 6 — 8 cases)
- [ ] DiscordService — connection, auth, rate limiting (Task 9 — 11 cases)
- [ ] DiscordService — guilds, channels, DMs, users (Task 10 — 8 cases)
- [ ] DiscordService — messages, reactions, attachments (Task 11 — 10 cases)
- [ ] DiscordService — forums, threads, GIFs, stickers, polls (Task 12 — 13 cases)
- [ ] CodeServerService — JSONC parser edge cases (Task 17 — 7 cases)
- [ ] CodeServerService — start/stop lifecycle (Task 18 — 13 cases)

### Step 3: Store Layer Tests (Phases C, E)
- [ ] useSpotifyStore — connection, playback actions (Task 7 — 12 cases)
- [ ] useSpotifyStore — volume debounce, interpolation (Task 8 — 10 cases)
- [ ] useDiscordStore — connection, guild/DM fetching (Task 13 — 9 cases)
- [ ] useDiscordStore — message CRUD (Task 14 — 10 cases)
- [ ] useDiscordStore — stickers, GIFs, polls (Task 15 — 7 cases)
- [ ] useDiscordStore — navigation state machine, forum actions (Task 16 — 13 cases)
- [ ] **STOP POINT 3 (Plan):** Validate all service + store tests pass

### Step 4: UI Component Tests (Phases G, H, I)
- [ ] Spotify components: SpotifyPlayer, SpotifyConnect (Task 19)
- [ ] Spotify components: PlaybackControls, NowPlaying (Task 20)
- [ ] Spotify components: VolumeControl, PlaylistPanel, SearchPanel (Task 21)
- [ ] Discord components: DiscordClient, DiscordConnect (Task 22)
- [ ] Discord components: ServerList, ChannelList, DMList (Task 23)
- [ ] Discord components: MessageList, MessageItem, MessageInput (Task 24)
- [ ] Discord components: ForumThreadList, CreatePollModal (Task 25)
- [ ] Discord components: EmojiPicker, GifPicker, StickerPicker, PickerPanel (Task 26)
- [ ] Discord components: Renderers + DiscordMarkdown + ReactionBar (Task 27)
- [ ] Chrome button + shell:launch-app handler (Task 28)

### Step 5: Validation
- [ ] Run full test suite (`npm test`) — all tests pass
- [ ] Run coverage report (`npm run test:coverage`) — ≥80% per file
- [ ] No regressions in existing tests
- [ ] **STOP POINT 4 (Final):** Full review

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `INTEGRATION-TESTS-IMPLEMENTATION-COMPLETE-20260204.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Test coverage added for Spotify, Discord, Chrome/Code-Server
2. **Changes Applied** - Files created/modified with test counts
3. **Test Results** - Full test suite output (all passing)
4. **Metrics** - Coverage before/after per integration
5. **Rollback Plan** - Delete new test files; revert factories.ts changes
6. **Next Steps** - Monitor flaky tests; extend coverage for edge cases

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Test output showing all new tests pass
- Coverage report showing ≥80% on integration files
- No regressions in existing test suite

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `INTEGRATION-TESTS-IMPLEMENTATION-COMPLETE-20260204.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-001-integration-test-coverage.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-001-integration-test-coverage.md`
   - [ ] Completion report exists in: `trinity/reports/INTEGRATION-TESTS-IMPLEMENTATION-COMPLETE-20260204.md`
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
- [ ] All 28 tasks implemented (16 new files + 2 extended)
- [ ] ~187 test cases all passing
- [ ] ≥80% coverage on all integration source files
- [ ] No regressions in existing test suite
- [ ] BAS quality gates pass (lint, build, test, coverage)
- [ ] Implementation report submitted to `trinity/reports/`

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members (CC, TRINITY, specialists) are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add** - FORBIDDEN - Only LUKA has permission
- [ ] **git commit** - FORBIDDEN - Only LUKA has permission
- [ ] **git push** - FORBIDDEN - Only LUKA has permission
- [ ] **git pull** - FORBIDDEN - Only LUKA has permission
- [ ] **git merge** - FORBIDDEN - Only LUKA has permission
- [ ] **git checkout -b** - FORBIDDEN - Only LUKA has permission
- [ ] **git branch** - FORBIDDEN - Only LUKA has permission
- [ ] **git tag** - FORBIDDEN - Only LUKA has permission
- [ ] **git rebase** - FORBIDDEN - Only LUKA has permission
- [ ] **git reset** - FORBIDDEN - Only LUKA has permission
- [ ] **git revert** - FORBIDDEN - Only LUKA has permission
- [ ] **git stash** - FORBIDDEN - Only LUKA has permission
- [ ] **Any git operation that modifies repository state**

### ⚠️ CRITICAL RESTRICTION - TEST EXECUTION

- [ ] **LUKA runs all tests** - Do NOT execute `npm test` or `npm run test:coverage` via Bash
- [ ] Write tests, LUKA validates them
- [ ] If a test fails, LUKA will report the failure for fixing

### Do NOT:
- [ ] Modify source files — only create/modify test files
- [ ] Change functionality beyond test coverage
- [ ] Create overly brittle snapshot tests
- [ ] Mock implementation details that could change
- [ ] Perform ANY git operations (see critical restrictions above)

### DO:
- [ ] Follow existing test patterns (see `tests/renderer/stores/useSettingsStore.test.ts`)
- [ ] Use factory functions for all test data
- [ ] Reset store state between tests via `beforeEach`
- [ ] Mock IPC client consistently across all store tests
- [ ] Use `vi.useFakeTimers` for all time-dependent tests
- [ ] Test error paths, not just happy paths
- [ ] Provide clear test descriptions matching "should [verb] when [condition]" pattern

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify:** Test failures in existing suite indicate regression
2. **Rollback:** Delete all new test files; revert `tests/mocks/factories.ts` to pre-change state
3. **Verify:** Run existing tests to confirm clean state

**Critical Files Backup:** `tests/mocks/factories.ts` (only existing file being modified)

---

## CONTEXT FROM AUDIT

**Source Audits:** JUNO agents abfa2b3 (Spotify), a84be62 (Discord), a64ea52 (Chrome/Code-Server)
**Key Findings:**
- Zero test coverage across all three integrations
- Spotify: 18 IPC channels, 18 service methods, 23 store state/actions, 7 UI components
- Discord: 29 IPC channels, 40+ service methods, 34 store actions, 20 UI components
- Chrome: 1 IPC channel (shell:launch-app), whitelist-based
- Code-Server: 3 IPC channels, Docker lifecycle management, JSONC parsing

**TRA Plan Reference:** `trinity/sessions/test-plan-integrations.md` — 28 tasks, 9 phases, 4 stop points

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The scope indicators are for planning purposes only, NOT deadlines.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All 28 tasks must be implemented
**Risk Level:** MEDIUM
**Risk Factors:**
- Discord service has 40+ methods — large surface area for test maintenance
- Store tests depend on IPC mock matching exact channel signatures
- UI component tests depend on Zustand store shape staying stable

**Mitigation:**
- Factory functions centralize test data creation — single point of change
- Fetch helpers abstract HTTP mock responses — resilient to API changes
- Store tests use `setState` directly — independent of IPC implementation
- Phased approach with stop points catches issues early

---

## STOP POINTS

| # | Stop Point | When | Purpose |
|---|-----------|------|---------|
| 1 | Requirements | Before starting | Confirm scope: all 3 integrations, service+store+UI layers |
| 2 | Design | After Tasks 1-3 | Review mock factories and shared test utilities |
| 3 | Plan | After Tasks 4-16 | Validate service + store tests pass before UI layer |
| 4 | Final | After Task 28 | Full suite review, coverage check |

---

## EXECUTION SEQUENCE

```
Phase A (parallel):  [1, 2, 3]               — Mock factories + helpers
   │
   STOP POINT 2: Design Review
   │
Phase B (sequential): 4 → 5 → 6             — Spotify service
Phase C (sequential): 7 → 8                  — Spotify store
Phase D (sequential): 9 → 10 → 11 → 12      — Discord service
Phase E (sequential): 13 → 14 → 15 → 16     — Discord store
Phase F (sequential): 17 → 18                — Code-server expansion
   │
   (B+D+F parallelizable across integrations; C+E parallelizable)
   │
   STOP POINT 3: Plan Checkpoint
   │
Phase G (parallel):  [19, 20, 21]            — Spotify UI
Phase H:             22 → [23, 25, 26, 27] → 24  — Discord UI
Phase I (parallel):  [28]                    — Chrome/shell
   │
   STOP POINT 4: Final Review
```

---

**Remember:** Write tests only — do not modify source files. Report all changes to LUKA for git operations.
