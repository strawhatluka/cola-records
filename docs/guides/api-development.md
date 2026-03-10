# API Development Guide

## Overview

Cola Records uses Electron's IPC (Inter-Process Communication) for secure communication between the renderer (React UI) and main (Node.js backend) processes. This guide documents all 266 invoke channels and 11 event channels and their usage.

## IPC Architecture

### Process Separation

```
Renderer Process (React)          Main Process (Node.js)
    |                                     |
    | --- IPC invoke/handle -----------> |
    |                                     |
    | <-- Response ----------------------|
```

- **Renderer Process**: React UI, Zustand stores, user interactions
- **Preload Script**: Secure bridge exposing IPC methods via `window.electronAPI`
- **IPC Client**: Type-safe `IpcClient` class in `src/renderer/ipc/client.ts` wrapping `window.electronAPI`
- **Main Process**: Services, database, file system, external APIs

### Channel Naming Convention

Channels follow the `domain:action` pattern for consistency and organization:

```typescript
// Examples:
'git:commit'; // Git domain, commit action
'github:search-issues'; // GitHub domain, search-issues action
'contribution:create'; // Contribution domain, create action
'fs:read-file'; // File system domain, read-file action
```

## Making IPC Calls (Renderer Side)

### Basic Usage

```typescript
import { ipc } from '../ipc/client';

// Using the typed IPC client singleton
const result = await ipc.invoke('github:get-issue', 'facebook', 'react', 123);
```

### With Error Handling

```typescript
import { ipc } from '../ipc/client';

try {
  const issues = await ipc.invoke('github:search-issues', 'is:open label:good-first-issue', [
    'good-first-issue',
  ]);
  console.log('Found issues:', issues);
} catch (error) {
  console.error('Failed to search issues:', error.message);
}
```

### In Zustand Stores

```typescript
import { ipc } from '../ipc/client';

// Example from useContributionsStore.ts
const useContributionsStore = create((set) => ({
  contributions: [],

  fetchContributions: async () => {
    const contributions = await ipc.invoke('contribution:get-all');
    set({ contributions });
  },

  createContribution: async (data) => {
    const contribution = await ipc.invoke('contribution:create', data);
    set((state) => ({
      contributions: [...state.contributions, contribution],
    }));
  },
}));
```

## Handling IPC (Main Side)

### Basic Handler

```typescript
import { ipcMain } from 'electron';

ipcMain.handle('github:get-issue', async (event, { owner, repo, issueNumber }) => {
  return await githubService.getIssue(owner, repo, issueNumber);
});
```

### With Validation

```typescript
ipcMain.handle('contribution:create', async (event, data) => {
  // Validate required fields
  if (!data.repositoryUrl || !data.issueNumber) {
    throw new Error('Missing required fields: repositoryUrl, issueNumber');
  }

  return await contributionService.create(data);
});
```

---

## Channel Reference

### File System Channels (fs:) - 8 channels

| Channel                 | Description                  | Parameters                             |
| ----------------------- | ---------------------------- | -------------------------------------- |
| `fs:read-directory`     | List directory contents      | `{ path: string }`                     |
| `fs:read-file`          | Read file contents           | `{ path: string }`                     |
| `fs:write-file`         | Write file contents          | `{ path: string, content: string }`    |
| `fs:delete-file`        | Delete a file                | `{ path: string }`                     |
| `fs:delete-directory`   | Delete directory recursively | `{ path: string }`                     |
| `fs:rename-file`        | Rename/move a file           | `{ oldPath: string, newPath: string }` |
| `fs:reveal-in-explorer` | Open path in file explorer   | `{ path: string }`                     |
| `fs:directory-exists`   | Check if directory exists    | `{ path: string }`                     |

### Git Channels (git:) - 21 channels

| Channel                   | Description             | Parameters                                                |
| ------------------------- | ----------------------- | --------------------------------------------------------- |
| `git:status`              | Get repository status   | `{ repoPath: string }`                                    |
| `git:log`                 | Get commit history      | `{ repoPath: string, count?: number }`                    |
| `git:add`                 | Stage files             | `{ repoPath: string, files: string[] }`                   |
| `git:commit`              | Create commit           | `{ repoPath: string, message: string }`                   |
| `git:get-branches`        | List local branches     | `{ repoPath: string }`                                    |
| `git:get-remote-branches` | List remote branches    | `{ repoPath: string }`                                    |
| `git:push`                | Push to remote          | `{ repoPath: string, remote?: string, branch?: string }`  |
| `git:pull`                | Pull from remote        | `{ repoPath: string, remote?: string, branch?: string }`  |
| `git:clone`               | Clone repository        | `{ url: string, targetPath: string }`                     |
| `git:checkout`            | Checkout branch         | `{ repoPath: string, branch: string }`                    |
| `git:create-branch`       | Create new branch       | `{ repoPath: string, branchName: string }`                |
| `git:get-current-branch`  | Get current branch name | `{ repoPath: string }`                                    |
| `git:compare-branches`    | Compare two branches    | `{ repoPath: string, base: string, head: string }`        |
| `git:delete-branch`       | Delete local branch     | `{ repoPath: string, branch: string }`                    |
| `git:get-branch-info`     | Get branch details      | `{ repoPath: string, branch: string }`                    |
| `git:add-remote`          | Add remote              | `{ repoPath: string, name: string, url: string }`         |
| `git:get-remotes`         | List remotes            | `{ repoPath: string }`                                    |
| `git:diff`                | Get unstaged diff       | `{ repoPath: string }`                                    |
| `git:diff-staged`         | Get staged diff         | `{ repoPath: string }`                                    |
| `git:tag`                 | Create git tag          | `{ repoPath: string, tagName: string, message?: string }` |
| `git:push-tags`           | Push tags to remote     | `{ repoPath: string, remote?: string }`                   |

