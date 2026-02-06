# WO-063: Web Search & Web Fetch

**Status:** PENDING
**Complexity:** 5/10
**Priority:** MEDIUM
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 30 - Web Search & Web Fetch
**Dependencies:** WO-045 (Full Permissions System)
**Estimated Time:** 5.5 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Implement WebSearch and WebFetch tools that allow Claude to search the web for current information and fetch content from URLs. This includes a search API integration, HTML-to-markdown conversion, domain allow/block lists, a 15-minute self-cleaning cache, HTTPS upgrade, and redirect handling. The existing `claudeWebSearchEnabled` toggle in settings will gate these tools.

---

## Background

### Current State
- `claudeWebSearchEnabled` boolean toggle exists in `AppSettings` interface (`src/main/ipc/channels.ts`, line 174)
- Toggle is wired in `SettingsForm.tsx` (line 28, 52) and persisted to SQLite
- No actual web search or fetch implementation exists
- No search API integration
- No URL fetching capability
- No HTML-to-markdown conversion
- No caching layer
- No domain filtering

### Target State
- `WebSearch` tool: Query a search API, return structured results with domain filtering
- `WebFetch` tool: Fetch URL content, convert HTML to markdown, cache results for 15 minutes
- Domain allow/block lists configurable in settings
- HTTPS automatic upgrade for HTTP URLs
- Redirect detection and reporting
- Both tools gated by existing `claudeWebSearchEnabled` setting
- Both tools integrated into Claude's tool registry for autonomous use

---

## Acceptance Criteria

- [ ] AC-1: WebSearch tool returns structured search results (title, URL, snippet) for a given query
- [ ] AC-2: WebSearch supports `allowed_domains` parameter to restrict results
- [ ] AC-3: WebSearch supports `blocked_domains` parameter to exclude results
- [ ] AC-4: WebFetch tool fetches a URL and returns content as markdown
- [ ] AC-5: WebFetch converts HTML to clean markdown (strip scripts, styles, ads)
- [ ] AC-6: WebFetch caches results for 15 minutes, auto-evicts expired entries
- [ ] AC-7: WebFetch upgrades HTTP URLs to HTTPS automatically
- [ ] AC-8: WebFetch detects redirects and reports the redirect URL in the response
- [ ] AC-9: Both tools are disabled when `claudeWebSearchEnabled` is false
- [ ] AC-10: Both tools appear in Claude's available tools when enabled
- [ ] AC-11: Domain allow/block lists are configurable in settings
- [ ] AC-12: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
WebSearch Flow:
  Claude Tool Call -> WebSearchService.search(query, options)
    -> Check claudeWebSearchEnabled
    -> Apply domain allow/block filters
    -> Call search API (Brave Search / SerpAPI / DuckDuckGo)
    -> Parse results -> Return structured results

WebFetch Flow:
  Claude Tool Call -> WebFetchService.fetch(url)
    -> Check claudeWebSearchEnabled
    -> Check cache (15-min TTL)
    -> Upgrade HTTP -> HTTPS
    -> Fetch with redirect tracking
    -> Convert HTML to markdown (turndown)
    -> Cache result
    -> Return markdown content + metadata

Cache Architecture:
  In-memory Map<string, { content: string, fetchedAt: number }>
  Eviction: setInterval every 60s, remove entries older than 15 min
  Max entries: 100 (LRU eviction if exceeded)
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/web-search.service.ts` | WebSearch tool implementation with search API integration |
| `src/main/services/web-fetch.service.ts` | WebFetch tool with HTML-to-markdown, caching, redirect handling |
| `src/main/services/web-cache.service.ts` | 15-minute TTL cache with auto-eviction |
| `tests/unit/services/web-search.service.test.ts` | WebSearch unit tests |
| `tests/unit/services/web-fetch.service.test.ts` | WebFetch unit tests |
| `tests/unit/services/web-cache.service.test.ts` | Cache unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `WebSearchResult`, `WebFetchResult` interfaces, domain list settings |
| `src/main/index.ts` | Register web search/fetch IPC handlers, initialize services |
| `src/main/services/claude/claude-tool-registry.ts` (or equivalent) | Register WebSearch and WebFetch as available Claude tools |
| `src/renderer/components/settings/SettingsForm.tsx` | Add domain allow/block list configuration UI |
| `package.json` | Add `turndown` (HTML-to-markdown) dependency |

### Interfaces

```typescript
// src/main/services/web-search.service.ts
interface WebSearchOptions {
  query: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxResults?: number; // default 10
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  totalResults: number;
}

