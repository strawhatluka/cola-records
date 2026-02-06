# WO-065: LSP Integration

**Status:** PENDING
**Complexity:** 8/10
**Priority:** LOW
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 32 - LSP Integration
**Dependencies:** WO-042 (Settings Hierarchy)
**Estimated Time:** 10 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Implement Language Server Protocol (LSP) integration that provides Claude with code intelligence capabilities: go-to-definition, find-references, document-symbols, hover information, and diagnostics. This requires managing language server processes, implementing the LSP client protocol, and exposing LSP operations as a Claude tool gated by the `ENABLE_LSP_TOOL` environment variable.

---

## Background

### Current State
- No LSP integration exists in the application
- Monaco editor is used for code editing in `CodeEditorPanel.tsx` but has no LSP connection
- No language server management
- No code intelligence tools available to Claude
- No `ENABLE_LSP_TOOL` environment variable support

### Target State
- `LSPService` in main process managing language server lifecycles
- LSP client implementing core protocol operations
- Claude tool `Lsp` with operations: `go_to_definition`, `find_references`, `document_symbols`, `hover`, `get_diagnostics`
- Language support for TypeScript (primary), with extensible architecture for Python, Go, Rust, Java, C/C++
- `ENABLE_LSP_TOOL=1` environment variable gates the feature
- Plugin-provided LSP server support (future extensibility)

---

## Acceptance Criteria

