# WO-054: Extended Thinking (Complete)

**Status:** PLANNED
**Complexity:** 4/10
**Priority:** MEDIUM
**Phase:** 2 - Advanced Systems
**Dependencies:** None (extends existing extended thinking infrastructure)
**Category:** Audit Section 20 - Extended Thinking
**Estimated Time:** 4-6 hours
**Created:** 2026-02-01

---

## Objective

Complete the extended thinking feature set by adding configurable thinking budget via `MAX_THINKING_TOKENS`, natural language trigger detection ("think about this", "think harder", "megathink", "ultrathink"), budget level mapping, and improved thinking display in the renderer with collapsible sections, word count, and timing information.

---

## Background

Extended thinking was initially implemented in WO-020 with a simple toggle. The `useClaudeStore` has `extendedThinkingEnabled: boolean` and a `toggleExtendedThinking()` action. The `AppSettings` type includes `claudeExtendedThinking?: boolean`. The `ClaudeStreamEvent` has a `thinking` type with a `thinking` string field. The container passes the thinking flag to the Claude API. The missing features are budget configuration, trigger words, and enhanced thinking display.

### Current State (Implemented)
- `extendedThinkingEnabled` boolean in useClaudeStore
- `toggleExtendedThinking()` action
- `claudeExtendedThinking` in AppSettings
- `ClaudeStreamEvent` type 'thinking' with thinking content string
- Container sends `thinking: true/false` to Claude API
- Basic thinking content rendered in conversation

### Missing Features (This WO)
- `MAX_THINKING_TOKENS` environment variable support
- Configurable thinking budget (default 31,999 for Opus)
- Natural language triggers: "think about this", "think harder", "megathink", "ultrathink"
- Budget level mapping (triggers map to different token budgets)
- Improved thinking display: collapsible, word count, timing, visual distinction
- `/config` toggle equivalent (settings panel integration)

---

## Acceptance Criteria

1. `MAX_THINKING_TOKENS` environment variable sets the thinking token budget
2. Settings include a `claudeThinkingBudget` numeric field (default 31,999)
3. Natural language triggers in user messages automatically adjust thinking budget:
   - "think about this" / "think step by step" -> standard budget (10,000 tokens)
   - "think harder" / "think deeply" -> elevated budget (20,000 tokens)
   - "megathink" -> high budget (50,000 tokens)
   - "ultrathink" -> maximum budget (100,000 tokens)
4. Triggers auto-enable extended thinking if it was disabled
5. Thinking display shows content in a collapsible panel with visual distinction
6. Thinking display shows word count, character count, and elapsed time
7. Thinking content uses a distinct visual style (different background, italic or monospace)
8. Extended thinking can be toggled via the settings panel
9. Budget level indicator shown in prompt area when triggers activate
10. Unit tests cover trigger detection, budget mapping, display rendering
11. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
Existing Infrastructure (preserved):
  ClaudeContainerService (main) -- sends thinking flag to API
  useClaudeStore (renderer) -- extendedThinkingEnabled toggle
  AppSettings -- claudeExtendedThinking boolean

New/Modified:
  ThinkingTriggerDetector (main) -- detects trigger words, maps to budget
  ClaudeContainerService -- pass budget tokens to API, read env var
  ClaudeThinkingDisplay.tsx (renderer) -- improved thinking panel
  useClaudeStore.ts -- thinkingBudget state, trigger activation
  AppSettings -- claudeThinkingBudget number
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/thinking-trigger.service.ts` | Detects natural language triggers and maps to budget levels |
| `src/renderer/components/claude/ClaudeThinkingDisplay.tsx` | Improved thinking output panel with collapsible sections, timing, word count |
| `tests/unit/services/thinking-trigger.service.test.ts` | Trigger detection and budget mapping tests |
| `tests/unit/components/claude/ClaudeThinkingDisplay.test.tsx` | Thinking display component tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `claudeThinkingBudget` to AppSettings |
| `src/main/services/claude-container.service.ts` | Read MAX_THINKING_TOKENS env var, pass budget to API, integrate trigger detection |
| `src/renderer/stores/useClaudeStore.ts` | Add `thinkingBudget` state, `setThinkingBudget` action, `activeTriggerLevel` state |
| `src/renderer/components/claude/ClaudeMessage.tsx` | Use ClaudeThinkingDisplay for thinking-type messages |
| `src/renderer/components/claude/ClaudeInputArea.tsx` | Show trigger level indicator when trigger detected |

### Interfaces

```typescript
// Thinking budget levels
export type ThinkingBudgetLevel = 'off' | 'standard' | 'elevated' | 'high' | 'maximum' | 'custom';

