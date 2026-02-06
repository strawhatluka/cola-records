# ORCHESTRATOR WORK ORDER #025
## Type: IMPLEMENTATION
## Checkpoints — Store & Auto-Checkpoint Integration

---

## MISSION OBJECTIVE

Implement the Zustand store state and actions for checkpoints and branching, integrate auto-checkpoint creation into the Claude container streaming pipeline, add conversation ID tracking in the container service, and implement the full rewind and fork flows end-to-end from store through IPC to backend.

**Implementation Goal:** Complete store integration and streaming pipeline hooks — checkpoints are created automatically during tool use, and users can rewind/fork via store actions that call the WO-024 backend.
**Based On:** TRA Plan `trinity/sessions/TRA-WO-024-checkpoints-forking-plan.md` Phase 2
**Depends On:** WO-024 (database schema, CRUD, CheckpointService, IPC channels, fork logic)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/stores/useClaudeStore.ts
    changes: Add checkpoint/branch state fields + 7 new actions (loadCheckpoints, createManualCheckpoint, rewindToCheckpoint, deleteCheckpoint, forkFromCheckpoint, loadBranches, switchBranch)
    risk: MEDIUM

  - path: src/main/services/claude-container.service.ts
    changes: Add auto-checkpoint hook in handleNdjsonEvent for Edit/Write tool_use events, track currentConversationId and currentMessageIndex, add extractAffectedFiles helper
    risk: HIGH

  - path: src/main/services/checkpoint.service.ts
    changes: Expose createAutoCheckpoint convenience method for container service integration
    risk: LOW
```

---

## TASK BREAKDOWN

### T6: Store Checkpoint & Branch State
**Complexity:** 5
**Files Modified:** `src/renderer/stores/useClaudeStore.ts`

**New State Fields:**
```typescript
// Checkpoint state
checkpoints: ClaudeCheckpoint[];
checkpointLoading: boolean;

// Branch state
branches: ClaudeConversation[];  // conversations sharing a parent lineage
currentBranchId: string | null;
```

**New Actions (7):**
```typescript
// Checkpoint actions
loadCheckpoints: () => Promise<void>;
createManualCheckpoint: (label: string) => Promise<void>;
rewindToCheckpoint: (checkpointId: string) => Promise<void>;
deleteCheckpoint: (checkpointId: string) => Promise<void>;

// Branch actions
forkFromCheckpoint: (checkpointId: string, label: string) => Promise<void>;
loadBranches: () => Promise<void>;
switchBranch: (conversationId: string) => Promise<void>;
```

**Integration Points:**
- `loadCheckpoints` called in `switchConversation` and after any checkpoint mutation
- `loadBranches` called in `switchConversation` and after fork
- `clearMessages` and store reset must clear checkpoint/branch state
- `switchBranch` reuses existing `switchConversation` logic

**Acceptance Criteria:**
- [ ] All 4 state fields added with defaults (empty array, false, null)
- [ ] All 7 actions implemented
- [ ] `loadCheckpoints` fetches from `claude:checkpoints:list` IPC
- [ ] State cleared on `clearMessages()` and store reset
- [ ] Checkpoint loading state toggled correctly
- [ ] Actions handle errors gracefully (set error state, don't crash)

### T7: Auto-Checkpoint in Streaming Pipeline
**Complexity:** 7
**Depends on:** T3 from WO-024 (CheckpointService)
**Files Modified:** `src/main/services/claude-container.service.ts`, `src/main/services/checkpoint.service.ts`

**Design:**
When a `tool_use` event arrives in `handleNdjsonEvent` for file-modifying tools (Edit, Write), the service creates an auto-checkpoint BEFORE the tool executes, capturing the current file state.

**Changes to claude-container.service.ts:**
```typescript
// In handleNdjsonEvent, tool_use case:
case 'tool_use':
  // Auto-checkpoint for file-modifying tools
  if (['Edit', 'Write'].includes(parsed.name) && this.currentConversationId) {
    const files = this.extractAffectedFiles(parsed.name, parsed.input);
    if (files.length > 0) {
      // Don't await — fire and forget to avoid blocking stream
      this.checkpointService.createCheckpoint(
        this.currentConversationId,
        parsed.id || `msg_${Date.now()}`,
        `Before ${parsed.name} ${path.basename(files[0])}`,
        'auto',
        this.currentMessageIndex,
        files
      ).catch(err => console.error('Auto-checkpoint failed:', err));
    }
  }
  // ... existing tool_use handling continues
