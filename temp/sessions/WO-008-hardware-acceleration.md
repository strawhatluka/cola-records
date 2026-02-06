# ORCHESTRATOR WORK ORDER #008
## Type: IMPLEMENTATION
## Hardware Acceleration & Performance Optimization

---

## MISSION OBJECTIVE

Implement all 11 hardware acceleration and performance optimization recommendations from the JUNO audit (2026-02-04). All changes must preserve existing functionality exactly — zero behavioral regressions.

**Implementation Goal:** GPU-optimized CSS transitions, lazy-loaded images, memoized components, throttled scroll handlers, and Electron GPU configuration — all without breaking existing behavior.
**Based On:** JUNO Hardware Acceleration Audit (trinity/reports/JUNO-AUDIT-HARDWARE-ACCELERATION-2026-02-04.md)

---

## TRA COMPLEXITY ANALYSIS

| Task | Complexity | Risk | Rationale |
|------|-----------|------|-----------|
| Image lazy loading (31 tags) | 1 (Low) | LOW | Additive attribute, no behavior change |
| CSS transition-all → specific (7 instances) | 2 (Low) | LOW | CSS-only, visual-only change |
| will-change hints (4 elements) | 1 (Low) | LOW | Additive CSS, no behavior change |
| Accordion height → max-height | 3 (Low) | LOW | Tailwind config change, visual animation |
| React.memo on MessageItem | 3 (Low) | MEDIUM | Must verify props are stable references |
| React.memo on ServerList items | 2 (Low) | LOW | No local state, pure render |
| React.memo on ChannelList items | 2 (Low) | LOW | No local state, pure render |
| useMemo on DiscordMarkdown | 3 (Low) | LOW | Memoize tokenization by content string |
| Throttle scroll handlers (2 pickers) | 4 (Medium) | MEDIUM | Must maintain section tracking accuracy |
| Electron GPU flags | 2 (Low) | LOW | App startup config, no runtime change |
| Contribution scanner → Worker Thread | 7 (High) | HIGH | Architecture change, IPC bridge needed |

**Total Scale:** LARGE (11 tasks, 20+ files, multiple architectural areas)
**Stop Points:** 4 (requirements ✓, design ✓, plan ✓, final)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/renderer/components/discord/MessageItem.tsx
    changes: Wrap export in React.memo
    risk: MEDIUM

  - path: src/renderer/components/discord/DiscordMarkdown.tsx
    changes: Add useMemo for tokenization
    risk: LOW

  - path: src/renderer/components/discord/EmojiPicker.tsx
    changes: Throttle scroll handler, add loading="lazy"
    risk: MEDIUM

  - path: src/renderer/components/discord/StickerPicker.tsx
    changes: Throttle scroll handler
    risk: MEDIUM

  - path: src/main/services/contribution-scanner.service.ts
    changes: Move scanning to Worker Thread
    risk: HIGH

  - path: src/main/index.ts
    changes: Add GPU command-line switches
    risk: LOW

Supporting_Files:
  - src/renderer/components/layout/Sidebar.tsx - transition-all → transition-[width]
  - src/renderer/components/ThemeToggle.tsx - transition-all → transition-transform
  - src/renderer/components/ui/Progress.tsx - transition-all → transition-[transform]
  - src/renderer/components/discord/GifPicker.tsx - transition-all → transition-[filter]
  - src/renderer/components/discord/ServerList.tsx - transition-all → transition-[border-radius,background-color], React.memo
  - src/renderer/components/discord/ChannelList.tsx - React.memo on ChannelItem
  - src/renderer/components/discord/MessageList.tsx - No direct changes (benefits from MessageItem memo)
  - src/renderer/components/discord/DMList.tsx - loading="lazy"
  - src/renderer/components/discord/EmbedRenderer.tsx - loading="lazy"
  - src/renderer/components/discord/MessageInput.tsx - loading="lazy"
  - src/renderer/components/discord/PollRenderer.tsx - loading="lazy"
  - src/renderer/components/discord/ReactionBar.tsx - loading="lazy"
  - src/renderer/components/discord/AttachmentRenderer.tsx - loading="lazy"
  - src/renderer/components/spotify/NowPlaying.tsx - loading="lazy"
  - src/renderer/components/spotify/PlaylistPanel.tsx - loading="lazy"
  - src/renderer/components/spotify/SearchPanel.tsx - loading="lazy"
  - src/renderer/components/issues/DevelopmentIssueDetailModal.tsx - loading="lazy"
  - src/renderer/components/pull-requests/PullRequestDetailModal.tsx - loading="lazy"
  - tailwind.config.js - accordion height → max-height keyframes
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Zero-Risk Attribute Changes (Image Lazy Loading)
**Complexity: 1 | Risk: LOW | Parallelizable: YES**