### GitHub Channels (github:) - 54 channels

#### Repository Operations

| Channel                         | Description                    |
| ------------------------------- | ------------------------------ |
| `github:get-authenticated-user` | Get current authenticated user |
| `github:validate-token`         | Validate GitHub token          |
| `github:get-repository`         | Get repository details         |
| `github:get-repository-tree`    | Get file tree of repository    |
| `github:fork-repository`        | Fork a repository              |

#### Issue Operations

| Channel                         | Description                      |
| ------------------------------- | -------------------------------- |
| `github:search-issues`          | Search issues across GitHub      |
| `github:list-issues`            | List repository issues           |
| `github:get-issue`              | Get single issue details         |
| `github:create-issue`           | Create new issue                 |
| `github:update-issue`           | Update issue state               |
| `github:add-assignees`          | Add assignees to issue           |
| `github:list-issue-comments`    | List issue comments              |
| `github:create-issue-comment`   | Add comment to issue             |
| `github:list-issue-reactions`   | List reactions on issue          |
| `github:add-issue-reaction`     | Add reaction to issue            |
| `github:delete-issue-reaction`  | Remove reaction from issue       |
| `github:list-sub-issues`        | List sub-issues                  |
| `github:create-sub-issue`       | Create sub-issue                 |
| `github:add-existing-sub-issue` | Link existing issue as sub-issue |
| `github:get-parent-issue`       | Get parent issue for a sub-issue |

#### Pull Request Operations

| Channel                      | Description         |
| ---------------------------- | ------------------- |
| `github:list-pull-requests`  | List repository PRs |
| `github:get-pull-request`    | Get PR details      |
| `github:create-pull-request` | Create new PR       |
| `github:merge-pull-request`  | Merge PR            |
| `github:close-pull-request`  | Close PR            |
| `github:list-pr-commits`     | List PR commits     |
| `github:list-pr-events`      | List PR events      |
| `github:get-pr-check-status` | Get PR check status |

#### PR Comments & Reviews

| Channel                                 | Description                      |
| --------------------------------------- | -------------------------------- |
| `github:list-pr-comments`               | List PR comments                 |
| `github:list-pr-reviews`                | List PR reviews                  |
| `github:list-pr-review-comments`        | List review comments             |
| `github:create-pr-comment`              | Add PR comment                   |
| `github:create-review-comment-reply`    | Reply to review comment          |
| `github:list-review-comment-reactions`  | List reactions on review comment |
| `github:add-review-comment-reaction`    | Add reaction to review comment   |
| `github:delete-review-comment-reaction` | Remove reaction                  |
| `github:get-pr-review-threads`          | Get review threads               |
| `github:resolve-review-thread`          | Resolve thread                   |
| `github:unresolve-review-thread`        | Unresolve thread                 |

#### Comment Reactions

| Channel                          | Description             |
| -------------------------------- | ----------------------- |
| `github:list-comment-reactions`  | List comment reactions  |
| `github:add-comment-reaction`    | Add reaction to comment |
| `github:delete-comment-reaction` | Remove comment reaction |

#### GitHub Actions

| Channel                         | Description                   | Parameters                                     | Returns                                                                                                                                         |
| ------------------------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `github:list-workflow-runs`     | List workflow runs for a repo | `(owner: string, repo: string)`                | `{ id, name, displayTitle, status, conclusion, headBranch, headSha, event, runNumber, createdAt, updatedAt, htmlUrl, actor, actorAvatarUrl }[]` |
| `github:list-workflow-run-jobs` | List jobs for a specific run  | `(owner: string, repo: string, runId: number)` | `{ id, name, status, conclusion, startedAt, completedAt, htmlUrl, runnerName, labels, steps[] }[]`                                              |
| `github:get-job-logs`           | Get raw log output for a job  | `(owner: string, repo: string, jobId: number)` | `string`                                                                                                                                        |

#### Releases

| Channel                  | Description                | Parameters                                                                                | Returns                                                                                                                               |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `github:list-releases`   | List repository releases   | `(owner: string, repo: string)`                                                           | `{ id, tagName, name, body, draft, prerelease, createdAt, publishedAt, htmlUrl, author, authorAvatarUrl, isLatest }[]`                |
| `github:get-release`     | Get single release details | `(owner: string, repo: string, releaseId: number)`                                        | `{ id, tagName, name, body, draft, prerelease, createdAt, publishedAt, htmlUrl, author, authorAvatarUrl, targetCommitish, isLatest }` |
| `github:create-release`  | Create a new release       | `(owner, repo, { tagName, name, body, draft, prerelease, makeLatest, targetCommitish? })` | `{ id, tagName, name, body, draft, prerelease, htmlUrl }`                                                                             |
| `github:update-release`  | Update release metadata    | `(owner, repo, releaseId, { tagName?, name?, body?, draft?, prerelease?, makeLatest? })`  | `{ id, tagName, name, body, draft, prerelease, htmlUrl }`                                                                             |
| `github:delete-release`  | Delete a release           | `(owner: string, repo: string, releaseId: number)`                                        | `void`                                                                                                                                |
| `github:publish-release` | Publish a draft release    | `(owner: string, repo: string, releaseId: number)`                                        | `{ id, tagName, name, htmlUrl }`                                                                                                      |

#### Search & User Activity

