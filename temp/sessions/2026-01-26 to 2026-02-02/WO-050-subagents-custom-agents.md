# WO-050: Subagents & Custom Agents

**Status:** PLANNED
**Complexity:** 8/10
**Priority:** HIGH
**Phase:** 2 - Advanced Systems
**Dependencies:** WO-042 (Settings Hierarchy), WO-046 (Full Hooks System)
**Category:** Audit Section 15 - Subagents & Custom Agents
**Estimated Time:** 12-16 hours
**Created:** 2026-02-01

---

## Objective

Implement the full subagent system including three built-in agent types (Explore, Plan, General-purpose), custom agent definitions from project and user directories, YAML frontmatter-based agent configuration, automatic delegation logic, the `/agents` slash command, and agent-scoped hooks.

---

## Background

The current codebase has stream event types `subagent_start` and `subagent_result` in `ClaudeStreamEvent`, and `AppSettings` references for hooks. However, there is no subagent spawning logic, no agent file parser, no built-in agent types, and no `/agents` command. The Claude container currently handles all queries in a single context. This work order adds the ability to delegate tasks to specialized subagents that run with restricted tool sets and their own system prompts.

### Current State
- `ClaudeStreamEvent` includes `subagentId` and `subagentTask` fields
- No `SubagentService` or agent spawning logic
- No `.claude/agents/` or `~/.claude/agents/` directory scanning
- No built-in agent types (Explore, Plan, General)
- No YAML frontmatter parsing for agent files
- No `/agents` slash command
- No auto-delegation logic

### Target State
- Three built-in subagents with predefined capabilities
- Custom agents loaded from `.claude/agents/` (project) and `~/.claude/agents/` (user)
- Agent markdown files with YAML frontmatter (name, description, model, tools, hooks)
- Auto-delegation: Claude decides when to invoke agents based on description matching
- `/agents` command to create, edit, list, and manage agents
- Agent-scoped hooks that live only for the agent's lifetime
- Project agents override user agents with the same name
- Subagent results streamed back as `subagent_start`/`subagent_result` events

---

## Acceptance Criteria

1. Built-in Explore agent can search/read files but cannot modify anything
2. Built-in Plan agent can analyze and produce plans but not execute changes
3. Built-in General-purpose agent has full tool access for complex multi-step tasks
4. Custom agents loaded from `.claude/agents/` and `~/.claude/agents/` directories
5. Agent files use markdown with YAML frontmatter parsed correctly
6. Each agent respects its configured `model` and `tools` restrictions
7. Auto-delegation triggers when Claude determines a subagent is appropriate
8. `/agents` command lists all agents and allows creating new agent files
9. Agent name conflicts resolved: project agents override user agents
10. Agent-scoped hooks activate on agent start and deactivate on agent stop
11. Subagent events stream properly to the renderer (start, result)
12. Unit tests cover agent parsing, spawning, delegation, tool restrictions
13. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
SubagentService (Main Process)
  |
  +-- AgentFileParser
  |     +-- parseYAMLFrontmatter(markdown) -> AgentConfig
  |     +-- scanDirectory(path) -> AgentConfig[]
  |
  +-- BuiltInAgents
  |     +-- ExploreAgent (read-only: Glob, Grep, Read, Bash[read-only])
  |     +-- PlanAgent (analysis: Read, Glob, Grep, no writes)
  |     +-- GeneralAgent (full tools)
  |
  +-- AgentSpawner
  |     +-- spawn(agentConfig, task) -> SubagentSession
  |     +-- stop(sessionId)
  |     +-- getActiveAgents() -> SubagentSession[]
  |
  +-- DelegationEngine
  |     +-- shouldDelegate(userMessage, agents) -> AgentConfig | null
  |     +-- matchDescription(task, agentDescriptions) -> score
  |
  +-- AgentHookManager
        +-- activateHooks(agentConfig)
        +-- deactivateHooks(agentConfig)