Add `loading="lazy"` to all `<img>` tags that don't already have it. This is a purely additive HTML attribute with zero behavioral side effects.

- [ ] 1.1 Add `loading="lazy"` to MessageItem.tsx avatar img (line ~70)
- [ ] 1.2 Add `loading="lazy"` to MessageItem.tsx sticker img
- [ ] 1.3 Add `loading="lazy"` to DiscordMarkdown.tsx emote img tags (2 locations)
- [ ] 1.4 Add `loading="lazy"` to DMList.tsx avatar img
- [ ] 1.5 Add `loading="lazy"` to EmbedRenderer.tsx img tags (3 locations)
- [ ] 1.6 Add `loading="lazy"` to EmojiPicker.tsx img tags (2 locations)
- [ ] 1.7 Add `loading="lazy"` to MessageInput.tsx preview img
- [ ] 1.8 Add `loading="lazy"` to PollRenderer.tsx emoji img
- [ ] 1.9 Add `loading="lazy"` to ReactionBar.tsx emoji img
- [ ] 1.10 Add `loading="lazy"` to ServerList.tsx guild icon img (line ~59)
- [ ] 1.11 Add `loading="lazy"` to AttachmentRenderer.tsx img
- [ ] 1.12 Add `loading="lazy"` to NowPlaying.tsx album art img
- [ ] 1.13 Add `loading="lazy"` to PlaylistPanel.tsx thumbnail img
- [ ] 1.14 Add `loading="lazy"` to SearchPanel.tsx thumbnail img
- [ ] 1.15 Add `loading="lazy"` to PullRequestDetailModal.tsx avatar imgs (3 locations)
- [ ] 1.16 Add `loading="lazy"` to DevelopmentIssueDetailModal.tsx avatar img

**⏸️ STOP POINT 1:** User runs tests. All must pass before continuing.

---

### Phase 2: CSS-Only Optimizations (Transitions + will-change + Accordion)
**Complexity: 2-3 | Risk: LOW | Parallelizable: YES**

Replace `transition-all` with property-specific transitions and add GPU layer hints. Visual-only changes — no logic affected.

#### 2A: Replace transition-all (7 instances)
- [ ] 2A.1 Sidebar.tsx:36 — `transition-all duration-300` → `transition-[width] duration-300`
- [ ] 2A.2 ThemeToggle.tsx:19 — `transition-all` → `transition-transform`
- [ ] 2A.3 ThemeToggle.tsx:20 — `transition-all` → `transition-transform`
- [ ] 2A.4 Progress.tsx:22 — `transition-all` → `transition-transform`
- [ ] 2A.5 GifPicker.tsx:128 — `transition-all` → `transition-[filter]`
- [ ] 2A.6 ServerList.tsx:14 — `transition-all` → `transition-[border-radius,background-color]`
- [ ] 2A.7 ServerList.tsx:48 — `transition-all` → `transition-[border-radius,background-color]`

#### 2B: Add will-change hints (4 elements)
- [ ] 2B.1 Sidebar.tsx — add `will-change-[width]` to the animated aside element
- [ ] 2B.2 ThemeToggle.tsx — add `will-change-transform` to both icon elements
- [ ] 2B.3 Progress.tsx — add `will-change-transform` to the indicator element

#### 2C: Accordion animation fix
- [ ] 2C.1 tailwind.config.js — change accordion keyframes from `height` to `max-height`:
  ```js
  'accordion-down': {
    from: { 'max-height': '0', overflow: 'hidden' },
    to: { 'max-height': 'var(--radix-accordion-content-height)', overflow: 'hidden' },
  },
  'accordion-up': {
    from: { 'max-height': 'var(--radix-accordion-content-height)', overflow: 'hidden' },
    to: { 'max-height': '0', overflow: 'hidden' },
  },
  ```

**⏸️ STOP POINT 2:** User runs tests. Verify all animations still function visually.

---

### Phase 3: React Memoization (memo + useMemo)
**Complexity: 3 | Risk: MEDIUM | Parallelizable: YES (across components)**

Wrap key components in React.memo and add useMemo for expensive computations. Must verify that callback props are stable (not recreated on every render).

#### 3A: DiscordMarkdown useMemo
- [ ] 3A.1 DiscordMarkdown.tsx — wrap the `tokenize()` call result in `useMemo` keyed on `content` string
  ```tsx
  const tokens = useMemo(() => tokenize(text), [text]);
  ```

#### 3B: MessageItem React.memo
- [ ] 3B.1 MessageItem.tsx — wrap export in `React.memo`:
  ```tsx
  export const MessageItem = React.memo(function MessageItem({ ... }: MessageItemProps) {
    // existing component body
  });
  ```
