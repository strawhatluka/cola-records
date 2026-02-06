# ORCHESTRATOR WORK ORDER #027
## Type: IMPLEMENTATION
## Test Coverage Gap Closure — JUNO Audit Findings

---

## MISSION OBJECTIVE

Close the 6 test coverage gaps identified by the JUNO audit of WO-015 through WO-026. Create dedicated test files for 5 untested source files and expand database service tests to cover Claude-specific CRUD and fork operations.

**Implementation Goal:** 6 new test files bringing all Claude Box source files to full test coverage — backend services, database operations, and UI components.
**Based On:** JUNO Audit `trinity/reports/AUDIT-WO-015-026-JUNO-2026-01-31.md` (Section 2: Test Coverage Audit, Findings F1-F6)
**Depends On:** WO-024 (checkpoint service + database CRUD), WO-026 (ClaudeCheckpoints + ClaudeBranchSwitcher), WO-016 (CodeBlock + claude-theme)

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: tests/main/services/checkpoint.service.test.ts
    changes: Full unit test suite for CheckpointService (createCheckpoint, restoreCheckpoint, getTimeline, cleanup, gzip compression)
    risk: MEDIUM

  - path: tests/main/database/database.service.claude.test.ts
    changes: Unit tests for conversation CRUD, checkpoint CRUD with JOIN, file snapshot CRUD, forkConversation transaction
    risk: HIGH

  - path: tests/renderer/components/ide/claude/ClaudeCheckpoints.test.tsx
    changes: Unit tests for checkpoint timeline component (rendering, callbacks, manual creation, empty/loading states)
    risk: LOW

  - path: tests/renderer/components/ide/claude/ClaudeBranchSwitcher.test.tsx
    changes: Unit tests for branch switcher component (tree view, active highlighting, switch callback, empty state)
    risk: LOW

  - path: tests/renderer/components/ide/claude/CodeBlock.test.tsx
    changes: Unit tests for syntax highlighting, copy button, language label, line numbers
    risk: LOW

  - path: tests/renderer/components/ide/claude/claude-theme.test.ts
    changes: Unit tests for theme constants and Tailwind class helper outputs
    risk: LOW
