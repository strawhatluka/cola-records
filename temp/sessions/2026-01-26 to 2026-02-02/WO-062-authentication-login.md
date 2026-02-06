# WO-062: Authentication & Login (Complete)

**Status:** PENDING
**Complexity:** 5/10
**Priority:** HIGH
**Phase:** 4 - Integration & Polish
**Category:** Audit Section 25 - Authentication & Login
**Dependencies:** WO-042 (Settings Hierarchy)
**Estimated Time:** 6 hours
**Created:** 2026-02-01
**Author:** TRA (Work Planner)

---

## Objective

Implement a complete authentication system supporting OAuth browser flow, secure credential storage via Electron safeStorage, environment variable auth methods, the apiKeyHelper setting, and /login + /logout slash commands. This upgrades the current basic API key + OAuth token text fields into a production-grade auth system.

---

## Background

### Current State
- `claudeApiKey` and `claudeOAuthToken` fields exist in `AppSettings` interface (`src/main/ipc/channels.ts`, line 161-162)
- Settings stored as plaintext strings in SQLite via `database.setSetting()` (`src/main/index.ts`, lines 411-415)
- `SettingsForm.tsx` has text input fields for API key and OAuth token (lines 38-39)
- `useSettingsStore.ts` fetches/updates settings via `settings:get` and `settings:update` IPC channels
- No browser-based OAuth flow exists
- No secure credential storage (credentials stored in plaintext SQLite)
- No environment variable support for auth tokens
- No /login or /logout slash commands

### Target State
- OAuth browser flow for Claude.ai subscription authentication
- Secure credential storage using Electron's `safeStorage` API (Windows Credential Manager / macOS Keychain)
- `apiKeyHelper` setting that executes a shell script to retrieve an API key dynamically
- Environment variable support: `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_API_KEY`
- `/login` slash command to switch accounts or re-authenticate
- `/logout` slash command to sign out and clear credentials

---

## Acceptance Criteria

- [ ] AC-1: OAuth browser flow opens system browser, receives callback, stores token securely
- [ ] AC-2: Credentials stored via Electron safeStorage (encrypted at rest), not plaintext SQLite
- [ ] AC-3: `apiKeyHelper` setting executes a shell command and uses stdout as the API key
- [ ] AC-4: `CLAUDE_CODE_OAUTH_TOKEN` env var is checked at startup and used if present
- [ ] AC-5: `CLAUDE_CODE_API_KEY` env var is checked at startup and used if present
- [ ] AC-6: `/login` slash command triggers OAuth flow or prompts for API key
- [ ] AC-7: `/logout` slash command clears all stored credentials and resets auth state
- [ ] AC-8: Auth state is reactive - UI updates when auth status changes
- [ ] AC-9: Fallback chain: env var -> safeStorage -> apiKeyHelper -> prompt user
- [ ] AC-10: All existing API key and OAuth token functionality continues to work (backwards compatible)
- [ ] AC-11: Unit tests achieve 80%+ coverage on all new code

---

## Technical Design

### Architecture

```
Auth Resolution Chain (priority order):
1. CLAUDE_CODE_API_KEY env var
2. CLAUDE_CODE_OAUTH_TOKEN env var
3. Electron safeStorage (encrypted local storage)
4. apiKeyHelper shell command
5. Prompt user via /login

OAuth Browser Flow:
  Renderer -> IPC -> Main Process -> shell.openExternal(authURL)
  -> Local HTTP callback server (localhost:PORT) -> Token exchange
  -> Store token via safeStorage -> Notify renderer
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/auth.service.ts` | Core authentication service with credential management |
| `src/main/services/secure-storage.service.ts` | Electron safeStorage wrapper for encrypted credential storage |
| `src/main/services/oauth-flow.service.ts` | OAuth browser flow with local callback server |
| `src/renderer/components/claude/ClaudeAuthStatus.tsx` | Auth status indicator component |
| `tests/unit/services/auth.service.test.ts` | Auth service unit tests |
| `tests/unit/services/secure-storage.service.test.ts` | Secure storage unit tests |
| `tests/unit/services/oauth-flow.service.test.ts` | OAuth flow unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add `AuthState` interface, `apiKeyHelper` to AppSettings, new IPC channels |
| `src/main/index.ts` | Register auth IPC handlers, initialize auth service at startup |
| `src/renderer/stores/useSettingsStore.ts` | Add auth state fields, auth actions |
| `src/renderer/components/settings/SettingsForm.tsx` | Replace plaintext inputs with secure auth UI, add apiKeyHelper field |
| `src/renderer/components/claude/ClaudePanel.tsx` | Integrate auth status indicator |

### Interfaces

