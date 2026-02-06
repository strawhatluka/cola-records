# ORCHESTRATOR WORK ORDER #022
## Type: IMPLEMENTATION
## Claude Box — Slash Commands & Context Management

---

## MISSION OBJECTIVE

Implement 7 features covering new slash commands (/compact, /model, /config), extended thinking toggle UI, context compaction backend, and additional keyboard shortcuts. This phase closes GAP-01, 02, 03, 08-UI, 14, 15, 23.

**Implementation Goal:** Full slash command parity with VS Code extension, context compaction capability, model display in context bar, thinking toggle, and new keyboard shortcuts.
**Based On:** JUNO Gap Analysis `trinity/reports/GAP-ANALYSIS-ClaudeBox-vs-Extension-2026-01-31.md`, TRA Plan `trinity/sessions/TRA-claude-box-gap-closure-plan.md`
**Depends On:** WO-020 (selectedModel state T3, extendedThinkingEnabled state T4)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/claude/ClaudeSlashCommands.tsx
    changes: Add /compact, /model, /config to SLASH_COMMANDS array
    risk: LOW

  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    changes: Handle compact, model, config in slash command handler; add Cmd+N and Cmd+Esc keyboard shortcuts
    risk: MEDIUM

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Add compactConversation action
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Add compact() method for context summarization
    risk: HIGH

  - path: src/main/ipc/channels.ts
    changes: Add claude:compact channel
    risk: LOW

  - path: src/main/index.ts
    changes: Add claude:compact IPC handler
    risk: LOW

Supporting_Files:
  - src/renderer/components/ide/claude/ClaudeContextBar.tsx — Display model name, add thinking toggle button
  - tests/renderer/components/ide/claude/ClaudeSlashCommands.test.tsx — (if exists) update for new commands
  - tests/renderer/components/ide/claude/ClaudePanel.test.tsx — Test new shortcuts and slash commands