export interface ThinkingBudgetConfig {
  level: ThinkingBudgetLevel;
  tokens: number;
  label: string;
}

export const THINKING_BUDGET_LEVELS: Record<ThinkingBudgetLevel, ThinkingBudgetConfig> = {
  off: { level: 'off', tokens: 0, label: 'Off' },
  standard: { level: 'standard', tokens: 10_000, label: 'Standard' },
  elevated: { level: 'elevated', tokens: 20_000, label: 'Elevated' },
  high: { level: 'high', tokens: 50_000, label: 'High (megathink)' },
  maximum: { level: 'maximum', tokens: 100_000, label: 'Maximum (ultrathink)' },
  custom: { level: 'custom', tokens: 31_999, label: 'Custom' },
};

export interface ThinkingTriggerResult {
  detected: boolean;
  level: ThinkingBudgetLevel;
  tokens: number;
  /** The trigger phrase that was matched */
  trigger?: string;
  /** The user message with trigger phrase optionally cleaned */
  cleanedMessage: string;
}

export interface ThinkingDisplayProps {
  content: string;
  /** Elapsed time in milliseconds */
  elapsedMs?: number;
  /** Whether the thinking block is still streaming */
  streaming?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
}

// AppSettings addition:
// claudeThinkingBudget?: number; // Default: 31999
```

---

## Implementation Tasks

### Task 1: Thinking Trigger Detection Service
- **Type:** FEATURE
- **Files:** `src/main/services/thinking-trigger.service.ts`
- **Details:** Create a service that scans user message text for natural language thinking triggers. Trigger patterns (case-insensitive): `"think about this"` and `"think step by step"` -> standard (10k). `"think harder"` and `"think deeply"` and `"think more carefully"` -> elevated (20k). `"megathink"` -> high (50k). `"ultrathink"` -> maximum (100k). Return `ThinkingTriggerResult` with the detected level, token count, matched trigger phrase, and the message with the trigger optionally preserved (triggers are instructional, keep them in context). If multiple triggers found, use the highest level. If no trigger found, return `{ detected: false, level: 'off', tokens: 0, cleanedMessage: originalMessage }`.
- **Test:** `tests/unit/services/thinking-trigger.service.test.ts` - Each trigger phrase, case insensitivity, multiple triggers (highest wins), no trigger, trigger at start/middle/end of message, partial matches (should not trigger)

### Task 2: Environment Variable and Settings Support
- **Type:** FEATURE
- **Files:** `src/main/ipc/channels.ts`, `src/main/services/claude-container.service.ts`
- **Details:** Add `claudeThinkingBudget?: number` to `AppSettings` (default 31,999). Read `MAX_THINKING_TOKENS` from `process.env` at container start. Precedence: environment variable > settings value > default (31,999). Store the resolved budget in the container service. When extended thinking is enabled, pass the budget as `max_tokens` for the thinking parameter in the API call.
- **Test:** Test env var override, settings value, default fallback, precedence order

### Task 3: Container Trigger Integration
- **Type:** INTEGRATION
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** Before sending a query to the Claude API, run the user message through `ThinkingTriggerDetector`. If a trigger is detected: (1) auto-enable extended thinking for this request even if the global toggle is off, (2) use the trigger's token budget instead of the default, (3) emit a stream event to the renderer indicating the trigger level (new event type or metadata on existing). Pass the thinking budget to the API request. After the request, revert to the user's default thinking settings (triggers are per-message, not persistent).
- **Test:** Test trigger enables thinking, budget override, per-message scope (not persistent), no trigger uses default

### Task 4: Store Updates for Thinking Budget
- **Type:** FEATURE
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add state: `thinkingBudget: number` (default from settings), `activeTriggerLevel: ThinkingBudgetLevel | null` (set when trigger detected, cleared after response). Add actions: `setThinkingBudget(tokens: number)` updates settings and store, `setActiveTriggerLevel(level)` for UI indicator. When a thinking stream event is received, track start time for elapsed calculation. Add `thinkingStartTime: number | null` and `thinkingElapsedMs: number` to state.
- **Test:** Store action tests, trigger level state management, timing tracking

### Task 5: ClaudeThinkingDisplay Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeThinkingDisplay.tsx`
- **Details:** Replace the basic thinking content rendering with an enhanced display. Features: (1) Collapsible panel with chevron toggle, default collapsed for completed thinking, expanded while streaming. (2) Header bar showing "Thinking..." or "Thought for X seconds" with brain icon. (3) Word count and character count in header (e.g., "247 words"). (4) Content area with distinct styling: slightly darker/lighter background (theme-aware), monospace font, slightly smaller text. (5) Streaming indicator (pulsing dot) while thinking is active. (6) Fade-in animation when thinking completes and collapses.
- **Test:** `tests/unit/components/claude/ClaudeThinkingDisplay.test.tsx` - Render collapsed/expanded, streaming state, word count accuracy, elapsed time display, collapse toggle

