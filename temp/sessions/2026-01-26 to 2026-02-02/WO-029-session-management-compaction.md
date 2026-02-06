# ORCHESTRATOR WORK ORDER #029
## Type: IMPLEMENTATION
## Session Management & Compaction

---

## MISSION OBJECTIVE

Replace the single global session with conversation-scoped sessions (ARCH-003), implement true message retry with session rollback (GAP-010), and upgrade compaction to use SDK-native session-aware compaction (GAP-004).

**Implementation Goal:** Each conversation has its own isolated SDK session. Retry rolls back the session. Compaction preserves the session.
**Based On:** TRA-WO-029-session-management.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: docker/claude-container/server.ts
    changes: Session Map, /reset endpoint, /rollback endpoint, /compact endpoint
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Pass conversationId in query/compact, add rollback() method
    risk: MEDIUM

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Update retryLastMessage() and compaction flow
    risk: LOW

Supporting_Files:
  - src/main/ipc/channels.ts — add claude:rollback channel
  - src/main/index.ts — wire rollback IPC handler
```

---

## IMPLEMENTATION APPROACH

### Step 1: T-003 — Conversation-Scoped Sessions
- [ ] In server.ts, replace `let currentSessionId = ""` with `const sessions = new Map<string, string>()`
- [ ] In /query, accept `body.conversationId`, look up session from Map
- [ ] Store new sessionId in Map keyed by conversationId after response
- [ ] Add `POST /reset` endpoint: deletes session entry by conversationId
- [ ] In service query(), pass `conversationId` in HTTP body
- [ ] In service compact(), pass `conversationId` in HTTP body

### Step 2: T-007 — True Message Retry (after T-003)
- [ ] Add `POST /rollback` endpoint to server.ts — deletes session for conversationId
- [ ] Add `claude:rollback` to IpcChannels interface
- [ ] Add rollback() method to service — POSTs to /rollback
- [ ] Wire IPC handler in index.ts
- [ ] Update store retryLastMessage() to call claude:rollback before resending

### Step 3: T-008 — SDK-Native Compaction (parallel with T-007)
- [ ] Add `POST /compact` endpoint to server.ts — uses existing session, sends compaction prompt within session
- [ ] Return compacted token count in response
- [ ] Refactor service compact() to call /compact instead of /query
- [ ] Update store compaction flow to reflect new token counts

### Step 4: Validation
- [ ] Verify each conversation gets its own session
- [ ] Verify retry creates a fresh session
- [ ] Verify compaction preserves session continuity

---

## SUCCESS CRITERIA

- [ ] Multiple conversations can run without session conflicts
- [ ] Retry properly resets the session state
- [ ] Compaction keeps the session alive with reduced context
- [ ] ARCH-003, GAP-010, GAP-004 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- **Depends on WO-028 being complete** (parameter mapping + rich streaming)

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-029-session-management-compaction.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off ARCH-003, GAP-010, GAP-004
