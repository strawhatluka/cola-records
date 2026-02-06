# ORCHESTRATOR WORK ORDER #026
## Type: IMPLEMENTATION
## Checkpoints — UI Components & Panel Integration

---

## MISSION OBJECTIVE

Implement the 3 UI components for the checkpoint system: a ClaudeCheckpoints timeline component with rewind/fork/delete buttons, a ClaudeBranchSwitcher tree view for navigating conversation branches, and full ClaudePanel integration including checkpoint header button, branch switcher, rewind confirmation dialog, and a rewind-to button on completed Edit/Write tool calls.

**Implementation Goal:** Complete user-facing checkpoint and branching UI — users can see a timeline of checkpoints, rewind to any point, fork conversations, and switch between branches.
**Based On:** TRA Plan `trinity/sessions/TRA-WO-024-checkpoints-forking-plan.md` Phase 3
**Depends On:** WO-024 (backend), WO-025 (store state + actions)

---

## IMPLEMENTATION SCOPE

### Files to Create/Modify
```yaml
New_Files:
  - path: src/renderer/components/ide/claude/ClaudeCheckpoints.tsx
    changes: Vertical timeline component with checkpoint dots, labels, rewind/fork/delete buttons, manual checkpoint creation
    risk: MEDIUM

  - path: src/renderer/components/ide/claude/ClaudeBranchSwitcher.tsx
    changes: Tree view of parent-child conversations with active branch highlighting and click-to-switch
    risk: MEDIUM

Modified_Files:
  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    changes: Add checkpoint timeline toggle button in header, branch switcher button, rewind confirmation dialog, checkpoint/branch overlay panels, wire all store actions
    risk: HIGH

  - path: src/renderer/components/ide/claude/ClaudeToolCall.tsx
    changes: Add rewind-to button on completed Edit/Write tool calls (hover-visible)
    risk: LOW
```

---

## TASK BREAKDOWN

### T11: ClaudeCheckpoints Component — Timeline UI
**Complexity:** 7
**Depends on:** T6 from WO-025 (store checkpoint state)
**Files NEW:** `src/renderer/components/ide/claude/ClaudeCheckpoints.tsx`

**Component Props:**
```typescript
interface ClaudeCheckpointsProps {
  checkpoints: ClaudeCheckpoint[];
  onRewind: (checkpointId: string) => void;
  onFork: (checkpointId: string) => void;
  onDelete: (checkpointId: string) => void;
  onCreateManual: (label: string) => void;
  loading: boolean;
}
```

**UI Layout:**
```
┌─ Checkpoints ──────────────────────────┐
│  [+ Manual Checkpoint]                  │
│                                         │
│  ● Before Edit src/index.ts      [↩][⑂]│
│  │  3 files · 2m ago                    │
│  │                                      │
│  ● Before Write src/new-file.ts  [↩][⑂]│
│  │  1 file · 5m ago                     │
│  │                                      │
│  ● Before Edit package.json      [↩][⑂]│
│    2 files · 8m ago                     │
│                                         │
│  [↩] = Rewind  [⑂] = Fork              │
└─────────────────────────────────────────┘
```

**Features:**
- Vertical timeline with Claude Orange accent dots and connector lines
- Each checkpoint shows: label, file count, relative time (using `formatDistanceToNow` pattern or manual calculation)
- Rewind button (RotateCcw icon from lucide-react) — calls onRewind
- Fork button (GitBranch icon) — calls onFork
- Delete button (X icon) — appears on hover only, calls onDelete
- "Manual Checkpoint" button at top (Plus icon) — prompts for label via inline input
- Auto-checkpoints labeled: "Before {ToolName} {filename}"
- Manual checkpoints labeled with user-provided text
- Scrollable container with max-height
- Empty state: "No checkpoints yet. Checkpoints are created automatically when Claude edits files."