### Task 6: Message Integration
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeMessage.tsx`
- **Details:** When rendering a message with `messageType === 'thinking'`, use `ClaudeThinkingDisplay` instead of plain text. Pass thinking content, elapsed time from store, and streaming state. Group consecutive thinking messages into a single display block.
- **Test:** Test thinking message renders ClaudeThinkingDisplay, non-thinking messages unaffected

### Task 7: Trigger Level Indicator in Input Area
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeInputArea.tsx`
- **Details:** When `activeTriggerLevel` is not null, show a small badge/chip near the input area indicating the active thinking level. Examples: "Standard Thinking", "Elevated Thinking", "Megathink", "Ultrathink" with a brain icon and color coding (blue/yellow/orange/red). Badge disappears after the response completes (activeTriggerLevel cleared). This provides user feedback that their trigger phrase was recognized.
- **Test:** Test badge appears for each level, disappears on null, color coding

### Task 8: Settings Panel Integration
- **Type:** UI
- **Files:** `src/renderer/components/settings/AppSettings.tsx` (or equivalent settings component)
- **Details:** Add extended thinking section to settings panel. Toggle for extended thinking (existing). Numeric input for thinking budget with preset buttons: Standard (10k), Default (31,999), High (50k), Maximum (100k). Tooltip explaining `MAX_THINKING_TOKENS` env var override. Show current effective budget (env var if set, settings value otherwise).
- **Test:** Test toggle, budget input, preset buttons, env var display

---

## Testing Requirements

- **Unit Tests:** Trigger detection (all phrases, edge cases), budget level mapping, ClaudeThinkingDisplay (all states), store actions
- **Integration Tests:** Full flow: user types "ultrathink" -> thinking enabled with 100k budget -> thinking displayed -> budget reverts
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock container service for trigger integration, mock IPC for store tests, mock useClaudeStore for component tests
- **Edge Cases:** Trigger word inside a code block (should not trigger), partial trigger match ("think" alone should not trigger), multiple triggers of different levels (highest wins), empty thinking content, very long thinking output (1000+ words), rapid toggle on/off

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for trigger accuracy, budget handling, display UX |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 20 (Extended Thinking):

- [x] Extended thinking toggle (existing)
- [ ] Configurable budget (MAX_THINKING_TOKENS)
- [ ] Natural language triggers ("think about this", "think harder", "megathink", "ultrathink")
- [x] Thinking display (existing, being enhanced)
- [ ] /config toggle for extended thinking (settings panel)
- [ ] Default enabled for Opus with 31,999 budget

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| False trigger detection (word in normal context) | LOW | MEDIUM | Use phrase matching not single words; require full phrase match |
| Excessive thinking budget consuming API credits | MEDIUM | LOW | Show budget cost warning for high/maximum levels; confirm for ultrathink |
| Thinking content too large to display smoothly | LOW | LOW | Virtualize long thinking content; truncate display with "show full" option |
| API rejects thinking budget (model doesn't support) | MEDIUM | LOW | Graceful fallback to default budget; show warning if model doesn't support extended thinking |

---

## Notes

- This work order has NO external dependencies since it extends the existing extended thinking toggle.
- Natural language triggers are per-message overrides, not persistent setting changes. This matches Claude Code's behavior where "ultrathink" in one message doesn't change the default for subsequent messages.
- The default budget of 31,999 tokens matches Claude Code's default for Opus 4.5.
- The `MAX_THINKING_TOKENS` environment variable provides compatibility with Claude Code's configuration.
- Trigger phrases are kept in the message content (not stripped) because they provide useful instruction context to the model.
- The "Tab sticky toggle" from CLI is not applicable to our GUI; the settings toggle provides equivalent functionality.
- The "Alt+T" keyboard shortcut will be implemented in WO-060 (Keyboard Shortcuts).
