# ORCHESTRATOR WORK ORDER #MIGRATE-001
## Type: IMPLEMENTATION
## Electron Foundation & Core Services Migration

---

## MISSION OBJECTIVE

Migrate the foundational infrastructure and core backend services from Flutter/Dart to Electron/Node.js/TypeScript. This work order establishes the technical foundation for the entire application migration, including project setup, IPC architecture, database layer, file system operations, and git integration services.

**Implementation Goal:** Create a fully functional Electron application with all backend services operational, ready for UI integration.

**Based On:** TRA Strategic Plan for Flutter → Electron migration (complete application rewrite)

---

## IMPLEMENTATION SCOPE

### New Project Structure to Create
```yaml
Project_Root:
  - package.json                    # Node.js dependencies
  - tsconfig.json                   # TypeScript configuration
  - vite.config.ts                  # Vite bundler config
  - forge.config.js                 # Electron Forge packaging
  - .env.example                    # Environment template

  src/:
    main/:                          # Main process (Node.js)
      - index.ts                    # Main process entry
      - ipc/:                       # IPC handlers
        - file-system.ts
        - git.ts
        - github.ts
        - database.ts
        - terminal.ts
      - services/:                  # Backend services
        - FileSystemService.ts
        - FileWatcherService.ts
        - GitService.ts
        - ContributionGitService.ts
        - GitIgnoreService.ts
        - GitHubGraphQLClient.ts
        - GitHubRestClient.ts
        - DatabaseService.ts
        - SecureStorageService.ts
      - database/:
        - schema.sql
        - migrations.ts

    renderer/:                      # Renderer process (React)
      - index.tsx                   # Renderer entry
      - App.tsx                     # Root component
      - ipc/:                       # IPC client wrappers
        - file-system.ts
        - git.ts
        - github.ts
      - stores/:                    # Zustand state stores
        - useFileTreeStore.ts
        - useGitStore.ts
        - useIssuesStore.ts
        - useContributionsStore.ts
        - useCodeEditorStore.ts
        - useTerminalStore.ts
        - useSettingsStore.ts
```

### Technologies to Install
```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "better-sqlite3": "^9.0.0",
    "electron-store": "^8.1.0",
    "simple-git": "^3.22.0",
    "@octokit/graphql": "^7.0.0",
    "@octokit/rest": "^20.0.0",
    "chokidar": "^3.6.0",
    "ignore": "^5.3.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-squirrel": "^7.0.0",
    "@electron-forge/maker-dmg": "^7.0.0",
    "@electron-forge/plugin-vite": "^7.0.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/better-sqlite3": "^7.6.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "prettier": "^3.0.0"
  }
}
```

---

## IMPLEMENTATION APPROACH

### Phase 1: Project Setup & Foundation (9 hours estimated)

#### Step 1.1: Initialize Electron Project
- [ ] Create new directory: `cola-records-electron/`
- [ ] Run: `npm init electron-app@latest . -- --template=vite-typescript`
- [ ] Install additional dependencies from package.json above
- [ ] Configure TypeScript with strict mode
- [ ] Setup ESLint + Prettier with TypeScript rules
- [ ] Configure Vite for main + renderer bundling
- [ ] Test: `npm start` launches blank Electron window

#### Step 1.2: IPC Architecture Setup
- [ ] Create `src/main/ipc/` directory structure
- [ ] Implement typed IPC channel system:
  ```typescript
  // src/main/ipc/types.ts
  export interface IpcChannels {
    'fs:scanDirectory': { params: [string], return: FileNode };
    'git:status': { params: [string], return: GitStatus };
    'github:searchIssues': { params: [SearchParams], return: Issue[] };
    // ... all channels
  }
  ```
- [ ] Create IPC handler wrapper with type safety
- [ ] Create renderer IPC client wrappers (async/await style)
- [ ] Test: IPC echo channel (send → receive → verify)

#### Step 1.3: Environment & Security Setup
- [ ] Create `.env.example` with GitHub token placeholder
- [ ] Implement SecureStorageService using `safeStorage` API:
  ```typescript
  class SecureStorageService {
    async saveToken(token: string): Promise<void>;
    async getToken(): Promise<string | null>;
    async deleteToken(): Promise<void>;
  }
  ```
- [ ] Add token validation with GitHub API
- [ ] Test: Save encrypted token → restart app → retrieve token

#### Step 1.4: Database Setup (SQLite + IndexedDB)
- [ ] Install better-sqlite3 for main process
- [ ] Create database schema for contributions:
  ```sql
  CREATE TABLE contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_name TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    fork_url TEXT,
    local_path TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    issue_number INTEGER,
    issue_title TEXT,
    current_branch TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  ```