| Channel                        | Description                          | Parameters                             | Returns                                                                                                                                       |
| ------------------------------ | ------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `github:search-issues-and-prs` | Combined issue and PR search         | `(query: string, perPage?: number)`    | `{ totalCount, items: { id, number, title, state, htmlUrl, createdAt, updatedAt, closedAt, labels, repoFullName, isPullRequest, author }[] }` |
| `github:list-user-events`      | List authenticated user activity     | `(username: string, perPage?: number)` | `{ id, type, repoName, createdAt, action, refType, ref, commitCount, prNumber, prTitle, issueNumber, issueTitle }[]`                          |
| `github:list-user-repos`       | List authenticated user repositories | `()`                                   | `{ id, name, fullName, description, url, cloneUrl, language, stars, forks, private }[]`                                                       |

### Contribution Channels (contribution:) - 7 channels

| Channel                         | Description                      | Parameters                            |
| ------------------------------- | -------------------------------- | ------------------------------------- |
| `contribution:create`           | Create contribution record       | `{ repositoryUrl, issueNumber, ... }` |
| `contribution:get-all`          | Get all contributions            | none                                  |
| `contribution:get-by-id`        | Get single contribution          | `{ id: string }`                      |
| `contribution:update`           | Update contribution              | `{ id: string, ...updates }`          |
| `contribution:delete`           | Delete contribution              | `{ id: string }`                      |
| `contribution:scan-directory`   | Scan directory for contributions | `{ path: string }`                    |
| `contribution:sync-with-github` | Sync contribution with GitHub    | `{ id: string }`                      |

### Project Channels (project:) - 9 channels

| Channel                            | Description                                                                      | Parameters                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `project:scan-directory`           | Scan directory for project structure and metadata (package.json, git info, etc.) | `{ path: string }`                                                |
| `project:check-cli-tools`          | Detect installed CLI tools for an ecosystem                                      | `(ecosystem: string, isMonorepo: boolean, monorepoTool?: string)` |
| `project:validate-package-manager` | Validate that a package manager is installed                                     | `(ecosystem: string, packageManager: string)`                     |
| `project:install-tool`             | Install a CLI tool globally                                                      | `(toolName: string)`                                              |
| `project:scaffold`                 | Scaffold a new project using CLI tools and templates                             | `(config: ScaffoldConfig)`                                        |
| `project:scaffold-database`        | Scaffold database layer (ORM config, Docker Compose, env vars)                   | `(config: DatabaseScaffoldConfig)`                                |
| `project:get-orm-options`          | Get available ORM options for an ecosystem and database engine                   | `(ecosystem: string, engine: string)`                             |
| `project:create-github-repo`       | Create a new GitHub repository                                                   | `(name: string, options: CreateRepoOptions)`                      |
| `project:initialize-git`           | Initialize git repo with main/dev branches and optional remote                   | `(projectPath: string, remoteName?: string, remoteUrl?: string)`  |

### Settings Channels (settings:) - 4 channels

| Channel                     | Description                    | Parameters                    |
| --------------------------- | ------------------------------ | ----------------------------- |
| `settings:get`              | Get setting value              | `{ key: string }`             |
| `settings:update`           | Update setting                 | `{ key: string, value: any }` |
| `settings:get-ssh-remotes`  | Get SSH remote configurations  | none                          |
| `settings:save-ssh-remotes` | Save SSH remote configurations | `{ remotes: object[] }`       |

### GitIgnore Channels (gitignore:) - 2 channels

| Channel                  | Description                                                                    | Parameters                               |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------- |
| `gitignore:is-ignored`   | Check if a specific path is ignored by .gitignore rules                        | `{ repoPath: string, filePath: string }` |
| `gitignore:get-patterns` | Get all gitignore patterns for a repository (includes nested .gitignore files) | `{ repoPath: string }`                   |

### Dialog Channels (dialog:) - 1 channel

| Channel                 | Description                                                 | Parameters           |
| ----------------------- | ----------------------------------------------------------- | -------------------- |
| `dialog:open-directory` | Open native OS directory picker dialog for folder selection | `{ title?: string }` |

### Shell Channels (shell:) - 3 channels

| Channel               | Description                                                           | Parameters                             |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `shell:execute`       | Execute shell command in system shell with optional working directory | `{ command: string, cwd?: string }`    |
| `shell:open-external` | Open URL in user's default browser                                    | `{ url: string }`                      |
| `shell:launch-app`    | Launch external application with optional command-line arguments      | `{ appPath: string, args?: string[] }` |

### Spotify Channels (spotify:) - 18 channels

| Channel                      | Description                     |
| ---------------------------- | ------------------------------- |
| `spotify:is-connected`       | Check Spotify connection status |
| `spotify:start-auth`         | Start OAuth flow                |
| `spotify:disconnect`         | Disconnect Spotify              |
| `spotify:get-playback-state` | Get current playback state      |
| `spotify:play`               | Resume playback                 |
| `spotify:pause`              | Pause playback                  |
| `spotify:next`               | Skip to next track              |
| `spotify:previous`           | Go to previous track            |
| `spotify:set-shuffle`        | Set shuffle mode                |
| `spotify:set-volume`         | Set volume level                |
| `spotify:seek`               | Seek to position                |
| `spotify:get-playlists`      | Get user playlists              |
| `spotify:play-playlist`      | Play specific playlist          |
| `spotify:search`             | Search tracks/albums/artists    |
| `spotify:add-to-queue`       | Add track to queue              |
| `spotify:save-track`         | Save track to library           |
| `spotify:remove-track`       | Remove track from library       |
| `spotify:is-track-saved`     | Check if track is saved         |

### Discord Channels (discord:) - 29 channels

