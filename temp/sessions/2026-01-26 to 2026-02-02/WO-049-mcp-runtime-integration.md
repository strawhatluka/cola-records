# WO-049: MCP Runtime Integration

**Status:** PLANNED
**Complexity:** 8/10
**Priority:** HIGH
**Phase:** 2 - Advanced Systems
**Dependencies:** WO-042 (Settings Hierarchy), WO-045 (Full Permissions System)
**Category:** Audit Section 12 - MCP (Model Context Protocol)
**Estimated Time:** 12-16 hours
**Created:** 2026-02-01

---

## Objective

Implement full Model Context Protocol (MCP) runtime integration, enabling users to add, remove, list, and test MCP servers across three transports (HTTP, SSE, Stdio), manage server scopes (local/project/user), interact via the `/mcp` slash command, toggle servers with @mentions, and track context window impact from MCP tool definitions.

---

## Background

The current codebase has a basic `ClaudeMcpServer` interface in `src/main/ipc/channels.ts` with fields for name, command, args, env, and enabled status. The `AppSettings` type includes `claudeMcpServers` as an optional array. However, there is no runtime MCP client, no transport layer implementation, no `.mcp.json` project configuration, no `/mcp` interactive command, and no tool discovery or context tracking. This work order builds the complete MCP subsystem on top of the settings hierarchy (WO-042) and permissions system (WO-045).

### Current State
- `ClaudeMcpServer` interface: name, command, args, env, enabled
- `AppSettings.claudeMcpServers` stores basic server configs
- No MCP protocol client implementation
- No transport layer (HTTP/SSE/Stdio)
- No `.mcp.json` project file support
- No `/mcp` slash command
- No tool discovery from MCP servers
- No context window impact tracking

### Target State
- Full MCP client supporting HTTP, SSE, and Stdio transports
- Runtime server lifecycle management (start/stop/health check)
- Tool discovery and registration from connected servers
- Three scope levels: local, project (`.mcp.json`), user
- `/mcp` interactive command with server status dashboard
- @mention toggle for enabling/disabling servers mid-session
- Tool naming convention: `mcp__<server>__<tool>`
- MCP tool permissions integrated with wildcard patterns
- Context window impact tracking for enabled tool definitions

---

## Acceptance Criteria

1. Users can add MCP servers via settings or `/mcp` command with HTTP, SSE, or Stdio transport
2. Servers can be scoped to local (personal + project), project (`.mcp.json`, committed), or user (global)
3. `/mcp` command shows interactive server list with status (connected/disconnected/error)
4. Servers can be enabled/disabled via @mention during conversation
5. Tools discovered from MCP servers follow `mcp__<server>__<tool>` naming
6. MCP tools integrate with the permissions system (wildcard: `mcp__server__*`)
7. `.mcp.json` configuration file is loaded from project root
8. Context window impact is displayed (how many tokens MCP tool definitions consume)
9. Server health checks run automatically on connection
10. All MCP operations have proper error handling and timeout management
11. Unit tests cover all three transports, tool discovery, scope merging, and permissions
12. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
MCPRuntimeService (Main Process)
  |
  +-- MCPTransportFactory
  |     +-- HTTPTransport       (fetch-based, recommended for remote)
  |     +-- SSETransport        (EventSource-based, legacy)
  |     +-- StdioTransport      (child_process spawn, local)
  |
  +-- MCPServerManager
  |     +-- lifecycle: start / stop / restart / health
  |     +-- scope: local / project / user
  |     +-- config loading: .mcp.json + settings hierarchy
  |
  +-- MCPToolRegistry
  |     +-- discoverTools(server) -> MCPTool[]
  |     +-- registerTools(tools)
  |     +-- getContextImpact() -> { tokens, tools }
  |
  +-- IPC Handlers
        +-- mcp:servers:list
        +-- mcp:servers:add
        +-- mcp:servers:remove
        +-- mcp:servers:test
        +-- mcp:servers:toggle
        +-- mcp:tools:list
        +-- mcp:context-impact

