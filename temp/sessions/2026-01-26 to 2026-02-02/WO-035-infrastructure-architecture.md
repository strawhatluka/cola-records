# ORCHESTRATOR WORK ORDER #035
## Type: IMPLEMENTATION
## Infrastructure & Architecture

---

## MISSION OBJECTIVE

Fix Docker image build from packaged Electron app (ARCH-004), add resizable Claude panel (ARCH-005), and batch multi-file checkpoints per turn (ARCH-006). These are independent architecture improvements with no feature dependencies.

**Implementation Goal:** App builds Docker images in production, panel is resizable, checkpoints are batched per turn.
**Based On:** TRA-WO-035-infrastructure.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/claude-container.service.ts
    changes: Fix Docker context path for packaged app, accumulate checkpoint files
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    changes: Add resize handle and drag logic
    risk: LOW

  - path: src/main/services/checkpoint.service.ts
    changes: Add createBatchCheckpoint method
    risk: LOW

Supporting_Files:
  - forge.config.ts — add extraResources for Docker context
  - src/renderer/stores/useClaudeStore.ts — panelWidth state
```

---

## IMPLEMENTATION APPROACH

### All Parallel (no dependencies, immediate start):

**T-024 — Docker Build Fix (2h)**
- [ ] Detect packaged mode via `app.isPackaged`
- [ ] Resolve Docker context from `process.resourcesPath` when packaged
- [ ] Add `docker/claude-container/` to Electron Forge extraResources
- [ ] Verify dev mode still works with `app.getAppPath()`

**T-025 — Resizable Panel (2.5h)**
- [ ] Add 4px resize handle on left edge of ClaudePanel
- [ ] mousedown/mousemove/mouseup handlers
- [ ] Min 300px, max 800px constraints
- [ ] Store width in state, persist to localStorage
- [ ] Cursor change on hover

**T-026 — Checkpoint Batching (3h)**
- [ ] Add `pendingCheckpointFiles: string[]` to service
- [ ] In tool_use handler: accumulate files instead of creating checkpoint
- [ ] On done event: create single batch checkpoint with all accumulated files
- [ ] Add `createBatchCheckpoint()` to checkpoint.service.ts
- [ ] Clear pending list after creation

---

## SUCCESS CRITERIA

- [ ] Docker image builds from both dev and packaged Electron app
- [ ] Claude panel can be resized by dragging
- [ ] Panel width persists across sessions
- [ ] One checkpoint per turn regardless of number of tool calls
- [ ] ARCH-004, ARCH-005, ARCH-006 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- No dependencies — can start immediately
- Test Docker build path on both Windows and macOS if possible

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-035-infrastructure-architecture.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off ARCH-004, ARCH-005, ARCH-006