| Channel                                 | Description              |
| --------------------------------------- | ------------------------ |
| `discord:is-connected`                  | Check Discord connection |
| `discord:connect`                       | Connect to Discord       |
| `discord:disconnect`                    | Disconnect from Discord  |
| `discord:get-user`                      | Get current user         |
| `discord:get-guilds`                    | Get user's servers       |
| `discord:get-guild-channels`            | Get server channels      |
| `discord:get-guild-emojis`              | Get server emojis        |
| `discord:get-dm-channels`               | Get DM channels          |
| `discord:get-messages`                  | Get channel messages     |
| `discord:send-message`                  | Send message             |
| `discord:edit-message`                  | Edit message             |
| `discord:delete-message`                | Delete message           |
| `discord:add-reaction`                  | Add reaction             |
| `discord:remove-reaction`               | Remove reaction          |
| `discord:get-channel`                   | Get channel info         |
| `discord:typing`                        | Send typing indicator    |
| `discord:get-pinned-messages`           | Get pinned messages      |
| `discord:create-dm`                     | Create DM channel        |
| `discord:send-message-with-attachments` | Send with attachments    |
| `discord:search-gifs`                   | Search GIFs              |
| `discord:trending-gifs`                 | Get trending GIFs        |
| `discord:get-sticker-packs`             | Get sticker packs        |
| `discord:get-guild-stickers`            | Get server stickers      |
| `discord:send-sticker`                  | Send sticker             |
| `discord:create-poll`                   | Create poll              |
| `discord:get-forum-threads`             | Get forum threads        |
| `discord:get-thread-messages`           | Get thread messages      |
| `discord:send-thread-message`           | Send to thread           |
| `discord:create-forum-thread`           | Create forum thread      |

### Code Server Channels (code-server:) - 7 channels

| Channel                            | Description                         |
| ---------------------------------- | ----------------------------------- |
| `code-server:start`                | Start code-server instance          |
| `code-server:stop`                 | Stop code-server                    |
| `code-server:status`               | Get code-server status              |
| `code-server:add-workspace`        | Add workspace folder                |
| `code-server:remove-workspace`     | Remove workspace folder             |
| `code-server:get-mounted-projects` | Get mounted projects                |
| `code-server:get-stats`            | Get Docker container resource stats |

### Documentation Channels (docs:) - 1 channel

| Channel              | Description                      |
| -------------------- | -------------------------------- |
| `docs:get-structure` | Get documentation file structure |

### Terminal Channels (terminal:) - 5 channels

| Channel               | Description                | Parameters                                   |
| --------------------- | -------------------------- | -------------------------------------------- |
| `terminal:spawn`      | Spawn new terminal         | `{ cwd?: string, shell?: string }`           |
| `terminal:write`      | Write to terminal          | `{ id: string, data: string }`               |
| `terminal:resize`     | Resize terminal            | `{ id: string, cols: number, rows: number }` |
| `terminal:kill`       | Kill terminal              | `{ id: string }`                             |
| `terminal:get-buffer` | Get terminal output buffer | `{ id: string }`                             |

### Dev Scripts Channels (dev-scripts:) - 3 channels

| Channel               | Description                 | Parameters                            |
| --------------------- | --------------------------- | ------------------------------------- |
| `dev-scripts:get-all` | Get all scripts for project | `{ projectPath: string }`             |
| `dev-scripts:save`    | Save dev script             | `{ projectPath, name, command, ... }` |
| `dev-scripts:delete`  | Delete dev script           | `{ id: string }`                      |

### Updater Channels (updater:) - 5 channels

| Channel               | Description                                                     | Parameters |
| --------------------- | --------------------------------------------------------------- | ---------- |
| `updater:check`       | Check for available updates from update server                  | none       |
| `updater:download`    | Download available update package                               | none       |
| `updater:install`     | Install downloaded update (restarts app to apply)               | none       |
| `updater:get-status`  | Get current update status (checking, downloading, ready, error) | none       |
| `updater:get-version` | Get current installed app version                               | none       |

### Dev Tools Channels (dev-tools:) - 61 channels

The largest IPC domain, covering all development tool configuration management. Handlers are registered in `dev-tools.handlers.ts` and delegate to specialized services.

#### Project Detection and Setup (9 channels)

| Channel                           | Description                                              | Parameters                   |
| --------------------------------- | -------------------------------------------------------- | ---------------------------- |
| `dev-tools:detect-project`        | Detect ecosystem, package manager, scripts, and tooling  | `(workingDirectory: string)` |
| `dev-tools:project-info`          | Get full project detection info (alias for detect)       | `(workingDirectory: string)` |
| `dev-tools:get-install-command`   | Get the install command for the detected package manager | `(workingDirectory: string)` |
| `dev-tools:get-typecheck-command` | Get the typecheck command for the detected ecosystem     | `(workingDirectory: string)` |
| `dev-tools:get-git-init-command`  | Get the git init command                                 | none                         |
| `dev-tools:get-hooks-command`     | Get the hook tool install command for the detected tool  | `(workingDirectory: string)` |
| `dev-tools:setup-env-file`        | Create a .env file from .env.example or empty template   | `(workingDirectory: string)` |
| `dev-tools:get-clean-targets`     | Get deletable cache/build artifacts for the ecosystem    | `(workingDirectory: string)` |
| `dev-tools:disk-usage`            | Scan directory for disk usage breakdown                  | `(workingDirectory: string)` |

#### Env File Management (7 channels)

| Channel                        | Description                                           | Parameters                                       |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| `dev-tools:scan-env-variables` | Scan source code for referenced environment variables | `(workingDirectory: string, ecosystem: string)`  |
| `dev-tools:discover-env-files` | Discover all .env\* files in project                  | `(workingDirectory: string)`                     |
| `dev-tools:create-env-example` | Create .env.example from detected env usage           | `(workingDirectory: string, ecosystem: string)`  |
| `dev-tools:create-env-file`    | Create a new .env file with a given name              | `(workingDirectory: string, targetName: string)` |
| `dev-tools:read-env-file`      | Read contents of an env file                          | `(filePath: string)`                             |
| `dev-tools:write-env-file`     | Write contents to an env file                         | `(filePath: string, content: string)`            |
| `dev-tools:sync-env-files`     | Sync env files with .env.example (add missing keys)   | `(workingDirectory: string, ecosystem: string)`  |

