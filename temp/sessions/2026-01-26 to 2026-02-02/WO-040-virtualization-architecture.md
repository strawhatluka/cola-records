# ORCHESTRATOR WORK ORDER #040
## Type: IMPLEMENTATION
## Virtualization & Architecture — Hardware Acceleration Phase 4

---

## MISSION OBJECTIVE

Perform structural refactoring to virtualize long lists and decompose monolithic components. This is the final phase: split the 600+ line ClaudePanel into focused sub-components, virtualize the Claude message list and search results with `react-window`, and write comprehensive tests for all changes.

**Implementation Goal:** 4 audit items resolved (RENDER-004, RENDER-006, RENDER-009, plus comprehensive test coverage) across 4 tasks.
**Based On:** JUNO Audit `trinity/reports/AUDIT-JUNO-HARDWARE-ACCELERATION-2026-01-31.md` and TRA Plan `trinity/plans/TRA-PLAN-HARDWARE-ACCELERATION-2026-01-31.md`

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/ide/claude/ClaudePanel.tsx
    changes: Extract sub-components (ClaudeContextBar, ClaudeMessageList, ClaudeInputSection)
    risk: HIGH

  - path: src/renderer/components/ide/claude/ClaudeMessageList.tsx
    changes: NEW FILE - Virtualized message list with react-window VariableSizeList
    risk: HIGH

  - path: src/renderer/components/ide/search/SearchPanel.tsx
    changes: Virtualize search results with react-window
    risk: MEDIUM

Supporting_Files:
  - src/renderer/components/ide/claude/ClaudeContextBar.tsx - NEW FILE: model/token/permission display
  - src/renderer/components/ide/claude/ClaudeInputSection.tsx - NEW FILE: input area + slash commands
  - tests/renderer/components/ide/claude/ClaudePanel.test.tsx - Update for sub-components
  - tests/renderer/components/ide/claude/ClaudeMessageList.test.tsx - NEW: virtualization tests
  - tests/renderer/components/ide/search/SearchPanel.test.tsx - Update for virtualization
```

### Changes Required

#### Change Set 1: Split ClaudePanel (T-029) — RENDER-009
**Files:** `src/renderer/components/ide/claude/ClaudePanel.tsx` → 3 sub-components
**Current State:** Monolithic ~600 line component with ~30 store selectors; every selector change re-renders entire panel
**Target State:** 3 focused sub-components, each subscribing only to needed store slices
**Implementation:**
```
ClaudePanel.tsx (orchestrator)
├── ClaudeContextBar.tsx — model selector, token count, permission mode
│   └── Subscribes to: model, tokenCount, permissionMode, isStreaming
├── ClaudeMessageList.tsx — message rendering loop + auto-scroll
│   └── Subscribes to: messages, isStreaming, currentAssistantMessageId
└── ClaudeInputSection.tsx — input area, slash commands, attachments
    └── Subscribes to: inputValue, isStreaming, attachments, sendMessage
```
- ClaudePanel becomes a thin wrapper that renders the 3 sub-components
- Each sub-component imports its own store selectors
- No behavior change — purely structural refactoring

#### Change Set 2: Virtualize Claude Message List (T-030) — RENDER-004
**Files:** `src/renderer/components/ide/claude/ClaudeMessageList.tsx`
**Current State:** Messages rendered with `.map()` in plain `overflow-y-auto` div
**Target State:** `react-window` `<VariableSizeList>` with dynamic row heights
**Implementation:**
```typescript
import { VariableSizeList } from 'react-window';

// Message list with dynamic heights:
const listRef = useRef<VariableSizeList>(null);
const rowHeights = useRef<Map<number, number>>(new Map());

const getItemSize = (index: number) => rowHeights.current.get(index) || 200;

const setRowHeight = useCallback((index: number, height: number) => {
  rowHeights.current.set(index, height);
  listRef.current?.resetAfterIndex(index, false);
}, []);