Renderer:
  MCPServerManager.tsx (interactive UI)
  useClaudeStore.ts (mcpServers state, tool registry)
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/mcp-runtime.service.ts` | Core MCP runtime service with transport factory and server lifecycle |
| `src/main/services/mcp/http-transport.ts` | HTTP transport client for remote MCP servers |
| `src/main/services/mcp/sse-transport.ts` | SSE transport client (legacy) |
| `src/main/services/mcp/stdio-transport.ts` | Stdio transport client for local process MCP |
| `src/main/services/mcp/tool-registry.ts` | MCP tool discovery and registration |
| `src/main/services/mcp/types.ts` | MCP-specific type definitions |
| `src/renderer/components/claude/MCPServerManager.tsx` | Interactive MCP server management UI |
| `tests/unit/services/mcp-runtime.service.test.ts` | MCP runtime service tests |
| `tests/unit/services/mcp/http-transport.test.ts` | HTTP transport tests |
| `tests/unit/services/mcp/sse-transport.test.ts` | SSE transport tests |
| `tests/unit/services/mcp/stdio-transport.test.ts` | Stdio transport tests |
| `tests/unit/services/mcp/tool-registry.test.ts` | Tool registry tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add MCP IPC channels, expand `ClaudeMcpServer` interface with transport type, scope, status |
| `src/main/ipc/handlers.ts` | Register MCP IPC handlers |
| `src/main/services/claude-container.service.ts` | Inject MCP tools into Claude system prompt, pass tool definitions |
| `src/renderer/stores/useClaudeStore.ts` | Add MCP server state, tool registry state, context impact tracking |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/mcp` command |
| `src/renderer/components/claude/ClaudeInputArea.tsx` | Support @mention for MCP servers |

### Interfaces

```typescript
// src/main/services/mcp/types.ts

export type MCPTransportType = 'http' | 'sse' | 'stdio';
export type MCPServerScope = 'local' | 'project' | 'user';
export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportType;
  /** HTTP/SSE: URL endpoint; Stdio: executable command */
  endpoint: string;
  /** Stdio-only: command arguments */
  args?: string[];
  /** Environment variables passed to stdio process */
  env?: Record<string, string>;
  /** Configuration scope */
  scope: MCPServerScope;
  /** Enabled/disabled state */
  enabled: boolean;
  /** Optional authentication headers (HTTP/SSE) */
  headers?: Record<string, string>;
}

export interface MCPServerState extends MCPServerConfig {
  status: MCPServerStatus;
  tools: MCPTool[];
  lastHealthCheck?: number;
  error?: string;
  /** Context tokens consumed by tool definitions */
  contextTokens: number;
}

export interface MCPTool {
  /** Fully qualified name: mcp__<server>__<tool> */
  qualifiedName: string;
  /** Original tool name from MCP server */
  originalName: string;
  /** Server this tool belongs to */
  serverName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCallRequest {
  serverName: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface MCPToolCallResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface MCPProjectConfig {
  /** .mcp.json format */
  mcpServers: Record<string, {
    transport: MCPTransportType;
    endpoint: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
  }>;
}

export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, input: Record<string, unknown>): Promise<MCPToolCallResult>;
  healthCheck(): Promise<boolean>;
}
```

---

## Implementation Tasks

### Task 1: MCP Type Definitions and IPC Channels
- **Type:** FEATURE
- **Files:** `src/main/services/mcp/types.ts`, `src/main/ipc/channels.ts`
- **Details:** Create all MCP-related types (MCPServerConfig, MCPServerState, MCPTool, MCPTransport interface, MCPProjectConfig). Add IPC channel definitions for `mcp:servers:list`, `mcp:servers:add`, `mcp:servers:remove`, `mcp:servers:test`, `mcp:servers:toggle`, `mcp:tools:list`, `mcp:context-impact`. Expand existing `ClaudeMcpServer` to include transport type and scope.
- **Test:** Type compilation validation, IPC channel type safety

