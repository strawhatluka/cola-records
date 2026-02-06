# ORCHESTRATOR WORK ORDER #038
## Type: IMPLEMENTATION
## GPU Rendering & Terminal — Hardware Acceleration Phase 2

---

## MISSION OBJECTIVE

Enable GPU-accelerated terminal rendering via XTerm WebGL addon, add resilient fallback to canvas renderer, debounce terminal resize operations, and optimize Docker process spawning. This phase introduces the `@xterm/addon-webgl` dependency and modifies the terminal component.

**Implementation Goal:** 4 audit items resolved (XTERM-001, XTERM-002, XTERM-003, BUILD-005) across 2 consolidated task groups.
**Based On:** JUNO Audit `trinity/reports/AUDIT-JUNO-HARDWARE-ACCELERATION-2026-01-31.md` and TRA Plan `trinity/plans/TRA-PLAN-HARDWARE-ACCELERATION-2026-01-31.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/terminal/XTermWrapper.tsx
    changes: Install WebGL addon, add fallback, debounce ResizeObserver
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Cache docker path, use shell:false for spawning
    risk: MEDIUM

Supporting_Files:
  - package.json - Add @xterm/addon-webgl dependency
```

### Changes Required

#### Change Set 1: XTerm WebGL Renderer (T-015, T-016, T-017) — XTERM-001, XTERM-002, XTERM-003
**Files:** `src/renderer/components/ide/terminal/XTermWrapper.tsx`, `package.json`
**Current State:** Default canvas renderer, no WebGL addon, raw ResizeObserver without debounce
**Target State:** WebGL GPU-accelerated rendering with canvas fallback, debounced resize
**Implementation:**
```typescript
import { WebglAddon } from '@xterm/addon-webgl';

// After term.open(terminalRef.current):
try {
  const webglAddon = new WebglAddon();
  webglAddon.onContextLoss(() => {
    console.warn('WebGL context lost — falling back to canvas renderer');
    webglAddon.dispose();
  });
  term.loadAddon(webglAddon);
} catch {
  // WebGL not available — canvas renderer remains active
}

// Debounced ResizeObserver:
let rafId: number | null = null;
const resizeObserver = new ResizeObserver(() => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    fitAddonRef.current?.fit();
    rafId = null;
  });
});
// Cleanup:
return () => {
  resizeObserver.disconnect();
  if (rafId) cancelAnimationFrame(rafId);
};
```

#### Change Set 2: Docker shell:false Optimization (T-018) — BUILD-005
**Files:** `src/main/services/claude-container.service.ts`
**Current State:** Docker commands spawn with default shell, resolving `docker` via PATH each time
**Target State:** Docker executable path resolved once at startup, `shell: false` for all spawns
**Implementation:**
```typescript
private dockerPath: string | null = null;

private async resolveDockerPath(): Promise<string> {
  if (this.dockerPath) return this.dockerPath;
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const { stdout } = await execFileAsync(cmd, ['docker']);
  this.dockerPath = stdout.trim().split('\n')[0];
  return this.dockerPath;
}
// Use this.dockerPath with shell: false in all spawn calls
```

---

## IMPLEMENTATION APPROACH

### Step 1: Install WebGL Addon Dependency
- [ ] Run `npm install @xterm/addon-webgl` to add the dependency
- [ ] Verify package.json updated
- [ ] Verify no peer dependency conflicts

### Step 2: XTerm WebGL Integration (T-015, T-016)
- [ ] Import `WebglAddon` in XTermWrapper.tsx
- [ ] After `term.open()`, load WebGL addon in try/catch
- [ ] Add `onContextLoss` handler to dispose and fallback to canvas
- [ ] Log warning on context loss for debugging
- [ ] Verify terminal renders correctly with WebGL

### Step 3: Debounce ResizeObserver (T-017)
- [ ] Replace raw `ResizeObserver` callback with `requestAnimationFrame` debounce
- [ ] Ensure `cancelAnimationFrame` on cleanup
- [ ] Verify terminal resizes correctly during panel drag

### Step 4: Docker Path Caching (T-018)
- [ ] Add `dockerPath` field to ClaudeContainerService
- [ ] Implement `resolveDockerPath()` using `where`/`which`
- [ ] Replace shell-based docker spawns with `execFile` using resolved path
- [ ] Test Docker operations still work

### Step 5: Validation
- [ ] Run full test suite — all tests pass
- [ ] Run build — production build succeeds
- [ ] Manual verification: terminal renders, Docker commands execute

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PERF-PHASE2-IMPLEMENTATION-COMPLETE-2026-01-31.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - WebGL terminal rendering and Docker optimization
2. **Changes Applied** - Detailed diffs for XTermWrapper.tsx and claude-container.service.ts
3. **Test Results** - Test suite output
4. **Metrics** - Terminal rendering mode confirmation (WebGL vs canvas)
5. **Rollback Plan** - Remove WebGL addon import, revert ResizeObserver
6. **Next Steps** - Proceed to Phase 3 (WO-039)

### Evidence to Provide
- File diff statistics
- npm install output (new dependency)
- Test output showing all passing
- Build verification

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `PERF-PHASE2-IMPLEMENTATION-COMPLETE-2026-01-31.md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-038-gpu-rendering-terminal.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-038-gpu-rendering-terminal.md`
   - [ ] Completion report exists in: `trinity/reports/PERF-PHASE2-IMPLEMENTATION-COMPLETE-2026-01-31.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] `@xterm/addon-webgl` installed and loaded with fallback
- [ ] Terminal renders via WebGL when available, canvas otherwise
- [ ] ResizeObserver debounced via requestAnimationFrame
- [ ] Docker path resolved once at startup, shell:false used
- [ ] All existing tests pass — no regressions
- [ ] Production build succeeds
- [ ] Implementation report submitted to trinity/reports/

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, etc.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change terminal behavior beyond rendering backend
- [ ] Break existing terminal features (links, search, fit)

### DO:
- [ ] Follow existing XTerm addon loading patterns
- [ ] Maintain graceful degradation (WebGL → canvas fallback)
- [ ] Test on different terminal scenarios (multiple sessions, resize)
- [ ] Report completion to LUKA for git operations

---

## ROLLBACK STRATEGY

If issues arise:
1. **WebGL addon:** Remove import and try/catch block — terminal reverts to canvas
2. **ResizeObserver debounce:** Revert to direct `fitAddon.fit()` call
3. **Docker path:** Revert to shell-based spawn (remove `resolveDockerPath`)
4. **Dependency:** `npm uninstall @xterm/addon-webgl`

**Critical Files Backup:** `src/renderer/components/ide/terminal/XTermWrapper.tsx`, `src/main/services/claude-container.service.ts`

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-01-31)
**Key Findings:** Terminal uses default canvas renderer (no WebGL), ResizeObserver triggers fit() without debounce causing layout thrashing, Docker spawns create unnecessary shell processes
**Root Causes Being Fixed:** Missing GPU-accelerated terminal rendering, resize layout thrashing, wasteful shell process spawning
**Expected Impact:** 2-5x faster terminal rendering for high-throughput output, eliminated layout thrashing during panel resize, reduced process overhead per Docker command

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
**Implementation Scope:** FOCUSED — 4 items, 2 task groups
**Completeness Required:** 100%
**Risk Level:** MEDIUM — New dependency + WebGL context management
**Risk Factors:**
- WebGL addon may not initialize on all GPU hardware
- Docker path resolution may differ across platforms

**Mitigation:**
- Try/catch + onContextLoss ensures graceful canvas fallback
- Platform-aware `where`/`which` command selection
- Fallback to original shell-based spawn if path resolution fails

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
