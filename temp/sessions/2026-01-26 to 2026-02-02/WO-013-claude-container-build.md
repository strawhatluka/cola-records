# ORCHESTRATOR WORK ORDER #013
## Type: IMPLEMENTATION
## Build Cola Records Claude Agent Container

---

## MISSION OBJECTIVE

Build a custom Docker container that runs a lightweight Hono server wrapping the `@anthropic-ai/claude-agent-sdk`, supporting both `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` (Max plan) authentication. This replaces the placeholder `ghcr.io/anthropics/claude-code:latest` image reference in our existing container service with a container we build and control.

**Implementation Goal:** A working Docker container at `docker/claude-container/` that exposes `/query` (POST, streaming), `/health` (GET), and handles Max plan OAuth token credential writing via entrypoint — fully compatible with our existing `claude-container.service.ts` and `useClaudeStore.ts`.

**Based On:** [receipting/claude-agent-sdk-container](https://github.com/receipting/claude-agent-sdk-container) blueprint + WO-010/011/012 existing integration

---

## IMPLEMENTATION SCOPE

### Files to Create
```yaml
New_Files:
  - path: docker/claude-container/Dockerfile
    description: Multi-stage Docker build (node:22-alpine, tsx, claude-agent-sdk)
    risk: MEDIUM

  - path: docker/claude-container/server.ts
    description: Hono server with /query (streaming) and /health endpoints
    risk: MEDIUM

  - path: docker/claude-container/package.json
    description: Container dependencies (hono, @anthropic-ai/claude-agent-sdk, jose)
    risk: LOW

  - path: docker/claude-container/tsconfig.json
    description: TypeScript config for the container server
    risk: LOW

  - path: docker/claude-container/docker-entrypoint.sh
    description: Entrypoint script that writes OAuth credentials for Max plan
    risk: MEDIUM

  - path: docker/claude-container/.claude/settings.json
    description: Claude SDK settings (allowAll tools, no permission prompts)
    risk: LOW
```

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/services/claude-container.service.ts
    changes: Update image name, add OAuth token env var, add X-API-Key header to /query
    risk: MEDIUM

  - path: src/main/ipc/channels.ts
    changes: Add claudeOAuthToken to AppSettings, update ClaudeQueryResponse
    risk: LOW

  - path: src/main/index.ts
    changes: Pass OAuth token to container start, update settings handlers
    risk: LOW

  - path: src/renderer/components/settings/SettingsForm.tsx
    changes: Replace API Key input with OAuth Token input (or support both)
    risk: LOW

  - path: src/renderer/stores/useClaudeStore.ts
    changes: Update streaming to parse JSON chunks from server (not raw HTTP chunks)
    risk: MEDIUM
```

---

### Changes Required

#### Change Set 1: Container Server (docker/claude-container/)

**server.ts** — Stripped-down Hono server based on the blueprint:

```typescript
// What we KEEP from the blueprint:
// - Hono framework with @hono/node-server
// - /health endpoint (returns API key status + SDK loaded)
// - /query POST endpoint with @anthropic-ai/claude-agent-sdk query()
// - Session ID tracking for conversation continuity
// - Streaming responses via SDK async iterator
// - ANTHROPIC_API_KEY || CLAUDE_CODE_OAUTH_TOKEN auth check
// - API key protection via X-API-Key header
// - Graceful shutdown (SIGTERM/SIGINT)

// What we STRIP from the blueprint:
// - GitHub OAuth (not needed — our Electron app is the only client)
// - WebSocket endpoint (we use HTTP streaming via IPC)
// - Web CLI / React SPA frontend
// - Static file serving
// - Multi-agent Canadian/Australian demo
// - JWT session cookies
// - Docker environment enforcement check

// What we ADD/CHANGE:
// - Stream response as newline-delimited JSON (NDJSON) for cleaner parsing
//   Each line: {"type":"text","content":"..."} or {"type":"done"} or {"type":"error","message":"..."}
// - Single-agent mode (no subagents) — direct prompt passthrough
// - Configurable model via request body options
// - Working directory set to /workspace (mounted project volume)
```

**Streaming format (NDJSON):**
```
{"type":"text","content":"Here is"}
{"type":"text","content":" my response"}
{"type":"done","sessionId":"abc-123"}
```

This is cleaner than raw HTTP chunked encoding for our `claude-container.service.ts` to parse.

**docker-entrypoint.sh** — From the blueprint, writes OAuth credentials:
```bash
#!/bin/sh
# If CLAUDE_CODE_OAUTH_TOKEN is set, write ~/.claude/.credentials.json
# and ~/.claude.json for Max plan authentication.
# If ANTHROPIC_API_KEY is set instead, no credential files needed —
# the SDK reads it from the environment directly.
# Then: exec tsx server.ts
```

**Dockerfile** — Multi-stage build:
```dockerfile
# Stage 1: Install production dependencies
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
RUN apk --no-cache add tini bash git && \
    npm install -g tsx @anthropic-ai/claude-agent-sdk
RUN adduser -u 10001 -D -s /bin/bash appuser
COPY --from=builder /app/node_modules ./node_modules
COPY server.ts package.json tsconfig.json ./
COPY docker-entrypoint.sh ./
COPY .claude/settings.json ./claude-settings.json
RUN mkdir -p /home/appuser/.claude && \
    cp ./claude-settings.json /home/appuser/.claude/settings.json && \
    chown -R appuser:appuser /home/appuser /app && \
    chmod +x docker-entrypoint.sh
USER appuser
ENV HOME=/home/appuser
VOLUME ["/home/appuser/.claude"]
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
```

**package.json:**
```json
{
  "name": "cola-claude-container",
  "version": "1.0.0",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "@hono/node-server": "^1.0.0",
    "hono": "^4.0.0"
  }
}
```

#### Change Set 2: Update claude-container.service.ts

**Current:** Points to `ghcr.io/anthropics/claude-code:latest`, passes only `ANTHROPIC_API_KEY`, streams raw HTTP chunks.

**Target:**
- Image name: `cola-claude-agent:latest` (locally built)
- Pass `CLAUDE_CODE_OAUTH_TOKEN` OR `ANTHROPIC_API_KEY` depending on which is configured
- Pass `CLAUDE_AGENT_SDK_CONTAINER_API_KEY` for endpoint protection
- Add `X-API-Key` header to `/query` requests
- Parse NDJSON streaming lines instead of raw chunks
- Forward parsed `{"type":"text","content":"..."}` as `claude:stream-chunk` events
- Forward `sessionId` from `{"type":"done"}` for conversation continuity

#### Change Set 3: Update AppSettings + Settings UI

**channels.ts:** Add `claudeOAuthToken?: string` to `AppSettings` (keep `claudeApiKey` for standard API key support).

**SettingsForm.tsx:** Add a toggle or two fields:
- "OAuth Token (Max Plan)" — for `CLAUDE_CODE_OAUTH_TOKEN`
- "API Key (Standard)" — for `ANTHROPIC_API_KEY`
- Only one needs to be set. OAuth takes priority.

**index.ts (IPC handlers):** Pass the correct token to `claudeContainerService.start()` based on which is configured.

#### Change Set 4: Update useClaudeStore streaming

**Current:** Listens to `claude:stream-chunk` events with `{ content: string, done: boolean }`.

**Target:** No change needed to the store — the `claude-container.service.ts` will parse NDJSON and continue emitting the same `{ content, done }` shape. The store interface stays stable.

---

## IMPLEMENTATION APPROACH

### Step 1: Create Container Source
- [ ] Create `docker/claude-container/` directory
- [ ] Create `package.json` with hono + claude-agent-sdk dependencies
- [ ] Create `tsconfig.json`
- [ ] Create `.claude/settings.json` (allowAll tools)
- [ ] Create `docker-entrypoint.sh` (OAuth credential writer + server start)
- [ ] Create `server.ts` (Hono server with /health, /query NDJSON streaming)
- [ ] Create `Dockerfile` (multi-stage build)

### Step 2: Update Electron Service Layer
- [ ] Read and update `src/main/services/claude-container.service.ts`:
  - Change image constant to `cola-claude-agent:latest`
  - Update `start()` to accept and pass OAuth token or API key
  - Add `X-API-Key` header to query requests
  - Parse NDJSON streaming in `query()` method
  - Add `docker build` step if image doesn't exist locally
- [ ] Read and update `src/main/ipc/channels.ts`:
  - Add `claudeOAuthToken` to `AppSettings`
- [ ] Read and update `src/main/index.ts`:
  - Pass correct token type to container start
  - Handle `claudeOAuthToken` in settings get/update

### Step 3: Update Settings UI
- [ ] Read and update `src/renderer/components/settings/SettingsForm.tsx`:
  - Add OAuth Token field alongside existing API Key field
  - Indicate which takes priority

### Step 4: Validation
- [ ] Verify TypeScript compiles without errors
- [ ] Verify Docker build works: `docker build -t cola-claude-agent:latest docker/claude-container/`
- [ ] Verify existing tests pass (no regressions)

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CLAUDE-CONTAINER-BUILD-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was built
2. **Changes Applied** - Detailed list with file paths
3. **Container Architecture** - Diagram of container internals
4. **Test Results** - Docker build + TypeScript compilation
5. **Rollback Plan** - How to revert
6. **Next Steps** - Testing with real Max plan token

### Evidence to Provide
- Docker build output (success)
- TypeScript compilation verification
- File diff statistics

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/sessions/`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-013-claude-container-build.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-013-claude-container-build.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] `docker/claude-container/` contains all 6 files (Dockerfile, server.ts, package.json, tsconfig.json, docker-entrypoint.sh, .claude/settings.json)
- [ ] `docker build -t cola-claude-agent:latest docker/claude-container/` succeeds
- [ ] server.ts exposes `/health` (GET) and `/query` (POST with NDJSON streaming)
- [ ] docker-entrypoint.sh correctly writes OAuth credentials for Max plan
- [ ] claude-container.service.ts uses local image `cola-claude-agent:latest`
- [ ] claude-container.service.ts passes correct auth env vars (OAuth or API key)
- [ ] claude-container.service.ts parses NDJSON streaming correctly
- [ ] Settings UI supports both OAuth Token and API Key input
- [ ] TypeScript compiles without errors
- [ ] No test regressions

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations. Only LUKA has permission.