### Task 2: HTTP Transport Client
- **Type:** FEATURE
- **Files:** `src/main/services/mcp/http-transport.ts`
- **Details:** Implement `MCPTransport` interface using Node.js `fetch` (or `http`/`https`). POST to `/tools/list` for tool discovery. POST to `/tools/call` for tool invocation. Support authentication headers. Implement connection timeout (10s), request timeout (30s). Health check via GET `/health`.
- **Test:** `tests/unit/services/mcp/http-transport.test.ts` - Mock HTTP server, test connect/disconnect, tool listing, tool calling, timeout handling, auth headers, error responses

### Task 3: SSE Transport Client
- **Type:** FEATURE
- **Files:** `src/main/services/mcp/sse-transport.ts`
- **Details:** Implement `MCPTransport` using EventSource for server-to-client streaming. POST for requests, SSE for responses. Reconnection logic with exponential backoff. Parse NDJSON event stream for tool results.
- **Test:** `tests/unit/services/mcp/sse-transport.test.ts` - Mock SSE server, test streaming responses, reconnection, error handling

### Task 4: Stdio Transport Client
- **Type:** FEATURE
- **Files:** `src/main/services/mcp/stdio-transport.ts`
- **Details:** Implement `MCPTransport` using `child_process.spawn`. Send JSON-RPC messages on stdin, read JSON-RPC responses from stdout. Handle process lifecycle (spawn, kill, restart). Parse stderr for diagnostic output. Set environment variables from config. Support `$CLAUDE_PROJECT_DIR` variable.
- **Test:** `tests/unit/services/mcp/stdio-transport.test.ts` - Mock child process, test spawn/kill, message exchange, env vars, error handling

### Task 5: MCP Tool Registry
- **Type:** FEATURE
- **Files:** `src/main/services/mcp/tool-registry.ts`
- **Details:** Maintain a registry of all tools from all connected MCP servers. Apply naming convention `mcp__<server>__<tool>`. Calculate context token impact (estimate tokens per tool definition JSON). Provide methods: `discoverTools(server)`, `registerTools()`, `unregisterTools(serverName)`, `getTools()`, `getContextImpact()`, `findTool(qualifiedName)`.
- **Test:** `tests/unit/services/mcp/tool-registry.test.ts` - Test naming convention, registration, unregistration, context impact calculation, lookup

### Task 6: MCP Runtime Service
- **Type:** FEATURE
- **Files:** `src/main/services/mcp-runtime.service.ts`
- **Details:** Core orchestrator service. Transport factory creates correct transport based on config type. Server lifecycle: `addServer()`, `removeServer()`, `startServer()`, `stopServer()`, `restartServer()`, `testServer()`. Load configs from three sources: user settings (`~/.claude/settings.json`), project (`.mcp.json`), local (`.claude/settings.local.json`). Merge configs with scope precedence. Auto-connect enabled servers on startup. Periodic health checks (60s interval). Emit status change events to renderer via IPC.
- **Test:** `tests/unit/services/mcp-runtime.service.test.ts` - Test config loading, scope merging, lifecycle operations, health checks, error recovery

### Task 7: IPC Handler Registration
- **Type:** INTEGRATION
- **Files:** `src/main/ipc/handlers.ts`
- **Details:** Register all MCP IPC handlers connecting renderer requests to MCPRuntimeService methods. Handle errors gracefully with descriptive messages. Pass server status updates via `mcp:status-changed` event channel.
- **Test:** Integration test via IPC channel invocation mocks

### Task 8: Claude Container MCP Integration
- **Type:** INTEGRATION
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** When building the Claude query payload, inject MCP tool definitions from the tool registry into the system prompt or tools array. When Claude invokes an `mcp__*` tool, route the call through MCPRuntimeService to the appropriate server. Return MCP tool results as `tool_result` stream events.
- **Test:** Test tool injection into query, tool call routing, result handling