```

**New Helper Method:**
```typescript
private extractAffectedFiles(toolName: string, input: Record<string, unknown>): string[] {
  switch (toolName) {
    case 'Edit': return input.file_path ? [String(input.file_path)] : [];
    case 'Write': return input.file_path ? [String(input.file_path)] : [];
    default: return [];
  }
}
```

**Acceptance Criteria:**
- [ ] Auto-checkpoints created before Edit and Write tool operations
- [ ] Checkpoint captures current file state BEFORE modification
- [ ] No checkpoint for Read, Glob, Bash (non-file-modifying tools)
- [ ] Does not block the streaming pipeline (fire-and-forget with error catch)
- [ ] Labels use format: "Before {ToolName} {basename}"
- [ ] Requires valid currentConversationId to checkpoint

### T8: Conversation ID Tracking in Container Service
**Complexity:** 4
**Depends on:** T7
**Files Modified:** `src/main/services/claude-container.service.ts`

**New Private State:**
```typescript
private currentConversationId: string | null = null;
private currentMessageIndex: number = 0;
```

**Changes:**
- `query()` method accepts `conversationId` parameter, sets `this.currentConversationId`
- Message index incremented as messages arrive in the NDJSON stream (on each `text`, `tool_use`, `tool_result` event)
- Reset `currentMessageIndex` to 0 at start of each query
- Clear `currentConversationId` when query completes or errors

**IPC Channel Update:**
- Update `claude:query` channel signature in channels.ts to include optional `conversationId` and `messageIndex` parameters
- Update the IPC handler in index.ts to pass these through

**Acceptance Criteria:**
- [ ] Service tracks which conversation it's operating on
- [ ] Message index incremented accurately during streaming
- [ ] currentConversationId available for auto-checkpoint creation (T7)
- [ ] State reset between queries
- [ ] Store passes conversationId when calling claude:query

### T9: Rewind Checkpoint Action — Full Flow
**Complexity:** 5
**Depends on:** T6, T4 from WO-024
**Files Modified:** `src/renderer/stores/useClaudeStore.ts`

**`rewindToCheckpoint` Implementation:**
```typescript
rewindToCheckpoint: async (checkpointId: string) => {
  const { currentConversationId, messages } = get();
  if (!currentConversationId) return;

  set({ checkpointLoading: true });
  try {
    // 1. Restore files via backend
    const result = await ipc.invoke('claude:checkpoints:restore', checkpointId);

    // 2. Truncate messages to checkpoint point
    const truncatedMessages = messages.slice(0, result.messageIndex);
    set({ messages: truncatedMessages });

    // 3. Save truncated conversation
    await ipc.invoke('claude:conversation:save', currentConversationId, truncatedMessages);

    // 4. Delete checkpoints after this point
    // (checkpoints after the rewind point are no longer valid)

    // 5. Reload checkpoints
    const checkpoints = await ipc.invoke('claude:checkpoints:list', currentConversationId);
    set({ checkpoints, checkpointLoading: false });
  } catch (error) {
    set({ error: String(error), checkpointLoading: false });
  }
}
```

**Edge Cases:**
- File no longer exists (deleted after checkpoint) → backend recreates from snapshot
- Checkpoint from different conversation → reject (backend validates)
- Partial restore failure → backend logs which files restored, store shows error

**Acceptance Criteria:**
- [ ] Full rewind flow works: restore files → truncate messages → save → reload checkpoints
- [ ] Files restored on disk via backend
- [ ] Messages truncated in store to checkpoint's messageIndex
- [ ] Conversation saved after rewind
- [ ] Checkpoints reloaded after rewind
- [ ] Error handling for failures
- [ ] Loading state managed correctly

### T10: Fork Checkpoint Action — Full Flow
**Complexity:** 7
**Depends on:** T6, T4 + T5 from WO-024
**Files Modified:** `src/renderer/stores/useClaudeStore.ts`

**`forkFromCheckpoint` Implementation:**
```typescript
forkFromCheckpoint: async (checkpointId: string, label: string) => {
  const { currentConversationId } = get();
  if (!currentConversationId) return;

  set({ checkpointLoading: true });
  try {
    // 1. Create forked conversation via backend
    const newConversation = await ipc.invoke(
      'claude:conversation:fork',
      currentConversationId,
      checkpointId,
      label
    );

    // 2. Add to conversations list
    const conversations = get().conversations;
    set({ conversations: [newConversation, ...conversations] });

    // 3. Switch to the forked conversation
    // (reuse switchConversation logic — loads messages, checkpoints, branches)
    await get().switchConversation(newConversation.id);

    // 4. Reload branches for the parent lineage
    await get().loadBranches();

    set({ checkpointLoading: false });
  } catch (error) {
    set({ error: String(error), checkpointLoading: false });
  }
}
```

**`loadBranches` Implementation:**
```typescript
loadBranches: async () => {
  const { currentConversationId, conversations } = get();
  if (!currentConversationId) return;

  // Find all conversations in the same branch lineage
  // (parent, siblings, children of current conversation)
  const current = conversations.find(c => c.id === currentConversationId);
  if (!current) return;

  const rootId = current.parentConversationId || current.id;
  const branches = conversations.filter(
    c => c.id === rootId || c.parentConversationId === rootId
  );

  set({ branches, currentBranchId: currentConversationId });
}
```

**`switchBranch` Implementation:**
```typescript
switchBranch: async (conversationId: string) => {
  await get().switchConversation(conversationId);
  await get().loadBranches();
}
```

**Acceptance Criteria:**
- [ ] Fork creates new conversation from checkpoint point via IPC
- [ ] Original conversation remains untouched
- [ ] User automatically switched to forked conversation
- [ ] Conversations list updated with new fork
- [ ] Branch relationships tracked and loadable
- [ ] switchBranch switches conversation and reloads branch tree
- [ ] Error handling for failures

---

## IMPLEMENTATION APPROACH

### Step 1: Store State (T6)
- [ ] Add checkpoint and branch state fields to useClaudeStore
- [ ] Add all 7 action stubs (empty implementations)
- [ ] Wire loadCheckpoints into switchConversation
- [ ] Wire state clearing into clearMessages and reset
- [ ] Implement loadCheckpoints, deleteCheckpoint, createManualCheckpoint

### Step 2: Conversation Tracking (T8)
- [ ] Add currentConversationId and currentMessageIndex to container service
- [ ] Update query() to accept and store conversationId
- [ ] Increment messageIndex in NDJSON event handler
- [ ] Update IPC channel signature if needed
- [ ] Update store to pass conversationId when querying

### Step 3: Auto-Checkpoint Hook (T7)
- [ ] Add extractAffectedFiles helper to container service
- [ ] Add auto-checkpoint logic in handleNdjsonEvent tool_use case
- [ ] Import and wire checkpointService in container service
- [ ] Fire-and-forget pattern (no await, catch errors)

### Step 4: Rewind Flow (T9)
- [ ] Implement full rewindToCheckpoint action
- [ ] Handle message truncation and conversation save
- [ ] Reload checkpoints after rewind
- [ ] Error handling and loading state

### Step 5: Fork Flow (T10)
- [ ] Implement forkFromCheckpoint action
- [ ] Implement loadBranches action
- [ ] Implement switchBranch action
- [ ] Wire branch loading into conversation switch

### Step 6: Validation
- [ ] Auto-checkpoints created during tool_use streaming
- [ ] Rewind restores files and truncates conversation
- [ ] Fork creates independent conversation copy
- [ ] Branch switching works correctly
- [ ] All existing functionality unaffected

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE2-CHECKPOINTS-STORE-INTEGRATION-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. Store State Fields Added
3. Store Actions Implemented (7 actions with descriptions)
4. Auto-Checkpoint Pipeline Integration
5. Container Service Changes
6. Rewind Flow Description
7. Fork Flow Description
8. Files Modified List

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-025-checkpoints-store-auto-checkpoint.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-025-checkpoints-store-auto-checkpoint.md`

