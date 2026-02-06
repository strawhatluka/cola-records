# WO-061: Plan Mode

**Status:** PENDING
**Complexity:** 5/10
**Priority:** HIGH
**Phase:** 3 - UI & UX Features
**Dependencies:** WO-045 (Full Permissions System)
**Category:** Audit Checklist Section 28 - Plan Mode
**Estimated Time:** 4-5 hours (including BAS gates)

---

## Objective

Implement a complete Plan Mode that enforces read-only tool access, presents implementation plans in a structured review format, provides a plan approval workflow to transition to normal mode for execution, and integrates a plan agent subagent for autonomous context gathering.

---

## Background

### Current State (What Exists)
- **useClaudeStore**: Has `permissionMode: ClaudePermissionMode` where `ClaudePermissionMode` includes `'plan'` as a valid value
- **setPermissionMode(mode)** action in store to switch modes
- **ClaudePermission.tsx** (~2.9KB): Permission request UI with Allow/Deny and "Remember" checkbox
- **claude:query IPC**: Sends model, thinking, conversationId, attachments, systemPrompt, maxTokens parameters
- **ClaudeStreamEvent**: Supports `type: 'tool_use'` events, making it possible to intercept tool calls

### What Is Missing (From Audit Checklist Section 28)
1. Read-only enforcement: In plan mode, Claude can read/analyze but cannot modify files or execute destructive commands
2. Plan presentation format: Structured display of implementation plans with numbered steps, affected files, and estimated impact
3. ExitPlanMode equivalent: A mechanism for Claude to signal plan completion and for the user to approve the plan and switch to normal mode
4. Plan agent: A built-in subagent that gathers context (reads files, searches code) during plan mode before presenting the plan
5. Plan review UI: User can review, edit, and annotate Claude's plan before accepting it for execution

---

## Acceptance Criteria

- [ ] AC-1: When plan mode is active, all file write/edit/delete tool calls are blocked with a "Plan mode: read-only" message
- [ ] AC-2: Bash commands that could modify state are blocked (whitelist of safe read-only commands is enforced)
- [ ] AC-3: Claude presents plans in a structured format with clear sections: Goal, Steps, Affected Files, Risks
- [ ] AC-4: A "Plan Complete" action appears when Claude finishes planning, allowing the user to approve and switch to normal mode
- [ ] AC-5: The user can review the plan in a dedicated UI panel, add notes/edits, and accept or request changes
- [ ] AC-6: A plan agent subagent automatically gathers context (reads files, searches) to inform the plan
- [ ] AC-7: The plan mode indicator is clearly visible in the Claude panel header and input area
- [ ] AC-8: Switching from plan mode to normal mode preserves the conversation context
- [ ] AC-9: All components have unit tests with >= 80% coverage

---

## Technical Design

### Architecture

Plan mode operates across three layers:

1. **Enforcement Layer** (main process) - Intercepts tool calls and blocks write operations when plan mode is active
2. **Presentation Layer** (renderer) - Structured plan display component with review/edit capability
3. **Workflow Layer** (renderer) - Plan approval flow that transitions from plan mode to normal execution mode

