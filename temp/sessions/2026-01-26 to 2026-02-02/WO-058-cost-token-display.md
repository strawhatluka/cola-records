# WO-058: Cost & Token Display (Complete)

**Status:** PENDING
**Complexity:** 4/10
**Priority:** MEDIUM
**Phase:** 3 - UI & UX Features
**Dependencies:** None (extends existing ClaudeCostDisplay.tsx and ClaudeContextBar.tsx)
**Category:** Audit Checklist Section 22 - Cost & Token Display
**Estimated Time:** 3-4 hours (including BAS gates)

---

## Objective

Enhance the cost and token display system to provide detailed breakdowns of API usage, including per-request duration tracking, input/output token separation, cached token discount calculations, code change summaries, and a `/cost` slash command for on-demand usage statistics.

---

## Background

### Current State (What Exists)
- **ClaudeCostDisplay.tsx** (~2.1KB): Basic component displaying total token usage
- **ClaudeContextBar.tsx** (~3.2KB): Token usage display with context percentage bar (200K max)
- **useClaudeStore**: Tracks `tokenUsage: { inputTokens: number; outputTokens: number }` and `contextPercent: number`
- **ClaudeStreamEvent**: Includes `type: 'usage'` with `usage: { inputTokens, outputTokens }` data
- **ClaudePersistedMessage**: Stores `usageInputTokens` and `usageOutputTokens` per message

### What Is Missing (From Audit Checklist Section 22)
1. `/cost` slash command showing full session usage breakdown
2. API duration tracking (time spent on API calls)
3. Wall duration tracking (total elapsed time from session start)
4. Code changes summary (files created/modified/deleted during session)
5. Input/output token breakdown with per-request detail
6. Cached token discount display (90% discount on cached tokens)

---

## Acceptance Criteria

- [ ] AC-1: The `/cost` slash command displays a formatted summary of session usage including cost, tokens, duration, and changes
- [ ] AC-2: Each Claude request tracks API duration (time from request start to response complete) and displays it
- [ ] AC-3: Wall duration is tracked from the first message in the session and displayed in the cost summary
- [ ] AC-4: A code changes summary shows the number of files created, modified, and deleted during the session
- [ ] AC-5: Input and output tokens are displayed separately with per-request detail available
- [ ] AC-6: Cached token count is tracked and displayed with the 90% discount reflected in cost calculations
- [ ] AC-7: The enhanced ClaudeCostDisplay shows all metrics in a compact, readable format
- [ ] AC-8: Cost calculations use correct per-model pricing (Sonnet, Opus, Haiku have different rates)
- [ ] AC-9: All components have unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The cost tracking system has three layers:

1. **Tracking Layer** - Zustand store accumulates per-request metrics (tokens, duration, changes)
2. **Calculation Layer** - Pure functions compute costs from token counts and model pricing
3. **Display Layer** - Enhanced ClaudeCostDisplay and /cost command output

```
ClaudeStreamEvent (usage) --> useClaudeCostStore
                                  |
                                  +-- totalInputTokens
                                  +-- totalOutputTokens
                                  +-- cachedInputTokens
                                  +-- requests[] (per-request details)
                                  +-- filesChanged { created, modified, deleted }
                                  +-- sessionStartTime
                                  |
                                  v
                          cost-calculator.ts
                                  |
                                  v
                    ClaudeCostDisplay.tsx (enhanced)
                    /cost slash command output
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/renderer/stores/useClaudeCostStore.ts` | Dedicated cost tracking Zustand store | ~150 lines |
| `src/renderer/components/ide/claude/cost-calculator.ts` | Pure functions for cost calculation with model pricing | ~80 lines |
| `src/renderer/components/ide/claude/__tests__/useClaudeCostStore.test.ts` | Cost store tests | ~150 lines |
| `src/renderer/components/ide/claude/__tests__/cost-calculator.test.ts` | Calculator tests | ~120 lines |
| `src/renderer/components/ide/claude/__tests__/ClaudeCostDisplay.test.tsx` | Enhanced display tests | ~100 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/components/ide/claude/ClaudeCostDisplay.tsx` | Complete rewrite to show full breakdown: tokens, cost, duration, changes |
| `src/renderer/components/ide/claude/ClaudeContextBar.tsx` | Add cached token indicator to context bar |
| `src/renderer/stores/useClaudeStore.ts` | Wire stream events to feed useClaudeCostStore; add file change tracking from tool_use events |
| `src/renderer/components/ide/claude/ClaudePanel.tsx` | Wire /cost slash command to display cost summary in chat |
| `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx` | Register /cost command |

### Interfaces

```typescript
// useClaudeCostStore.ts
interface RequestMetrics {
  id: string;
  model: ClaudeModelId;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  apiDurationMs: number;          // Time for API response
  startedAt: number;              // Timestamp
  completedAt: number;            // Timestamp
}

