# ORCHESTRATOR WORK ORDER #034
## Type: IMPLEMENTATION
## Advanced Features

---

## MISSION OBJECTIVE

Implement MCP server support (GAP-018), web search capability (GAP-021), hook system for pre/post tool execution (GAP-020), and task delegation/sub-agents (GAP-022). These are the most complex features extending Claude's capabilities beyond basic chat.

**Implementation Goal:** Claude in the IDE has MCP, web search, hooks, and sub-agent capabilities.
**Based On:** TRA-WO-034-advanced-features.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: docker/claude-container/server.ts
    changes: MCP client init, web search tool, hook execution, sub-agent spawning
    risk: HIGH

  - path: src/main/services/claude-container.service.ts
    changes: Pass MCP config, sub-agent event handling
    risk: MEDIUM

  - path: src/main/ipc/channels.ts
    changes: Extend AppSettings (mcpServers, hooks), sub-agent event types
    risk: LOW

Supporting_Files:
  - src/renderer/components/settings/SettingsForm.tsx — MCP + hooks config UI
  - src/renderer/stores/useClaudeStore.ts — sub-agent tracking
  - src/renderer/components/ide/claude/ClaudeToolCall.tsx — web search + sub-agent UI
  - docker/claude-container/Dockerfile — network access for web search
```

---

## IMPLEMENTATION APPROACH

### Phase 1 (parallel, after WO-028 + WO-030):

**T-010 — MCP Server Support (6h)**
- [ ] Add `mcpServers` config to AppSettings
- [ ] MCP config UI in SettingsForm.tsx
- [ ] Pass MCP config to container at start
- [ ] Initialize MCP clients in server.ts
- [ ] Pass to query() options
- [ ] MCP tool results in NDJSON stream

**T-023 — Web Search (3h)**
- [ ] Enable SDK web search or register custom WebSearch tool
- [ ] Configure search API key as env var
- [ ] Stream search results as tool_result
- [ ] Render web results in ClaudeToolCall.tsx with clickable URLs

### Phase 2 (after WO-030):

**T-022 — Hooks (5h)**
- [ ] Add `claudeHooks` config to AppSettings
- [ ] Hooks config UI in SettingsForm.tsx
- [ ] Pass hooks to container
- [ ] Pre-hooks in canUseTool, post-hooks after tool_result
- [ ] Stream hook output as hook_result events

### Phase 3 (after WO-030):

**T-011 — Sub-Agents (8h)**
- [ ] Stream subagent_start/subagent_result events (if SDK supports)
- [ ] OR implement dispatch tool with parallel queries (fallback)
- [ ] Track sub-agents in store
- [ ] Render sub-agent progress in ClaudeToolCall.tsx

---

## SUCCESS CRITERIA

- [ ] MCP servers can be configured and their tools appear in Claude
- [ ] Web search returns results within conversations
- [ ] Hooks execute before/after specified tools
- [ ] Sub-agents can be spawned for parallel tasks
- [ ] GAP-018, GAP-020, GAP-021, GAP-022 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- **Depends on WO-028** (rich streaming) and **WO-030** (permission flow for hooks/sub-agents)
- **CRITICAL:** Verify SDK sub-agent API exists before implementing T-011
- **CRITICAL:** Verify SDK MCP integration API before implementing T-010

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-034-advanced-features.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off GAP-018, GAP-020, GAP-021, GAP-022