- [ ] 3B.2 MessageList.tsx — verify callback props passed to MessageItem are wrapped in `useCallback`:
  - `onReactionToggle` — check if stable
  - `onReply` — check if stable
  - `onEdit` — check if stable
  - `onDelete` — check if stable
  - `onEmojiPick` — check if stable
  - If any are inline arrow functions, wrap in `useCallback`

#### 3C: ServerList item memoization
- [ ] 3C.1 ServerList.tsx — if there's a sub-component for individual server buttons, wrap in React.memo. If inline JSX, extract to a memoized sub-component.

#### 3D: ChannelList item memoization
- [ ] 3D.1 ChannelList.tsx — wrap the `ChannelItem` sub-component in React.memo (it already exists as a sub-component with 4 props)

**⏸️ STOP POINT 3:** User runs tests. All must pass. Verify Discord message rendering, channel switching, server switching all work correctly.

---

### Phase 4: Scroll Handler Throttling
**Complexity: 4 | Risk: MEDIUM**

Wrap scroll handlers in `requestAnimationFrame` to limit to ~60fps instead of firing on every pixel.

- [ ] 4.1 EmojiPicker.tsx — wrap `handleScroll` in RAF:
  ```tsx
  const rafRef = useRef<number>(0);
  const handleScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // existing scroll logic
    });
  };
  // cleanup in useEffect return: cancelAnimationFrame(rafRef.current)
  ```

- [ ] 4.2 StickerPicker.tsx — same RAF pattern as EmojiPicker

- [ ] 4.3 Verify section highlighting still updates correctly when scrolling through emoji/sticker categories

**⏸️ STOP POINT 4 (FINAL):** User runs tests. Full verification of all changes.

---

### Phase 5: Electron GPU Configuration
**Complexity: 2 | Risk: LOW**

Add GPU acceleration command-line switches to Electron app startup. These are safe flags that Electron/Chromium already supports.

- [ ] 5.1 src/main/index.ts — add GPU switches BEFORE `app.on('ready', ...)`:
  ```ts
  // GPU acceleration optimization
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  ```

---

### Phase 6: Contribution Scanner Worker Thread (DEFERRED)
**Complexity: 7 | Risk: HIGH**

> **TRA RECOMMENDATION: DEFER TO SEPARATE WORK ORDER**
>
> Moving the contribution scanner to a Worker Thread is a significant architectural change that:
> - Requires creating a new worker script file
> - Needs IPC bridging between worker and main thread
> - Must handle worker lifecycle (spawn, terminate, error recovery)
> - Changes the async flow of contribution scanning
> - Risk of breaking contribution detection and My Projects screen
>
> This should be WO-009 as a standalone effort with its own investigation phase.

---

### Phase 7: Dead Dependency Cleanup (DEFERRED)
**Complexity: 1 | Risk: LOW**

> **TRA RECOMMENDATION: DEFER TO SESSION END**
>
> Removing dead dependencies (`@xterm/*`, `pdfjs-dist`, `react-pdf`) requires `npm uninstall` which modifies `package.json` and `package-lock.json`. This is a cleanup task best done at session end before LUKA's commit, not mid-implementation.

---

## SEQUENCING & PARALLELIZATION