```
User activates Plan Mode
  |
  v
useClaudeStore.permissionMode = 'plan'
  |
  +-- Enforcement: claude:query sends plan mode flag
  |   |
  |   v
  |   Main process: PlanModeEnforcer
  |   - Intercepts tool_use events
  |   - Blocks Write, Edit, Bash(destructive)
  |   - Allows Read, Glob, Grep, Bash(safe)
  |
  +-- Presentation: ClaudePlanView
  |   - Parses plan from Claude's response
  |   - Renders structured plan with sections
  |
  +-- Workflow: ClaudePlanApproval
      - "Accept Plan" -> switch to normal mode
      - "Modify Plan" -> send feedback to Claude
      - "Cancel Plan" -> stay in plan mode
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/main/services/plan-mode-enforcer.ts` | Enforces read-only tool access in plan mode | ~120 lines |
| `src/renderer/components/ide/claude/ClaudePlanView.tsx` | Structured plan display with sections | ~200 lines |
| `src/renderer/components/ide/claude/ClaudePlanApproval.tsx` | Plan review and approval workflow buttons | ~120 lines |
| `src/renderer/components/ide/claude/plan-parser.ts` | Parses Claude's plan response into structured sections | ~100 lines |
| `src/main/services/__tests__/plan-mode-enforcer.test.ts` | Enforcer tests | ~180 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudePlanView.test.tsx` | Plan view tests | ~120 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudePlanApproval.test.tsx` | Approval tests | ~100 lines |
| `src/renderer/components/ide/claude/__tests__/plan-parser.test.ts` | Parser tests | ~120 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `planMode` flag to `claude:query` parameters; add `ClaudePlanSection` type; add `claude:exit-plan-mode` channel |
| `src/main/ipc/handlers.ts` | Integrate PlanModeEnforcer into claude:query handler; register exit-plan-mode handler |
| `src/renderer/stores/useClaudeStore.ts` | Add `activePlan: ClaudePlan \| null`, `planReviewOpen: boolean`, `exitPlanMode()`, `approvePlan()` actions |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Render ClaudePlanView when plan is active; show plan mode banner; add ClaudePlanApproval to message flow |
| `src/renderer/components/ide/claude/ClaudeInputArea.tsx` | Show plan mode indicator badge; modify send to include plan mode context |
| `src/renderer/components/ide/claude/ClaudeMessageList.tsx` | Detect plan-formatted messages and render via ClaudePlanView instead of plain text |

### Interfaces

```typescript
// plan-parser.ts
interface ClaudePlanSection {
  type: 'goal' | 'steps' | 'files' | 'risks' | 'timeline' | 'notes';
  title: string;
  content: string;
  items?: string[];               // For list-type sections (steps, files)
}

interface ClaudePlan {
  id: string;
  title: string;
  sections: ClaudePlanSection[];
  rawContent: string;             // Original markdown from Claude
  status: 'draft' | 'reviewed' | 'approved' | 'rejected';
  userNotes?: string;             // User annotations
  createdAt: number;
}

function parsePlanFromResponse(content: string): ClaudePlan | null;
function isPlanResponse(content: string): boolean;

// plan-mode-enforcer.ts
interface ToolCallDecision {
  allowed: boolean;
  reason?: string;                // "Plan mode: read-only operation"
}

const SAFE_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task'];
const SAFE_BASH_PATTERNS = [
  /^(cat|less|head|tail|wc|ls|find|grep|rg|tree|echo|pwd|which|type)\b/,
  /^git\s+(log|status|diff|show|branch|remote)\b/,
  /^npm\s+(ls|list|outdated|audit)\b/,
];

function evaluateToolCall(toolName: string, toolInput: Record<string, unknown>, planMode: boolean): ToolCallDecision;

// Store additions
interface PlanModeState {
  activePlan: ClaudePlan | null;
  planReviewOpen: boolean;

  setActivePlan: (plan: ClaudePlan | null) => void;
  approvePlan: () => void;        // Switch to normal mode, keep conversation
  rejectPlan: (feedback: string) => void;  // Send feedback, stay in plan mode
  exitPlanMode: () => void;       // Exit plan mode without approval
}

// IPC additions
'claude:exit-plan-mode': () => void;
```

---

## Implementation Tasks

### T1: Plan Mode Enforcer (45 min)
**File:** `src/main/services/plan-mode-enforcer.ts`
- Define `SAFE_TOOLS` allowlist: Read, Glob, Grep, WebSearch, WebFetch, Task
- Define `BLOCKED_TOOLS`: Write, Edit, MultiEdit, NotebookEdit
- Define `SAFE_BASH_PATTERNS` for Bash tool: read-only commands (cat, ls, grep, git status, etc.)
- Implement `evaluateToolCall()`:
  - If tool is in SAFE_TOOLS: allow
  - If tool is in BLOCKED_TOOLS: deny with reason "Plan mode: write operations are not permitted"
  - If tool is 'Bash': check command against SAFE_BASH_PATTERNS; deny if no match
  - Default: deny (safe by default)
- Return `ToolCallDecision` with `allowed` boolean and human-readable `reason`