Renderer:
  AgentManager.tsx (list, create, status UI)
  useClaudeStore.ts (agents state, active subagents)
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/subagent.service.ts` | Core subagent orchestration service |
| `src/main/services/subagent/agent-parser.ts` | YAML frontmatter + markdown parser for agent files |
| `src/main/services/subagent/built-in-agents.ts` | Definitions for Explore, Plan, and General agents |
| `src/main/services/subagent/agent-spawner.ts` | Agent session spawning and lifecycle |
| `src/main/services/subagent/delegation-engine.ts` | Auto-delegation decision logic |
| `src/main/services/subagent/types.ts` | Subagent type definitions |
| `src/renderer/components/claude/AgentManager.tsx` | Agent listing, creation, and status UI |
| `tests/unit/services/subagent.service.test.ts` | Subagent service tests |
| `tests/unit/services/subagent/agent-parser.test.ts` | YAML frontmatter parsing tests |
| `tests/unit/services/subagent/built-in-agents.test.ts` | Built-in agent configuration tests |
| `tests/unit/services/subagent/delegation-engine.test.ts` | Delegation logic tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add subagent IPC channels, `AgentConfig` type |
| `src/main/ipc/handlers.ts` | Register subagent IPC handlers |
| `src/main/services/claude-container.service.ts` | Integrate subagent spawning, route `Task` tool calls to SubagentService |
| `src/renderer/stores/useClaudeStore.ts` | Add agents state, active subagents tracking |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/agents` command |
| `src/renderer/components/claude/ClaudeMessage.tsx` | Render subagent_start/subagent_result events |

### Interfaces

```typescript
// src/main/services/subagent/types.ts

export type BuiltInAgentType = 'explore' | 'plan' | 'general';

export interface AgentConfig {
  /** Agent name (used as identifier and slash command) */
  name: string;
  /** Human-readable description; used for auto-delegation matching */
  description: string;
  /** Model to use: sonnet, opus, haiku, or specific version ID */
  model?: string;
  /** Allowed tools list; empty = all tools; specific names restrict access */
  tools?: string[];
  /** System prompt (markdown body of agent file) */
  systemPrompt: string;
  /** Source: built-in, project (.claude/agents/), or user (~/.claude/agents/) */
  source: 'built-in' | 'project' | 'user';
  /** File path for custom agents */
  filePath?: string;
  /** Agent-scoped hooks from YAML frontmatter */
  hooks?: AgentHookConfig[];
  /** Whether this is a built-in agent type */
  builtInType?: BuiltInAgentType;
}

export interface AgentHookConfig {
  event: string;
  command: string;
  matcher?: string;
  /** If true, hook runs once then is removed */
  once?: boolean;
}

export interface SubagentSession {
  id: string;
  agentConfig: AgentConfig;
  task: string;
  status: 'running' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface AgentFileParseResult {
  frontmatter: {
    name: string;
    description: string;
    model?: string;
    tools?: string[];
    hooks?: AgentHookConfig[];
  };
  body: string; // markdown content = system prompt
}

export interface DelegationDecision {
  shouldDelegate: boolean;
  agent?: AgentConfig;
  confidence: number;
  reason: string;
}
```

---

## Implementation Tasks

### Task 1: Subagent Type Definitions and IPC Channels
- **Type:** FEATURE
- **Files:** `src/main/services/subagent/types.ts`, `src/main/ipc/channels.ts`
- **Details:** Create all subagent types (AgentConfig, SubagentSession, AgentFileParseResult, DelegationDecision). Add IPC channels: `claude:agents:list` returns `AgentConfig[]`, `claude:agents:create` accepts name + content and writes agent file, `claude:agents:delete` removes agent file, `claude:agents:spawn` spawns subagent with task string, `claude:agents:active` returns active `SubagentSession[]`.
- **Test:** Type compilation validation

