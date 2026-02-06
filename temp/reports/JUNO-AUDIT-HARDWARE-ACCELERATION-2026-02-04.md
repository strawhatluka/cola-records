# JUNO Hardware Acceleration Audit Report

**Audit Date:** 2026-02-04
**Audit Mode:** TARGETED (Hardware Acceleration Focus)
**Scope:** Full codebase — Electron main process + React renderer
**Confidence:** HIGH (100% source file coverage, systematic tool-based analysis)

---

## Executive Summary

**Project:** Cola Records (Electron 40 + React 19 + Vite 7)
**Total LOC:** ~18,099 across 115 TS/TSX files
**Verdict:** The application makes **zero explicit use of hardware acceleration**. Electron defaults handle basic GPU compositing, but significant optimization opportunities exist across list virtualization, CSS animations, image loading, and component memoization. Terminal is provided by embedded VS Code (Code Server), not a standalone XTerm component.

---

## Findings by Priority

### P0 — CRITICAL (Immediate Performance Impact)

**None found.** No active performance regressions that would cause crashes or freezes.

---

### P1 — HIGH (Significant Optimization Opportunities)

#### 1. react-window Installed But Unused
- **Impact:** Discord message lists, channel lists, and DM lists render ALL items in the DOM
- **Location:** `package.json` has `react-window: ^2.2.5` and `react-virtualized-auto-sizer: ^2.0.2`
- **Usage:** Zero imports of `react-window` anywhere in `src/renderer/`
- **Affected components:**
  - `MessageList.tsx` — renders all messages without virtualization
  - `ChannelList.tsx` — renders all channels
  - `DMList.tsx` — renders all DM conversations
  - `EmojiPicker.tsx` — renders all emoji in a grid
  - `StickerPicker.tsx` — renders all stickers
- **Why it matters:** A server with 100+ messages creates 100+ DOM nodes with avatars, markdown parsing, embeds, and reactions. Virtualization would render only ~15-20 visible items.