```json
{
  "tasks": [
    {
      "id": "P1",
      "description": "Image lazy loading — add loading='lazy' to 31 img tags across 15 files",
      "dependencies": [],
      "complexity": 1,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P2A",
      "description": "Replace transition-all with specific properties (7 instances, 5 files)",
      "dependencies": [],
      "complexity": 2,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P2B",
      "description": "Add will-change GPU hints (3 files)",
      "dependencies": [],
      "complexity": 1,
      "basGates": ["lint", "build"]
    },
    {
      "id": "P2C",
      "description": "Fix accordion height animation in tailwind config",
      "dependencies": [],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P3A",
      "description": "Add useMemo to DiscordMarkdown tokenization",
      "dependencies": [],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P3B",
      "description": "Wrap MessageItem in React.memo + stabilize callbacks in MessageList",
      "dependencies": [],
      "complexity": 3,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P3C",
      "description": "Memoize ServerList server button sub-component",
      "dependencies": [],
      "complexity": 2,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P3D",
      "description": "Wrap ChannelList ChannelItem in React.memo",
      "dependencies": [],
      "complexity": 2,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P4",
      "description": "Throttle EmojiPicker + StickerPicker scroll handlers with RAF",
      "dependencies": [],
      "complexity": 4,
      "basGates": ["lint", "build", "test"]
    },
    {
      "id": "P5",
      "description": "Add Electron GPU command-line switches",
      "dependencies": [],
      "complexity": 2,
      "basGates": ["lint", "build"]
    }
  ],
  "sequence": ["P1", "P2A", "P2B", "P2C", "P3A", "P3B", "P3C", "P3D", "P4", "P5"],
  "parallelizable": [
    ["P1", "P2A", "P2B", "P2C"],
    ["P3A", "P3B", "P3C", "P3D"],
    ["P4", "P5"]
  ],
  "stopPoints": [
    "After Phase 1 (image lazy loading) — user tests",
    "After Phase 2 (CSS optimizations) — user tests + visual verification",
    "After Phase 3 (React memoization) — user tests + functional verification",
    "After Phase 5 (all complete) — user final tests"
  ],
  "deferred": [
    "Phase 6: Contribution Scanner Worker Thread → WO-009",
    "Phase 7: Dead Dependency Cleanup → session end"
  ]
}
```

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `HW-ACCELERATION-IMPLEMENTATION-COMPLETE-20260204.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with file:line references
3. **Test Results** - User-confirmed test pass at each stop point
4. **Metrics** - Files changed, img tags updated, transitions optimized, components memoized
5. **Rollback Plan** - Each phase is independently revertible
6. **Next Steps** - WO-009 for Worker Thread, dependency cleanup

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Specific line numbers for critical changes
- Test output showing success (user-provided)
- List of deferred items with rationale

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `HW-ACCELERATION-IMPLEMENTATION-COMPLETE-20260204.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-008-hardware-acceleration.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-008-hardware-acceleration.md`
   - [ ] Completion report exists in: `trinity/reports/HW-ACCELERATION-IMPLEMENTATION-COMPLETE-20260204.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 31 `<img>` tags have `loading="lazy"`
- [ ] All 7 `transition-all` instances replaced with specific properties
- [ ] `will-change` hints added to 3 animated elements
- [ ] Accordion keyframes use `max-height` instead of `height`
- [ ] MessageItem, ChannelItem wrapped in React.memo
- [ ] DiscordMarkdown tokenization wrapped in useMemo
- [ ] EmojiPicker and StickerPicker scroll handlers throttled with RAF
- [ ] Electron GPU switches added to main process
- [ ] All existing tests pass (user-verified at each stop point)
- [ ] No visual or behavioral regressions
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### ⚠️ CRITICAL RESTRICTIONS - TEST EXECUTION FORBIDDEN

Only LUKA runs `npm test`. Do NOT execute test commands. Prepare changes and wait for user confirmation at each stop point.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond the requirements
- [ ] Remove or rename existing exports
- [ ] Change component prop interfaces
- [ ] Break any existing animations (they should look the same, just render more efficiently)
- [ ] Perform ANY git operations
- [ ] Run `npm test` or any test commands

### DO:
- [ ] Follow existing code patterns
- [ ] Maintain consistent style
- [ ] Test changes at each stop point via user
- [ ] Verify animations still look correct after CSS changes
- [ ] Ensure memoized components still receive updated data

---

## ROLLBACK STRATEGY

Each phase is independently revertible:
1. **Phase 1 rollback:** Remove `loading="lazy"` attributes
2. **Phase 2 rollback:** Restore `transition-all`, remove `will-change`, restore accordion `height`
3. **Phase 3 rollback:** Remove `React.memo` wrappers, remove `useMemo`, remove `useCallback`
4. **Phase 4 rollback:** Remove RAF wrapper, restore direct scroll handlers
5. **Phase 5 rollback:** Remove `app.commandLine.appendSwitch()` calls

**Critical Files Backup:** Not needed — all changes are small, additive, and independently revertible.

---

## CONTEXT FROM INVESTIGATION

**Source Investigation:** JUNO Hardware Acceleration Audit (2026-02-04)
**Key Findings:** 11 optimization opportunities across P1-P3 priority
**Root Causes Being Fixed:** No explicit HW acceleration config, no memoization, no lazy loading, layout-triggering CSS animations
**Expected Impact:** Reduced DOM operations, GPU-composited animations, lazy-loaded images, memoized re-renders

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified changes must be implemented (Phases 1-5)
**Risk Level:** MEDIUM (individually low-risk changes, but touching 20+ files)
**Risk Factors:**
- React.memo could mask state updates if callback props aren't stable
- Scroll throttling could make section highlights feel laggy
- Accordion max-height animation may differ slightly from height animation

**Mitigation:**
- Verify callback stability before memoizing (Phase 3B.2)
- Use requestAnimationFrame (not setTimeout) for scroll throttling — maintains 60fps
- Test accordion open/close visually after Phase 2C

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