// Auto-scroll to bottom on new messages:
useEffect(() => {
  if (isStreaming && listRef.current) {
    listRef.current.scrollToItem(messages.length - 1, 'end');
  }
}, [messages.length, isStreaming]);

// Row renderer measures its own height:
const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rowRef.current) {
      setRowHeight(index, rowRef.current.getBoundingClientRect().height);
    }
  });
  return (
    <div style={style}>
      <div ref={rowRef}>
        <ClaudeMessage message={messages[index]} ... />
      </div>
    </div>
  );
};
```
**Critical behavior to preserve:**
- Auto-scroll to bottom during streaming
- User can scroll up to read history (disable auto-scroll when scrolled up)
- Scroll position preserved during re-renders

#### Change Set 3: Virtualize SearchPanel Results (T-031) — RENDER-006
**Files:** `src/renderer/components/ide/search/SearchPanel.tsx`
**Current State:** Nested `.map()` renders all search results in DOM
**Target State:** `react-window` `<VariableSizeList>` with grouped file results
**Implementation:**
```typescript
// Flatten results into row items:
const flatResults = useMemo(() => {
  const items: Array<{ type: 'header' | 'result'; ... }> = [];
  for (const group of searchResults) {
    items.push({ type: 'header', file: group.file });
    for (const result of group.results) {
      items.push({ type: 'result', ...result });
    }
  }
  return items;
}, [searchResults]);

// Render with VariableSizeList:
<VariableSizeList
  height={containerHeight}
  itemCount={flatResults.length}
  itemSize={(i) => flatResults[i].type === 'header' ? 32 : 24}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {flatResults[index].type === 'header'
        ? <FileHeader ... />
        : <SearchResult ... />}
    </div>
  )}
</VariableSizeList>
```

#### Change Set 4: Tests (T-032)
**Files:** Test files for ClaudePanel, ClaudeMessageList, SearchPanel
**Action:**
- Update existing ClaudePanel tests for new sub-component structure
- Add tests for ClaudeContextBar, ClaudeInputSection
- Add tests for virtualized ClaudeMessageList (scroll behavior, dynamic heights)
- Add tests for virtualized SearchPanel (flattened results, headers)
- Verify all existing behavior preserved

---

## IMPLEMENTATION APPROACH

### Step 1: Split ClaudePanel (T-029)
- [ ] Create `ClaudeContextBar.tsx` — extract model/token/permission display
- [ ] Create `ClaudeInputSection.tsx` — extract input area + slash commands
- [ ] Create `ClaudeMessageList.tsx` — extract message rendering loop
- [ ] Refactor `ClaudePanel.tsx` to render the 3 sub-components
- [ ] Each sub-component uses its own minimal store selectors
- [ ] Run tests — verify no behavioral changes
- [ ] Verify UI renders identically

### Step 2: Virtualize Message List (T-030)
- [ ] Import `VariableSizeList` from `react-window` in ClaudeMessageList
- [ ] Implement dynamic row height measurement
- [ ] Implement auto-scroll-to-bottom during streaming
- [ ] Implement scroll-up detection to pause auto-scroll
- [ ] Handle edge cases: empty list, single message, very long messages
- [ ] Verify code blocks, tool calls, and markdown render correctly in virtual rows

### Step 3: Virtualize Search Results (T-031)
- [ ] Flatten grouped search results into row items
- [ ] Implement `VariableSizeList` with header/result row types
- [ ] Preserve file group visual hierarchy
- [ ] Handle edge cases: no results, single result, very large result sets
- [ ] Verify click-to-open-file still works

### Step 4: Write Tests (T-032)
- [ ] Update existing ClaudePanel tests for new component structure
- [ ] Add unit tests for each extracted sub-component
- [ ] Add virtualization tests (scroll behavior, dynamic heights, auto-scroll)
- [ ] Add SearchPanel virtualization tests
- [ ] Run full test suite — all tests pass
- [ ] Verify coverage meets 80% threshold

### Step 5: Validation
- [ ] Run full test suite — all tests pass
- [ ] Run build — production build succeeds
- [ ] BAS quality gates: lint, build, test, coverage, final review

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `PERF-PHASE4-IMPLEMENTATION-COMPLETE-2026-01-31.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Component decomposition and list virtualization
2. **Changes Applied** - New files created, existing files refactored
3. **Test Results** - Full test suite results with coverage
4. **Metrics** - DOM node count before/after for large message lists
5. **Rollback Plan** - Revert to monolithic ClaudePanel
6. **Next Steps** - All 38 audit items complete