#### 2. Zero `React.memo` Usage Across Entire Codebase
- **Impact:** Every parent re-render causes full child tree re-renders
- **Location:** Searched all of `src/renderer/` — no `React.memo` or `memo()` calls found
- **Critical targets for memoization:**
  - `MessageItem.tsx` — re-renders on every poll cycle (10s interval at [MessageList.tsx:67](src/renderer/components/discord/MessageList.tsx#L67))
  - `ContributionCard` — re-renders when any store state changes
  - `ServerList.tsx` server icons — static between fetches
  - `ChannelList.tsx` channel items — static between fetches
- **`useMemo` usage:** Only 5 instances found (CreatePullRequestModal, EmojiPicker, StickerPicker) — adequate for those components but missing from hot paths

---

### P2 — MEDIUM (GPU Compositing & CSS Optimization)

#### 3. `transition-all` Causes Layout Thrashing (7 instances)
- **Impact:** `transition-all` animates ALL CSS properties including `width`, `height`, `margin`, `padding` — forcing the browser to recalculate layout on every frame instead of using GPU-only transform/opacity compositing
- **Locations:**
  - [Sidebar.tsx:36](src/renderer/components/layout/Sidebar.tsx#L36) — `transition-all duration-300` (sidebar collapse animation)
  - [ThemeToggle.tsx:19](src/renderer/components/ThemeToggle.tsx#L19) — `transition-all` (sun icon rotate/scale)
  - [ThemeToggle.tsx:20](src/renderer/components/ThemeToggle.tsx#L20) — `transition-all` (moon icon rotate/scale)
  - [Progress.tsx:22](src/renderer/components/ui/Progress.tsx#L22) — `transition-all` (progress bar width)
  - [GifPicker.tsx:128](src/renderer/components/discord/GifPicker.tsx#L128) — `transition-all` (hover brightness)
  - [ServerList.tsx:14](src/renderer/components/discord/ServerList.tsx#L14) — `transition-all` (icon shape morph)
  - [ServerList.tsx:48](src/renderer/components/discord/ServerList.tsx#L48) — `transition-all` (icon shape morph)
- **Fix:** Replace with specific properties:
  - Sidebar: `transition-[width]` or `transition-transform`
  - ThemeToggle: `transition-transform` (only rotates/scales)
  - Progress: `transition-[width]`
  - GifPicker: `transition-[filter]`
  - ServerList: `transition-[border-radius]`

#### 4. Zero `will-change` or GPU Layer Hints
- **Impact:** Browser has no advance knowledge of which elements will animate, preventing GPU layer pre-promotion
- **Location:** Searched entire `src/` — no `will-change`, `translateZ(0)`, or `translate3d` found anywhere
- **Candidates for `will-change`:**
  - Sidebar collapse (`will-change: width` or use transform-based animation)
  - ThemeToggle icons (`will-change: transform`)
  - Progress bar (`will-change: width`)
  - Popover content (`will-change: transform, opacity`)

#### 5. Accordion Animates `height` (Layout-Triggering)
- **Location:** [tailwind.config.js:54-66](tailwind.config.js#L54-L66)
  ```js
  'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } }
  'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } }
  ```
- **Impact:** Animating `height` triggers layout recalculation every frame. GPU cannot composite height changes — it must reflow the entire document below the accordion.
- **Fix:** Use `max-height` with `overflow: hidden`, or use `transform: scaleY()` with `transform-origin: top` for GPU-only animation.

#### 6. Images Without `loading="lazy"` (13 of 15 `<img>` tags)
- **Impact:** All images load immediately even when off-screen, consuming bandwidth and blocking the compositor
- **With lazy loading:** Only 2 components use it:
  - [GifPicker.tsx:159](src/renderer/components/discord/GifPicker.tsx#L159)
  - [StickerPicker.tsx:201](src/renderer/components/discord/StickerPicker.tsx#L201)
- **Without lazy loading (13 instances):**
  - [MessageItem.tsx:70](src/renderer/components/discord/MessageItem.tsx#L70) — author avatars (rendered per message)
  - [NowPlaying.tsx:45](src/renderer/components/spotify/NowPlaying.tsx#L45) — album art
  - [PlaylistPanel.tsx:31](src/renderer/components/spotify/PlaylistPanel.tsx#L31) — playlist thumbnails
  - [SearchPanel.tsx:36](src/renderer/components/spotify/SearchPanel.tsx#L36) — search result thumbnails
  - [ServerList.tsx:59](src/renderer/components/discord/ServerList.tsx#L59) — server icons
  - [EmojiPicker.tsx:243,300](src/renderer/components/discord/EmojiPicker.tsx#L243) — custom emoji images
  - [EmbedRenderer.tsx:47,111,171](src/renderer/components/discord/EmbedRenderer.tsx#L47) — embed author/footer icons
  - [PullRequestDetailModal.tsx:335,363,388](src/renderer/components/pull-requests/PullRequestDetailModal.tsx#L335) — comment author avatars
  - [DevelopmentIssueDetailModal.tsx:483](src/renderer/components/issues/DevelopmentIssueDetailModal.tsx#L483) — comment author avatar

---

### P3 — LOW (Electron Configuration & Background Processing)

#### 7. No Explicit Electron GPU Configuration
- **Location:** [src/main/index.ts:817-826](src/main/index.ts#L817-L826)
- **Current state:** No `app.commandLine.appendSwitch()` calls, no GPU flags
- **Missing configuration options:**
  - `app.commandLine.appendSwitch('enable-gpu-rasterization')` — forces GPU rasterization of all content
  - `app.commandLine.appendSwitch('enable-zero-copy')` — reduces memory copies between GPU and CPU
  - `app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')` — hardware video decode (Linux)
- **Note:** Electron 40 enables GPU compositing by default. These are optional tuning flags — not critical.
- **BrowserWindow webPreferences:** No `offscreen: true` (correct — that would disable GPU), no `backgroundThrottling: false` set

#### 8. Unthrottled Scroll Handlers
- **Impact:** Scroll event fires at 60fps+ — expensive callbacks on every frame
- **Locations:**
  - [EmojiPicker.tsx:191](src/renderer/components/discord/EmojiPicker.tsx#L191) — `handleScroll` reads `scrollTop` and iterates sections (no throttle)
  - [StickerPicker.tsx:166](src/renderer/components/discord/StickerPicker.tsx#L166) — `handleScroll` (no throttle)
  - [MessageList.tsx:247](src/renderer/components/discord/MessageList.tsx#L247) — `handleScroll` for load-more detection (less critical, only checks `scrollTop < 100`)
- **Fix:** Wrap in `requestAnimationFrame` or throttle to 16ms intervals

#### 9. DiscordMarkdown Re-tokenizes on Every Render
- **Location:** `src/renderer/components/discord/DiscordMarkdown.tsx`
- **Impact:** The markdown parsing function runs regex tokenization on every render. For a message list with 50 messages, this means 50 regex tokenizations on every 10s poll cycle.
- **Fix:** Wrap the parsing result in `useMemo` keyed on the raw content string

#### 10. Contribution Scanner Blocks Main Process
- **Location:** `src/main/services/contribution-scanner.service.ts`
- **Impact:** Sequential file scanning and Git operations run on the main Electron thread, blocking IPC responses during scans
- **Fix:** Move scanning to a Worker Thread (`worker_threads` module)

#### 11. Synchronous SQLite on Main Thread
- **Location:** `better-sqlite3` operations throughout main process services
- **Impact:** Database reads/writes block the event loop. Typically <1ms per query but compounds under load.
- **Note:** This is a known architectural constraint of `better-sqlite3` (synchronous by design). Moving to `sql.js` (WASM) or using Worker Threads would be needed for full async.

---

## Unused Dependencies

| Package | Status |
|---------|--------|
| `react-window` | Installed, zero imports |
| `react-virtualized-auto-sizer` | Installed, zero imports |
| `@xterm/xterm` | Installed, zero imports (terminal provided by embedded VS Code) |
| `@xterm/addon-fit` | Installed, zero imports (dead dependency) |
| `@xterm/addon-search` | Installed, zero imports (dead dependency) |
| `@xterm/addon-web-links` | Installed, zero imports (dead dependency) |
| `pdfjs-dist` | Installed, no PDF rendering components found |
| `react-pdf` | Installed, no PDF rendering components found |

---

## Completeness Metrics

| Metric | Value |
|--------|-------|
| Files analyzed | 115/115 (100%) |
| Source directories | `src/main/`, `src/renderer/`, `src/preload/` |
| `<img>` tags audited | 15/15 |
| CSS transition patterns | 7/7 identified |
| Scroll handlers | 3/3 identified |
| React.memo usage | 0 instances (confirmed via grep) |
| useMemo usage | 5 instances found |
| will-change usage | 0 instances (confirmed via grep) |
| GPU config flags | 0 (confirmed via grep) |
| Confidence | HIGH |

---

## Recommendations (Prioritized)

### Quick Wins (Low effort, high impact)

1. **Add `loading="lazy"` to 13 `<img>` tags** — one attribute per tag, immediate bandwidth savings
2. **Replace `transition-all` with specific properties** — 7 find-and-replace operations
3. **Wrap `MessageItem` in `React.memo`** — prevents re-render on every poll cycle
4. **Add `useMemo` to DiscordMarkdown parsing** — prevents re-tokenization per render
5. **Remove dead xterm dependencies** — 4 unused packages inflating bundle/install size

### Medium Effort

6. **Virtualize MessageList with react-window** — already installed, needs integration
7. **Throttle scroll handlers** — wrap in `requestAnimationFrame`
8. **Add `will-change` hints** — to sidebar, theme toggle, progress bar animations

### Larger Effort

9. **Move contribution scanning to Worker Thread** — unblocks main process during scans
10. **Virtualize EmojiPicker/StickerPicker grids** — custom emoji servers can have 100+ emotes

---

## Summary

The application relies entirely on Electron's default GPU compositing with no explicit hardware acceleration optimizations. The highest-impact opportunities are:

1. **react-window virtualization** — library already installed but unused (P1)
2. **React.memo on list items** — zero usage across codebase (P1)
3. **CSS transition specificity** — 7 `transition-all` instances causing unnecessary layout work (P2)
4. **Image lazy loading** — 13 of 15 images load eagerly (P2)
5. **Dead dependencies** — 4 xterm packages, 2 PDF packages installed but never imported (cleanup)

---

**Audit Complete:** 2026-02-04
**Auditor:** JUNO (Quality Auditor)
**Next Action:** Create work orders for P1 and P2 items