**Styling (Claude Orange theme):**
- Timeline dots: `bg-[#d97757]`
- Connector lines: `bg-[#706f6a]` (dim)
- Labels: `text-[#faf9f5]` (warm white)
- Metadata (file count, time): `text-[#b0aea5]` (muted)
- Buttons: `text-[#b0aea5]` hover `text-[#d97757]`
- Background: `bg-[#1e1e1d]` (surface)
- Loading state: skeleton pulse animation

**Acceptance Criteria:**
- [ ] Timeline renders all checkpoints in chronological order (newest first)
- [ ] Rewind button visible, triggers onRewind callback
- [ ] Fork button visible, triggers onFork callback
- [ ] Delete button appears on hover only
- [ ] Manual checkpoint creation with inline label input
- [ ] File count and relative time displayed per checkpoint
- [ ] Claude Orange styling throughout
- [ ] Empty state message when no checkpoints
- [ ] Scrollable for many checkpoints
- [ ] Accessible: aria-labels on all interactive elements

### T12: ClaudeBranchSwitcher Component
**Complexity:** 5
**Depends on:** T6 and T10 from WO-025 (branch state)
**Files NEW:** `src/renderer/components/ide/claude/ClaudeBranchSwitcher.tsx`

**Component Props:**
```typescript
interface ClaudeBranchSwitcherProps {
  branches: ClaudeConversation[];
  currentBranchId: string | null;
  onSwitchBranch: (conversationId: string) => void;
}
```

**UI Layout:**
```
┌─ Branches ─────────────────────────────┐
│  ● Main conversation            [active]│
│  ├─ Fork: "Try different approach"      │
│  └─ Fork: "Alternative fix"     [active]│
└─────────────────────────────────────────┘
```

**Features:**
- Tree view: parent conversation at top, child forks indented below
- Active branch highlighted with orange accent dot and bold text
- Click any branch to switch (calls onSwitchBranch)
- Each branch shows: label (or title), message count
- Compact display — overlay/dropdown style
- Empty state: "No branches. Fork from a checkpoint to create one."

**Styling:**
- Active branch: `text-[#faf9f5]` with `bg-[#d97757]/20` background
- Inactive branches: `text-[#b0aea5]`
- Tree connector lines: `border-[#706f6a]`
- Hover: `bg-[#2a2a28]` (slightly lighter surface)

**Acceptance Criteria:**
- [ ] Renders parent → child branch tree
- [ ] Active branch highlighted with orange accent
- [ ] Click switches branch via callback
- [ ] Shows branch labels and message counts
- [ ] Claude Orange styling
- [ ] Empty state when no branches
- [ ] Accessible: aria-current on active branch

### T13: ClaudePanel Integration — Checkpoints + Branches
**Complexity:** 6
**Depends on:** T11, T12
**Files Modified:** `src/renderer/components/ide/claude/ClaudePanel.tsx`

**Header Button Changes:**
```
[+ New] [Clock History] [GitBranch Branches] [RotateCcw Checkpoints] [Trash Clear]
```

**New State in Panel:**
```typescript
const [showCheckpoints, setShowCheckpoints] = useState(false);
const [showBranches, setShowBranches] = useState(false);
const [rewindConfirm, setRewindConfirm] = useState<{ checkpointId: string; label: string; fileCount: number; messageCount: number } | null>(null);
const [forkPrompt, setForkPrompt] = useState<string | null>(null);  // checkpointId when prompting for fork label
```

**New Store Selectors:**
```typescript
const checkpoints = useClaudeStore(s => s.checkpoints);
const checkpointLoading = useClaudeStore(s => s.checkpointLoading);
const branches = useClaudeStore(s => s.branches);
const currentBranchId = useClaudeStore(s => s.currentBranchId);
const rewindToCheckpoint = useClaudeStore(s => s.rewindToCheckpoint);
const forkFromCheckpoint = useClaudeStore(s => s.forkFromCheckpoint);
const deleteCheckpoint = useClaudeStore(s => s.deleteCheckpoint);
const createManualCheckpoint = useClaudeStore(s => s.createManualCheckpoint);
const switchBranch = useClaudeStore(s => s.switchBranch);
const loadCheckpoints = useClaudeStore(s => s.loadCheckpoints);
```

