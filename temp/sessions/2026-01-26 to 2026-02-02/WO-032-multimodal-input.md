# ORCHESTRATOR WORK ORDER #032
## Type: IMPLEMENTATION
## Multimodal & Input

---

## MISSION OBJECTIVE

Add image input support via paste/attach (GAP-011) and file drag-and-drop into chat (GAP-012), enabling multimodal conversations with Claude.

**Implementation Goal:** Users can paste/attach images and drag files from the file tree into chat.
**Based On:** TRA-WO-032-multimodal-input.md

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/claude/ClaudeInputArea.tsx
    changes: Paste handler, attach button, drop handlers, thumbnail preview
    risk: MEDIUM

  - path: docker/claude-container/server.ts
    changes: Multi-part prompt construction (text + image)
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Pass attachments in HTTP body
    risk: LOW

Supporting_Files:
  - src/renderer/stores/useClaudeStore.ts — attachments in sendMessage
  - src/renderer/components/ide/claude/ClaudePanel.tsx — drag event forwarding
  - src/main/ipc/channels.ts — update query signature for attachments
```

---

## IMPLEMENTATION APPROACH

### Step 1: T-009 — Image Input (5h)
- [ ] Add paste handler to ClaudeInputArea detecting image clipboard data
- [ ] Convert images to base64, store as attachment array in state
- [ ] Add paperclip attach button with file picker (accept: image/*)
- [ ] Show image thumbnails below input
- [ ] Include attachments in sendMessage body
- [ ] Service passes attachments through HTTP body
- [ ] Server constructs multi-part prompt for SDK
- [ ] Validate max 5MB per image

### Step 2: T-017 — Drag and Drop Files (3h, after T-009)
- [ ] Add onDragOver/onDrop handlers to input area
- [ ] Detect file paths from file tree drag data or OS drops
- [ ] Text files: read via IPC, prepend as fenced code block
- [ ] Images: reuse T-009 base64 attachment flow
- [ ] Visual drop zone indicator

---

## SUCCESS CRITERIA

- [ ] Pasting an image shows thumbnail and sends to Claude
- [ ] Attach button opens file picker for images
- [ ] Dragging a text file prepends its content as code block
- [ ] Dragging an image attaches it
- [ ] GAP-011, GAP-012 checked off

---

## CONSTRAINTS & GUIDELINES

- **Do NOT run tests** — LUKA runs tests
- **Do NOT perform git operations** — LUKA handles git
- **Depends on WO-028** (rich streaming)
- Max image size: 5MB, validate before encoding

---

## ✅ AFTER COMPLETION

**Step 1:** Create completion report in `trinity/reports/`
**Step 2:** `mv trinity/work-orders/WO-032-multimodal-input.md trinity/sessions/`
**Step 3:** Update CLAUDE-BOX-GAPS.md — check off GAP-011, GAP-012