#### Hooks Management (8 channels)

| Channel                             | Description                                      | Parameters                                                    |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `dev-tools:detect-hooks`            | Detect installed hook tool and configuration     | `(workingDirectory: string, ecosystem: string)`               |
| `dev-tools:setup-hook-tool`         | Install and configure a hook tool                | `(workingDirectory: string, tool: string, ecosystem: string)` |
| `dev-tools:get-hook-install-cmd`    | Get the install command for a specific hook tool | `(tool: string)`                                              |
| `dev-tools:read-hooks-config`       | Read hook configuration for a specific tool      | `(workingDirectory: string, tool: string)`                    |
| `dev-tools:write-hooks-config`      | Write hook configuration                         | `(workingDirectory: string, config: object)`                  |
| `dev-tools:setup-lint-staged`       | Set up lint-staged configuration                 | `(workingDirectory: string, config: object)`                  |
| `dev-tools:get-hook-presets`        | Get preset hook actions for ecosystem and tool   | `(ecosystem: string, tool: string)`                           |
| `dev-tools:get-lint-staged-presets` | Get lint-staged preset rules for ecosystem       | `(ecosystem: string)`                                         |

#### EditorConfig Management (5 channels)

| Channel                              | Description                                | Parameters                                      |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------------- |
| `dev-tools:read-editorconfig`        | Read .editorconfig file                    | `(workingDirectory: string)`                    |
| `dev-tools:write-editorconfig`       | Write .editorconfig file                   | `(workingDirectory: string, config: object)`    |
| `dev-tools:create-editorconfig`      | Create default .editorconfig for ecosystem | `(workingDirectory: string, ecosystem: string)` |
| `dev-tools:delete-editorconfig`      | Delete .editorconfig file                  | `(workingDirectory: string)`                    |
| `dev-tools:get-editorconfig-presets` | Get editorconfig presets for ecosystem     | `(ecosystem: string)`                           |

#### Formatter Config Management (7 channels)

| Channel                          | Description                         | Parameters                                                       |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `dev-tools:detect-formatter`     | Detect installed code formatter     | `(workingDirectory: string, ecosystem: string)`                  |
| `dev-tools:read-format-config`   | Read formatter configuration        | `(configPath: string, formatter: string)`                        |
| `dev-tools:write-format-config`  | Write formatter configuration       | `(workingDirectory: string, formatter: string, config: object)`  |
| `dev-tools:get-format-presets`   | Get formatter presets for ecosystem | `(ecosystem: string, formatter: string)`                         |
| `dev-tools:create-format-ignore` | Create formatter ignore file        | `(workingDirectory: string, formatter: string)`                  |
| `dev-tools:read-format-ignore`   | Read formatter ignore file contents | `(workingDirectory: string, formatter: string)`                  |
| `dev-tools:write-format-ignore`  | Write formatter ignore file         | `(workingDirectory: string, formatter: string, content: string)` |

#### Test Config Management (4 channels)

| Channel                           | Description                        | Parameters                                                      |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `dev-tools:detect-test-framework` | Detect installed test framework    | `(workingDirectory: string, ecosystem: string)`                 |
| `dev-tools:read-test-config`      | Read test framework configuration  | `(configPath: string, framework: string)`                       |
| `dev-tools:write-test-config`     | Write test framework configuration | `(workingDirectory: string, framework: string, config: object)` |
| `dev-tools:get-test-presets`      | Get test presets for ecosystem     | `(ecosystem: string, framework: string)`                        |

#### Coverage Config Management (5 channels)

| Channel                           | Description                             | Parameters                                                     |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| `dev-tools:detect-coverage`       | Detect coverage provider                | `(workingDirectory: string, ecosystem: string)`                |
| `dev-tools:read-coverage-config`  | Read coverage configuration             | `(configPath: string, provider: string)`                       |
| `dev-tools:write-coverage-config` | Write coverage configuration            | `(workingDirectory: string, provider: string, config: object)` |
| `dev-tools:get-coverage-presets`  | Get coverage presets for ecosystem      | `(ecosystem: string, provider: string)`                        |
| `dev-tools:open-coverage-report`  | Open coverage report in default browser | `(reportPath: string)`                                         |

#### Build Config Management (4 channels)

| Channel                        | Description                    | Parameters                                                      |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| `dev-tools:detect-build-tool`  | Detect installed build tool    | `(workingDirectory: string, ecosystem: string)`                 |
| `dev-tools:read-build-config`  | Read build tool configuration  | `(configPath: string, buildTool: string)`                       |
| `dev-tools:write-build-config` | Write build tool configuration | `(workingDirectory: string, buildTool: string, config: object)` |
| `dev-tools:get-build-presets`  | Get build tool presets         | `(ecosystem: string, buildTool: string)`                        |

#### Lint Config Management (4 channels)

| Channel                       | Description                | Parameters                                                   |
| ----------------------------- | -------------------------- | ------------------------------------------------------------ |
| `dev-tools:detect-linter`     | Detect installed linter    | `(workingDirectory: string, ecosystem: string)`              |
| `dev-tools:read-lint-config`  | Read linter configuration  | `(configPath: string, linter: string)`                       |
| `dev-tools:write-lint-config` | Write linter configuration | `(workingDirectory: string, linter: string, config: object)` |
| `dev-tools:get-lint-presets`  | Get linter presets         | `(ecosystem: string, linter: string)`                        |

