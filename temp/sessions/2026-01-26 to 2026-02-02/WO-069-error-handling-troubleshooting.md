# WO-069: Error Handling & Troubleshooting

**Status:** PLANNED
**Complexity:** 5/10
**Priority:** HIGH
**Phase:** 5 - Onboarding, Error Handling & CLI Parity
**Dependencies:** WO-046 (Full Hooks System), WO-047 (Slash Commands - Core Set)
**Category:** Audit Section 38 - Error Handling & Troubleshooting
**Estimated Time:** 6-8 hours
**Created:** 2026-02-01

---

## Objective

Implement a comprehensive error handling and troubleshooting toolkit including the `/doctor` diagnostic command, `/bug` report generator, log viewer, verbose/debug modes, auto-retry logic, and connectivity checking. This equips users with self-service tools to diagnose and resolve issues without external support.

---

## Background

Cola Records currently lacks structured troubleshooting tools. When users encounter errors (API failures, configuration issues, hook errors), they have no systematic way to diagnose problems, view detailed logs, or report bugs. The Claude Code VS Code extension provides `/doctor` for health diagnostics, `/bug` for transcript-based bug reporting, verbose mode for detailed logging, and auto-retry on transient failures. This work order brings those capabilities to the Electron app.

### Current State
- Basic error boundary exists (ErrorBoundary.tsx) for React crashes
- No `/doctor` or `/bug` slash commands
- No log viewer component
- No verbose or debug mode toggle
- No auto-retry logic for API calls
- No internet connectivity checking
- Hook errors (from WO-046) have no user-facing feedback mechanism
- Permission denials do not suggest alternative approaches

### Target State
- `/doctor` command runs installation and configuration health checks
- `/bug` command generates a bug report with conversation transcript
- "Show Logs" action opens a log viewer with filterable debug output
- Verbose mode toggle shows detailed hook output and reasoning
- Debug mode provides full execution trace
- Auto-retry on transient API errors with backoff
- Permission retry suggests alternative approaches after denial
- Internet connectivity check when API calls fail

---

## Acceptance Criteria

- [ ] AC-1: `/doctor` command runs 6+ diagnostic checks (API key validity, internet connectivity, settings file integrity, database health, required dependencies, hook configuration) and displays results with pass/fail/warn indicators
- [ ] AC-2: `/bug` command collects the current conversation transcript, system info (OS, Electron version, app version), and recent error log entries, then copies to clipboard or saves to file
- [ ] AC-3: A "Show Logs" action is accessible from the Claude panel header menu, opening a log viewer panel with filterable, scrollable log entries
- [ ] AC-4: Verbose mode is togglable via a UI button (and future keyboard shortcut), showing hook execution output, permission reasoning, and API call details inline in the conversation
- [ ] AC-5: Debug mode extends verbose mode with timing data, IPC channel traces, and tool execution details
- [ ] AC-6: Hook errors (exit code 2) display the stderr content as a user-visible error message in the conversation
- [ ] AC-7: API call failures trigger automatic retry with exponential backoff (max 3 retries, 1s/2s/4s delays) for transient errors (HTTP 429, 500, 502, 503, 504, ETIMEDOUT, ECONNRESET)
- [ ] AC-8: After a permission denial, the system suggests an alternative approach message to Claude
- [ ] AC-9: When API calls fail, a connectivity check runs and displays network status to the user
- [ ] AC-10: All new code has unit tests with >= 80% coverage

---

## Technical Design

### Architecture

The error handling system spans both main and renderer processes. The diagnostic engine runs in the main process (accessing file system, database, network), while the UI components live in the renderer. A structured logging system captures events from both processes and surfaces them through IPC.