```typescript
// src/main/services/auth.service.ts
interface AuthCredentials {
  apiKey?: string;
  oauthToken?: string;
  source: 'env' | 'safeStorage' | 'apiKeyHelper' | 'manual';
}

interface AuthState {
  authenticated: boolean;
  source: AuthCredentials['source'] | null;
  accountEmail?: string;
  expiresAt?: string;
}

interface AuthService {
  /** Resolve credentials using the fallback chain */
  resolveCredentials(): Promise<AuthCredentials>;
  /** Store credentials securely */
  storeCredentials(credentials: AuthCredentials): Promise<void>;
  /** Clear all stored credentials */
  clearCredentials(): Promise<void>;
  /** Get current auth state */
  getAuthState(): Promise<AuthState>;
  /** Execute apiKeyHelper shell command */
  executeApiKeyHelper(command: string): Promise<string>;
  /** Check environment variables for auth tokens */
  checkEnvVars(): AuthCredentials | null;
}

// src/main/services/secure-storage.service.ts
interface SecureStorageService {
  /** Check if encryption is available on this platform */
  isAvailable(): boolean;
  /** Store a value securely */
  setSecure(key: string, value: string): void;
  /** Retrieve a securely stored value */
  getSecure(key: string): string | null;
  /** Delete a securely stored value */
  deleteSecure(key: string): void;
}

// src/main/services/oauth-flow.service.ts
interface OAuthFlowService {
  /** Start OAuth browser flow, returns token on completion */
  startOAuthFlow(): Promise<{ token: string; expiresAt: string }>;
  /** Cancel an in-progress OAuth flow */
  cancelOAuthFlow(): void;
}

// New IPC channels
'auth:get-state' -> AuthState
'auth:login' -> AuthState (triggers OAuth flow or API key prompt)
'auth:logout' -> void (clears all credentials)
'auth:resolve' -> AuthCredentials (resolves current credentials)
```

---

## Implementation Tasks

### Task 1: Create SecureStorageService
**File:** `src/main/services/secure-storage.service.ts`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** None

Implement a wrapper around Electron's `safeStorage` API:
- `isAvailable()`: Check `safeStorage.isEncryptionAvailable()`
- `setSecure(key, value)`: Encrypt with `safeStorage.encryptString()`, store in a local JSON file
- `getSecure(key)`: Read encrypted buffer, decrypt with `safeStorage.decryptString()`
- `deleteSecure(key)`: Remove key from storage file
- Storage file location: `app.getPath('userData')/secure-credentials.enc`

### Task 2: Create OAuthFlowService
**File:** `src/main/services/oauth-flow.service.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Task 1

Implement OAuth browser flow:
- Start local HTTP server on a random available port (use `net.createServer`)
- Generate state parameter for CSRF protection
- Open system browser with `shell.openExternal(authURL)` pointing to Claude.ai OAuth endpoint
- Listen for callback with authorization code
- Exchange code for token via HTTP POST
- Store token via SecureStorageService
- Clean up: close local server, return token
- Timeout after 5 minutes if no callback received

### Task 3: Create AuthService
**File:** `src/main/services/auth.service.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Task 1, Task 2

Implement credential resolution chain:
- `checkEnvVars()`: Read `CLAUDE_CODE_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` from `process.env`
- `executeApiKeyHelper(command)`: Spawn shell process, capture stdout, trim whitespace
- `resolveCredentials()`: Try env vars -> safeStorage -> apiKeyHelper -> return null
- `storeCredentials()`: Save to safeStorage
- `clearCredentials()`: Remove from safeStorage, reset state
- `getAuthState()`: Return current authentication status
- Emit events on auth state changes for reactive UI updates

### Task 4: Register Auth IPC Handlers
**File:** `src/main/index.ts`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 3

- Add `auth:get-state` handler -> calls `authService.getAuthState()`
- Add `auth:login` handler -> triggers `oauthFlowService.startOAuthFlow()` or API key prompt
- Add `auth:logout` handler -> calls `authService.clearCredentials()`
- Add `auth:resolve` handler -> calls `authService.resolveCredentials()`
- Initialize AuthService at app startup, resolve credentials on launch
- Migrate existing plaintext credentials to safeStorage on first run