### T2: Plan Mode Enforcer Tests (45 min)
**File:** `src/main/services/__tests__/plan-mode-enforcer.test.ts`
- Test Read tool: allowed
- Test Write tool: denied with reason
- Test Edit tool: denied with reason
- Test Bash with `cat file.txt`: allowed
- Test Bash with `rm -rf /`: denied
- Test Bash with `git status`: allowed
- Test Bash with `git push`: denied
- Test Bash with `npm install`: denied
- Test Bash with `npm ls`: allowed
- Test unknown tool: denied (safe default)
- Test planMode=false: all tools allowed (bypass enforcer)

### T3: Plan Parser (30 min)
**File:** `src/renderer/components/ide/claude/plan-parser.ts`
- `isPlanResponse()`: detect if Claude's response contains a plan structure
  - Look for markdown headers like "## Plan", "## Implementation Plan", "## Steps", or structured numbered lists
- `parsePlanFromResponse()`: extract sections from Claude's plan markdown
  - Parse goal/objective section
  - Parse numbered steps
  - Parse affected files list
  - Parse risks/considerations
  - Parse timeline estimates
  - Return `ClaudePlan` object with sections array
- Handle both structured (with headers) and unstructured (plain list) plan formats

### T4: Plan Parser Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/plan-parser.test.ts`
- Test isPlanResponse with plan-like content: returns true
- Test isPlanResponse with regular response: returns false
- Test parsePlanFromResponse extracts goal section
- Test parsePlanFromResponse extracts numbered steps
- Test parsePlanFromResponse extracts affected files
- Test parsePlanFromResponse handles unstructured plans
- Test parsePlanFromResponse returns null for non-plan content

### T5: Plan View Component (45 min)
**File:** `src/renderer/components/ide/claude/ClaudePlanView.tsx`
- Receives `ClaudePlan` as prop
- Renders structured sections with clear visual hierarchy:
  - **Goal**: highlighted card at top
  - **Steps**: numbered checklist with toggle-able items
  - **Files**: file tree-style list with change type icons (create/modify/delete)
  - **Risks**: warning-styled callout cards
  - **Timeline**: timeline visualization or simple estimate display
- User notes textarea for adding annotations
- Edit mode: user can modify step descriptions (saved to plan.userNotes)
- Read-only mode for viewing accepted plans

### T6: Plan Approval Component (30 min)
**File:** `src/renderer/components/ide/claude/ClaudePlanApproval.tsx`
- Three action buttons:
  - **Accept Plan** (green): calls `approvePlan()` which switches to normal mode
  - **Request Changes** (blue): opens text input for feedback, sends as message to Claude
  - **Cancel** (gray): calls `exitPlanMode()`, stays in conversation
- Shows plan status badge: "Draft", "Under Review", "Approved"
- Confirmation dialog for Accept: "This will switch to normal mode and allow Claude to execute the plan."