- [ ] Implement DatabaseService with CRUD operations
- [ ] Create IndexedDB wrapper for API cache in renderer:
  ```typescript
  class CacheRepository {
    async get(key: string): Promise<any | null>;
    async set(key: string, value: any, ttl: number): Promise<void>;
    async delete(key: string): Promise<void>;
    async cleanup(): Promise<void>; // Remove expired entries
  }
  ```
- [ ] Test: Insert contribution → query → verify data integrity

#### Step 1.5: Zustand Store Architecture
- [ ] Create base store types in `src/renderer/stores/types.ts`
- [ ] Implement initial stores (no functionality yet, just structure):
  - useFileTreeStore (state: root, selectedPath, gitStatus)
  - useGitStore (state: status, branches, currentBranch)
  - useIssuesStore (state: issues, loading, filters)
  - useContributionsStore (state: contributions, loading)
  - useCodeEditorStore (state: openFiles, activeFile)
  - useTerminalStore (state: sessions, activeSession)
  - useSettingsStore (state: contributionsDir, theme, token)
- [ ] Test: Import stores → access initial state → verify reactivity

---

### Phase 2: Core Services Migration (6.5 hours estimated)

#### Step 2.1: File System Service
- [ ] Migrate FileTreeService to TypeScript:
  ```typescript
  class FileSystemService {
    async scanDirectory(path: string, showHidden: boolean): Promise<FileNode>;
    async readFile(path: string): Promise<string>;
    async writeFile(path: string, content: string): Promise<void>;
    async deleteFile(path: string): Promise<void>;
  }
  ```
- [ ] Implement recursive directory scanning with depth limit (10)
- [ ] Add file metadata extraction (size, modified date)
- [ ] Implement exclude patterns (.git, node_modules, etc.)
- [ ] Create IPC handler: `fs:scanDirectory`
- [ ] Test: Scan cola-records-flutter → verify file count matches

#### Step 2.2: File Watcher Service
- [ ] Implement FileWatcherService using chokidar:
  ```typescript
  class FileWatcherService {
    watch(path: string, excludePatterns: string[]): EventEmitter;
    unwatch(path: string): void;
    dispose(): void;
  }
  ```
- [ ] Add debouncing (500ms) for file change events
- [ ] Implement event deduplication (same path within debounce window)
- [ ] Stream events to renderer via IPC
- [ ] Test: Create file → verify event → delete file → verify event

#### Step 2.3: Git Service (Primary - Development IDE)
- [ ] Implement GitService using simple-git:
  ```typescript
  class GitService {
    async status(repoPath: string): Promise<GitStatus>;
    async diff(repoPath: string, filePath?: string): Promise<string>;
    async commit(repoPath: string, message: string, files: string[]): Promise<void>;
    async push(repoPath: string, remote: string, branch: string): Promise<void>;
    async pull(repoPath: string, remote: string, branch: string): Promise<void>;
    async listBranches(repoPath: string): Promise<string[]>;
    async switchBranch(repoPath: string, branch: string): Promise<void>;
    async createBranch(repoPath: string, branch: string): Promise<void>;
    async stageFiles(repoPath: string, files: string[]): Promise<void>;
    async unstageFiles(repoPath: string, files: string[]): Promise<void>;
  }
  ```
- [ ] Implement git status parsing (modified, added, deleted, etc.)
- [ ] Add error handling for merge conflicts
- [ ] Create IPC handlers for all git operations
- [ ] Test: Run git status on cola-records-flutter → verify output

#### Step 2.4: Git Service (Contribution Workflow)
- [ ] Implement ContributionGitService:
  ```typescript
  class ContributionGitService {
    async clone(url: string, localPath: string): Promise<void>;
    async addRemote(repoPath: string, name: string, url: string): Promise<void>;
    async setRemoteUrl(repoPath: string, name: string, url: string): Promise<void>;
    validateGitHubUrl(url: string): boolean;
    validateLocalPath(path: string): boolean;
  }
  ```
- [ ] Add security validation:
  - URL must be GitHub HTTPS or SSH
  - Path must not contain `..` (traversal prevention)
  - Path must be absolute
- [ ] Test: Clone a test repo → verify remotes configured correctly

#### Step 2.5: GitIgnore Service
- [ ] Implement GitIgnoreService using `ignore` package:
  ```typescript
  class GitIgnoreService {
    async isIgnored(filePath: string, repoPath: string): Promise<boolean>;
    clearCache(repoPath?: string): void;
  }
  ```
- [ ] Load .gitignore patterns from repository root
- [ ] Cache patterns per repository (Map<repoPath, Ignore>)
- [ ] Support pattern negation (!)
- [ ] Test: Check files against .gitignore → verify accuracy

---

### Phase 3: GitHub API Integration (5.5 hours estimated)