---

## SUCCESS CRITERIA

- [ ] All 5 tasks (T6-T10) implemented
- [ ] 4 new state fields in store
- [ ] 7 new store actions functional
- [ ] Auto-checkpoints created during Edit/Write tool_use events
- [ ] Container service tracks conversation ID and message index
- [ ] Rewind flow: restore files → truncate messages → save → reload
- [ ] Fork flow: create conversation → switch → load branches
- [ ] No regressions to existing streaming or conversation functionality
- [ ] All tests pass (LUKA runs final verification)

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Run tests (LUKA runs tests)
- [ ] Use sed for file editing
- [ ] Perform ANY git operations
- [ ] Run npm install
- [ ] Modify UI components (that's WO-026)
- [ ] Modify database schema (that's WO-024)

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially (not in parallel)
- [ ] Follow existing Zustand store patterns (get/set, individual selectors)
- [ ] Follow existing container service patterns (NDJSON handling, event emission)
- [ ] Use fire-and-forget for non-blocking auto-checkpoints
- [ ] Handle errors gracefully in all async actions

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** HIGH
**Risk Factors:**
- Auto-checkpoint in streaming pipeline must not block or slow message delivery
- Rewind flow modifies both filesystem and conversation state — partial failures possible
- Fork flow involves multiple IPC calls — need atomicity at backend level
- Container service state (conversationId, messageIndex) must stay synchronized

**Mitigation:**
- Fire-and-forget pattern for auto-checkpoints with error catching
- Backend checkpoint restore is transactional (from WO-024)
- Backend fork is transactional (from WO-024)
- Clear container state between queries, validate before use

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