#### Package Manager (5 channels)

| Channel                                 | Description                                  | Parameters                               |
| --------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `dev-tools:get-pm-commands`             | Get common commands for a package manager    | `(pm: string)`                           |
| `dev-tools:get-pm-info`                 | Get package manager info (version, packages) | `(workingDirectory: string, pm: string)` |
| `dev-tools:get-pm-init-command`         | Get the init command for a package manager   | `(pm: string)`                           |
| `dev-tools:get-pm-dedupe-command`       | Get the dedupe command for a package manager | `(pm: string)`                           |
| `dev-tools:get-pm-lock-refresh-command` | Get the lock file refresh command            | `(pm: string)`                           |

#### Package Config (2 channels)

| Channel                          | Description                                | Parameters                                                    |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `dev-tools:read-package-config`  | Read package manifest (package.json, etc.) | `(workingDirectory: string, ecosystem: string)`               |
| `dev-tools:write-package-config` | Write package manifest updates             | `(workingDirectory: string, ecosystem: string, data: object)` |

#### NPM Registry (1 channel)

| Channel                         | Description                      | Parameters        |
| ------------------------------- | -------------------------------- | ----------------- |
| `dev-tools:search-npm-registry` | Search npm registry for packages | `(query: string)` |

### AI Channels (ai:) - 3 channels

AI/LLM integration for text completion. Supports Gemini, Anthropic, OpenAI, and Ollama providers. Handlers are registered in `ai.handlers.ts` and delegate to `AIService`.

| Channel              | Description                                     | Parameters                             |
| -------------------- | ----------------------------------------------- | -------------------------------------- |
| `ai:complete`        | Send a prompt to the configured AI provider     | `(prompt: string, maxTokens?: number)` |
| `ai:test-connection` | Test connectivity to the configured AI provider | none                                   |
| `ai:get-config`      | Get current AI configuration (provider, model)  | none                                   |

### Workflow Channels (workflow:) - 8 channels

AI-powered workflow automation and version management. Handlers are registered in `workflow.handlers.ts` and delegate to `WorkflowService`, `VersionService`, and `CLIScannerService`.

| Channel                            | Description                                                   | Parameters                                                      |
| ---------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| `workflow:generate-changelog`      | Generate changelog entries from git diff using AI             | `(repoPath: string, issueNumber?: string, branchName?: string)` |
| `workflow:generate-commit-message` | Generate conventional commit message from staged diff         | `(repoPath: string, issueNumber?: string, branchName?: string)` |
| `workflow:apply-changelog`         | Apply changelog entry to CHANGELOG.md (merge into Unreleased) | `(repoPath: string, entry: string)`                             |
| `workflow:detect-versions`         | Detect version files and current versions in project          | `(repoPath: string)`                                            |
| `workflow:bump-version`            | Calculate next semver version from current                    | `(current: string, type: 'major' \| 'minor' \| 'patch')`        |
| `workflow:update-version`          | Write new version to specified manifest files                 | `(repoPath: string, newVersion: string, files: string[])`       |
| `workflow:scan-clis`               | Scan for installed CLI tools by ecosystem                     | `(ecosystem: string)`                                           |
| `workflow:get-cli-help`            | Get help text for a CLI tool                                  | `(cliPath: string, subcommand?: string)`                        |

### Notification Channels (notification:) - 9 channels

Notification CRUD and preference management. Handlers are registered in `notification.handlers.ts`. Notifications are persisted to the SQLite `notifications` table and deduplicated via `dedupe_key`.

| Channel                           | Description                                    | Parameters                                    |
| --------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `notification:add`                | Add a notification to the database             | `(notification: AppNotification)`             |
| `notification:get-all`            | Get all notifications with pagination          | `(limit?: number, offset?: number)`           |
| `notification:mark-read`          | Mark a single notification as read             | `(id: string)`                                |
| `notification:mark-all-read`      | Mark all notifications as read                 | none                                          |
| `notification:dismiss`            | Dismiss a notification (soft delete)           | `(id: string)`                                |
| `notification:clear-all`          | Clear all notifications                        | none                                          |
| `notification:get-preferences`    | Get notification preferences                   | none                                          |
| `notification:update-preferences` | Update notification preferences (deep merge)   | `(updates: Partial<NotificationPreferences>)` |
| `notification:get-unread-count`   | Get count of unread, undismissed notifications | none                                          |

### GitHub Config Channels (github-config:) - 7 channels

Management of the `.github/` directory structure including workflows, issue templates, dependabot, CODEOWNERS, and more. Handlers are registered in `github-config.handlers.ts` and delegate to `GitHubConfigService`.

| Channel                              | Description                                             | Parameters                                                          |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `github-config:scan`                 | Scan .github/ directory for all 12 supported features   | `(workingDirectory: string)`                                        |
| `github-config:read-file`            | Read a file from .github/ directory                     | `(workingDirectory: string, relativePath: string)`                  |
| `github-config:write-file`           | Write a file to .github/ directory                      | `(workingDirectory: string, relativePath: string, content: string)` |
| `github-config:delete-file`          | Delete a file or directory from .github/                | `(workingDirectory: string, relativePath: string)`                  |
| `github-config:create-from-template` | Create a .github/ file from a built-in template         | `(workingDirectory: string, featureId: string, templateId: string)` |
| `github-config:list-templates`       | List available templates for a feature                  | `(featureId: string)`                                               |
| `github-config:list-issue-templates` | List parsed issue templates from .github/ISSUE_TEMPLATE | `(workingDirectory: string)`                                        |

