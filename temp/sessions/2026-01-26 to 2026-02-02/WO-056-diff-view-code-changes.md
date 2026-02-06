# WO-056: Diff View & Code Changes

**Status:** PENDING
**Complexity:** 7/10
**Priority:** HIGH
**Phase:** 3 - UI & UX Features
**Dependencies:** None (extends existing ClaudeDiff.tsx and Monaco editor infrastructure)
**Category:** Audit Checklist Section 23 - Diff View & Code Changes
**Estimated Time:** 7-8 hours (including BAS gates)

---

## Objective

Build a comprehensive diff viewing and code change management system that provides side-by-side Monaco diff editing, gutter bubble indicators, an accept/reject workflow with "tell Claude what to change" alternative, real-time change tracking in a sidebar file list, and click-to-diff navigation. This replaces the basic diff viewer with a full code review experience.

---

## Background

### Current State (What Exists)
- **ClaudeDiff.tsx** (~7.3KB): Basic diff viewer component that displays file changes in a simple format
- **DiffEditor.tsx**: Git diff viewer in the IDE editor panel (Monaco-based, used for git diffs)
- **MonacoEditor.tsx**: Full Monaco code editor with syntax highlighting, IntelliSense, themes
- **useClaudeStore**: Tracks messages including `tool_use` events with `toolName: 'Edit'` or `'Write'` that represent file changes
- **IPC channels**: `fs:read-file`, `fs:write-file` for file content operations
- **ClaudeStreamEvent**: Includes `type: 'tool_use'` with `toolName` and `toolInput` for tracking changes

### What Is Missing (From Audit Checklist Section 23)
1. Side-by-side diff view using Monaco's built-in diff editor
2. Inline diff view directly in the editor (changes shown in active editor)
3. Gutter bubbles - colored indicators in left margin of code showing Claude's changes
4. Click gutter bubble to see inline diff detail
5. Accept/Reject changes buttons per file change
6. "Tell Claude what to change" - provide alternative instructions instead of accept/reject
7. Real-time change display in sidebar panel as Claude makes changes
8. Click file in sidebar to open full side-by-side comparison

---

## Acceptance Criteria

- [ ] AC-1: When Claude proposes file edits, a side-by-side Monaco diff editor opens showing original vs proposed changes
- [ ] AC-2: Gutter bubbles (colored decorations) appear in the left margin of the active editor for files Claude has modified
- [ ] AC-3: Clicking a gutter bubble reveals an inline diff overlay showing the specific change at that location
- [ ] AC-4: Each file change has Accept and Reject buttons; Accept applies the change, Reject discards it
- [ ] AC-5: A "Tell Claude what to change" text input allows the user to provide alternative instructions instead of accepting/rejecting
- [ ] AC-6: A file change list sidebar shows all files modified by Claude in the current conversation, updated in real-time
- [ ] AC-7: Clicking a file in the change list opens the full side-by-side diff for that file
- [ ] AC-8: Changes are tracked per-file with status indicators (pending, accepted, rejected)
- [ ] AC-9: The diff editor supports both light and dark themes matching the application theme
- [ ] AC-10: All components have unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The diff system has four layers:

1. **Change Tracking Layer** - A Zustand store slice that tracks all file changes from Claude's tool_use events, maintaining original content snapshots and proposed changes
2. **Diff Rendering Layer** - Monaco diff editor integration for side-by-side view, plus gutter decoration API for inline indicators
3. **Action Layer** - Accept/reject workflow that applies or discards changes via filesystem IPC
4. **Navigation Layer** - File change list sidebar with click-to-navigate functionality