interface WebSearchService {
  search(options: WebSearchOptions): Promise<WebSearchResponse>;
  isEnabled(): boolean;
}

// src/main/services/web-fetch.service.ts
interface WebFetchOptions {
  url: string;
  maxLength?: number; // default 50000 chars
}

interface WebFetchResult {
  content: string; // markdown
  url: string; // final URL after redirects
  originalUrl: string;
  redirected: boolean;
  redirectUrl?: string;
  contentType: string;
  cached: boolean;
  fetchedAt: string;
}

interface WebFetchService {
  fetch(options: WebFetchOptions): Promise<WebFetchResult>;
  isEnabled(): boolean;
  clearCache(): void;
}

// src/main/services/web-cache.service.ts
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

interface WebCacheService<T> {
  get(key: string): T | null;
  set(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size(): number;
  startEviction(): void;
  stopEviction(): void;
}

// New AppSettings fields
interface AppSettings {
  // ... existing
  claudeWebSearchAllowedDomains?: string[];
  claudeWebSearchBlockedDomains?: string[];
}
```

---

## Implementation Tasks

### Task 1: Create WebCacheService
**File:** `src/main/services/web-cache.service.ts`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** None

Implement a generic TTL cache:
- In-memory `Map<string, CacheEntry<T>>` storage
- Configurable TTL (default 15 minutes = 900000ms)
- `startEviction()`: `setInterval` every 60 seconds to evict expired entries
- `stopEviction()`: Clear the interval (for cleanup/testing)
- Max entries limit (default 100) with LRU eviction when exceeded
- `get()` returns null for expired entries and auto-evicts them

### Task 2: Create WebFetchService
**File:** `src/main/services/web-fetch.service.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Task 1

Implement URL fetching with HTML-to-markdown:
- Use Node.js `fetch` (built-in in Node 18+) or `undici` for HTTP requests
- HTTPS upgrade: Replace `http://` with `https://` in URLs
- Redirect handling: Use `redirect: 'manual'` to detect redirects, then follow manually (max 5 redirects)
- HTML-to-markdown: Use `turndown` library for conversion
- Strip `<script>`, `<style>`, `<nav>`, `<footer>`, `<iframe>` tags before conversion
- Content length limiting: Truncate markdown to `maxLength` characters
- Cache results using WebCacheService with URL as key
- Return `WebFetchResult` with redirect info and cache status
- Check `claudeWebSearchEnabled` before fetching
- Set reasonable User-Agent header
- Timeout: 30 seconds per request

### Task 3: Create WebSearchService
**File:** `src/main/services/web-search.service.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** None

Implement web search with domain filtering:
- Primary search backend: Use a free/configurable search API
  - Option A: DuckDuckGo Instant Answer API (free, no key required)
  - Option B: Brave Search API (requires key, better results)
  - Option C: SerpAPI (requires key, Google results)
- Make search backend configurable in settings
- Domain allow list: If set, only return results from listed domains
- Domain block list: If set, exclude results from listed domains
- Domain matching: Compare against URL hostname (supports wildcards like `*.github.com`)
- Parse results into `WebSearchResult[]` format
- Return max `maxResults` results (default 10)
- Check `claudeWebSearchEnabled` before searching

### Task 4: Register Tools in Claude Tool Registry
**File:** `src/main/services/claude/claude-tool-registry.ts` (or equivalent tool registration)
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Tasks 2, 3

Register WebSearch and WebFetch as Claude tools:
- WebSearch tool definition with parameters: `query`, `allowed_domains`, `blocked_domains`
- WebFetch tool definition with parameters: `url`
- Both tools conditionally available based on `claudeWebSearchEnabled`
- Tool descriptions for Claude to understand when to use each

### Task 5: Register IPC Handlers
**File:** `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** Tasks 2, 3

- Add `web:search` IPC handler -> calls `webSearchService.search()`
- Add `web:fetch` IPC handler -> calls `webFetchService.fetch()`
- Add `web:cache:clear` IPC handler -> clears fetch cache
- Initialize both services at app startup
- Start cache eviction timer

### Task 6: Update Settings UI for Domain Lists
**File:** `src/renderer/components/settings/SettingsForm.tsx`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 5

- Add domain allow list input (comma-separated or tag-style input)
- Add domain block list input (comma-separated or tag-style input)
- Show only when `claudeWebSearchEnabled` is true
- Persist to settings via existing `settings:update` IPC

### Task 7: Update AppSettings Interface
**File:** `src/main/ipc/channels.ts`
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** None

- Add `claudeWebSearchAllowedDomains?: string[]` to AppSettings
- Add `claudeWebSearchBlockedDomains?: string[]` to AppSettings
- Add `WebSearchResult`, `WebSearchResponse`, `WebFetchResult` type exports

### Task 8: Write Unit Tests
**Files:** `tests/unit/services/web-search.service.test.ts`, `tests/unit/services/web-fetch.service.test.ts`, `tests/unit/services/web-cache.service.test.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Tasks 1-7

Test coverage:
- WebCacheService: set/get, TTL expiration, max entries LRU, eviction timer, clear
- WebFetchService: successful fetch, HTTPS upgrade, redirect handling, HTML-to-markdown, caching, disabled state, timeout
- WebSearchService: query execution, domain allow list, domain block list, disabled state, wildcard matching
- Domain filter logic: exact match, wildcard, empty lists
- Integration: tool disabled when setting is false

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 20-25 | 80%+ lines and branches |
| Integration Tests | 2-3 | Search+fetch end-to-end with mocked HTTP |
| Mock Requirements | Node fetch/undici, search API responses |

### Key Test Scenarios
1. Cache entry expires after 15 minutes
2. HTTPS upgrade for HTTP URLs
3. Redirect chain followed correctly (max 5)
4. HTML converted to clean markdown (scripts/styles stripped)
5. Domain allow list filters results correctly
6. Domain block list excludes results correctly
7. Tools return error when `claudeWebSearchEnabled` is false
8. Cache hit returns cached content without HTTP request
9. Wildcard domain matching (`*.example.com` matches `sub.example.com`)
10. Content truncation at maxLength

---

## BAS Quality Gates

| Phase | Gate | Pass Criteria |
|-------|------|---------------|
| 1 | Linting | ESLint + Prettier: 0 errors |
| 2 | Structure | All imports resolve, types valid, turndown dependency installed |
| 3 | Build | TypeScript compilation: 0 errors |
| 4 | Testing | All tests pass (unit + integration) |
| 5 | Coverage | 80%+ lines and branches |
| 6 | Review | DRA approval |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 30:

- [ ] WebSearch tool - Search the web for current information beyond knowledge cutoff
- [ ] Domain allow list - `allowed_domains` parameter to restrict search to specific sites
- [ ] Domain block list - `blocked_domains` parameter to exclude specific sites
- [ ] WebFetch tool - Fetch content from URLs and process with AI
- [ ] HTML to markdown - Automatic conversion of fetched HTML content
- [ ] 15-minute cache - Self-cleaning cache for repeated URL access
- [ ] HTTPS upgrade - HTTP URLs automatically upgraded to HTTPS
- [ ] Redirect handling - Tool reports redirects and provides redirect URL

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Search API rate limiting | Medium | Medium | Implement rate limiter, cache search results too |
| Search API requires paid key | Medium | Low | Default to DuckDuckGo (free), support Brave/Serp as options |
| Fetched pages block scraping | Medium | Low | Set appropriate User-Agent, respect robots.txt optionally |
| Large HTML pages cause memory issues | Low | Medium | Content length limit (50KB default), streaming parser |
| Turndown produces poor markdown | Low | Low | Pre-process HTML to strip non-content elements |
| HTTPS upgrade breaks some sites | Low | Low | Fall back to HTTP if HTTPS fails with connection error |

---

## Notes

- The `turndown` npm package is the de facto standard for HTML-to-markdown in Node.js. It supports customizable rules and is well-maintained.
- DuckDuckGo Instant Answer API is free and requires no API key, making it ideal as the default search backend. For better results, users can configure Brave Search API (free tier: 2000 queries/month).
- The 15-minute cache TTL matches the Claude Code VS Code extension behavior exactly.
- Both tools should respect the existing permission system - Claude must request permission to use WebSearch/WebFetch unless the user has pre-approved them.
- The `web:search` and `web:fetch` IPC channels are separate from the Claude tool calls to allow direct usage from the renderer if needed in the future.