### Task 2: Agent File Parser
- **Type:** FEATURE
- **Files:** `src/main/services/subagent/agent-parser.ts`
- **Details:** Parse markdown files with YAML frontmatter delimited by `---`. Extract frontmatter fields: name (required), description (required), model (optional, defaults to 'sonnet'), tools (optional, defaults to all), hooks (optional). The markdown body after the closing `---` becomes the system prompt. Support nested YAML for hooks array. Validate required fields, return descriptive errors for malformed files.
- **Test:** `tests/unit/services/subagent/agent-parser.test.ts` - Valid frontmatter, missing required fields, empty body, complex hooks array, malformed YAML, no frontmatter delimiter

### Task 3: Built-In Agent Definitions
- **Type:** FEATURE
- **Files:** `src/main/services/subagent/built-in-agents.ts`
- **Details:** Define three built-in agents as `AgentConfig` objects. **Explore**: name='explore', description='Fast read-only agent for searching and analyzing codebases', model='sonnet', tools=['Read', 'Glob', 'Grep', 'Bash'], systemPrompt with read-only instructions. **Plan**: name='plan', description='Research agent for gathering context and creating implementation plans', model='sonnet', tools=['Read', 'Glob', 'Grep'], systemPrompt with analysis-only instructions. **General**: name='general', description='Capable agent for complex multi-step tasks requiring both exploration and action', model='sonnet', tools=[] (all), systemPrompt with full capability instructions.
- **Test:** `tests/unit/services/subagent/built-in-agents.test.ts` - Validate each agent has required fields, tool restrictions are correct

### Task 4: Agent Directory Scanner
- **Type:** FEATURE
- **Files:** `src/main/services/subagent.service.ts`
- **Details:** Implement `scanAgentDirectories()` that reads `.claude/agents/` (project) and `~/.claude/agents/` (user). For each `.md` file found, parse with AgentFileParser. Merge results: project agents take precedence over user agents with the same name. Combine with built-in agents (built-ins have lowest precedence). Watch directories for file changes and reload.
- **Test:** `tests/unit/services/subagent.service.test.ts` - Mock filesystem with agent files, test scanning, name conflict resolution, file watching

### Task 5: Agent Spawner
- **Type:** FEATURE
- **Files:** `src/main/services/subagent/agent-spawner.ts`
- **Details:** Spawn a subagent session: create a new Claude query with the agent's system prompt, model, and tool restrictions. The spawner sends a `subagent_start` stream event to the renderer, runs the Claude query with the task as the user message, collects the response, and sends a `subagent_result` event. Tool restrictions enforced by filtering the tools array passed to the container. Multiple subagents can run concurrently. Track active sessions with unique IDs.
- **Test:** Mock container queries, test tool filtering, concurrent sessions, error handling

### Task 6: Delegation Engine
- **Type:** FEATURE
- **Files:** `src/main/services/subagent/delegation-engine.ts`
- **Details:** Analyze user messages and current context to determine if delegation is appropriate. Use keyword matching against agent descriptions. Score each agent based on relevance. Threshold: only delegate if confidence > 0.7. Return `DelegationDecision` with the selected agent or null. The main Claude can also explicitly invoke the `Task` tool to delegate. Consider message length, complexity keywords ("search for", "analyze", "create a plan"), and active context.
- **Test:** `tests/unit/services/subagent/delegation-engine.test.ts` - Test keyword matching, confidence scoring, threshold behavior, no-match scenarios

### Task 7: Agent-Scoped Hook Management
- **Type:** INTEGRATION
- **Files:** `src/main/services/subagent.service.ts`
- **Details:** When a subagent starts, activate its hooks (from frontmatter) by registering them with the hooks system (WO-046). When the subagent completes or errors, deactivate those hooks. If a hook has `once: true`, it auto-removes after first execution. Hook events scoped: SubagentStart, SubagentStop fire for the specific agent.
- **Test:** Test hook activation on spawn, deactivation on complete, once behavior

### Task 8: IPC Handler Registration
- **Type:** INTEGRATION
- **Files:** `src/main/ipc/handlers.ts`
- **Details:** Register all subagent IPC handlers. `claude:agents:list` calls `SubagentService.getAgents()`. `claude:agents:create` writes a new `.md` file to `.claude/agents/` with provided name and content. `claude:agents:delete` removes the file. `claude:agents:spawn` spawns agent with task. `claude:agents:active` returns active sessions.
- **Test:** IPC round-trip mocks