interface FileChangeSummary {
  created: string[];              // File paths created
  modified: string[];             // File paths modified
  deleted: string[];              // File paths deleted
}

interface ClaudeCostState {
  // Aggregates
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  totalApiDurationMs: number;

  // Per-request detail
  requests: RequestMetrics[];

  // File changes
  fileChanges: FileChangeSummary;

  // Session timing
  sessionStartTime: number | null;
  lastActivityTime: number | null;

  // Current request tracking
  currentRequestStartTime: number | null;

  // Actions
  startRequest: () => void;
  completeRequest: (model: ClaudeModelId, inputTokens: number, outputTokens: number, cachedTokens?: number) => void;
  trackFileChange: (filePath: string, changeType: 'created' | 'modified' | 'deleted') => void;
  reset: () => void;
  getSummary: () => CostSummary;
}

// cost-calculator.ts
interface ModelPricing {
  inputPerMillion: number;        // USD per 1M input tokens
  outputPerMillion: number;       // USD per 1M output tokens
  cachedInputPerMillion: number;  // USD per 1M cached input tokens (90% discount)
}

interface CostSummary {
  totalCost: number;              // USD
  inputCost: number;
  outputCost: number;
  cachedDiscount: number;         // USD saved from caching
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  requestCount: number;
  totalApiDurationMs: number;
  wallDurationMs: number;
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  model: ClaudeModelId;
}

const MODEL_PRICING: Record<ClaudeModelId, ModelPricing> = {
  sonnet: { inputPerMillion: 3.00, outputPerMillion: 15.00, cachedInputPerMillion: 0.30 },
  opus:   { inputPerMillion: 15.00, outputPerMillion: 75.00, cachedInputPerMillion: 1.50 },
  haiku:  { inputPerMillion: 0.25, outputPerMillion: 1.25, cachedInputPerMillion: 0.025 },
};

function calculateCost(tokens: { input: number; output: number; cached: number }, model: ClaudeModelId): { total: number; input: number; output: number; discount: number };
function formatCost(usd: number): string;        // "$0.0123"
function formatTokens(count: number): string;    // "12.3K"
function formatDuration(ms: number): string;     // "2m 34s"
```

---

## Implementation Tasks

### T1: Cost Calculator Module (30 min)
**File:** `src/renderer/components/ide/claude/cost-calculator.ts`
- Define `MODEL_PRICING` constant with per-model rates for Sonnet, Opus, Haiku
- Implement `calculateCost()` using token counts and model pricing
- Cached tokens get 90% discount (charged at 10% of normal input rate)
- Implement `formatCost()` for USD display ($0.0123)
- Implement `formatTokens()` for human-readable token counts (1.2K, 45.6K, 1.2M)
- Implement `formatDuration()` for time display (2m 34s, 1h 05m)

### T2: Cost Calculator Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/cost-calculator.test.ts`
- Test calculateCost with known token counts for each model
- Test cached token discount: 1000 cached tokens at sonnet rate = $0.0003 (not $0.003)
- Test formatCost: edge cases (0, very small, large amounts)
- Test formatTokens: 0, 999, 1000 (1K), 1000000 (1M)
- Test formatDuration: 0ms, 500ms, 60000ms (1m), 3661000ms (1h 1m 1s)

### T3: Cost Tracking Store (45 min)
**File:** `src/renderer/stores/useClaudeCostStore.ts`
- Create Zustand store with all `ClaudeCostState` fields
- `startRequest()`: record current timestamp as `currentRequestStartTime`, set `sessionStartTime` if null
- `completeRequest()`: compute API duration, create `RequestMetrics` entry, update aggregates
- `trackFileChange()`: add file path to appropriate set (created/modified/deleted), deduplicate
- `reset()`: clear all state for new conversation
- `getSummary()`: compute and return `CostSummary` object using cost-calculator

### T4: Cost Store Tests (45 min)
**File:** `src/renderer/components/ide/claude/__tests__/useClaudeCostStore.test.ts`
- Test startRequest sets timing
- Test completeRequest accumulates tokens and creates request entry
- Test multiple requests aggregate correctly
- Test trackFileChange deduplicates paths
- Test getSummary computes correct totals
- Test reset clears everything
- Test wall duration calculation