### Do NOT:
- [ ] Include GitHub OAuth in the container (not needed for our use case)
- [ ] Include WebSocket support (we use HTTP streaming via IPC)
- [ ] Include the web CLI/SPA frontend
- [ ] Include the multi-agent demo (Canadian/Australian)
- [ ] Add heavy dependencies beyond what the blueprint uses
- [ ] Modify the useClaudeStore streaming interface (keep { content, done })
- [ ] Perform ANY git operations

### DO:
- [ ] Follow the blueprint's security patterns (non-root user, tini, execFile)
- [ ] Support both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN
- [ ] Use NDJSON streaming for clean chunk parsing
- [ ] Keep the container minimal and focused
- [ ] Read files before editing
- [ ] Edit sequentially (no parallel edits)

---

## ROLLBACK STRATEGY

If issues arise:
1. Delete `docker/claude-container/` directory entirely
2. Revert `claude-container.service.ts` to use `ghcr.io/anthropics/claude-code:latest`
3. Revert `channels.ts` to remove `claudeOAuthToken`
4. Revert `SettingsForm.tsx` to single API key field
5. Revert `index.ts` settings handlers

**Critical Files Backup:** claude-container.service.ts, channels.ts, index.ts, SettingsForm.tsx

---

## CONTEXT FROM INVESTIGATION