**Rewind Confirmation Dialog:**
```
┌─ Rewind to Checkpoint ─────────────────┐
│                                         │
│  Rewind to: "Before Edit src/index.ts"  │
│                                         │
│  This will:                             │
│  • Restore 3 files to their state at    │
│    this checkpoint                      │
│  • Remove 12 messages after this point  │
│                                         │
│  This action cannot be undone.          │
│                                         │
│           [Cancel]  [Rewind]            │
└─────────────────────────────────────────┘
```

**Fork Label Prompt (inline):**
- When user clicks fork on a checkpoint, show inline input asking for branch label
- Default label: "Fork from {checkpoint.label}"
- Enter confirms, Escape cancels

**Overlay Panels:**
- Checkpoints and Branches render as overlays (similar to ClaudeConversationHistory)
- Only one overlay visible at a time (checkpoints, branches, or history)
- Click outside closes overlay

**Acceptance Criteria:**
- [ ] RotateCcw (Checkpoints) button in header toggles checkpoint timeline overlay
- [ ] GitBranch (Branches) button in header toggles branch switcher overlay
- [ ] Only one overlay visible at a time
- [ ] Rewind confirmation dialog shown before executing rewind
- [ ] Fork prompts for branch label before executing
- [ ] Cancel dismisses dialogs without action
- [ ] All checkpoint/branch actions connected to store
- [ ] Checkpoints loaded when conversation changes
- [ ] Click outside closes overlays

### T14: ClaudeToolCall — Rewind-to Button
**Complexity:** 4
**Depends on:** T6 from WO-025 (checkpoint data)
**Files Modified:** `src/renderer/components/ide/claude/ClaudeToolCall.tsx`

**Changes:**
- For tool calls with `toolName` = Edit or Write, and status = complete (has tool_result), show a small rewind button
- Button appears on hover only (alongside existing expand/collapse)
- New prop: `onRewindToMessage?: (messageId: string) => void`
- Clicking calls onRewindToMessage with the tool call's message ID
- Parent (ClaudeMessage/ClaudePanel) maps messageId to the associated checkpoint and triggers rewind

**UI:**
```
┌─ Edit src/index.ts ──── ✓ ─── [↩] ──────┐
│  { "file_path": "src/index.ts", ... }     │
└───────────────────────────────────────────┘
                                  ^ hover-only rewind button
```

**Styling:**
- Button: `text-[#b0aea5]` hover `text-[#d97757]` (muted → orange)
- Icon: RotateCcw size 12
- Tooltip: "Rewind to before this edit"
- Only visible on hover of the tool call container

**Acceptance Criteria:**
- [ ] Rewind button on completed Edit/Write tool calls
- [ ] Only visible on hover, non-intrusive
- [ ] Not shown for Read/Glob/Bash/other non-modifying tools
- [ ] Calls onRewindToMessage callback with message ID
- [ ] Tooltip explains the action
- [ ] Claude Orange accent on hover

---

## IMPLEMENTATION APPROACH

### Step 1: ClaudeCheckpoints Component (T11)
- [ ] Create ClaudeCheckpoints.tsx
- [ ] Implement vertical timeline layout with dots and connector lines
- [ ] Add rewind, fork, delete buttons per checkpoint
- [ ] Add manual checkpoint creation with inline input
- [ ] Add empty state and loading skeleton
- [ ] Apply Claude Orange styling

### Step 2: ClaudeBranchSwitcher Component (T12) — parallel with Step 1
- [ ] Create ClaudeBranchSwitcher.tsx
- [ ] Implement tree view with parent → child indentation
- [ ] Highlight active branch
- [ ] Add click-to-switch behavior
- [ ] Add empty state

