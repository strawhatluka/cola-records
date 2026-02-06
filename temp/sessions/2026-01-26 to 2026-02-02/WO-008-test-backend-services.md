# ORCHESTRATOR WORK ORDER #008
## Type: IMPLEMENTATION
## Test Coverage — Backend Services

---

## MISSION OBJECTIVE

Implement test coverage for 4 untested backend services: environment.service, filewatcher.service, secure-storage.service, and github-rest.service. These require Node.js API and external package mocking.

**Implementation Goal:** 4 new test files, all passing
**Based On:** JUNO Audit (2026-01-29), TRA-PLAN-003 Phase 6
**Depends On:** None (can run in parallel with WO-003/004)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
Critical_Files:
  - path: tests/main/services/environment.service.test.ts
    changes: New test file — Node fs/path mocking
    risk: MEDIUM

  - path: tests/main/services/filewatcher.service.test.ts
    changes: New test file — chokidar mock
    risk: MEDIUM

  - path: tests/main/services/secure-storage.service.test.ts
    changes: New test file — electron safeStorage mock
    risk: MEDIUM

  - path: tests/main/services/github-rest.service.test.ts
    changes: New test file — Octokit mock, 16+ methods
    risk: HIGH
```

### Source Files Under Test
- `src/main/services/environment.service.ts` (198 lines)
- `src/main/services/filewatcher.service.ts` (149 lines)
- `src/main/services/secure-storage.service.ts` (146 lines)
- `src/main/services/github-rest.service.ts` (431 lines, 16+ public methods)

---

## IMPLEMENTATION APPROACH

### Step 1: Simpler Services (Parallel)
- [ ] Task 6.1: environment.service.test.ts — Config loading, path resolution, defaults
- [ ] Task 6.2: filewatcher.service.test.ts — Watch/unwatch, event callbacks, debounce
- [ ] Task 6.3: secure-storage.service.test.ts — Encrypt/decrypt, store/retrieve, electron mock

### Step 2: Complex Service
- [ ] Task 6.4: github-rest.service.test.ts — All 16+ public methods, Octokit mock, auth, error handling

### Step 3: Validation
- [ ] Run `npx vitest run` — all tests pass
- [ ] Verify no regressions

---

## KEY TEST SCENARIOS

### environment.service.ts (198 lines)
- Loads environment config from expected paths
- Returns defaults when config file missing
- Handles malformed config gracefully
- Path resolution for different platforms
- Singleton access pattern

### filewatcher.service.ts (149 lines)
- Starts watching a directory
- Fires callbacks on file change/add/delete
- Debounces rapid changes
- Stops watching cleanly
- Handles watch errors
- Multiple simultaneous watchers

### secure-storage.service.ts (146 lines)
- Stores encrypted value
- Retrieves and decrypts value
- Handles missing key gracefully
- Deletes stored value
- Works when electron safeStorage unavailable
- Singleton access pattern

### github-rest.service.ts (431 lines — HIGHEST COMPLEXITY)
- **Auth:** setToken, clearToken, isAuthenticated
- **Repos:** getRepo, listUserRepos, getRepoContents
- **Issues:** listIssues, getIssue, createIssue, addIssueComment
- **PRs:** createPullRequest, listPullRequests, getPullRequest
- **User:** getAuthenticatedUser
- **Error handling:** Rate limiting, 404s, auth failures, network errors
- Each method: success path + error path

---

## MOCK PATTERNS

### Node.js fs Mock
```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
```

### Chokidar Mock
```typescript
const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn(),
};
vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatcher),
}));
```

### Electron safeStorage Mock
```typescript
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s) => Buffer.from(s)),
    decryptString: vi.fn((b) => b.toString()),
  },
}));
```

### Octokit Mock
```typescript
const mockOctokit = {
  rest: {
    repos: { get: vi.fn(), listForAuthenticatedUser: vi.fn(), getContent: vi.fn() },
    issues: { listForRepo: vi.fn(), get: vi.fn(), create: vi.fn(), createComment: vi.fn() },
    pulls: { create: vi.fn(), list: vi.fn(), get: vi.fn() },
    users: { getAuthenticated: vi.fn() },
  },
};
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => mockOctokit),
}));
```

---

## DELIVERABLE REQUIREMENTS

**Filename:** `BACKEND-TESTS-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file from `trinity/work-orders/` to `trinity/sessions/`
**Step 3:** Report to LUKA for git operations

---

## SUCCESS CRITERIA

- [ ] 4 new test files created and passing
- [ ] github-rest.service.ts: all 16+ public methods tested (success + error)
- [ ] External dependencies mocked (chokidar, electron, octokit, fs)
- [ ] Singleton patterns tested
- [ ] Error handling paths tested
- [ ] No regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ GIT OPERATIONS FORBIDDEN — Only LUKA has permission.

### DO:
- [ ] Follow existing service test patterns (see git.service.test.ts, filesystem.service.test.ts)
- [ ] Test every public method
- [ ] Test error paths (rejected promises, missing files, auth failures)
- [ ] Test singleton access if applicable
- [ ] Read source files thoroughly to understand exact API shapes

### DO NOT:
- [ ] Modify source files
- [ ] Test private methods directly
- [ ] Perform ANY git operations

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** MEDIUM-HIGH
**Risk Factors:**
- github-rest.service.ts has 16+ methods requiring comprehensive Octokit mock
- electron safeStorage may need platform-specific handling
- chokidar event simulation complexity

**Mitigation:**
- Reference existing service tests for mock patterns
- Create reusable Octokit mock setup
- Use vi.fn().mockReturnThis() for chokidar chaining
- Test each github-rest method independently in its own describe block