### Evidence to Provide
- File diff statistics
- New file listings
- Test output showing all passing
- Coverage report (≥80%)
- Build verification

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `PERF-PHASE4-IMPLEMENTATION-COMPLETE-2026-01-31.md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-040-virtualization-architecture.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-040-virtualization-architecture.md`
   - [ ] Completion report exists in: `trinity/reports/PERF-PHASE4-IMPLEMENTATION-COMPLETE-2026-01-31.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] ClaudePanel split into 3 focused sub-components
- [ ] Claude message list virtualized with `react-window` VariableSizeList
- [ ] Auto-scroll-to-bottom works during streaming
- [ ] Scroll-up pauses auto-scroll (user can read history)
- [ ] SearchPanel results virtualized
- [ ] All new and existing tests pass
- [ ] Coverage ≥80% for modified/new files
- [ ] Production build succeeds
- [ ] No visual regressions — UI renders identically
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, etc.

### Do NOT:
- [ ] Change any business logic during the refactoring
- [ ] Remove any existing features or behavior
- [ ] Add new features beyond what's specified
- [ ] Break existing keyboard shortcuts or accessibility

### DO:
- [ ] Preserve 100% behavioral parity during ClaudePanel split
- [ ] Test auto-scroll thoroughly (most likely regression point)
- [ ] Measure row heights after markdown/code block rendering
- [ ] Handle window resize gracefully with virtualized lists
- [ ] Follow existing component patterns for new files

---

## ROLLBACK STRATEGY

If issues arise:
1. **ClaudePanel split:** Revert to original monolithic ClaudePanel.tsx, delete sub-component files
2. **Message virtualization:** Replace `VariableSizeList` with original `.map()` rendering
3. **Search virtualization:** Replace `VariableSizeList` with original nested `.map()`
4. **Tests:** Revert test file changes

**Critical Files Backup:** `ClaudePanel.tsx`, `SearchPanel.tsx`

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-01-31)
**Key Findings:** ClaudePanel has ~30 store selectors causing full re-renders; message list rendered with `.map()` without virtualization; search results render all DOM nodes; long conversations accumulate thousands of DOM nodes
**Root Causes Being Fixed:** Monolithic component with excessive selector surface, non-virtualized lists, O(n) DOM nodes for large datasets
**Expected Impact:** Reduced re-render surface area (3 focused components vs 1 monolithic), O(visible) DOM nodes instead of O(total) for message and search lists, dramatically improved performance for long conversations

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
**Implementation Scope:** COMPREHENSIVE — 4 items, 4 tasks, largest architectural scope
**Completeness Required:** 100%
**Risk Level:** HIGH — Structural refactoring of core UI components
**Risk Factors:**
- ClaudePanel split could break tests that reference internal structure
- Message list virtualization could break auto-scroll behavior
- Dynamic row height measurement may not capture markdown rendering
- react-window may not handle very tall rows (large code blocks) well

**Mitigation:**
- Preserve all public API/props during split — tests adapt to new imports
- Implement explicit scroll-to-bottom with `scrollToItem` API
- Use ResizeObserver or post-render measurement for row heights
- Set generous default row height (200px) with measurement override
- `react-window` is already a project dependency — no version risk

---

## DEPENDENCY CHAIN

```
T-029 (Split ClaudePanel) → T-030 (Virtualize messages)  [split first, then virtualize]
T-031 (Virtualize search) — independent, can parallel with T-030
T-032 (Tests) → depends on T-029, T-030, T-031 [tests after all structural changes]
```

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