```
Main Process:
  DiagnosticsService (new)
    -> checkApiKey()       : validates API key format and connectivity
    -> checkConnectivity() : tests internet access (DNS + HTTPS)
    -> checkDatabase()     : verifies SQLite integrity
    -> checkSettings()     : validates settings file schema
    -> checkDependencies() : verifies required binaries (git, node)
    -> checkHooks()        : validates hook configuration syntax

  LoggingService (new)
    -> captures structured log entries from all services
    -> stores in circular buffer (last 1000 entries)
    -> exposes via IPC for renderer consumption

  RetryService (new)
    -> wraps API calls with exponential backoff
    -> detects transient vs permanent errors
    -> emits retry events for verbose display

  ConnectivityService (new)
    -> periodic connectivity check (on API failure)
    -> DNS resolution test
    -> HTTPS endpoint test (api.anthropic.com)

Renderer Process:
  DoctorResults.tsx (new)
    -> displays diagnostic check results
  LogViewer.tsx (new)
    -> filterable, scrollable log display
  BugReportGenerator.tsx (new)
    -> collects and formats bug report data
  VerboseModeIndicator.tsx (new)
    -> toggle button and inline verbose output

IPC Channels (new):
  diagnostics:run-doctor
  diagnostics:check-connectivity
  logging:get-entries
  logging:set-level
  logging:on-entry (event)
  bug-report:generate
```

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/main/services/diagnostics.service.ts` | Health check diagnostics engine | ~200 lines |
| `src/main/services/logging.service.ts` | Structured logging with circular buffer | ~150 lines |
| `src/main/services/retry.service.ts` | API retry with exponential backoff | ~100 lines |
| `src/main/services/connectivity.service.ts` | Internet connectivity checking | ~80 lines |
| `src/renderer/components/claude/DoctorResults.tsx` | Diagnostic results display component | ~150 lines |
| `src/renderer/components/claude/LogViewer.tsx` | Filterable log viewer panel | ~200 lines |
| `src/renderer/components/claude/BugReportGenerator.tsx` | Bug report collection and formatting | ~120 lines |
| `src/renderer/components/claude/VerboseModeIndicator.tsx` | Verbose/debug mode toggle and display | ~80 lines |
| `src/main/services/__tests__/diagnostics.service.test.ts` | Unit tests for diagnostics | ~250 lines |
| `src/main/services/__tests__/retry.service.test.ts` | Unit tests for retry logic | ~150 lines |
| `src/main/services/__tests__/connectivity.service.test.ts` | Unit tests for connectivity | ~100 lines |
| `src/renderer/components/claude/__tests__/DoctorResults.test.tsx` | Unit tests for doctor UI | ~120 lines |
| `src/renderer/components/claude/__tests__/LogViewer.test.tsx` | Unit tests for log viewer | ~120 lines |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/index.ts` | Initialize DiagnosticsService, LoggingService, RetryService, ConnectivityService; register IPC handlers |
| `src/main/ipc/channels.ts` | Add diagnostics, logging, bug-report IPC channel types |
| `src/main/ipc/handlers.ts` | Register handlers for new channels |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/doctor`, `/bug` slash commands |
| `src/renderer/components/claude/ClaudePanel.tsx` | Add "Show Logs" action to panel header; integrate verbose mode display; render doctor/bug UI when invoked |
| `src/renderer/components/claude/ClaudeSpinner.tsx` | Display hook status messages during execution |
| `src/renderer/ipc/client.ts` | Add typed client methods for new IPC channels |
| `src/renderer/stores/useSettingsStore.ts` | Add `verboseMode: boolean` and `debugMode: boolean` fields |

### Interfaces

```typescript
// Diagnostic check result
interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  duration: number; // ms
  details?: string;
}

// Doctor results
interface DoctorResults {
  checks: DiagnosticCheck[];
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  systemInfo: {
    os: string;
    electronVersion: string;
    appVersion: string;
    nodeVersion: string;
  };
}

// Structured log entry
interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;        // service or component name
  message: string;
  data?: Record<string, unknown>;
}

