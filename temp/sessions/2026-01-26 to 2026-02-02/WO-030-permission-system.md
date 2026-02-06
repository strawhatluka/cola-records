# ORCHESTRATOR WORK ORDER #030
## Type: IMPLEMENTATION
## Permission System

---

## MISSION OBJECTIVE

Replace the decorative permission flow with a real bi-directional permission system (ARCH-002, GAP-002) where the container pauses tool execution, the UI prompts the user, and the response flows back to unblock the SDK. Then persist permission preferences across sessions (GAP-017).

**Implementation Goal:** Real permission control over tool execution. Per-tool saved preferences.
**Based On:** TRA-WO-030-permission-system.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: docker/claude-container/server.ts
    changes: Replace allowAll canUseTool with async Promise-based flow, add /permission/respond endpoint
    risk: HIGH

  - path: src/main/services/claude-container.service.ts
    changes: Handle permission_request event, POST to /permission/respond
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudePermission.tsx
    changes: Mode-based auto-approve logic, "Remember" checkbox
    risk: LOW

Supporting_Files:
  - src/main/ipc/channels.ts — extend AppSettings with permission fields
  - src/main/index.ts — wire permission respond to container service
  - src/renderer/stores/useClaudeStore.ts — load saved permission mode
  - src/renderer/components/settings/SettingsForm.tsx — permissions management
```

---

## IMPLEMENTATION APPROACH

### Step 1: T-004 — Bi-directional Permission Flow
- [ ] In server.ts, create `pendingPermissions = new Map<string, { resolve, reject }>()`
- [ ] Replace `allowAll` with async canUseTool that emits permission_request, creates Promise, awaits it
- [ ] Add `POST /permission/respond` endpoint — resolves pending Promise
- [ ] In service, when `permission_request` NDJSON event arrives, emit to renderer via IPC
- [ ] Remove fake permission emission from `emitPermissionRequest()` (line 417)
- [ ] Handle `claude:permission:respond` IPC by POSTing to container /permission/respond
- [ ] Wire IPC handler in index.ts
- [ ] Update ClaudePermission.tsx for mode-based behavior (auto/normal/strict)

### Step 2: T-020 — Permission Preference Persistence
- [ ] Add `claudeToolPermissions` and `claudePermissionMode` to AppSettings
- [ ] Before showing permission UI, check saved preference for the tool
- [ ] Add "Remember this choice" checkbox to ClaudePermission.tsx
- [ ] Persist choice via settings:update
- [ ] Add permissions management table in SettingsForm.tsx
- [ ] Load saved mode on store initialization

### Step 3: Validation
- [ ] Tool execution pauses until user approves
- [ ] Denied tools don't execute
- [ ] Saved preferences auto-approve/deny without prompting
- [ ] Permission mode persists across app restart

---

## SUCCESS CRITERIA

- [ ] Container canUseTool blocks until user responds
- [ ] NDJSON stream stays open during permission wait
- [ ] Per-tool preferences are saved and loaded
- [ ] ARCH-002, GAP-002, GAP-017 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- **Depends on WO-028** (rich streaming must be in place)
- **CRITICAL:** Verify SDK canUseTool supports async/Promise-based blocking before implementation

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-030-permission-system.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off ARCH-002, GAP-002, GAP-017