### Echo Channel (echo) - 1 channel

| Channel | Description                            | Parameters          |
| ------- | -------------------------------------- | ------------------- |
| `echo`  | Echo test channel for IPC connectivity | `(message: string)` |

---

## Services Reference

### Main Process Services

| Service                    | File                              | Purpose                                                           |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| AIService                  | `ai.service.ts`                   | Multi-provider AI abstraction (Gemini, Anthropic, OpenAI, Ollama) |
| BuildConfigService         | `build-config.service.ts`         | Build tool detection and configuration across 7 ecosystems        |
| CLIDetectionService        | `cli-detection.service.ts`        | CLI tool detection and installation for project scaffolding       |
| CLIScannerService          | `cli-scanner.service.ts`          | PATH scanning for executables with help text parsing              |
| CodeServerService          | `code-server.service.ts`          | Code-server Docker container integration                          |
| ContributionScannerService | `contribution-scanner.service.ts` | Scan directories for contributions                                |
| CoverageConfigService      | `coverage-config.service.ts`      | Test coverage provider detection and configuration                |
| DatabaseScaffoldService    | `database-scaffold.service.ts`    | Database scaffolding (ORM configs, Docker Compose, env vars)      |
| DatabaseService            | `database/database.service.ts`    | SQLite database operations                                        |
| DiscordService             | `discord.service.ts`              | Discord API integration                                           |
| DiskUsageService           | `disk-usage.service.ts`           | Project directory artifact size scanning                          |
| EditorconfigService        | `editorconfig.service.ts`         | .editorconfig parsing, writing, and ecosystem presets             |
| EnvironmentService         | `environment.service.ts`          | Environment variable management                                   |
| EnvFileService             | `env-file.service.ts`             | .env file discovery, CRUD, sync, and .env.example generation      |
| EnvScannerService          | `env-scanner.service.ts`          | Source code scanning for environment variable references          |
| FileSystemService          | `filesystem.service.ts`           | File system operations                                            |
| FormatConfigService        | `format-config.service.ts`        | Code formatter detection and configuration (Prettier, Ruff, etc.) |
| GitAskpassService          | `git-askpass.service.ts`          | GIT_ASKPASS helper for terminal Git authentication                |
| GitHubConfigService        | `github-config.service.ts`        | .github/ directory management (workflows, templates, etc.)        |
| GitHubGraphQLService       | `github-graphql.service.ts`       | GitHub GraphQL API                                                |
| GitHubRestService          | `github-rest.service.ts`          | GitHub REST API                                                   |
| GitHubService              | `github.service.ts`               | GitHub facade service                                             |
| GitIgnoreService           | `gitignore.service.ts`            | Gitignore parsing                                                 |
| GitService                 | `git.service.ts`                  | Local git operations via simple-git                               |
| HooksService               | `hooks.service.ts`                | Git hook tool management (Husky, pre-commit, Lefthook, etc.)      |
| LintConfigService          | `lint-config.service.ts`          | Linter detection and configuration across 7 ecosystems            |
| NotificationService        | `notification.service.ts`         | GitHub event polling and notification push to renderer            |
| NpmRegistryService         | `npm-registry.service.ts`         | npm registry package search via public API                        |
| PackageConfigService       | `package-config.service.ts`       | Multi-ecosystem package manifest read/write                       |
| PackageManagerService      | `package-manager.service.ts`      | Package manager command resolution (npm, yarn, pnpm, bun)         |
| ProjectDetectionService    | `project-detection.service.ts`    | Project ecosystem, package manager, and tooling detection         |
| ProjectScaffoldService     | `project-scaffold.service.ts`     | Project creation via CLI tools and templates                      |
| SecureStorageService       | `secure-storage.service.ts`       | Secure credential storage                                         |
| SpotifyService             | `spotify.service.ts`              | Spotify Web API integration                                       |
| TerminalService            | `terminal.service.ts`             | PTY terminal management                                           |
| TestConfigService          | `test-config.service.ts`          | Test framework detection and configuration                        |
| UpdaterService             | `updater.service.ts`              | Auto-update functionality                                         |
| VersionService             | `version.service.ts`              | Version file detection and semver bumping                         |
| WorkflowService            | `workflow.service.ts`             | AI-powered changelog and commit message generation                |

### Zustand Stores (Renderer)

| Store                        | File                              | Purpose                       |
| ---------------------------- | --------------------------------- | ----------------------------- |
| useContributionsStore        | `useContributionsStore.ts`        | Contribution state management |
| useDiscordStore              | `useDiscordStore.ts`              | Discord connection state      |
| useIssuesStore               | `useIssuesStore.ts`               | Issue search results          |
| useProfessionalProjectsStore | `useProfessionalProjectsStore.ts` | Professional projects         |
| useProjectsStore             | `useProjectsStore.ts`             | Open-source projects          |
| useSettingsStore             | `useSettingsStore.ts`             | Application settings          |
| useSpotifyStore              | `useSpotifyStore.ts`              | Spotify playback state        |
| useDevScriptsStore           | `useDevScriptsStore.ts`           | Dev scripts management        |
| useOpenProjectsStore         | `useOpenProjectsStore.ts`         | Currently open projects       |
| useUpdaterStore              | `useUpdaterStore.ts`              | Auto-update state management  |
| useNotificationStore         | `useNotificationStore.ts`         | Notification state management |

#### Store Export Status

Not all stores are exported from the central `index.ts` barrel file. When importing stores, be aware of which require direct imports:

**Exported from `src/renderer/stores/index.ts`** (use barrel import):

```typescript
import {
  useContributionsStore,
  useDevScriptsStore,
  useIssuesStore,
  useOpenProjectsStore,
  useSettingsStore,
} from '@/stores';
```