### T7: IPC Integration (30 min)
**Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`
- Add `planMode?: boolean` parameter to `claude:query` channel
- In the query handler, when `planMode=true`:
  - Inject plan mode system prompt addition: "You are in plan mode. Analyze the request and present an implementation plan. Do not modify any files."
  - Hook the tool call pipeline through `evaluateToolCall()` before executing tools
  - If tool is blocked, return a tool_result event with the denial reason
- Add `claude:exit-plan-mode` channel that clears plan mode flag on the server side

### T8: Store Updates (30 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- Add `activePlan: ClaudePlan | null` state
- Add `planReviewOpen: boolean` state
- `approvePlan()`:
  1. Set plan status to 'approved'
  2. Switch `permissionMode` to 'normal'
  3. Optionally send message to Claude: "Plan approved. Please proceed with implementation."
- `rejectPlan(feedback: string)`:
  1. Send feedback as user message to Claude
  2. Keep plan mode active
- `exitPlanMode()`:
  1. Set `activePlan` to null
  2. Switch `permissionMode` to 'normal'
- In stream event handler: when receiving assistant messages in plan mode, check if `isPlanResponse()` and auto-parse into `activePlan`

### T9: Panel Integration (30 min)
**File:** `src/renderer/components/ide/claude/ClaudePanel.tsx`
- When `permissionMode === 'plan'`:
  - Show plan mode banner at top: "Plan Mode - Read Only" with blue accent
  - When `activePlan` is set, render ClaudePlanView below messages
  - Show ClaudePlanApproval buttons below the plan
- When switching from plan to normal mode: remove banner, keep messages

### T10: Input Area Integration (15 min)
**File:** `src/renderer/components/ide/claude/ClaudeInputArea.tsx`
- When plan mode is active:
  - Show "Plan Mode" badge next to model selector in footer
  - Placeholder text: "Describe what you want Claude to plan..."
  - On send, include `planMode: true` flag in query params

### T11: Message List Integration (20 min)
**File:** `src/renderer/components/ide/claude/ClaudeMessageList.tsx`
- When rendering assistant messages:
  - Check if message content `isPlanResponse()`
  - If yes, render via `ClaudePlanView` instead of plain markdown
  - Allow toggle between plan view and raw markdown view

### T12: Component Tests (60 min)
**Files:** Multiple test files
- ClaudePlanView: renders all section types, user notes, edit mode
- ClaudePlanApproval: accept/reject/cancel actions, confirmation dialog
- Integration: plan mode -> send message -> receive plan -> display -> approve -> switch to normal

---

## Testing Requirements

### Unit Tests
- plan-mode-enforcer: all tool types, bash patterns, safe/blocked decisions
- plan-parser: plan detection, section extraction, edge cases
- ClaudePlanView: section rendering, user notes, edit/read-only modes
- ClaudePlanApproval: button actions, confirmation, status display
- Store: plan state management, mode transitions, approval workflow

### Integration Tests
- Full plan workflow: activate plan mode -> send prompt -> receive plan -> review -> approve -> normal mode
- Tool blocking: plan mode active -> Claude tries Write -> blocked message returned
- Bash filtering: plan mode -> `git status` allowed, `git push` blocked
- Plan editing: user adds notes -> feedback sent to Claude

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

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 28:

- [ ] `Plan mode activation` - Switch to Plan mode via permission mode indicator (T10, existing mode switching)
- [ ] `Read-only analysis` - Claude can read/analyze but cannot modify files or execute commands (T1, T7)
- [ ] `Plan presentation` - Claude describes implementation plan and waits for approval (T3, T5, T11)
- [ ] `ExitPlanMode tool` - Claude exits plan mode after presenting plan (T6, T7, T8)
- [ ] `Plan agent` - Built-in subagent used to gather context during plan mode (T7 system prompt, T1 read-only enforcement)
- [ ] `Plan review` - User reviews and edits Claude's plan before accepting (T5, T6)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bash command whitelist too restrictive (blocks safe commands) | Medium | Medium | Start with conservative whitelist; log blocked commands for review; allow user override |
| Bash command whitelist too permissive (allows destructive commands) | Low | High | Default deny; only allow explicitly whitelisted patterns; review patterns carefully |
| Plan parsing fails on Claude's unstructured responses | Medium | Low | Graceful fallback: show raw markdown if parsing fails; isPlanResponse() returns false |
| User forgets they're in plan mode | Low | Medium | Persistent banner, input badge, and mode indicator make plan mode highly visible |
| Conversation context lost on mode switch | Low | High | Mode switch only changes permissionMode; conversation, messages, and context preserved |

---

## Notes

- The plan mode enforcer operates at the main process level, intercepting tool calls before execution. This ensures even if the renderer is manipulated, write operations are blocked.
- The plan parser uses heuristics to detect plan-structured responses. It is not a strict format requirement; Claude can respond in any format and the parser attempts to extract structure. If parsing fails, the raw markdown is displayed normally.
- The "plan agent" functionality is implemented via the system prompt injection in plan mode, which instructs Claude to focus on analysis and planning. A dedicated subagent (WO-050) can be added later for more sophisticated context gathering.
- Safe bash patterns are intentionally conservative. Commands like `npm test` and `npm build` are blocked because they can have side effects (file creation, network access). Only truly read-only commands are allowed.
- The plan approval workflow is inspired by code review flows: Draft -> Review -> Approved/Changes Requested. This gives users confidence before allowing Claude to make changes.
- When the user approves a plan, an automatic message is sent to Claude: "Plan approved. Please proceed with implementation." This triggers Claude to execute the plan steps using normal mode tools.
