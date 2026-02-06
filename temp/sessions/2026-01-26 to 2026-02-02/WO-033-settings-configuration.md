# ORCHESTRATOR WORK ORDER #033
## Type: IMPLEMENTATION
## Settings & Configuration

---

## MISSION OBJECTIVE

Add missing Claude settings: persisted extended thinking toggle (GAP-008), custom system prompt (GAP-015), max tokens configuration (GAP-016), custom slash commands (GAP-019), reset to defaults, and consolidate all Claude settings into organized sub-sections.

**Implementation Goal:** All Claude configuration is available in Settings and persists across restarts.
**Based On:** TRA-WO-033-settings-config.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/settings/SettingsForm.tsx
    changes: All new settings fields, sub-sections, reset to defaults
    risk: MEDIUM

  - path: src/main/ipc/channels.ts
    changes: Extend AppSettings with new fields
    risk: LOW

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Load settings on init, sync toggles
    risk: LOW

Supporting_Files:
  - src/main/services/claude-container.service.ts — pass system prompt, max tokens
  - docker/claude-container/server.ts — accept system prompt, max tokens
  - src/renderer/components/ide/claude/ClaudeSlashCommands.tsx — merge custom commands
```

---

## IMPLEMENTATION APPROACH

### Parallel Group (immediate start):

**T-015 — Persist Extended Thinking (45min)**
- [ ] Add `claudeExtendedThinking: boolean` to AppSettings
- [ ] Toggle in SettingsForm.tsx Claude section
- [ ] Load from settings on store init
- [ ] Persist on toggle

**T-018 — Custom System Prompt (2h)**
- [ ] Add `claudeSystemPrompt: string` to AppSettings
- [ ] Textarea in SettingsForm.tsx
- [ ] Pass through query chain to SDK
- [ ] Only on first message of conversation

**T-019 — Max Tokens (1.5h)**
- [ ] Add `claudeMaxTokens: number` to AppSettings (default 16384)
- [ ] Number input in SettingsForm.tsx (range 256-128000)
- [ ] Pass through query chain to SDK

**T-021 — Custom Slash Commands (2.5h)**
- [ ] Add `claudeCustomCommands` array to AppSettings
- [ ] Manage section in SettingsForm.tsx (add/edit/remove)
- [ ] Merge with hardcoded commands in ClaudeSlashCommands.tsx
- [ ] Template variables: {selection}, {file}

**T-027 — Reset to Defaults (30min)**
- [ ] Define DEFAULT_SETTINGS constant
- [ ] Confirmation dialog on click
- [ ] Reset all fields

### Sequential (after all above + WO-030 + WO-034):

**T-028 — Settings Consolidation (3h)**
- [ ] Reorganize Claude AI card into sub-sections
- [ ] Extract sub-sections into components if needed

---

## SUCCESS CRITERIA

- [ ] Extended thinking toggle persists across restarts
- [ ] Custom system prompt reaches the SDK
- [ ] Max tokens configurable and validated
- [ ] Custom slash commands work alongside built-in ones
- [ ] Reset to defaults works
- [ ] Settings form is organized and coherent
- [ ] GAP-008, GAP-015, GAP-016, GAP-019 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- No dependencies for T-015, T-018, T-019, T-021, T-027 (can start immediately)
- T-028 waits for all settings tasks across all WOs

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-033-settings-configuration.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off GAP-008, GAP-015, GAP-016, GAP-019