### T5: Enhanced ClaudeCostDisplay (60 min)
**File:** `src/renderer/components/ide/claude/ClaudeCostDisplay.tsx`
- Rewrite component to show comprehensive breakdown:
  - **Cost**: Total cost in USD, with input/output/cached breakdown
  - **Tokens**: Input tokens | Output tokens | Cached tokens (with discount note)
  - **Duration**: API duration | Wall duration
  - **Changes**: N files created, N modified, N deleted
  - **Requests**: Total API request count
- Collapsible detail section (click to expand per-request breakdown)
- Compact default view: just total cost + total tokens + duration
- Use cost-calculator formatting functions

### T6: /cost Slash Command (30 min)
**Files:** `src/renderer/components/ide/claude/ClaudeSlashCommands.tsx`, `src/renderer/components/ide/claude/ClaudePanel.tsx`
- Register `/cost` in the slash command registry
- When invoked, generate a formatted system message in the chat:
  ```
  Session Cost Summary
  --------------------
  Total Cost: $0.0456
  Input Tokens: 12.3K ($0.0369)
  Output Tokens: 4.5K ($0.0675)
  Cached Tokens: 8.1K (saved $0.0219)
  API Duration: 45s
  Wall Duration: 12m 34s
  Requests: 8
  Changes: 2 files modified, 1 created
  ```
- Display as a system message (not sent to Claude API)

### T7: Stream Event Integration (30 min)
**File:** `src/renderer/stores/useClaudeStore.ts`
- In the stream event handler:
  - When sending a query: call `useClaudeCostStore.getState().startRequest()`
  - When receiving `type: 'usage'` event: store token counts temporarily
  - When receiving `type: 'done'` event: call `completeRequest()` with accumulated tokens
  - When receiving `type: 'tool_use'` with `toolName` in ['Write', 'Edit']: call `trackFileChange()`
- On `newConversation()`: call `useClaudeCostStore.getState().reset()`

### T8: Context Bar Enhancement (20 min)
**File:** `src/renderer/components/ide/claude/ClaudeContextBar.tsx`
- Add cached token indicator: show what portion of context is cached (lighter color in bar)
- Add tooltip showing: "X tokens used (Y cached) / 200K max"

### T9: Display Component Tests (30 min)
**File:** `src/renderer/components/ide/claude/__tests__/ClaudeCostDisplay.test.tsx`
- Test renders cost, tokens, duration, changes
- Test collapsible detail section
- Test correct formatting of all values
- Test empty state (no requests yet)
- Test /cost command output format

---

## Testing Requirements

### Unit Tests
- cost-calculator: all calculation functions, formatting, edge cases, all models
- useClaudeCostStore: all state transitions, aggregation, reset, summary
- ClaudeCostDisplay: rendering, formatting, expand/collapse, empty state
- /cost command: output format, all fields present

### Integration Tests
- Full flow: send message -> track timing -> receive usage -> display cost
- Multiple requests accumulate correctly
- File changes tracked from tool_use events
- New conversation resets cost tracking

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

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 22:

- [ ] `/cost command` - Show API token usage for current session (T6)
- [ ] `Total cost display` - Monetary cost of API calls (T1, T5)
- [ ] `API duration` - Time spent on API calls (T3, T5)
- [ ] `Wall duration` - Total elapsed time (T3, T5)
- [ ] `Code changes summary` - Summary of files changed (T3, T5, T7)
- [ ] `Token counts` - Input/output token breakdown (T3, T5)
- [ ] `Cached token discount` - 90% discount on cached tokens visible in cost display (T1, T5, T8)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Model pricing changes over time | High | Low | Store pricing as configurable constant; easy to update |
| API duration measurement inaccurate due to streaming | Medium | Low | Measure from first request byte to last stream event; note "approximate" in UI |
| Cached token count not available in stream events | Medium | Medium | Default to 0 cached tokens if not reported; add when API provides this data |
| Cost display clutters small panels | Low | Low | Compact default view; full detail only on expand or /cost command |

---

## Notes

- Model pricing is based on published Anthropic API rates as of February 2026. These should be maintained as a configurable constant that can be updated without code changes.
- The cached token metric depends on the Claude API reporting cached token counts in usage events. If `ClaudeStreamEvent.usage` does not include cached counts, we track 0 and add the field when available.
- Wall duration is measured from the first message in the current conversation to the current time, not from application start.
- The `/cost` command inserts a local system message into the chat. It does not make an API call and does not consume tokens.
- File change tracking deduplicates by path. If a file is edited multiple times, it appears once in "modified".
- Per-request detail in the collapsible section shows each API call with its individual tokens, cost, and duration. This is useful for understanding which prompts are expensive.
