# ORCHESTRATOR WORK ORDER #031
## Type: IMPLEMENTATION
## Core UX Enhancements

---

## MISSION OBJECTIVE

Implement 6 UI/UX improvements: clickable file paths in chat (GAP-013), wired diff accept/reject (GAP-014), Bash ANSI rendering (GAP-005), rich search results (GAP-006), copy formatted text (GAP-007), and persistent token badges (GAP-009).

**Implementation Goal:** Chat messages and tool calls display rich, interactive content matching the Claude Code VS Code extension experience.
**Based On:** TRA-WO-031-core-ux.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/claude/ClaudeMessage.tsx
    changes: Clickable file paths, copy button, persistent token badges
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudeToolCall.tsx
    changes: ANSI rendering, rich search results
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudeDiff.tsx
    changes: Wire accept/reject to fs:write-file IPC
    risk: MEDIUM

Supporting_Files:
  - package.json — add ansi-to-html dependency
```

---

## IMPLEMENTATION APPROACH

### Parallel Group (all after WO-028):

**T-016 — Persistent Token Badges (30min)**
- [ ] In ClaudeMessage.tsx, always show token badge on last assistant message
- [ ] Keep hover-only for non-last messages

**T-014 — Copy Formatted Text (1h)**
- [ ] Add copy icon button to assistant message header
- [ ] clipboard.writeText(message.content) on click
- [ ] Show "Copied!" feedback

**T-005 — Clickable File Paths (2.5h)**
- [ ] Create file path regex utility
- [ ] Post-process markdown to wrap paths in clickable elements
- [ ] onClick → useCodeEditorStore.openFile(path)
- [ ] Strip /workspace/ prefix

**T-006 — Wire Diff Accept/Reject (3h)**
- [ ] Accept: ipc.invoke('fs:write-file', filePath, newContent)
- [ ] Parse tool input for file_path and content
- [ ] Loading/success/error button states
- [ ] Refresh Monaco buffer after write

**T-012 — Bash ANSI Rendering (2.5h)**
- [ ] Add ansi-to-html dependency
- [ ] Convert ANSI output, render as sanitized HTML
- [ ] Exit code badge (green check / red X)
- [ ] Stderr in separate red-tinted block

### Sequential (after T-005):

**T-013 — Rich Search Results (2.5h)**
- [ ] Parse Grep/Glob results for file paths and line numbers
- [ ] Render clickable rows (reuse T-005 file path click handler)
- [ ] Group by file, show match previews

---

## SUCCESS CRITERIA

- [ ] File paths in messages are clickable and open in Monaco
- [ ] Diff accept writes to disk, reject discards
- [ ] Bash output renders ANSI colors
- [ ] Search results show clickable file:line references
- [ ] Copy button works on assistant messages
- [ ] Token badges visible on last exchange without hover
- [ ] GAP-005, GAP-006, GAP-007, GAP-009, GAP-013, GAP-014 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- **Depends on WO-028** (rich streaming for tool events)
- Use DOMPurify for any dangerouslySetInnerHTML

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-031-core-ux-enhancements.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off GAP-005, GAP-006, GAP-007, GAP-009, GAP-013, GAP-014