#### Step 3.1: GitHub GraphQL Client
- [ ] Implement GitHubGraphQLClient using @octokit/graphql:
  ```typescript
  class GitHubGraphQLClient {
    async searchIssues(params: SearchParams): Promise<Issue[]>;
    async getRepositoryTree(owner: string, repo: string, branch: string): Promise<TreeEntry[]>;
    async checkPullRequestStatus(owner: string, repo: string, head: string): Promise<PRStatus | null>;
  }
  ```
- [ ] Add retry logic (max 3 retries, exponential backoff)
- [ ] Implement rate limit handling
- [ ] Add GraphQL error parsing
- [ ] Create type definitions for all query responses
- [ ] Test: Search for "good first issue" → verify results

#### Step 3.2: GitHub REST Client
- [ ] Implement GitHubRestClient using @octokit/rest:
  ```typescript
  class GitHubRestClient {
    async forkRepository(owner: string, repo: string): Promise<Fork>;
    async getFileContents(owner: string, repo: string, path: string): Promise<string>;
    async getRepositoryInfo(owner: string, repo: string): Promise<RepoInfo>;
    async checkRateLimit(): Promise<RateLimit>;
  }
  ```
- [ ] Add API version header (application/vnd.github.v3+json)
- [ ] Implement token authentication
- [ ] Create IPC handlers for all API operations
- [ ] Test: Fork a repository → verify fork created

#### Step 3.3: API Cache Layer
- [ ] Implement CacheRepository with 24-hour TTL:
  ```typescript
  interface CacheEntry {
    key: string;
    value: any;
    expiresAt: number;
  }

  class CacheRepository {
    async get<T>(key: string): Promise<T | null>;
    async set<T>(key: string, value: T, ttl?: number): Promise<void>;
    async cleanup(): Promise<number>; // Returns count of removed entries
  }
  ```
- [ ] Use IndexedDB for storage
- [ ] Implement auto-cleanup on app initialization
- [ ] Add cache key hashing for consistency
- [ ] Test: Cache API response → retrieve → verify value → wait for expiry → verify null

---

### Phase 4: Testing & Validation (4 hours estimated)

#### Step 4.1: Unit Tests for Services
- [ ] Setup Jest for Node.js testing
- [ ] Write tests for FileSystemService (scan, read, write)
- [ ] Write tests for GitService (status, commit, push)
- [ ] Write tests for GitIgnoreService (pattern matching)
- [ ] Write tests for GitHubGraphQLClient (search, queries)
- [ ] Write tests for DatabaseService (CRUD operations)
- [ ] Target: ≥85% code coverage

#### Step 4.2: Integration Testing
- [ ] Test IPC roundtrip latency (target: <50ms)
- [ ] Test file watcher → IPC event stream
- [ ] Test git operations on real repository
- [ ] Test GitHub API with real token (rate limit safe)
- [ ] Test database persistence across app restarts

#### Step 4.3: Performance Benchmarking
- [ ] Benchmark file tree scanning (target: ≤3.5 seconds for cola-records)
- [ ] Benchmark git status (target: ≤500ms)
- [ ] Benchmark IPC message batching
- [ ] Document baseline metrics for future optimization

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `ELECTRON-FOUNDATION-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - What was migrated (Foundation + Core Services)
   - Technologies used (Electron 28, React 18, TypeScript 5, etc.)
   - Total files created
   - Test coverage percentage

2. **Architecture Overview**
   - IPC architecture diagram (channels + handlers)
   - Service layer diagram (main process services)
   - Database schema
   - State management structure (Zustand stores)

3. **Migration Mapping**
   - Flutter → Electron equivalents table:
     ```
     | Flutter Component           | Electron Equivalent          |
     |-----------------------------|------------------------------|
     | flutter_secure_storage      | safeStorage API              |
     | sqflite_common_ffi          | better-sqlite3 + IndexedDB   |
     | shared_preferences          | electron-store               |
     | process_run (git)           | simple-git                   |
     | dart-lang/git               | simple-git                   |
     | Directory.list()            | fs.readdir() recursive       |
     ```

4. **Test Results**
   - Unit test coverage report
   - Integration test results
   - Performance benchmarks vs Flutter baseline

5. **Known Limitations**
   - Any missing features to implement in Phase 2/3
   - Platform-specific issues found
   - Performance differences from Flutter

6. **Next Steps**
   - Ready for WO-MIGRATE-002 (UI & Screens)
   - Dependencies for UI implementation
   - Integration points for frontend

### Evidence to Provide
- Package.json showing all dependencies installed
- Test coverage summary (≥85%)
- Performance benchmark results
- Screenshot of Electron app launching
- IPC latency test results (<50ms)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `ELECTRON-FOUNDATION-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-001-electron-foundation-core-services.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-001-electron-foundation-core-services.md`
   - [ ] Completion report exists in: `trinity/reports/ELECTRON-FOUNDATION-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Ready for Next Phase:**
   - [ ] Inform user that WO-MIGRATE-001 is complete
   - [ ] WO-MIGRATE-002 can now begin (UI & Screens migration)

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Electron app launches successfully (blank window OK)
- [ ] All 7 Zustand stores created with initial state
- [ ] IPC architecture functional (test channel working)
- [ ] Database schema created and migrations run
- [ ] All 5 core services implemented (FileSystem, FileWatcher, Git, ContributionGit, GitIgnore)
- [ ] GitHub API clients functional (GraphQL + REST)
- [ ] Cache layer operational (IndexedDB with TTL)
- [ ] Unit tests ≥85% coverage
- [ ] Performance benchmarks meet targets:
  - File tree scan: ≤3.5 seconds
  - Git status: ≤500ms
  - IPC latency: <50ms