```
ClaudeStreamEvent (tool_use: Edit/Write)
  |
  v
useClaudeChangesStore (tracks original + proposed per file)
  |
  +---> ClaudeFileChangeList (sidebar) --click--> ClaudeSideBySideDiff
  |
  +---> GutterBubbleDecorations (in MonacoEditor) --click--> InlineDiffOverlay
  |
  +---> AcceptRejectBar (per file) --accept/reject/tell--> Action handlers
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/stores/useClaudeChangesStore.ts` | Zustand store tracking Claude's file changes (original snapshots, proposed content, status) | ~180 lines |
| `src/renderer/components/ide/claude/ClaudeSideBySideDiff.tsx` | Monaco DiffEditor wrapper for side-by-side view with accept/reject controls | ~200 lines |
| `src/renderer/components/ide/claude/ClaudeFileChangeList.tsx` | Sidebar list of files changed by Claude with status indicators and click-to-diff | ~150 lines |
| `src/renderer/components/ide/claude/ClaudeInlineDiffOverlay.tsx` | Popup overlay showing inline diff at a specific gutter bubble location | ~120 lines |
| `src/renderer/components/ide/claude/ClaudeAcceptRejectBar.tsx` | Accept/Reject/"Tell Claude" action bar for file changes | ~100 lines |
| `src/renderer/components/ide/claude/gutter-decorations.ts` | Monaco gutter decoration manager for colored change indicators | ~120 lines |
| `src/renderer/components/ide/claude/__tests__/useClaudeChangesStore.test.ts` | Store tests | ~200 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeFileChangeList.test.tsx` | File change list tests | ~120 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeAcceptRejectBar.test.tsx` | Accept/reject bar tests | ~100 lines |
| `src/renderer/components/ide/claude/__tests__/gutter-decorations.test.ts` | Gutter decoration tests | ~100 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/ide/claude/ClaudeDiff.tsx` | Refactor to use ClaudeSideBySideDiff; keep as wrapper for backward compatibility |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Add ClaudeFileChangeList to panel layout; wire up change tracking from stream events |
| `src/renderer/components/ide/editor/MonacoEditor.tsx` | Add gutter bubble decorations via gutter-decorations.ts; handle bubble click events |
| `src/renderer/components/ide/editor/CodeEditorPanel.tsx` | Support opening diff view in editor tab when user clicks file in change list |
| `src/renderer/stores/useClaudeStore.ts` | Add hook into stream event processing to feed changes to useClaudeChangesStore |
| `src/main/ipc/channels.ts` | Add `claude:apply-change` and `claude:reject-change` channel types |

### Interfaces

```typescript
// useClaudeChangesStore.ts
interface FileChange {
  id: string;                          // Unique change ID
  filePath: string;                    // Absolute file path
  originalContent: string;             // Content before Claude's change
  proposedContent: string;             // Content after Claude's change
  changeType: 'edit' | 'create' | 'delete';
  status: 'pending' | 'accepted' | 'rejected';
  hunks: DiffHunk[];                   // Parsed diff hunks for gutter decorations
  timestamp: number;
  messageId: string;                   // ID of the Claude message that produced this change
}

interface DiffHunk {
  startLine: number;                   // Line number in original file
  endLine: number;                     // End line in original file
  newStartLine: number;                // Line number in proposed file
  newEndLine: number;                  // End line in proposed file
  type: 'added' | 'removed' | 'modified';
}

interface ClaudeChangesState {
  changes: Map<string, FileChange>;    // Keyed by filePath
  activeChangeFile: string | null;     // Currently viewed diff file

  // Actions
  trackChange: (filePath: string, originalContent: string, proposedContent: string, changeType: FileChange['changeType'], messageId: string) => void;
  acceptChange: (filePath: string) => Promise<void>;
  rejectChange: (filePath: string) => void;
  setActiveChangeFile: (filePath: string | null) => void;
  clearChanges: () => void;
  getChangeForFile: (filePath: string) => FileChange | undefined;
}

// gutter-decorations.ts
interface GutterBubble {
  lineNumber: number;
  type: 'added' | 'removed' | 'modified';
  filePath: string;
  hunkIndex: number;
}

function createGutterDecorations(editor: monaco.editor.IStandaloneCodeEditor, bubbles: GutterBubble[]): monaco.editor.IEditorDecorationsCollection;
function clearGutterDecorations(collection: monaco.editor.IEditorDecorationsCollection): void;