// Log level filter
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Retry configuration
interface RetryConfig {
  maxRetries: number;       // default: 3
  baseDelayMs: number;      // default: 1000
  maxDelayMs: number;       // default: 10000
  retryableStatuses: number[]; // [429, 500, 502, 503, 504]
  retryableErrors: string[];   // ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']
}

// Bug report data
interface BugReport {
  systemInfo: DoctorResults['systemInfo'];
  conversationTranscript: string;
  recentLogs: LogEntry[];
  settings: Record<string, unknown>; // sanitized, no tokens
  timestamp: number;
}

// Connectivity check result
interface ConnectivityResult {
  online: boolean;
  dnsResolution: boolean;
  apiReachable: boolean;
  latencyMs: number;
  checkedAt: number;
}

// IPC channel additions
interface IpcChannels {
  // ... existing channels
  'diagnostics:run-doctor': () => Promise<DoctorResults>;
  'diagnostics:check-connectivity': () => Promise<ConnectivityResult>;
  'logging:get-entries': (filter?: { level?: LogLevel; source?: string; limit?: number }) => Promise<LogEntry[]>;
  'logging:set-level': (level: LogLevel) => Promise<void>;
  'bug-report:generate': () => Promise<BugReport>;
}

// IPC event additions
interface IpcEvents {
  // ... existing events
  'logging:entry': (entry: LogEntry) => void;
}
```

---

## Implementation Tasks

### Task 1: Create LoggingService
- **Type:** CREATE
- **Files:** `src/main/services/logging.service.ts`
- **Details:** Implement a structured logging service with a circular buffer (1000 entries). Methods: `log(level, source, message, data?)`, `getEntries(filter?)`, `setLevel(level)`, `clear()`. The service wraps `console.log/warn/error` calls with structured metadata. Emits `logging:entry` IPC events to renderer for real-time log display. Log entries include timestamp, level, source module name, message, and optional data payload. Buffer is FIFO -- oldest entries discarded when full.
- **Test:** Log entries are stored correctly. Buffer wraps at 1000. Filter by level/source works. IPC event emission works.

### Task 2: Create ConnectivityService
- **Type:** CREATE
- **Files:** `src/main/services/connectivity.service.ts`
- **Details:** Implement internet connectivity checking. Methods: `check(): Promise<ConnectivityResult>`. Performs: DNS resolution of `api.anthropic.com`, HTTPS GET to a lightweight endpoint (e.g., HEAD request to `https://api.anthropic.com`), and measures latency. Returns structured result with `online`, `dnsResolution`, `apiReachable`, `latencyMs`. Uses Node.js `dns.resolve` and `https.request` with 5-second timeout. Does not throw -- always returns a result.
- **Test:** Mock DNS and HTTPS. Test online/offline scenarios. Test timeout handling.

### Task 3: Create RetryService
- **Type:** CREATE
- **Files:** `src/main/services/retry.service.ts`
- **Details:** Implement a generic retry wrapper using exponential backoff. `withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>`. Default config: 3 retries, 1000ms base delay, retryable HTTP statuses [429, 500, 502, 503, 504], retryable errors ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']. On each retry, delay doubles (1s, 2s, 4s) with optional jitter (random 0-200ms). Logs each retry attempt via LoggingService. After max retries, throws the last error. For HTTP 429 (rate limit), respects `Retry-After` header if present.
- **Test:** Retries on transient errors. Respects max retries. Does not retry on 400/401/403/404. Exponential backoff timing. Retry-After header respected.