- [ ] AC-1: LSP tool available to Claude when `ENABLE_LSP_TOOL=1` is set
- [ ] AC-2: `go_to_definition` returns file path and position for a symbol
- [ ] AC-3: `find_references` returns all locations where a symbol is used
- [ ] AC-4: `document_symbols` returns the symbol hierarchy for a file
- [ ] AC-5: `hover` returns type information and documentation for a symbol
- [ ] AC-6: `get_diagnostics` returns errors and warnings for a file
- [ ] AC-7: TypeScript language server (tsserver) managed automatically
- [ ] AC-8: Language servers start on demand and shut down when idle
- [ ] AC-9: LSP tool is hidden from Claude when ENABLE_LSP_TOOL is not set
- [ ] AC-10: Architecture supports adding new language servers via configuration
- [ ] AC-11: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
LSP Architecture:

  Claude Tool Call ("Lsp", { operation, params })
       |
       v
  LSPToolHandler (validates ENABLE_LSP_TOOL, routes operation)
       |
       v
  LSPService (manages language server lifecycles)
       |
       v
  LSPClientManager (one client per language server)
       |          |           |
       v          v           v
  TypeScript   Python      Go         (language server processes)
  (tsserver)   (pylsp)     (gopls)

  Communication: JSON-RPC 2.0 over stdio (stdin/stdout)

  Lifecycle:
  1. First LSP request for a language -> start server
  2. Server initializes with workspace root
  3. Requests routed to appropriate server
  4. Idle timeout (5 min) -> shutdown server
  5. App exit -> shutdown all servers
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/lsp/lsp.service.ts` | Main LSP service coordinating server lifecycles |
| `src/main/services/lsp/lsp-client.ts` | LSP client implementing JSON-RPC 2.0 protocol over stdio |
| `src/main/services/lsp/lsp-server-manager.ts` | Language server process management (spawn, health, shutdown) |
| `src/main/services/lsp/lsp-tool-handler.ts` | Claude tool handler that routes LSP operations |
| `src/main/services/lsp/language-configs.ts` | Configuration for each supported language server |
| `src/main/services/lsp/types.ts` | LSP type definitions (positions, locations, symbols, diagnostics) |
| `tests/unit/services/lsp/lsp.service.test.ts` | LSP service unit tests |
| `tests/unit/services/lsp/lsp-client.test.ts` | LSP client protocol tests |
| `tests/unit/services/lsp/lsp-server-manager.test.ts` | Server manager tests |
| `tests/unit/services/lsp/lsp-tool-handler.test.ts` | Tool handler tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add LSP-related types and IPC channel definitions |
| `src/main/index.ts` | Register LSP IPC handlers, initialize LSP service |
| `src/main/services/claude/claude-tool-registry.ts` (or equivalent) | Register Lsp tool conditionally |

### Interfaces

```typescript
// src/main/services/lsp/types.ts
interface LspPosition {
  line: number;      // 0-based
  character: number; // 0-based
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface LspLocation {
  uri: string;       // file URI
  range: LspRange;
}

interface LspSymbol {
  name: string;
  kind: LspSymbolKind;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspSymbol[];
}

type LspSymbolKind =
  | 'file' | 'module' | 'namespace' | 'package'
  | 'class' | 'method' | 'property' | 'field'
  | 'constructor' | 'enum' | 'interface' | 'function'
  | 'variable' | 'constant' | 'string' | 'number'
  | 'boolean' | 'array' | 'object' | 'key'
  | 'null' | 'enumMember' | 'struct' | 'event'
  | 'operator' | 'typeParameter';

interface LspDiagnostic {
  range: LspRange;
  severity: 'error' | 'warning' | 'information' | 'hint';
  code?: string | number;
  source?: string;
  message: string;
}

interface LspHoverResult {
  contents: string;  // markdown
  range?: LspRange;
}

// src/main/services/lsp/lsp-tool-handler.ts
type LspOperation =
  | 'go_to_definition'
  | 'find_references'
  | 'document_symbols'
  | 'hover'
  | 'get_diagnostics';

interface LspToolInput {
  operation: LspOperation;
  filePath: string;
  position?: LspPosition;  // required for go_to_definition, find_references, hover
}

type LspToolResult =
  | { operation: 'go_to_definition'; locations: LspLocation[] }
  | { operation: 'find_references'; locations: LspLocation[] }
  | { operation: 'document_symbols'; symbols: LspSymbol[] }
  | { operation: 'hover'; result: LspHoverResult | null }
  | { operation: 'get_diagnostics'; diagnostics: LspDiagnostic[] };

// src/main/services/lsp/language-configs.ts
interface LanguageServerConfig {
  languageId: string;
  fileExtensions: string[];
  serverCommand: string;
  serverArgs: string[];
  initializationOptions?: Record<string, unknown>;
  /** Whether this server is bundled or requires user installation */
  bundled: boolean;
  /** npm package name if installable */
  npmPackage?: string;
}

// src/main/services/lsp/lsp.service.ts
interface LSPService {
  /** Check if LSP is enabled via ENABLE_LSP_TOOL env var */
  isEnabled(): boolean;
  /** Execute an LSP operation */
  execute(input: LspToolInput, workspaceRoot: string): Promise<LspToolResult>;
  /** Get supported languages */
  getSupportedLanguages(): string[];
  /** Shutdown all language servers */
  shutdown(): Promise<void>;
}

// src/main/services/lsp/lsp-client.ts
interface LSPClient {
  /** Initialize the LSP connection */
  initialize(workspaceRoot: string): Promise<void>;
  /** Send textDocument/definition request */
  goToDefinition(uri: string, position: LspPosition): Promise<LspLocation[]>;
  /** Send textDocument/references request */
  findReferences(uri: string, position: LspPosition): Promise<LspLocation[]>;
  /** Send textDocument/documentSymbol request */
  getDocumentSymbols(uri: string): Promise<LspSymbol[]>;
  /** Send textDocument/hover request */
  hover(uri: string, position: LspPosition): Promise<LspHoverResult | null>;
  /** Send textDocument/diagnostic or pull diagnostics */
  getDiagnostics(uri: string): Promise<LspDiagnostic[]>;
  /** Notify textDocument/didOpen */
  notifyDidOpen(uri: string, languageId: string, content: string): void;
  /** Notify textDocument/didClose */
  notifyDidClose(uri: string): void;
  /** Shutdown the client and server */
  shutdown(): Promise<void>;
  /** Check if the server is running */
  isRunning(): boolean;
}

// src/main/services/lsp/lsp-server-manager.ts
interface LSPServerManager {
  /** Start a language server for the given language */
  startServer(languageId: string, workspaceRoot: string): Promise<LSPClient>;
  /** Stop a language server */
  stopServer(languageId: string): Promise<void>;
  /** Get a running client for a language */
  getClient(languageId: string): LSPClient | null;
  /** Stop all running servers */
  stopAll(): Promise<void>;
}
```

---

## Implementation Tasks

### Task 1: Define LSP Types
**File:** `src/main/services/lsp/types.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Define all LSP-related TypeScript types:
- Position, Range, Location, Symbol, Diagnostic, HoverResult
- SymbolKind enum mapping (LSP numeric kinds to readable strings)
- LspToolInput and LspToolResult discriminated unions
- URI conversion helpers (file path <-> file:// URI)

### Task 2: Define Language Server Configurations
**File:** `src/main/services/lsp/language-configs.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

Define configuration for each supported language server:
- TypeScript: `typescript-language-server --stdio` (primary, well-tested)
- Python: `pylsp` or `pyright --stdio`
- Go: `gopls serve`
- Rust: `rust-analyzer`
- Java: `jdtls`
- C/C++: `clangd`
- Map file extensions to language IDs
- Mark which are bundled vs require user installation

### Task 3: Implement LSP Client (JSON-RPC 2.0)
**File:** `src/main/services/lsp/lsp-client.ts`
**Complexity:** High
**Estimated Time:** 120 min
**Dependencies:** Task 1

Implement the LSP client protocol over stdio:
- Spawn language server as child process
- Implement JSON-RPC 2.0 message framing (Content-Length header + \r\n\r\n + JSON body)
- Request/response correlation via message IDs
- Implement `initialize` handshake (send capabilities, receive server capabilities)
- Implement `textDocument/definition` request
- Implement `textDocument/references` request
- Implement `textDocument/documentSymbol` request
- Implement `textDocument/hover` request
- Implement `textDocument/publishDiagnostics` notification handler (server push)
- Implement `textDocument/didOpen` and `textDocument/didClose` notifications
- Implement `shutdown` + `exit` lifecycle
- Request timeout handling (10 seconds default)
- Error handling: server crash recovery, malformed response handling
- Parse LSP response types into our simplified type definitions

### Task 4: Implement LSP Server Manager
**File:** `src/main/services/lsp/lsp-server-manager.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Task 2, Task 3

Manage language server process lifecycles:
- `startServer(languageId, workspaceRoot)`: Look up config, spawn process, create LSPClient, initialize
- `getClient(languageId)`: Return running client or null
- `stopServer(languageId)`: Call client.shutdown(), kill process
- `stopAll()`: Shutdown all running servers
- Idle timeout: Track last request time per server, shutdown after 5 minutes of inactivity
- Auto-restart: If server crashes, attempt one restart on next request
- Server availability check: Verify command exists before spawning (use `which`/`where`)

### Task 5: Implement LSP Service
**File:** `src/main/services/lsp/lsp.service.ts`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** Task 4

Coordinate LSP operations:
- `isEnabled()`: Check `process.env.ENABLE_LSP_TOOL === '1'`
- `execute(input, workspaceRoot)`: Determine language from file extension, get/start server, route operation
- File-to-language resolution using extension mapping from language-configs
- Automatic didOpen/didClose for files being queried (if not already open)
- Read file content for didOpen notification
- Format results into our simplified types (strip protocol noise)
- Handle unsupported languages gracefully (return clear error message)

### Task 6: Implement LSP Tool Handler
**File:** `src/main/services/lsp/lsp-tool-handler.ts`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 5

Create the Claude tool handler:
- Validate ENABLE_LSP_TOOL is set
- Parse tool input (operation, filePath, position)
- Validate required fields per operation (position required for definition/references/hover)
- Call LSPService.execute()
- Format result for Claude consumption (human-readable text + structured data)
- Register as Claude tool with description explaining each operation

### Task 7: Register IPC Handlers and Tool
**File:** `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** Task 6

- Add `lsp:execute` IPC handler -> calls `lspService.execute()`
- Add `lsp:status` IPC handler -> returns running servers and supported languages
- Initialize LSPService at startup (but don't start servers until first request)
- Register Lsp tool in Claude's tool registry (only if ENABLE_LSP_TOOL=1)
- Ensure LSP servers are shut down on app exit

### Task 8: Update IPC Channel Types
**File:** `src/main/ipc/channels.ts`
**Complexity:** Low
**Estimated Time:** 15 min
**Dependencies:** Task 1

- Export LSP types for renderer use
- Add IPC channel type definitions for `lsp:execute` and `lsp:status`

### Task 9: Write Unit Tests - LSP Client
**File:** `tests/unit/services/lsp/lsp-client.test.ts`
**Complexity:** High
**Estimated Time:** 60 min
**Dependencies:** Task 3

Test the JSON-RPC protocol implementation:
- Message framing: Content-Length header generation and parsing
- Request/response correlation by ID
- Initialize handshake sequence
- Each LSP method (definition, references, symbols, hover, diagnostics)
- Timeout handling
- Server crash handling
- Malformed response handling
- Mock: child_process.spawn (mock stdin/stdout streams)

### Task 10: Write Unit Tests - Service and Manager
**Files:** `tests/unit/services/lsp/lsp.service.test.ts`, `tests/unit/services/lsp/lsp-server-manager.test.ts`, `tests/unit/services/lsp/lsp-tool-handler.test.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Tasks 4-6

Test coverage:
- LSPService: isEnabled check, language detection, operation routing, unsupported language
- ServerManager: start/stop servers, idle timeout, auto-restart, server not found
- ToolHandler: ENABLE_LSP_TOOL gate, input validation, result formatting
- Integration: full flow from tool call to LSP response (mocked server)

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 30-40 | 80%+ lines and branches |
| Integration Tests | 3-5 | Full LSP request cycle with mock server |
| Mock Requirements | child_process.spawn, stdin/stdout streams, filesystem |

### Key Test Scenarios
1. JSON-RPC message framing (Content-Length + body) round-trip
2. Request/response ID correlation with multiple concurrent requests
3. Initialize handshake completes successfully
4. go_to_definition returns correct location
5. find_references returns all usages
6. document_symbols returns hierarchical symbol tree
7. hover returns type information
8. get_diagnostics returns errors and warnings
9. Tool hidden when ENABLE_LSP_TOOL not set
10. Server starts on first request, shuts down after idle timeout
11. Server crash triggers restart on next request
12. Unsupported language returns clear error

---

## BAS Quality Gates

| Phase | Gate | Pass Criteria |
|-------|------|---------------|
| 1 | Linting | ESLint + Prettier: 0 errors |
| 2 | Structure | All imports resolve, types valid |
| 3 | Build | TypeScript compilation: 0 errors |
| 4 | Testing | All tests pass (unit + integration) |
| 5 | Coverage | 80%+ lines and branches |
| 6 | Review | DRA approval, architecture review for protocol correctness |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 32:

- [ ] LSP tool - Language Server Protocol integration for code intelligence (requires ENABLE_LSP_TOOL=1)
- [ ] Go to definition - Jump to symbol definitions across files
- [ ] Find references - Locate all usages of a function or variable
- [ ] Document symbols - View file structure and symbol hierarchy
- [ ] Hover information - Display type information and documentation
- [ ] Get diagnostics - Real-time error and warning detection
- [ ] Language support - Python, TypeScript, Go, Rust, Java, C/C++
- [ ] Plugin-provided LSP - Plugins can bundle LSP server configurations (architecture support)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Language servers not installed on user machine | High | Medium | Check availability, show clear install instructions, start with TS only |
| JSON-RPC framing implementation bugs | Medium | High | Extensive unit tests, follow LSP spec precisely, use reference implementations |
| Language server process leaks | Medium | Medium | Process cleanup on app exit, idle timeout, health monitoring |
| Performance impact from running language servers | Medium | Medium | Start on demand, idle shutdown, limit concurrent servers |
| LSP protocol version incompatibility | Low | Medium | Target LSP 3.17 (widely supported), negotiate capabilities |
| Large codebases cause slow responses | Medium | Low | Request timeouts, workspace root scoping |

---

## Notes

- This is the highest complexity work order in Phase 4 (8/10). The JSON-RPC 2.0 implementation over stdio is the core challenge. Consider using the `vscode-jsonrpc` npm package to handle the protocol layer rather than implementing from scratch.
- The `typescript-language-server` npm package wraps tsserver and provides standard LSP. It can be bundled with the app (`npm install typescript-language-server typescript`) to guarantee availability for TypeScript projects.
- The ENABLE_LSP_TOOL environment variable gate ensures this is opt-in, matching Claude Code VS Code extension behavior. Users must explicitly enable it.
- The idle timeout (5 minutes) prevents resource waste. Language servers can consume significant memory (tsserver: 100-500MB for large projects).
- Plugin-provided LSP support is an architecture concern - the language-configs system should be extensible so plugins can register new language servers. The actual plugin integration is handled in WO-051 (Plugins System).
- Consider starting with TypeScript support only for the initial implementation, and adding other languages incrementally. TypeScript is the most important for this project's codebase.
- The LSP client must handle both synchronous request/response and asynchronous notifications (like publishDiagnostics) from the server.