// ClaudeAcceptRejectBar.tsx props
interface AcceptRejectBarProps {
  filePath: string;
  onAccept: () => void;
  onReject: () => void;
  onTellClaude: (instructions: string) => void;
  status: 'pending' | 'accepted' | 'rejected';
}
```

---

## Implementation Tasks

### T1: File Changes Store (60 min)
**File:** `src/renderer/stores/useClaudeChangesStore.ts`
- Create Zustand store with `FileChange` tracking per file path
- Implement `trackChange()`: snapshot original content, store proposed, compute diff hunks
- Implement `acceptChange()`: write proposed content via `fs:write-file` IPC, set status to 'accepted'
- Implement `rejectChange()`: discard proposed content, set status to 'rejected'
- Implement diff hunk computation using line-by-line comparison
- Implement `clearChanges()` for conversation reset

### T2: File Changes Store Tests (45 min)
**File:** `src/renderer/components/ide/claude/__tests__/useClaudeChangesStore.test.ts`
- Test trackChange creates correct FileChange entry
- Test acceptChange writes file and updates status
- Test rejectChange updates status without writing
- Test diff hunk computation for added/removed/modified lines
- Test clearChanges resets store
- Mock IPC calls for file write

### T3: Side-by-Side Diff Component (60 min)
**File:** `src/renderer/components/ide/claude/ClaudeSideBySideDiff.tsx`
- Use `@monaco-editor/react` DiffEditor component
- Props: `originalContent`, `proposedContent`, `filePath`, `language`
- Auto-detect language from file extension
- Theme-aware (follows app dark/light theme)
- Render AcceptRejectBar below the diff editor
- Support read-only mode for already-accepted/rejected changes

### T4: File Change List Component (45 min)
**File:** `src/renderer/components/ide/claude/ClaudeFileChangeList.tsx`
- Renders list of files from useClaudeChangesStore
- Each item shows: file name, change type icon (edit/create/delete), status badge
- Click handler sets `activeChangeFile` and opens side-by-side diff
- Status colors: pending=yellow, accepted=green, rejected=red
- Empty state when no changes tracked
- Real-time updates via Zustand subscription

### T5: Accept/Reject Bar Component (45 min)
**File:** `src/renderer/components/ide/claude/ClaudeAcceptRejectBar.tsx`
- Three actions: Accept (green check), Reject (red X), "Tell Claude what to change" (blue pencil)
- Accept calls `acceptChange()` from changes store
- Reject calls `rejectChange()` from changes store
- "Tell Claude" opens inline text input; on submit, sends message to Claude via `sendMessage()` with context about the file and instructions
- Disabled state when change is already accepted/rejected

### T6: Gutter Bubble Decorations (60 min)
**File:** `src/renderer/components/ide/claude/gutter-decorations.ts`
- Use Monaco `deltaDecorations` API to add colored markers in the gutter
- Green gutter bubble for added lines
- Red gutter bubble for removed lines
- Blue gutter bubble for modified lines
- Each decoration has a `glyphMarginClassName` with custom CSS
- Export functions to create/update/clear decorations
- Handle decoration lifecycle (clean up on file close or changes reset)

### T7: Inline Diff Overlay (45 min)
**File:** `src/renderer/components/ide/claude/ClaudeInlineDiffOverlay.tsx`
- Triggered by clicking a gutter bubble decoration
- Shows a floating overlay at the click position
- Displays the specific hunk's old vs new content in a compact diff format
- Mini accept/reject buttons within the overlay
- Dismiss by clicking outside or pressing Escape
- Position calculation relative to Monaco editor viewport

### T8: Monaco Editor Integration (45 min)
**File:** `src/renderer/components/ide/editor/MonacoEditor.tsx`
- Import and use gutter-decorations module
- When a file is open that has pending changes in useClaudeChangesStore:
  - Compute gutter bubble positions from the file's diff hunks
  - Apply gutter decorations to the editor
  - Register click handler on glyph margin to open InlineDiffOverlay
- Clean up decorations when file is closed or changes are accepted/rejected
- Subscribe to useClaudeChangesStore for real-time updates

### T9: Stream Event to Change Tracking (30 min)
**File:** `src/renderer/stores/useClaudeStore.ts` (or `src/renderer/components/ide/claude/ClaudePanel.tsx`)
- In the stream event handler that processes `tool_use` events:
  - When `toolName === 'Edit'` or `toolName === 'Write'`: extract file path and content
  - Fetch original file content via `fs:read-file` IPC
  - Call `useClaudeChangesStore.getState().trackChange()` with original and proposed content
- Handle `Write` (create new file): original content is empty string
- Handle `Edit` (string replacement): compute full proposed content from original + edit

### T10: ClaudeDiff.tsx Refactor (20 min)
**File:** `src/renderer/components/ide/claude/ClaudeDiff.tsx`
- Refactor to use ClaudeSideBySideDiff internally
- Maintain existing props interface for backward compatibility
- Add file change list integration for multi-file diffs

### T11: Panel Layout Integration (30 min)
**File:** `src/renderer/components/ide/claude/ClaudePanel.tsx`
- Add collapsible "Changes" section showing ClaudeFileChangeList
- Position below the message list or in a tab alongside conversation
- Show change count badge on the section header
- Wire up "clear changes" when starting new conversation

### T12: Component Tests (60 min)
**Files:** Multiple test files
- ClaudeFileChangeList: renders files, click opens diff, status badges correct
- ClaudeAcceptRejectBar: button clicks trigger correct actions, disabled states
- Gutter decorations: correct decoration positions, colors, cleanup
- ClaudeSideBySideDiff: renders Monaco DiffEditor with correct content

---

## Testing Requirements

### Unit Tests
- useClaudeChangesStore: all actions, state transitions, diff hunk computation
- ClaudeFileChangeList: rendering, click handlers, empty state, status badges
- ClaudeAcceptRejectBar: accept/reject/tell-claude flows, disabled states
- gutter-decorations: creation, update, cleanup of Monaco decorations
- ClaudeSideBySideDiff: language detection, theme, read-only mode

### Integration Tests
- Stream event -> change tracking -> file list update flow
- Accept change -> file write -> gutter decoration removal
- Reject change -> status update -> no file write
- "Tell Claude" -> message sent with file context

### Coverage Target
- Lines: >= 80%
- Branches: >= 80%

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier: 0 errors after auto-fix |
| 2 | Structure | All imports resolve, TypeScript types valid, no circular deps |
| 3 | Build | `tsc --noEmit` passes with 0 errors |
| 4 | Testing | All new + existing tests pass |
| 5 | Coverage | >= 80% lines and branches on new files |
| 6 | Review | DRA code review: best practices, design doc adherence |

---

## Audit Checklist Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 23:

- [ ] `Side-by-side diff` - VS Code native diff viewer showing original vs proposed changes (T3)
- [ ] `Inline diff` - Changes shown directly in editor with old/new code comparison (T7, T8)
- [ ] `Gutter bubbles` - Colored indicators in left margin showing Claude's changes (T6, T8)
- [ ] `Click to expand diff` - Click gutter bubble to see inline diff detail (T7, T8)
- [ ] `Accept changes` - Accept proposed changes via permission dialog (T5)
- [ ] `Reject changes` - Reject proposed changes (T5)
- [ ] `Tell Claude what to change` - Provide alternative instructions instead of accept/reject (T5)
- [ ] `Real-time change display` - See Claude's changes in real-time in sidebar panel (T4, T9, T11)
- [ ] `Click file for full diff` - Click any file in sidebar to open full side-by-side comparison (T4, T3)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Monaco DiffEditor performance with large files | Medium | Medium | Limit diff to first 10K lines; show warning for very large files |
| Gutter decorations flicker during rapid edits | Medium | Low | Batch decoration updates; debounce recomputation at 200ms |
| Race condition between file write and store update | Low | High | Use async/await consistently; lock file path during write |
| Original content snapshot stale if file changed externally | Medium | Medium | Validate original content hash before applying; warn if file changed |
| "Tell Claude" instructions may not be clear enough | Low | Low | Provide template text: "For file X, instead of the proposed change, please..." |

---

## Notes

- Monaco's built-in DiffEditor (`monaco.editor.createDiffEditor`) supports both side-by-side and inline diff modes. We use side-by-side as the primary view.
- The gutter bubble approach uses Monaco's `glyphMarginClassName` decoration option. Custom CSS classes need to be injected for the colored circle indicators.
- The diff hunk computation uses a simple line-by-line comparison. For more accurate diffs, consider using the `diff` npm package, but the simple approach is sufficient for MVP.
- File changes are tracked per-conversation. When switching conversations, the changes store should be cleared and repopulated from the new conversation's tool_use messages.
- The "Tell Claude what to change" feature sends a new message to Claude with the file path and user instructions as context. Claude then processes it as a regular prompt.