### Task 4: Create DiagnosticsService
- **Type:** CREATE
- **Files:** `src/main/services/diagnostics.service.ts`
- **Details:** Implement the `/doctor` diagnostic engine. Method: `runDoctor(): Promise<DoctorResults>`. Runs 6 checks sequentially:
  1. **API Key Check** - Verifies API key/token is configured and valid format (not empty, correct prefix)
  2. **Internet Connectivity** - Uses ConnectivityService to check network access
  3. **Database Health** - Runs `PRAGMA integrity_check` on SQLite database
  4. **Settings Integrity** - Validates settings files exist and parse correctly (JSON syntax check)
  5. **Git Available** - Checks `git --version` returns successfully
  6. **Hook Configuration** - If hooks are configured, validates hook JSON schema (correct event names, valid types)
  Each check returns a DiagnosticCheck with status, message, and duration. Overall status: `healthy` (all pass), `degraded` (some warn), `unhealthy` (any fail). Collects system info: OS, Electron version, app version, Node version.
- **Test:** Each check pass/fail scenario. Overall status calculation. System info collection. Timeout handling for individual checks.

### Task 5: Register IPC Channels and Handlers
- **Type:** MODIFY
- **Files:** `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`, `src/main/index.ts`, `src/renderer/ipc/client.ts`
- **Details:** Add typed IPC channels: `diagnostics:run-doctor`, `diagnostics:check-connectivity`, `logging:get-entries`, `logging:set-level`, `bug-report:generate`. Add IPC event: `logging:entry`. Register handlers in main process that delegate to the new services. Add typed client methods in renderer IPC client. Initialize all new services in `src/main/index.ts`.
- **Test:** IPC channels resolve correctly. Type safety verified.

### Task 6: Create DoctorResults Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/DoctorResults.tsx`
- **Details:** Display diagnostic results as a styled list. Each check shows: icon (green check, yellow warning, red X), check name, status message, and execution time. Overall status displayed at top with color-coded badge (green/yellow/red). System info section at bottom. Component receives `DoctorResults` as props. Styled with Tailwind CSS matching Claude panel aesthetic. Include a "Re-run" button to execute diagnostics again.
- **Test:** Renders all checks with correct icons. Overall status badge correct. Re-run button triggers callback.

### Task 7: Create LogViewer Component
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/LogViewer.tsx`
- **Details:** Filterable, scrollable log viewer panel. Features: level filter dropdown (debug/info/warn/error/all), source filter text input, auto-scroll to bottom toggle, clear button, copy-all button. Log entries displayed in a virtual scrolling list (reuse react-window if available) with color-coded level badges. Timestamps formatted as relative ("2s ago", "5m ago"). Real-time updates via `logging:entry` IPC event listener. Maximum 1000 entries displayed. Opens as a panel section within the Claude panel or as a slide-out drawer.
- **Test:** Renders log entries. Filters work correctly. Auto-scroll toggles. Copy-all copies formatted text.

### Task 8: Create BugReportGenerator
- **Type:** CREATE
- **Files:** `src/renderer/components/claude/BugReportGenerator.tsx`
- **Details:** Collects bug report data and presents it to the user. On `/bug` invocation: calls `bug-report:generate` IPC which collects system info, sanitized settings (tokens redacted), recent logs (last 50), and conversation transcript. Displays a preview of the report. User can: copy to clipboard, save to file (via dialog:save-file IPC), or cancel. Report formatted as markdown. Sensitive data (API keys, tokens) is automatically redacted with `[REDACTED]`.
- **Test:** Report contains expected sections. Sensitive data is redacted. Copy and save actions work.

### Task 9: Implement Verbose Mode
- **Type:** MODIFY + CREATE
- **Files:** `src/renderer/components/claude/VerboseModeIndicator.tsx`, `src/renderer/stores/useSettingsStore.ts`, `src/renderer/components/claude/ClaudePanel.tsx`
- **Details:** Add `verboseMode: boolean` (default false) and `debugMode: boolean` (default false) to settings store. Create VerboseModeIndicator component: a small toggle button in the Claude panel header area that toggles verbose mode. When verbose mode is active, an indicator badge appears. In verbose mode, the conversation display shows additional inline entries for: hook execution start/completion, permission reasoning, API call durations, retry attempts. These verbose entries are styled differently (smaller font, muted color, monospace) to distinguish from conversation messages. Debug mode extends verbose with IPC traces and tool execution timing.
- **Test:** Toggle updates store. Verbose entries appear when mode is active. Hidden when mode is off.

### Task 10: Implement Auto-Retry and Connectivity Check Integration
- **Type:** MODIFY
- **Files:** `src/main/services/github.service.ts` (or equivalent API service), `src/renderer/components/claude/ClaudePanel.tsx`
- **Details:** Wrap existing API calls (GitHub API, Anthropic API) with `RetryService.withRetry()`. On final failure after retries, trigger a connectivity check and display the result to the user. If offline, show "No internet connection detected" message. If online but API unreachable, show "API server may be experiencing issues". Integrate with the Claude panel to show a connectivity status banner when issues are detected.
- **Test:** API calls are retried on transient errors. Connectivity check runs on final failure. Banner displays correctly.

### Task 11: Register /doctor and /bug Slash Commands
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`
- **Details:** Register `/doctor` slash command: invokes `diagnostics:run-doctor` IPC and renders DoctorResults component in the conversation area. Register `/bug` slash command: opens BugReportGenerator component. Both commands appear in the slash command menu with descriptions: "/doctor - Check installation health and run diagnostics" and "/bug - Report a bug with conversation transcript".
- **Test:** Commands appear in menu. /doctor triggers diagnostics and displays results. /bug opens report generator.