```

---

## TASK BREAKDOWN

### T1: CheckpointService Tests (Priority: HIGH)
**Complexity:** 7
**File NEW:** `tests/main/services/checkpoint.service.test.ts`
**Source:** `src/main/services/checkpoint.service.ts`

**Test Cases:**
- [ ] `createCheckpoint` — creates checkpoint with correct ID, conversationId, messageId, label, type, messageIndex
- [ ] `createCheckpoint` — reads and gzip-compresses affected files into file snapshots
- [ ] `createCheckpoint` — handles missing files gracefully (file deleted before snapshot)
- [ ] `createCheckpoint` — creates checkpoint + snapshots atomically (transaction)
- [ ] `restoreCheckpoint` — decompresses and writes files back to disk
- [ ] `restoreCheckpoint` — creates parent directories if they don't exist on restore
- [ ] `restoreCheckpoint` — returns restoredFiles array and messageIndex
- [ ] `restoreCheckpoint` — handles checkpoint not found (returns error)
- [ ] `getTimeline` — returns checkpoints for conversation sorted by createdAt
- [ ] `cleanup` — keeps most recent N checkpoints (default 50), deletes rest
- [ ] `cleanup` — deletes checkpoints older than maxAgeDays (default 7)
- [ ] Gzip round-trip: compress → decompress returns original content
- [ ] Gzip handles binary content correctly
- [ ] Gzip handles empty string content

**Mocking Strategy:**
- Mock `DatabaseService` (all checkpoint/snapshot CRUD methods)
- Mock `fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`, `fs.existsSync`
- Use real `zlib.gzipSync` / `zlib.gunzipSync` for compression round-trip tests

**Acceptance Criteria:**
- [ ] 14+ test cases covering all public methods
- [ ] Compression/decompression verified with real zlib
- [ ] File I/O mocked properly
- [ ] Error handling paths tested
- [ ] Follows existing service test patterns (claude-container.service.test.ts)

---

### T2: Database Service Claude Tests (Priority: HIGH)
**Complexity:** 8
**File NEW:** `tests/main/database/database.service.claude.test.ts`
**Source:** `src/main/database/database.service.ts`

**Test Cases — Conversation CRUD:**
- [ ] `saveConversation` — inserts new conversation with all fields
- [ ] `saveConversation` — updates existing conversation (upsert behavior)
- [ ] `getConversations` — returns conversations filtered by projectPath
- [ ] `getConversations` — returns conversations with branching fields (parentConversationId, forkCheckpointId, branchLabel)
- [ ] `getConversationById` — returns single conversation or null
- [ ] `deleteConversation` — removes conversation and cascading messages

**Test Cases — Message CRUD:**
- [ ] `saveMessage` — inserts message with all rich fields (messageType, toolName, toolInput, toolResult, thinking, usage)
- [ ] `getConversationMessages` — returns messages sorted by timestamp

**Test Cases — Checkpoint CRUD:**
- [ ] `createCheckpoint` — inserts checkpoint row with all fields
- [ ] `getCheckpoints` — returns checkpoints with fileCount via LEFT JOIN
- [ ] `getCheckpoints` — returns empty array for conversation with no checkpoints
- [ ] `getCheckpointById` — returns checkpoint or null
- [ ] `deleteCheckpoint` — CASCADE deletes associated file snapshots
- [ ] `deleteOldCheckpoints` — keeps most recent N, deletes rest

**Test Cases — File Snapshot CRUD:**
- [ ] `saveFileSnapshot` — inserts snapshot with compressed content
- [ ] `getFileSnapshots` — returns all snapshots for a checkpoint

**Test Cases — Fork:**
- [ ] `forkConversation` — creates new conversation with parentConversationId set
- [ ] `forkConversation` — copies messages up to checkpoint's messageIndex
- [ ] `forkConversation` — copies file snapshots to new checkpoint
- [ ] `forkConversation` — sets branchLabel on forked conversation
- [ ] `forkConversation` — is transactional (all-or-nothing)
- [ ] `forkConversation` — validates checkpoint belongs to source conversation

**Mocking Strategy:**
- Use in-memory SQLite database (better-sqlite3 with `:memory:`)
- Run schema migrations to set up tables
- No file system mocking needed (pure database tests)

**Acceptance Criteria:**
- [ ] 22+ test cases covering all Claude-specific database methods
- [ ] In-memory SQLite for isolation (no file system dependencies)
- [ ] Schema migrations applied in test setup
- [ ] Transaction behavior verified for forkConversation
- [ ] CASCADE delete verified for checkpoint → snapshots
- [ ] Follows existing database test patterns (database.service.settings.test.ts)

---

### T3: ClaudeCheckpoints Component Tests (Priority: MEDIUM)
**Complexity:** 5
**File NEW:** `tests/renderer/components/ide/claude/ClaudeCheckpoints.test.tsx`
**Source:** `src/renderer/components/ide/claude/ClaudeCheckpoints.tsx`

**Test Cases:**
- [ ] Renders timeline with checkpoint dots and connector lines
- [ ] Displays checkpoint labels, file counts, and relative times
- [ ] Rewind button visible on each checkpoint, triggers onRewind callback with checkpointId
- [ ] Fork button visible on each checkpoint, triggers onFork callback with checkpointId
- [ ] Delete button appears on hover only, triggers onDelete callback
- [ ] "Manual Checkpoint" button triggers inline label input
- [ ] Manual checkpoint: Enter confirms with label, calls onCreateManual
- [ ] Manual checkpoint: Escape cancels inline input
- [ ] Empty state: shows "No checkpoints yet" message when checkpoints=[]
- [ ] Loading state: shows skeleton/pulse animation when loading=true
- [ ] Scrollable container for many checkpoints
- [ ] Checkpoints rendered newest-first (chronological order)
- [ ] Claude Orange styling: dots use bg-[#d97757]
- [ ] Accessibility: aria-labels on rewind, fork, delete buttons

**Mocking Strategy:**
- Standard React Testing Library (render, screen, userEvent)
- Mock ClaudeCheckpoint[] data with various states
- No child component mocks needed (leaf component)

**Acceptance Criteria:**
- [ ] 14+ test cases
- [ ] All callback props tested
- [ ] Empty and loading states verified
- [ ] Hover behavior tested for delete button
- [ ] Inline input tested for manual checkpoint creation
- [ ] Follows existing component test patterns (ClaudeConversationHistory.test.tsx)

---

### T4: ClaudeBranchSwitcher Component Tests (Priority: MEDIUM)
**Complexity:** 4
**File NEW:** `tests/renderer/components/ide/claude/ClaudeBranchSwitcher.test.tsx`
**Source:** `src/renderer/components/ide/claude/ClaudeBranchSwitcher.tsx`

**Test Cases:**
- [ ] Renders parent conversation at top of tree
- [ ] Renders child branches indented below parent
- [ ] Active branch highlighted with orange accent (bg-[#d97757]/20)
- [ ] Inactive branches show muted text (text-[#b0aea5])
- [ ] Click on branch calls onSwitchBranch with conversationId
- [ ] Each branch shows label (or title fallback) and message count
- [ ] Tree connector lines rendered between parent and children
- [ ] Empty state: shows "No branches" message when branches=[]
- [ ] Close button and Escape key handling
- [ ] Accessibility: aria-current on active branch

**Mocking Strategy:**
- Standard React Testing Library
- Mock ClaudeConversation[] data with parent/child relationships
- No child component mocks needed

**Acceptance Criteria:**
- [ ] 10+ test cases
- [ ] Tree structure rendering verified
- [ ] Active/inactive styling verified
- [ ] Switch callback tested
- [ ] Empty state verified
- [ ] Follows existing component test patterns

---

### T5: CodeBlock Component Tests (Priority: LOW)
**Complexity:** 3
**File NEW:** `tests/renderer/components/ide/claude/CodeBlock.test.tsx`
**Source:** `src/renderer/components/ide/claude/CodeBlock.tsx`

**Test Cases:**
- [ ] Renders code content in pre/code block
- [ ] Displays language label in header
- [ ] Copy button copies content to clipboard
- [ ] Copy button shows "Copied!" feedback after click
- [ ] Copy feedback resets after timeout
- [ ] Line numbers displayed for blocks with >10 lines
- [ ] No line numbers for short blocks (≤10 lines)
- [ ] Handles empty content gracefully
- [ ] Unknown language still renders code block

**Mocking Strategy:**
- Mock `navigator.clipboard.writeText`
- Mock PrismLight / react-syntax-highlighter
- Standard render/screen/userEvent

**Acceptance Criteria:**
- [ ] 9+ test cases
- [ ] Clipboard interaction tested
- [ ] Feedback timing tested (vi.useFakeTimers)
- [ ] Follows existing component test patterns

---

### T6: claude-theme Tests (Priority: LOW)
**Complexity:** 1
**File NEW:** `tests/renderer/components/ide/claude/claude-theme.test.ts`
**Source:** `src/renderer/components/ide/claude/claude-theme.ts`

**Test Cases:**
- [ ] `claudeTheme` object exports all expected color keys (orange, orangeHover, darkBg, darkSurface, text, etc.)
- [ ] `claudeTheme.orange` equals '#d97757' (brand primary)
- [ ] `claude` class helper object exports all expected keys (panel, surface, text, accent, etc.)
- [ ] `claude.panel` contains expected Tailwind class string
- [ ] `claude.accent` references the correct orange color
- [ ] All color values are valid hex/tailwind format

**Mocking Strategy:**
- No mocking needed (pure value tests)
- Direct import and assertion

**Acceptance Criteria:**
- [ ] 6+ test cases
- [ ] Brand color values verified
- [ ] Class helper outputs verified
- [ ] No external dependencies

---

## IMPLEMENTATION APPROACH

### Step 1: Backend Service Tests (T1 + T2) — Sequential
- [ ] Read checkpoint.service.ts to understand all method signatures
- [ ] Create checkpoint.service.test.ts with mocked database and fs
- [ ] Read database.service.ts to understand all Claude-specific methods
- [ ] Create database.service.claude.test.ts with in-memory SQLite
- [ ] Verify both test files import correctly

### Step 2: UI Component Tests (T3 + T4) — Can be parallel
- [ ] Read ClaudeCheckpoints.tsx to understand props and rendering
- [ ] Create ClaudeCheckpoints.test.tsx
- [ ] Read ClaudeBranchSwitcher.tsx to understand props and rendering
- [ ] Create ClaudeBranchSwitcher.test.tsx

### Step 3: Utility Tests (T5 + T6) — Can be parallel
- [ ] Read CodeBlock.tsx to understand component API
- [ ] Create CodeBlock.test.tsx
- [ ] Read claude-theme.ts to understand exports
- [ ] Create claude-theme.test.ts

### Step 4: Validation
- [ ] All 6 new test files created
- [ ] All test files follow existing patterns (vi.mock, render, screen, userEvent)
- [ ] Import paths are correct and consistent
- [ ] No modifications to source files
- [ ] All existing tests still pass (LUKA runs final verification)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TEST-GAP-CLOSURE-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Test Files Created (6 files with paths)
3. Test Case Count (total new tests across all files)
4. Coverage Summary (before/after comparison)
5. Mocking Strategy Per File
6. Any Remaining Gaps

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-027-test-coverage-gap-closure.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-027-test-coverage-gap-closure.md`