**Direct import required** (not in barrel export):

```typescript
import { useDiscordStore } from '@/stores/useDiscordStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useProfessionalProjectsStore } from '@/stores/useProfessionalProjectsStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSpotifyStore } from '@/stores/useSpotifyStore';
import { useUpdaterStore } from '@/stores/useUpdaterStore';
```

---

## Domain-Split Service Architecture

Two services have been refactored from monolithic files into domain-based sub-modules organized in subdirectories. Each uses a barrel `index.ts` re-export to preserve the original class API while splitting implementation into focused, testable units.

### GitHub REST Service (`src/main/services/github/`)

The `GitHubRestService` class extends `GitHubRestServiceBase` and delegates every public method to standalone functions in domain modules.

| Module                     | File                              | Responsibility                                                                                      |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| GitHubRestServiceBase      | `github-rest-base.service.ts`     | Octokit client management, token handling, authenticated user, search, user events, repository tree |
| GitHub Issues              | `github-issues.service.ts`        | Issue CRUD, comments, reactions, sub-issues                                                         |
| GitHub Pull Requests       | `github-pull-requests.service.ts` | PR CRUD, reviews, comments, reactions, merge, close, check status                                   |
| GitHub Extras              | `github-extras.service.ts`        | Repositories, releases, actions, stars, rate limits, comment reactions                              |
| GitHubRestService (facade) | `index.ts`                        | Re-exports class that delegates to all sub-modules                                                  |

```
src/main/services/github/
  index.ts                          # GitHubRestService facade class + singleton export
  github-rest-base.service.ts       # Base class with Octokit client
  github-issues.service.ts          # Issue domain functions
  github-pull-requests.service.ts   # PR domain functions
  github-extras.service.ts          # Repository, releases, actions, misc functions
```

### Code Server Service (`src/main/services/code-server/`)

The `CodeServerService` class orchestrates container lifecycle and delegates to domain modules for path mapping, config sync, and Docker operations.

| Module                           | File             | Responsibility                                                                             |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Path Mapper                      | `path-mapper.ts` | Port allocation, host/container path translation, workspace category detection             |
| Config Sync                      | `config-sync.ts` | VS Code settings sync, git config, bashrc, SSH config, Docker mount generation             |
| Docker Ops                       | `docker-ops.ts`  | Docker CLI execution, container state, stats, image management, extensions                 |
| Types                            | `types.ts`       | Shared TypeScript interfaces (`CodeServerStatus`, `CodeServerStats`, `WorkspaceBasePaths`) |
| CodeServerService (orchestrator) | `index.ts`       | Lifecycle management, workspace tracking, delegates to sub-modules                         |

```
src/main/services/code-server/
  index.ts          # CodeServerService orchestrator class + singleton export
  path-mapper.ts    # Path translation utilities
  config-sync.ts    # Configuration synchronization
  docker-ops.ts     # Docker CLI operations
  types.ts          # Shared type definitions
```

---

## Event Channels (Main -> Renderer)

In addition to the request/response invoke channels, Cola Records uses 11 one-way event channels for pushing data from the main process to the renderer. These are defined in `src/main/ipc/channels/events.ts`.

| Channel                 | Payload                                                                             | Purpose                                 |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| `git:status-changed`    | `(repoPath: string)`                                                                | Notify renderer that git status changed |
| `terminal:data`         | `(terminalId: string, data: string)`                                                | PTY output data stream                  |
| `terminal:exit`         | `(terminalId: string, exitCode: number)`                                            | PTY process exited                      |
| `updater:checking`      | `()`                                                                                | Update check started                    |
| `updater:available`     | `({ version: string, releaseDate: string, releaseNotes?: string })`                 | Update available with version info      |
| `updater:not-available` | `()`                                                                                | No update available                     |
| `updater:progress`      | `({ percent: number, bytesPerSecond: number, transferred: number, total: number })` | Download progress                       |
| `updater:downloaded`    | `({ version: string, releaseDate: string, releaseNotes?: string })`                 | Update downloaded, ready to install     |
| `updater:error`         | `({ message: string })`                                                             | Update error occurred                   |
| `notification:push`     | `(notification: AppNotification)`                                                   | Push single notification to renderer    |
| `notification:batch`    | `(notifications: AppNotification[])`                                                | Push batch of notifications to renderer |

Event channels use `webContents.send()` in the main process and `ipcRenderer.on()` listeners in the renderer, unlike invoke channels which use the request/response pattern.

---

## Best Practices

### Channel Design

1. **Use descriptive action names**: `github:search-issues` not `github:search`
2. **Group by domain**: All git operations under `git:` prefix
3. **Consistent parameter objects**: Always use object parameters for flexibility
4. **Return typed responses**: Define TypeScript interfaces for responses

### Error Handling

```typescript
// Main process - throw descriptive errors
ipcMain.handle('github:get-issue', async (event, params) => {
  if (!params.issueNumber) {
    throw new Error('issueNumber is required');
  }
  try {
    return await githubService.getIssue(params);
  } catch (error) {
    throw new Error(`Failed to get issue: ${error.message}`);
  }
});

// Renderer - handle errors gracefully
try {
  const issue = await ipc.invoke('github:get-issue', 'owner', 'repo', 123);
} catch (error) {
  toast.error(error.message);
}
```

### Security

- Never expose sensitive data (tokens) to renderer
- Validate all input parameters in handlers
- Use contextIsolation and nodeIntegration: false
- Expose only necessary IPC methods via preload

## Adding New Channels

1. Define handler in main process IPC setup
2. Add type definitions if using TypeScript
3. Document channel in this guide
4. Test with error cases
