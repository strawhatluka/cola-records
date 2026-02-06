# ORCHESTRATOR WORK ORDER #028
## Type: IMPLEMENTATION
## Container Streaming Foundation

---

## MISSION OBJECTIVE

Fix the body parameter mapping mismatch (GAP-003) and expand the container's NDJSON streaming to emit all event types — tool_use, tool_result, thinking, usage, error — instead of only text events (ARCH-001, GAP-001). This is the critical-path foundation that unblocks 5 downstream work orders.

**Implementation Goal:** Container server.ts emits rich NDJSON events matching all types that the service already parses.
**Based On:** TRA-CLAUDE-BOX-PARITY-2026-01-31 (T-001, T-002), TRA-WO-028-container-streaming.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: docker/claude-container/server.ts
    changes: Fix parameter destructuring, rewrite streaming loop to emit all event types
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Verify body format (should be correct already)
    risk: LOW
```

---

## IMPLEMENTATION APPROACH

### Step 1: T-002 — Fix Model/Thinking Parameter Mapping
- [ ] In `server.ts:69`, change `const { prompt, options = {} } = body` to `const { prompt, model, thinking } = body`
- [ ] In `server.ts:107`, change `model: options.model || "claude-sonnet-4-5"` to `model: model || "claude-sonnet-4-5"`
- [ ] Pass `thinking` to SDK query options if SDK supports it
- [ ] Verify `claude-container.service.ts:199-202` already sends `{ prompt, model, thinking }` at body root

### Step 2: T-001 — Expand NDJSON Streaming
- [ ] Rewrite the streaming loop (`server.ts:122-143`) to handle all content block types
- [ ] For `assistant` messages, iterate content blocks and emit based on `block.type`:
  - `text` → `{ type: "text", content: block.text }`
  - `tool_use` → `{ type: "tool_use", name: block.name, input: block.input, id: block.id }`
  - `thinking` → `{ type: "thinking", content: block.thinking }`
- [ ] For `tool_result` messages, emit `{ type: "tool_result", content, tool_use_id }`
- [ ] Extract usage from system/init messages: `{ type: "usage", input_tokens, output_tokens }`
- [ ] Keep error handling in catch block as `{ type: "error", message }`
- [ ] Keep session ID capture from init messages

### Step 3: Validation
- [ ] The service's `handleNdjsonEvent()` (lines 322-402) already handles all these event types — verify no changes needed there
- [ ] Verify NDJSON line format matches what the service parser expects
- [ ] Test with a simple query that triggers tool use (e.g., file read)

---

## SUCCESS CRITERIA

- [ ] `server.ts` emits tool_use, tool_result, thinking, usage events (not just text)
- [ ] Model selection from the UI reaches the SDK correctly
- [ ] Service `handleNdjsonEvent()` receives and processes all event types
- [ ] No regressions in existing text streaming
- [ ] ARCH-001, GAP-001, GAP-003 can be checked off in CLAUDE-BOX-GAPS.md

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS
- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- Follow existing NDJSON protocol format
- Do NOT change the HTTP endpoint structure (/query, /health)
- Keep the `send()` helper function pattern

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** Move this file: `mv trinity/work-orders/WO-028-container-streaming-foundation.md trinity/sessions/`
**Step 3:** Verify file locations
**Step 4:** Update CLAUDE-BOX-GAPS.md — check off ARCH-001, GAP-001, GAP-003