---

## SUCCESS CRITERIA

- [ ] All 6 tasks (T1-T6) implemented
- [ ] checkpoint.service.test.ts — 14+ test cases covering all public methods
- [ ] database.service.claude.test.ts — 22+ test cases covering conversation, checkpoint, snapshot, fork
- [ ] ClaudeCheckpoints.test.tsx — 14+ test cases covering timeline, callbacks, states
- [ ] ClaudeBranchSwitcher.test.tsx — 10+ test cases covering tree view, switching, states
- [ ] CodeBlock.test.tsx — 9+ test cases covering rendering, copy, line numbers
- [ ] claude-theme.test.ts — 6+ test cases covering color values and class helpers
- [ ] Total new test cases: 75+
- [ ] All new tests follow existing patterns
- [ ] No source file modifications (test-only WO)
- [ ] Zero test regressions (LUKA runs final verification)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install
- [ ] Modify source files (this WO is tests only)

### DO:
- [ ] Read source files to understand component/service APIs before writing tests
- [ ] Edit files sequentially (not in parallel)
- [ ] Follow existing test patterns (vi.mock, render, screen, userEvent)
- [ ] Mock all external dependencies (IPC, child components, fs, database)
- [ ] Use data-testid for component identification where appropriate
- [ ] Use in-memory SQLite for database tests (better-sqlite3 :memory:)
- [ ] Use real zlib for compression round-trip tests

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** LOW
**Risk Factors:**
- In-memory SQLite schema migration complexity for database tests
- Mock complexity for CheckpointService (fs + zlib + database)
- ClaudeCheckpoints hover behavior testing may need careful userEvent handling

**Mitigation:**
- Follow existing database.service.settings.test.ts pattern for SQLite setup
- Use vi.mock for fs module, real zlib for compression verification
- Use fireEvent.mouseEnter/mouseLeave for hover states

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Audit `trinity/reports/AUDIT-WO-015-026-JUNO-2026-01-31.md`
**Key Findings:** 6 test coverage gaps identified — 5 source files with no tests, 1 with partial coverage
**Root Causes Being Fixed:** WO-024 and WO-026 created new files after WO-023 (the testing WO); CodeBlock and claude-theme were low-priority gaps from WO-016
**Expected Impact:** 6 gaps closed, 75+ new test cases, estimated coverage increase from ~80% to ~95%

---

**Remember:** This is a test-only work order. Do not modify source files. Report all changes to LUKA for git operations.