### Task 12: Implement Hook Error Feedback
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudePanel.tsx` (or hook integration point)
- **Details:** When a hook returns exit code 2 (blocking error), display the stderr content as a visible error message in the conversation stream. The error message should be styled distinctly (red border, error icon) and include the hook name and event type. This integrates with WO-046's hook system -- if hooks are not yet implemented, create the integration point as a handler that can be wired up later.
- **Test:** Exit code 2 errors display in conversation. Error includes hook name. Styling is distinct.

### Task 13: Implement Permission Retry Suggestion
- **Type:** MODIFY
- **Files:** `src/renderer/components/claude/ClaudePanel.tsx` (or permission handling component)
- **Details:** When a user denies a permission request, instead of just acknowledging the denial, add a system message suggesting Claude try an alternative approach. The message template: "Permission denied for [tool]. Claude will try an alternative approach." This message is injected into the conversation context so Claude can see it and adjust its behavior.
- **Test:** Permission denial triggers suggestion message. Message includes correct tool name.

### Task 14: Write Comprehensive Tests
- **Type:** CREATE
- **Files:** All `__tests__/` files listed in New Files section
- **Details:** Write unit tests for all new services and components. Focus on: DiagnosticsService (each check pass/fail/timeout), RetryService (retry logic, backoff timing, non-retryable errors), ConnectivityService (online/offline/timeout), DoctorResults (rendering all states), LogViewer (filtering, scrolling, real-time updates), BugReportGenerator (data collection, redaction, export).
- **Test:** All tests pass. Coverage >= 80% lines and branches for all new files.

---

## Testing Requirements

### Unit Tests
- DiagnosticsService: each of 6 checks with pass, fail, and timeout scenarios
- RetryService: retry on transient errors, no retry on permanent errors, backoff timing, max retries
- ConnectivityService: online, offline, partial connectivity, timeout
- LoggingService: buffer management, filtering, IPC event emission
- DoctorResults: rendering with various check states
- LogViewer: filtering, auto-scroll, copy functionality
- BugReportGenerator: data collection, redaction, clipboard/file export
- VerboseModeIndicator: toggle state, verbose entry rendering

### Integration Tests
- `/doctor` end-to-end: slash command triggers diagnostics, results render in panel
- `/bug` end-to-end: slash command opens generator, report contains expected data
- Auto-retry: API failure triggers retry, final failure shows connectivity banner
- Verbose mode: toggle shows/hides verbose entries in conversation

### Edge Cases
- Database locked during integrity check (timeout gracefully)
- No internet during doctor check (fail gracefully, report offline)
- Empty conversation when /bug invoked (report still generates with system info)
- Rapid verbose mode toggling
- Hook system not available (WO-046 not yet complete) -- hook error feedback degrades gracefully

---

## BAS Quality Gates

| Phase | Gate | Tool | Pass Criteria |
|-------|------|------|---------------|
| 1 | Linting | ESLint + Prettier | 0 errors, auto-fix applied |
| 2 | Structure | Import/export validation | All imports resolve, types valid |
| 3 | Build | TypeScript compiler (tsc) | 0 compilation errors |
| 4 | Testing | Vitest | 100% tests pass |
| 5 | Coverage | @vitest/coverage-v8 | >= 80% lines and branches for new files |
| 6 | Review | DRA code review | Best practices compliance |

---

## Audit Items Addressed

From `CLAUDE-CODE-EXTENSION-AUDIT.md` Section 38 - Error Handling & Troubleshooting:

- [ ] **/doctor command** - Diagnose installation health and common issues
- [ ] **/bug command** - Report bugs with conversation transcript to Anthropic
- [ ] **Show Logs command** - View extension debug logs via panel action
- [ ] **Verbose mode (Ctrl+O)** - See detailed hook output and reasoning
- [ ] **Debug mode (--debug)** - Full execution details including hook matching and exit codes
- [ ] **Hook error feedback** - Exit code 2 from hooks shows stderr as error message to Claude
- [ ] **Auto-retry on errors** - Claude can retry failed operations with adjusted approach
- [ ] **Permission retry** - After permission denial, Claude adjusts and tries alternative approach
- [ ] **Internet connectivity check** - Claude checks connectivity when not responding

Not addressed (out of scope for Cola Records Electron app):
- Developer: Reload Window (VS Code specific)
- Extension conflict detection (VS Code specific)
- Workspace trust check (VS Code specific)
- Version requirement (VS Code specific)
- Extension data removal (VS Code specific)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DiagnosticsService checks become stale as architecture evolves | Medium | Low | Checks are modular -- easy to add/remove/update individual checks |
| RetryService causes delays on permanent API failures | Low | Medium | Only retryable status codes trigger retry; permanent errors fail immediately |
| LoggingService memory usage with high-frequency logging | Medium | Low | Circular buffer capped at 1000 entries; debug-level logs filtered by default |
| Hook system dependency (WO-046) not yet available | Medium | Low | Hook error feedback creates an integration point; works as no-op until hooks are wired |
| Bug report accidentally leaks sensitive data | Low | High | All tokens/keys automatically redacted with regex pattern matching before report generation |
| Connectivity check false positives (corporate proxy, firewall) | Medium | Low | Check reports raw results; does not make assumptions about proxy/firewall |

---

## Notes

- The DiagnosticsService is designed to be extensible. New checks can be added as simple functions that return a `DiagnosticCheck` object. Future work orders may add checks for MCP servers, plugins, or LSP integration.
- The LoggingService is intentionally simple (in-memory circular buffer). For production, consider persisting logs to a file for crash analysis. This can be added later without changing the API.
- The RetryService uses a generic wrapper pattern (`withRetry`) that can be applied to any async operation. It should be applied to all external API calls (GitHub, Anthropic) as a cross-cutting concern.
- Verbose mode entries in the conversation use a distinct visual style to avoid confusion with actual Claude responses. They are collapsible by default.
- The `/bug` command sanitizes all sensitive data. The redaction regex covers common patterns: API keys (sk-ant-*, anthropic-*), OAuth tokens, and any field named "token", "key", "secret", or "password".
- This work order has a dependency on WO-046 (Hooks) for hook error feedback and on WO-047 (Slash Commands) for command registration. If those are not complete, the hook-specific features degrade gracefully and the slash commands use whatever registration mechanism is available.