### Task 9: Container Integration
- **Type:** INTEGRATION
- **Files:** `src/main/services/claude-container.service.ts`
- **Details:** When Claude produces a `tool_use` event for the `Task` tool, intercept and route to `SubagentService.spawn()`. Pass the task description and optional agent type from tool input. Stream `subagent_start` and `subagent_result` events to the renderer. Include subagent results in the conversation context for subsequent Claude responses.
- **Test:** Test Task tool interception, subagent result injection

### Task 10: Store Updates
- **Type:** FEATURE
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add state: `agents: AgentConfig[]`, `activeSubagents: SubagentSession[]`. Add actions: `loadAgents()`, `spawnAgent(name, task)`, `getActiveSubagents()`. Listen for subagent stream events to update active session status. On `subagent_start`, add to activeSubagents. On `subagent_result`, update status to completed.
- **Test:** Store action tests with mocked IPC

### Task 11: AgentManager UI Component
- **Type:** UI
- **Files:** `src/renderer/components/claude/AgentManager.tsx`
- **Details:** Panel with two sections: **Available Agents** (list of all agents with name, description, source badge, model) and **Active Subagents** (running sessions with task, status, elapsed time). Each available agent shows source icon (built-in/project/user). Create Agent button opens a form with name, description, model dropdown, tools checklist, and system prompt textarea. Active subagents show spinner while running, result preview when complete.
- **Test:** Render tests for agent list, create form, active sessions display

### Task 12: /agents Slash Command
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`
- **Details:** Register `/agents` in the slash command registry. When invoked, open the AgentManager panel. If invoked with arguments (e.g., `/agents create security-reviewer`), pre-fill the create form.
- **Test:** Slash command registration test, argument parsing test

---

## Testing Requirements

- **Unit Tests:** Agent parser, built-in agents, delegation engine, spawner, directory scanner
- **Integration Tests:** Container Task tool routing, hook activation/deactivation, IPC handlers
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock filesystem for directory scanning, mock container for spawning, mock IPC for renderer
- **Edge Cases:** Malformed agent files, missing required fields, agent name collisions, concurrent subagent spawning, agent hooks that fail, empty agents directory

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for agent isolation, tool restriction enforcement |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 15 (Subagents & Custom Agents):

- [ ] Explore agent (read-only)
- [ ] Plan agent (analysis)
- [ ] General-purpose agent
- [ ] Project agents (.claude/agents/)
- [ ] User agents (~/.claude/agents/)
- [ ] Agent file format (YAML frontmatter + markdown)
- [ ] Agent model selection
- [ ] Agent tools configuration
- [ ] Automatic delegation
- [ ] /agents command
- [ ] Agent name conflicts (project overrides global)
- [ ] Agent hooks in frontmatter

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Subagent context explosion (too many concurrent agents) | HIGH | MEDIUM | Limit concurrent subagents to 3, queue additional requests |
| Tool restriction bypass via creative prompting | HIGH | LOW | Enforce tool whitelist at the container level, not just prompt level |
| Agent file injection (malicious system prompts) | MEDIUM | LOW | Only load from trusted directories, display agent source in UI |
| Delegation false positives (unnecessary agent spawns) | MEDIUM | MEDIUM | High confidence threshold (0.7), user can disable auto-delegation |
| Hook leak (agent hooks not cleaned up) | MEDIUM | LOW | Always deactivate hooks in finally block, track hook IDs per session |

---

## Notes

- This work order depends on WO-042 for settings hierarchy (user directory paths) and WO-046 for the hooks system (agent-scoped hooks).
- The `Task` tool from Claude Code's built-in tools maps to our subagent spawning mechanism.
- Built-in agents use 'sonnet' as default model for cost efficiency; users can override via custom agents.
- Agent files follow the exact same format as Claude Code's custom agents for maximum compatibility.
- The delegation engine is intentionally conservative (high threshold) to avoid unwanted subagent spawns.