```

---

## TASK BREAKDOWN

### T15: `/compact` Slash Command (GAP-01)
**Complexity:** 6
**Depends on:** T19 (backend compact endpoint)
**Files:** `ClaudeSlashCommands.tsx`, `ClaudePanel.tsx`, `useClaudeStore.ts`
**Changes:**
- Add to SLASH_COMMANDS: `{ name: 'compact', description: 'Compact context window', icon: <Minimize2 size={14} /> }`
- In ClaudePanel handleSlashCommand, case `'compact'`: call `compactConversation()` from store
- In store, add `compactConversation` action:
  1. Collect all messages as conversation text
  2. Call `ipc.invoke('claude:compact', conversationText)`
  3. Replace messages with a single system message containing the summary
  4. Reset tokenUsage and contextPercent based on new context size

**Acceptance Criteria:**
- [ ] `/compact` appears in slash menu with Minimize2 icon
- [ ] Selecting it triggers context compaction via IPC
- [ ] Messages replaced with summary system message
- [ ] Token usage / context percent reduced after compaction

### T16: `/model` Slash Command + Model Selector UI (GAP-02)
**Complexity:** 4
**Depends on:** T3 from WO-020 (selectedModel in store)
**Files:** `ClaudeSlashCommands.tsx`, `ClaudePanel.tsx`, `ClaudeContextBar.tsx`
**Changes:**
- Add to SLASH_COMMANDS: `{ name: 'model', description: 'Switch Claude model', icon: <Cpu size={14} /> }`
- In ClaudePanel handleSlashCommand, case `'model'`: cycle through models: sonnet → opus → haiku → sonnet, call `setModel()` from store
- In ClaudeContextBar: display model name label next to context percent, e.g., "Sonnet · 32%"
- Model label uses `claude.textMuted` style, clicking it cycles models too

**Acceptance Criteria:**
- [ ] `/model` appears in slash menu
- [ ] Selecting it cycles Sonnet → Opus → Haiku → Sonnet
- [ ] Current model displayed in context bar
- [ ] Clicking model label in context bar also cycles

### T17: `/config` Slash Command (GAP-03)
**Complexity:** 3
**Files:** `ClaudeSlashCommands.tsx`, `ClaudePanel.tsx`
**Changes:**
- Add to SLASH_COMMANDS: `{ name: 'config', description: 'Open settings', icon: <Settings size={14} /> }`
- In ClaudePanel handleSlashCommand, case `'config'`: emit navigation event or use existing routing to open Settings screen
- If no navigation system available, inject a system message with settings link/instructions

**Acceptance Criteria:**
- [ ] `/config` appears in slash menu
- [ ] Selecting it opens settings or displays settings access instructions

### T18: Extended Thinking Toggle UI (GAP-08 UI)
**Complexity:** 2
**Depends on:** T4 from WO-020 (extendedThinkingEnabled in store)
**Files:** `ClaudeContextBar.tsx`
**Changes:**
- Add Brain icon button to context bar (between mode selector and context percent)
- Connect to `useClaudeStore(s => s.extendedThinkingEnabled)` and `useClaudeStore(s => s.toggleExtendedThinking)`
- When enabled: Brain icon in orange (`claude.accent`), tooltip "Extended thinking: ON"
- When disabled: Brain icon in muted (`claude.textMuted`), tooltip "Extended thinking: OFF"

**Acceptance Criteria:**
- [ ] Brain icon toggle visible in context bar
- [ ] Orange when enabled, muted when disabled
- [ ] Clicking toggles store value
- [ ] Tooltip shows current state

### T19: Context Compaction Backend (GAP-23)
**Complexity:** 6
**Files:** `channels.ts`, `claude-container.service.ts`, `index.ts`
**Changes:**
- Add `'claude:compact': (conversationText: string) => ClaudeQueryResponse` to IpcChannels
- In service, add `compact(conversationText: string)` method:
  - Sends POST to container with `{ prompt: "Summarize this conversation concisely, preserving key context and decisions:\n\n" + conversationText, compact: true }`
  - Returns the summarized text
- Add IPC handler in index.ts

**Acceptance Criteria:**
- [ ] `claude:compact` channel defined and handled
- [ ] Container receives compaction request
- [ ] Returns summarized conversation text
- [ ] Frontend can use response to replace messages

### T20: `Cmd+N` / `Ctrl+N` Keyboard Shortcut (GAP-14)
**Complexity:** 1
**Files:** `ClaudePanel.tsx`
**Changes:**
- In existing keyboard handler `useEffect`, add case:
  ```
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newConversation();
    setCostMessages([]);
  }
  ```

**Acceptance Criteria:**
- [ ] `Ctrl+N` / `Cmd+N` creates new conversation
- [ ] Prevents default browser behavior (new window)

### T21: `Cmd+Esc` / `Ctrl+Esc` Toggle Focus Shortcut (GAP-15)
**Complexity:** 2
**Files:** `ClaudePanel.tsx`
**Changes:**
- In keyboard handler, add case for Escape with Ctrl/Cmd modifier:
  ```
  if ((e.ctrlKey || e.metaKey) && e.key === 'Escape') {
    e.preventDefault();
    // Toggle: if input focused, blur; if not, focus input
    if (document.activeElement === inputRef.current) {
      inputRef.current?.blur();
    } else {
      inputRef.current?.focus();
    }
  }
  ```

**Acceptance Criteria:**
- [ ] `Ctrl+Esc` / `Cmd+Esc` toggles focus on Claude input
- [ ] If focused, blurs; if not focused, focuses

---

## IMPLEMENTATION APPROACH

### Step 1: Backend Compaction (T19)
- [ ] Add claude:compact channel
- [ ] Implement compact() method in service
- [ ] Add IPC handler
- [ ] Test endpoint works

### Step 2: Slash Commands (T15, T16, T17)
- [ ] Add 3 new commands to SLASH_COMMANDS array
- [ ] Implement handlers in ClaudePanel
- [ ] Add compactConversation action to store
- [ ] Update context bar with model display

### Step 3: Thinking Toggle UI (T18)
- [ ] Add Brain toggle to ClaudeContextBar
- [ ] Wire to store toggle action

### Step 4: Keyboard Shortcuts (T20, T21)
- [ ] Add Cmd+N handler
- [ ] Add Cmd+Esc handler

### Step 5: Validation
- [ ] All slash commands appear and function
- [ ] Context bar shows model + thinking toggle
- [ ] Keyboard shortcuts work
- [ ] All tests pass

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE3-SLASH-COMMANDS-CONTEXT-COMPLETE.md`
**Location:** `trinity/sessions/`

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-022-claude-box-slash-commands-context.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-022-claude-box-slash-commands-context.md`

---

## SUCCESS CRITERIA

- [ ] All 7 tasks (T15-T21) implemented
- [ ] `/compact`, `/model`, `/config` in slash menu and functional
- [ ] Context bar shows model name and thinking toggle
- [ ] Compaction reduces context window usage
- [ ] Cmd+N and Cmd+Esc shortcuts work
- [ ] All tests pass

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially
- [ ] Follow existing Claude Orange theme and code patterns

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Context compaction relies on container summarization quality
- Cmd+N may conflict with Electron/browser default shortcuts
- Model cycling UX needs to be intuitive

**Mitigation:**
- Compaction is user-initiated (not automatic), so quality issues are recoverable
- preventDefault() on keyboard handlers
- Model displayed in context bar provides clear feedback

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