### Task 9: Store Updates and Context Impact Tracking
- **Type:** FEATURE
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add state: `mcpServers: MCPServerState[]`, `mcpTools: MCPTool[]`, `mcpContextImpact: { totalTokens: number; byServer: Record<string, number> }`. Add actions: `loadMCPServers()`, `addMCPServer()`, `removeMCPServer()`, `toggleMCPServer()`, `refreshMCPTools()`. Listen for `mcp:status-changed` IPC events.
- **Test:** Store action tests with mocked IPC

### Task 10: MCPServerManager UI Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/MCPServerManager.tsx`
- **Details:** Interactive panel showing all MCP servers grouped by scope (User/Project/Local). Each server row shows: name, transport icon, status indicator (green/yellow/red dot), tool count, context tokens consumed, enable/disable toggle. Action buttons: Add Server, Remove, Test Connection, Refresh. Add Server form: name, transport type dropdown, endpoint/command, scope dropdown. Context impact summary at bottom: "X tools consuming ~Y tokens".
- **Test:** Render tests for server list, add form, toggle, status indicators

### Task 11: /mcp Slash Command and @mention Toggle
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`, `src/renderer/components/claude/ClaudeInputArea.tsx`
- **Details:** Register `/mcp` in slash command registry. When invoked, open MCPServerManager panel. In @mention autocomplete, include MCP server names prefixed with `@mcp:`. Selecting an @mcp mention toggles that server enabled/disabled for the current session.
- **Test:** Slash command registration test, @mention autocomplete filtering test

### Task 12: .mcp.json Configuration File Support
- **Type:** FEATURE
- **Files:** `src/main/services/mcp-runtime.service.ts`
- **Details:** On project load, check for `.mcp.json` in project root. Parse JSON following `MCPProjectConfig` schema. Merge project MCP servers with user and local configs. Watch `.mcp.json` for changes and reload. Validate schema on load with descriptive error messages for invalid configs.
- **Test:** Test file loading, schema validation, merge with other scopes, file watching

---

## Testing Requirements

- **Unit Tests:** Each transport (HTTP, SSE, Stdio), tool registry, runtime service, store actions
- **Integration Tests:** IPC handler round-trip, container tool injection, tool call routing
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock HTTP servers for transport tests, mock child_process for stdio, mock IPC for renderer tests
- **Edge Cases:** Server disconnection during tool call, invalid `.mcp.json`, duplicate server names across scopes, tool name collisions

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for MCP protocol correctness, security of transport layer |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 12 (MCP):

- [ ] HTTP transport
- [ ] SSE transport
- [ ] Stdio transport
- [ ] List servers
- [ ] Remove server
- [ ] Test server
- [ ] Scope options (local/project/user)
- [ ] /mcp command
- [ ] @mention MCP servers
- [ ] MCP tool naming (mcp__server__tool)
- [ ] MCP tool permissions with wildcards
- [ ] Context window impact tracking
- [ ] .mcp.json project config
- [ ] settings.local.json local MCP config

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MCP protocol version incompatibility | HIGH | MEDIUM | Pin to stable MCP spec, implement version negotiation |
| Stdio process leaks on crash | HIGH | MEDIUM | Implement process cleanup on disconnect, SIGTERM/SIGKILL fallback |
| SSE reconnection storms | MEDIUM | LOW | Exponential backoff with jitter, max retry limit |
| Context window overflow from many MCP tools | HIGH | MEDIUM | Track token impact, warn at 20% context usage, allow disable |
| Tool name collisions across servers | MEDIUM | LOW | Fully qualified naming, log warnings for collisions |

---

## Notes

- This work order depends on WO-042 (Settings Hierarchy) for multi-tier config loading and WO-045 (Full Permissions) for MCP tool permission wildcards.
- The MCP "Serve mode" (exposing Cola Records as an MCP server) is out of scope for this work order.
- Claude Code as MCP Server functionality is deferred to a future work order.
- The HTTP transport is recommended as the primary transport; SSE is legacy but must be supported for backward compatibility.
- Stdio transport security: only spawn executables that the user has explicitly configured.