### Task 5: Update AppSettings Interface
**File:** `src/main/ipc/channels.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** None

- Add `apiKeyHelper?: string` to `AppSettings`
- Add `AuthState` interface export
- Add new IPC channel type definitions for auth handlers

### Task 6: Create ClaudeAuthStatus Component
**File:** `src/renderer/components/claude/ClaudeAuthStatus.tsx`
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 4

- Show auth status indicator (authenticated/unauthenticated)
- Display auth source (API key, OAuth, env var)
- Login button when unauthenticated
- Logout option in dropdown menu
- Account email display when available

### Task 7: Update SettingsForm for Auth
**File:** `src/renderer/components/settings/SettingsForm.tsx`
**Complexity:** Medium
**Estimated Time:** 45 min
**Dependencies:** Task 4, Task 5

- Replace plaintext API key input with masked display + "Change" button
- Replace plaintext OAuth token input with "Connect with Claude.ai" button
- Add `apiKeyHelper` text input field for shell command configuration
- Show current auth source and status
- Add "Test Connection" button that validates credentials

### Task 8: Implement /login and /logout Slash Commands
**File:** `src/main/services/claude/claude-slash-commands.ts` (or equivalent)
**Complexity:** Low
**Estimated Time:** 30 min
**Dependencies:** Task 3, Task 4

- `/login`: Check current auth state, offer OAuth flow or API key entry
- `/logout`: Call `authService.clearCredentials()`, confirm to user
- Register both commands in the slash command registry

### Task 9: Update Settings Store
**File:** `src/renderer/stores/useSettingsStore.ts`
**Complexity:** Low
**Estimated Time:** 20 min
**Dependencies:** Task 4, Task 5

- Add `authState` field to store
- Add `fetchAuthState()` action
- Add `login()` and `logout()` actions
- Subscribe to auth state change events via IPC

### Task 10: Write Unit Tests
**Files:** `tests/unit/services/auth.service.test.ts`, `tests/unit/services/secure-storage.service.test.ts`, `tests/unit/services/oauth-flow.service.test.ts`
**Complexity:** Medium
**Estimated Time:** 60 min
**Dependencies:** Tasks 1-9

Test coverage requirements:
- SecureStorageService: encrypt/decrypt round-trip, unavailable platform fallback, delete
- AuthService: env var resolution, apiKeyHelper execution, credential chain priority, clear credentials
- OAuthFlowService: server startup, callback handling, timeout, cancellation
- IPC handlers: each handler returns expected responses
- Backwards compatibility: existing API key/OAuth token settings still work

---

## Testing Requirements

| Test Type | Count | Coverage Target |
|-----------|-------|----------------|
| Unit Tests | 25-30 | 80%+ lines and branches |
| Integration Tests | 3-5 | Auth flow end-to-end, IPC round-trip, migration |
| Mock Requirements | Electron safeStorage, child_process.exec, net.createServer |

### Key Test Scenarios
1. Credential resolution chain respects priority order
2. safeStorage encryption/decryption round-trip
3. apiKeyHelper shell execution with various outputs (success, error, timeout)
4. OAuth flow timeout handling
5. /login and /logout command execution
6. Env var override takes precedence over stored credentials
7. Migration from plaintext SQLite to safeStorage

---

## BAS Quality Gates

| Phase | Gate | Pass Criteria |
|-------|------|---------------|
| 1 | Linting | ESLint + Prettier: 0 errors |
| 2 | Structure | All imports resolve, types valid |
| 3 | Build | TypeScript compilation: 0 errors |
| 4 | Testing | All tests pass (unit + integration) |
| 5 | Coverage | 80%+ lines and branches |
| 6 | Review | DRA approval, security review for credential handling |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 25:

- [ ] OAuth login - Browser-based OAuth flow for Claude.ai subscription
- [ ] API key authentication - Set ANTHROPIC_AUTH_TOKEN or use apiKeyHelper
- [ ] /login command - Switch Anthropic accounts
- [ ] /logout command - Sign out from Anthropic account
- [ ] Command Palette: Logout - Sign out via command
- [ ] apiKeyHelper setting - Shell script that returns an API key
- [ ] macOS Keychain storage / Windows Credential Manager - Credentials stored encrypted
- [ ] CLAUDE_CODE_OAUTH_TOKEN - Environment variable for remote/CI authentication
- [ ] CLAUDE_CODE_API_KEY - Environment variable for headless authentication

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| safeStorage unavailable on some Linux distros | Medium | Medium | Fallback to encrypted file with machine-specific key |
| OAuth callback server port conflict | Low | Low | Use random port, retry on conflict |
| apiKeyHelper command injection | Medium | High | Sanitize command, run in restricted shell, validate output |
| Migration loses existing credentials | Low | High | Backup plaintext before migration, verify after |
| OAuth endpoint URL changes | Low | Medium | Make OAuth URL configurable in settings |

---

## Notes

- Electron's `safeStorage` uses the OS keychain (Windows Credential Manager, macOS Keychain, Linux libsecret). This is the recommended approach for desktop apps.
- The `apiKeyHelper` feature must sanitize shell commands to prevent injection. Consider using `execFile` instead of `exec` and validating the command path.
- Environment variables take highest priority to support CI/CD and containerized environments.
- The migration from plaintext SQLite to safeStorage should be automatic and transparent on first launch after this update.
- Third-party provider auth (Bedrock, Vertex, Foundry) is explicitly out of scope for this WO per the master plan.