- [ ] Secure storage working (token encrypt/decrypt)
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] ESLint passes with no errors
- [ ] All BAS quality gates passed

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations on the source Flutter project. The Electron project is a NEW, SEPARATE codebase.

**Git Operations Only Allowed On:**
- ✅ The NEW `cola-records-electron/` project
- ❌ The existing `cola-records/` Flutter project (LUKA only)

**Workflow:**
1. Create new directory: `cola-records-electron/`
2. Initialize Electron project in new directory
3. All development happens in `cola-records-electron/`
4. LUKA will manage git for both projects separately

### Do NOT:
- [ ] Modify any files in the Flutter project (`cola-records/`)
- [ ] Delete the Flutter project
- [ ] Create npm dependencies that conflict with Flutter deps
- [ ] Skip security validation for git operations
- [ ] Hard-code GitHub tokens or secrets
- [ ] Expose IPC channels without validation

### DO:
- [ ] Create all new code in `cola-records-electron/`
- [ ] Follow TypeScript strict mode guidelines
- [ ] Validate all user input (paths, URLs, git commands)
- [ ] Use async/await consistently (no raw promises)
- [ ] Add JSDoc comments for all public methods
- [ ] Implement proper error handling (try/catch)
- [ ] Log important operations for debugging
- [ ] Test on Windows (primary platform)

---

## ROLLBACK STRATEGY

If issues arise during migration:

1. **Electron App Won't Launch**
   - Check: `npm run start` error logs
   - Verify: All dependencies installed (`npm install`)
   - Validate: Vite config syntax
   - Rollback: Delete `node_modules/`, reinstall

2. **IPC Channels Not Working**
   - Check: Main process registered handlers
   - Check: Renderer process using correct channel names
   - Test: Simple echo channel first
   - Rollback: Revert to basic IPC example from template

3. **Database Errors**
   - Check: SQLite file permissions
   - Check: Schema applied correctly
   - Test: Simple insert/select query
   - Rollback: Delete database file, re-run migrations

4. **GitHub API Rate Limit**
   - Check: Token has correct scopes
   - Check: Current rate limit status
   - Wait: Rate limit resets hourly
   - Fallback: Use unauthenticated requests (60/hour)

**Critical Files Backup:** None (new project, no data loss risk)

---

## CONTEXT FROM PLANNING

**Source Plan:** TRA Strategic Plan for Complete Flutter → Electron Migration
**Key Findings:**
- Flutter has limitations for desired IDE functionality
- Electron provides richer desktop APIs
- VSCode-style loading patterns must be preserved
- Performance targets: ≤3.5s file tree, ≤500ms git status

**Root Reasons for Migration:**
- Need better native file system integration
- Require full git CLI access
- Want Monaco Editor (VSCode's editor)
- Need xterm.js + node-pty for proper terminal

**Expected Impact:**
- Modern web tech stack (React, TypeScript)
- Better cross-platform compatibility
- Easier UI development with shadcn/ui
- Stronger ecosystem (npm packages)

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The 25-hour estimate is for planning purposes only, NOT a deadline.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE (Phases 1-4)
**Completeness Required:** 100% - All services must be fully functional
**Risk Level:** HIGH
**Risk Factors:**
- New technology stack (team may be unfamiliar with Electron)
- IPC architecture is critical foundation (all future work depends on it)
- Security validation required (git URL whitelisting, path sanitization)
- Performance must match or exceed Flutter baseline

**Mitigation:**
- Start with Electron Forge template (proven foundation)
- Test IPC channels individually before integration
- Implement security validators before git operations
- Benchmark early and often (compare to Flutter metrics)
- Follow VSCode's approach for file/git operations

---

**Remember:** This is the foundation for the entire migration. Take time to get it right. All UI work (WO-MIGRATE-002 and WO-MIGRATE-003) depends on these services working correctly.