**Source:** [receipting/claude-agent-sdk-container](https://github.com/receipting/claude-agent-sdk-container)
**Key Findings:**
- Uses `@anthropic-ai/claude-agent-sdk` npm package with `query()` async iterator
- OAuth token auth: entrypoint writes `~/.claude/.credentials.json` with token + far-future expiry
- Also writes `~/.claude.json` with workspace config, onboarding flags, subscription status
- Server uses Hono framework on port 8080
- SDK's `query()` returns async iterator of messages with types: `system` (init + session_id), `assistant` (content blocks)
- Session continuity via `options.resume = sessionId` from previous response's init message
- `CanUseTool` callback set to `allowAll` for auto-approving tool use
- Container runs as non-root `appuser` with tini as PID 1
- SDK installed globally: `npm install -g tsx @anthropic-ai/claude-agent-sdk`

**Expected Impact:** Full Claude AI integration using Max plan subscription, no API credits needed

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- `@anthropic-ai/claude-agent-sdk` version compatibility (pinned at ^0.1.0 in blueprint)
- OAuth token format/expiry may change with SDK updates
- Docker build may fail if npm registry is unreachable
- NDJSON parsing edge cases (partial lines, empty lines)

**Mitigation:**
- Pin exact SDK version that matches the blueprint
- Entrypoint sets 10-year expiry on OAuth credentials (matches blueprint)
- Docker build happens once, image is cached locally
- NDJSON parser handles partial lines via line buffer

---

## TRA IMPLEMENTATION PLAN

```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Create docker/claude-container/ directory and package.json + tsconfig.json",
      "dependencies": [],
      "complexity": 2
    },
    {
      "id": 2,
      "description": "Create .claude/settings.json for SDK tool permissions",
      "dependencies": [1],
      "complexity": 1
    },
    {
      "id": 3,
      "description": "Create docker-entrypoint.sh with OAuth credential writer",
      "dependencies": [1],
      "complexity": 4
    },
    {
      "id": 4,
      "description": "Create server.ts (Hono + /health + /query NDJSON streaming)",
      "dependencies": [1],
      "complexity": 7
    },
    {
      "id": 5,
      "description": "Create Dockerfile (multi-stage build)",
      "dependencies": [1, 3, 4],
      "complexity": 4
    },
    {
      "id": 6,
      "description": "Update channels.ts (add claudeOAuthToken to AppSettings)",
      "dependencies": [],
      "complexity": 1
    },
    {
      "id": 7,
      "description": "Update claude-container.service.ts (local image, NDJSON parsing, auth)",
      "dependencies": [4, 6],
      "complexity": 6
    },
    {
      "id": 8,
      "description": "Update index.ts (pass OAuth token, settings handlers)",
      "dependencies": [6, 7],
      "complexity": 3
    },
    {
      "id": 9,
      "description": "Update SettingsForm.tsx (OAuth Token + API Key fields)",
      "dependencies": [6],
      "complexity": 3
    },
    {
      "id": 10,
      "description": "Verify TypeScript compiles",
      "dependencies": [7, 8, 9],
      "complexity": 1
    }
  ],
  "sequence": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "parallelizable": [[2, 3], [6, 1]],
  "stopPoints": ["design", "final"],
  "totalComplexity": 32
}
```

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