### Step 3: ClaudeToolCall Rewind Button (T14) — parallel with Steps 1 & 2
- [ ] Add onRewindToMessage prop to ClaudeToolCall
- [ ] Conditionally render rewind button for Edit/Write with complete status
- [ ] Hover-only visibility
- [ ] Tooltip

### Step 4: ClaudePanel Integration (T13) — after Steps 1, 2, 3
- [ ] Add checkpoint and branch header buttons
- [ ] Add overlay state management (only one at a time)
- [ ] Mount ClaudeCheckpoints in overlay
- [ ] Mount ClaudeBranchSwitcher in overlay
- [ ] Implement rewind confirmation dialog
- [ ] Implement fork label prompt
- [ ] Wire all store selectors and actions
- [ ] Load checkpoints on conversation change
- [ ] Wire ClaudeToolCall rewind button to checkpoint lookup

### Step 5: Validation
- [ ] Checkpoint timeline shows auto-created checkpoints
- [ ] Rewind confirms then restores
- [ ] Fork prompts for label then creates branch
- [ ] Branch switcher shows tree and switches
- [ ] Tool call rewind button triggers correct checkpoint
- [ ] All existing panel functionality unaffected

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PHASE3-CHECKPOINTS-UI-PANEL-COMPLETE.md`
**Location:** `trinity/sessions/`

### Required Sections
1. Executive Summary
2. New Components Created (with props interfaces)
3. ClaudePanel Integration Changes
4. ClaudeToolCall Changes
5. UI/UX Decisions Made
6. Files Created/Modified List
7. Screenshots or ASCII Layout Descriptions

---

## AFTER COMPLETION

**Step 1: Create Completion Report**
   - [ ] Created in `trinity/sessions/`

**Step 2: MOVE THIS WORK ORDER FILE**
   ```bash
   mv trinity/work-orders/WO-026-checkpoints-ui-panel-integration.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] Work order in `trinity/sessions/WO-026-checkpoints-ui-panel-integration.md`

---

## SUCCESS CRITERIA

- [ ] All 4 tasks (T11-T14) implemented
- [ ] ClaudeCheckpoints timeline component with rewind/fork/delete/manual creation
- [ ] ClaudeBranchSwitcher tree view with active highlighting and switching
- [ ] ClaudePanel header has checkpoint and branch buttons
- [ ] Rewind confirmation dialog prevents accidental rewinds
- [ ] Fork prompts for label before creating branch
- [ ] Only one overlay visible at a time
- [ ] ClaudeToolCall has hover rewind button on Edit/Write
- [ ] Claude Orange styling on all new UI
- [ ] Accessibility: aria-labels on all interactive elements
- [ ] All existing panel features still work (regression-free)
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
- [ ] Modify backend services (that's WO-024)
- [ ] Modify store (that's WO-025)
- [ ] Add new npm dependencies (use lucide-react icons already in project)

### DO:
- [ ] Read files before editing
- [ ] Edit files sequentially (not in parallel)
- [ ] Follow existing component patterns (ClaudeConversationHistory for overlay, ClaudeContextBar for header buttons)
- [ ] Use Claude Orange brand colors consistently
- [ ] Use lucide-react icons (RotateCcw, GitBranch, Plus, X, etc.)
- [ ] Add aria-labels for accessibility

---

## SCOPE & RISK ASSESSMENT

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Overlay management complexity (3 overlays: history, checkpoints, branches)
- Rewind confirmation dialog UX needs to be clear about destructive action
- ClaudeToolCall rewind button requires mapping message ID → checkpoint ID
- Branch tree rendering for deep hierarchies

**Mitigation:**
- Follow existing overlay pattern from ClaudeConversationHistory
- Confirmation dialog clearly states what will be restored/removed
- Checkpoint lookup by messageId (checkpoints store the messageId they were created for)
- Limit branch tree depth display, flatten if needed

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
