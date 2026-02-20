# Application Architecture Flow

## Overview

Cola Records is an Electron desktop application with a clear separation between the Main Process (Node.js) and Renderer Process (React). Communication between these processes occurs through a secure IPC (Inter-Process Communication) bridge via the preload script.

**Architecture Type:** Electron Main/Renderer with IPC Bridge

**Entry Points:**

- Main Process: `src/main/index.ts`
- Renderer: `src/renderer/index.tsx`
- Preload: `src/main/preload.ts`

## Architecture Diagram

```mermaid
graph TD
    subgraph Renderer["Renderer Process (React 19)"]
        UI[React Components]
        Screens[Screen Components]
        Stores[Zustand Stores]
        Hooks[Custom Hooks]
        IPC_Client[IPC Client via window.api]
    end

    subgraph Preload["Preload Script"]
        Bridge[Context Bridge]
    end

    subgraph Main["Main Process (Electron)"]
        IPC_Handler[IPC Handlers]
        Services[Service Layer]
        DB[(SQLite Database)]
    end

    subgraph External["External Services"]
        GitHub[GitHub API]
        Spotify[Spotify API]
        Discord[Discord Gateway]
        Git[Git CLI]
    end

    UI --> Screens
    Screens --> Stores
    Screens --> Hooks
    Stores --> IPC_Client
    Hooks --> IPC_Client
    IPC_Client -->|ipcRenderer.invoke| Bridge
    Bridge -->|Secure Channel| IPC_Handler
    IPC_Handler --> Services
    Services --> DB
    Services --> GitHub
    Services --> Spotify
    Services --> Discord
    Services --> Git
```

## Detailed Data Flow

```mermaid
sequenceDiagram
    participant User
    participant React as React Component
    participant Store as Zustand Store
    participant IPC as IPC Client
    participant Handler as IPC Handler
    participant Service as Service Layer
    participant External as External API/DB

    User->>React: User Action
    React->>Store: Dispatch Action
    Store->>IPC: ipc.invoke(channel, ...args)
    IPC->>Handler: ipcMain.handle(channel)
    Handler->>Service: Service Method Call
    Service->>External: API/DB Operation
    External-->>Service: Response
    Service-->>Handler: Result
    Handler-->>IPC: Return Value
    IPC-->>Store: Update State
    Store-->>React: Re-render
    React-->>User: UI Update
```

## Key Data Flows

### Contribution Workflow

```mermaid
graph LR
    subgraph Discovery["Issue Discovery"]
        Search[Search GitHub Issues]
        Filter[Filter by Labels/Language]
        Select[Select Issue]
    end

    subgraph Setup["Contribution Setup"]
        Fork[Fork Repository]
        Clone[Clone Locally]
        Branch[Create Branch]
    end

    subgraph Development["Development"]
        Code[Write Code]
        Commit[Commit Changes]
        Push[Push to Fork]
    end

    subgraph Submit["Submission"]
        PR[Create Pull Request]
        Track[Track PR Status]
        Merge[Merge/Close]
    end

    Search --> Filter --> Select
    Select --> Fork --> Clone --> Branch
    Branch --> Code --> Commit --> Push
    Push --> PR --> Track --> Merge
```

### Issue Discovery Flow

```mermaid
graph TD
    User[User] -->|Search| IssueDiscovery[IssueDiscoveryScreen]
    IssueDiscovery -->|github:search-issues| GitHubService[GitHub Service]
    GitHubService -->|Check Cache| Cache[(github_cache)]
    Cache -->|Cache Miss| GitHubAPI[GitHub REST API]
    GitHubAPI -->|Response| GitHubService
    GitHubService -->|Store| Cache
    GitHubService -->|Return| IssueDiscovery
    IssueDiscovery -->|Display| IssueList[IssueList Component]
    IssueList -->|Render| IssueCard[IssueCard Components]
    IssueCard -->|Select| IssueDetailModal[IssueDetailModal]
```

### Git Operations Flow

```mermaid
graph TD
    Component[React Component] -->|git:status| GitService[Git Service]
    Component -->|git:clone| GitService
    Component -->|git:checkout| GitService
    Component -->|git:push| GitService

    GitService -->|Execute| GitCLI[Git CLI]
    GitCLI -->|Local Repo| FileSystem[File System]
    GitCLI -->|Remote| GitHub[GitHub Remote]
    GitCLI -->|Remote| Upstream[Upstream Remote]
```

## IPC Channel Categories

| Category     | Prefix          | Channels | Purpose                      |
| ------------ | --------------- | -------- | ---------------------------- |
| File System  | `fs:`           | 8        | Local file operations        |
| Git          | `git:`          | 17       | Git CLI operations           |
| GitHub       | `github:`       | 53       | GitHub API interactions      |
| Contribution | `contribution:` | 7        | Contribution CRUD            |
| Settings     | `settings:`     | 4        | Application settings         |
| Spotify      | `spotify:`      | 18       | Music playback               |
| Discord      | `discord:`      | 29       | Discord messaging            |
| Terminal     | `terminal:`     | 4        | PTY terminal                 |
| Dev Scripts  | `dev-scripts:`  | 3        | Custom scripts               |
| Code Server  | `code-server:`  | 7        | VS Code server               |
| Updater      | `updater:`      | 5        | Auto-update functionality    |
| Project      | `project:`      | 1        | Project scanning             |
| Gitignore    | `gitignore:`    | 2        | Git ignore operations        |
| Dialog       | `dialog:`       | 1        | Native dialogs               |
| Shell        | `shell:`        | 3        | Shell operations             |
| Docs         | `docs:`         | 1        | Documentation file structure |
| **Total**    |                 | **163**  | **+ 9 event channels**       |

## Service Layer

The Main Process contains 15 top-level services plus 9 domain-split sub-modules handling specific domains:

```mermaid
graph TD
    subgraph Core["Core Services"]
        Database[database.service.ts]
        FileSystem[filesystem.service.ts]
        Environment[environment.service.ts]
        SecureStorage[secure-storage.service.ts]
    end

    subgraph Git["Git Services"]
        GitService[git.service.ts]
        GitIgnore[gitignore.service.ts]
    end

    subgraph GitHub["GitHub Services"]
        GitHubMain[github.service.ts]
        GitHubREST[github-rest.service.ts]
        GitHubGraphQL[github-graphql.service.ts]
        subgraph GitHubSplit["Domain-Split Modules (github/)"]
            GitHubIssues[github-issues.service.ts]
            GitHubPRs[github-pull-requests.service.ts]
            GitHubBase[github-rest-base.service.ts]
            GitHubExtras[github-extras.service.ts]
        end
    end

    subgraph Integrations["Integration Services"]
        Spotify[spotify.service.ts]
        Discord[discord.service.ts]
        CodeServer[code-server.service.ts]
        subgraph CodeServerSplit["Domain-Split Modules (code-server/)"]
            PathMapper[path-mapper.ts]
            ConfigSync[config-sync.ts]
            DockerOps[docker-ops.ts]
            CSTypes[types.ts]
        end
    end

    subgraph Utilities["Utility Services"]
        Terminal[terminal.service.ts]
        Scanner[contribution-scanner.service.ts]
        Updater[updater.service.ts]
    end
```

> **Note:** The `github/` and `code-server/` subdirectories contain domain-split sub-modules that are re-exported through barrel files. The top-level service files delegate to these sub-modules for specific operations.

## State Management

Renderer process uses Zustand stores for state management:

| Store                        | Purpose                       |
| ---------------------------- | ----------------------------- |
| useContributionsStore        | Track active contributions    |
| useIssuesStore               | GitHub issue cache            |
| useProjectsStore             | Open source project tracking  |
| useProfessionalProjectsStore | Professional project tracking |
| useSettingsStore             | Application settings          |
| useSpotifyStore              | Spotify playback state        |
| useDiscordStore              | Discord connection state      |
| useDevScriptsStore           | Development scripts           |
| useOpenProjectsStore         | Currently open projects       |
| useUpdaterStore              | Auto-update state management  |

---

## Multi-Project Architecture

Cola Records supports opening and managing multiple projects simultaneously through a tab-based interface. This architecture enables developers to work on several contributions without restarting the code-server container.

### Architecture Overview

```mermaid
graph TD
    subgraph Renderer["Renderer Process"]
        TabBar[ProjectTabBar]
        Tabs[ProjectTab Components]
        Store[useOpenProjectsStore]
        DevScreen[DevelopmentScreen]
    end

    subgraph Main["Main Process"]
        CodeServer[CodeServerService]
        Container[(Docker Container)]
    end

    TabBar --> Tabs
    Tabs --> Store
    Store -->|code-server:add-workspace| CodeServer
    Store -->|code-server:remove-workspace| CodeServer
    DevScreen --> Store
    CodeServer --> Container
```

### State Management

The `useOpenProjectsStore` Zustand store manages open project state:

| Property          | Type             | Description                                |
| ----------------- | ---------------- | ------------------------------------------ |
| `projects`        | `OpenProject[]`  | Array of currently open projects           |
| `activeProjectId` | `string \| null` | ID of the currently visible project        |
| `maxProjects`     | `number`         | Maximum simultaneous projects (default: 5) |

### Project Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant TabBar as ProjectTabBar
    participant Store as useOpenProjectsStore
    participant IPC as IPC Handler
    participant Service as CodeServerService

    User->>TabBar: Click project from list
    TabBar->>Store: openProject(contribution)
    Store->>Store: Check maxProjects limit
    Store->>IPC: code-server:add-workspace
    IPC->>Service: addWorkspace(projectPath)
    Service->>Service: hostToContainerPath(projectPath)
    Service-->>IPC: URL with ?folder= parameter
    IPC-->>Store: codeServerUrl
    Store->>Store: updateProjectState('running')
    Store-->>TabBar: Re-render with new tab
```

### Workspace Mounting Strategy

Rather than recreating Docker containers for each project, Cola Records mounts three workspace parent directories at container creation:

| Setting                           | Container Path                     | Purpose                        |
| --------------------------------- | ---------------------------------- | ------------------------------ |
| `defaultClonePath`                | `/config/workspaces/contributions` | Open-source contribution repos |
| `defaultProjectsPath`             | `/config/workspaces/my-projects`   | Personal projects              |
| `defaultProfessionalProjectsPath` | `/config/workspaces/professional`  | Professional/work projects     |

Project switching is handled via URL `?folder=` parameter, not container recreation. This preserves:

- Installed npm packages
- VS Code extensions
- Claude Code authentication
- Terminal history

### IPC Channels

| Channel                        | Direction        | Purpose                              |
| ------------------------------ | ---------------- | ------------------------------------ |
| `code-server:add-workspace`    | Renderer -> Main | Add project to tracking, get URL     |
| `code-server:remove-workspace` | Renderer -> Main | Remove project from tracking         |
| `code-server:start`            | Renderer -> Main | Start container with initial project |
| `code-server:stop`             | Renderer -> Main | Stop container (clears all projects) |

---

## Auto-Update Architecture

Cola Records uses `electron-updater` for automatic updates, providing seamless update delivery through GitHub Releases.

### Update Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Checking: App Start / Manual Check
    Checking --> Available: Update Found
    Checking --> NotAvailable: No Update
    Available --> Downloading: User Approves
    Downloading --> Downloaded: Complete
    Downloaded --> Installing: User Confirms
    Installing --> [*]: App Restarts

    NotAvailable --> Idle
    Available --> Idle: User Dismisses
```

### UpdaterService Lifecycle

```mermaid
sequenceDiagram
    participant App as App Start
    participant Service as UpdaterService
    participant Updater as electron-updater
    participant Renderer as Renderer Process
    participant GitHub as GitHub Releases

    App->>Service: initialize(mainWindow)
    Service->>Service: Skip if development mode
    Service->>Updater: Configure (autoDownload: false)
    Service->>Updater: Setup event listeners

    Note over Service: 5 second delay

    Service->>Updater: checkForUpdates()
    Updater->>GitHub: Check latest release
    GitHub-->>Updater: Release info
    Updater-->>Service: update-available event
    Service->>Renderer: updater:available
```

### Update States

| Status          | Description                        |
| --------------- | ---------------------------------- |
| `idle`          | No update activity                 |
| `checking`      | Checking GitHub for updates        |
| `available`     | Update found, awaiting user action |
| `not-available` | Current version is latest          |
| `downloading`   | Update downloading in background   |
| `downloaded`    | Ready to install                   |
| `error`         | Update check/download failed       |

### IPC Channels

| Channel                 | Direction        | Purpose                            |
| ----------------------- | ---------------- | ---------------------------------- |
| `updater:check`         | Renderer -> Main | Manually trigger update check      |
| `updater:download`      | Renderer -> Main | Start downloading available update |
| `updater:install`       | Renderer -> Main | Quit and install downloaded update |
| `updater:get-status`    | Renderer -> Main | Get current update state           |
| `updater:get-version`   | Renderer -> Main | Get current app version            |
| `updater:checking`      | Main -> Renderer | Update check started               |
| `updater:available`     | Main -> Renderer | Update available with version info |
| `updater:not-available` | Main -> Renderer | No update available                |
| `updater:progress`      | Main -> Renderer | Download progress (percent, bytes) |
| `updater:downloaded`    | Main -> Renderer | Update ready to install            |
| `updater:error`         | Main -> Renderer | Error occurred                     |

### Configuration

```typescript
// Auto-updater settings in UpdaterService
autoUpdater.autoDownload = false; // User must approve download
autoUpdater.autoInstallOnAppQuit = true; // Install on next quit if downloaded
```

---

## GitHub Actions Flow

Cola Records integrates with GitHub Actions to display workflow runs, jobs, and logs directly within the development tools panel.

### Data Flow

```mermaid
graph TD
    ActionsTool[ActionsTool Component] -->|github:list-workflow-runs| Handler[IPC Handler]
    Handler --> GitHubREST[GitHubRestService]
    GitHubREST --> ActionsAPI[GitHub Actions API]
    ActionsAPI -->|Workflow Runs| GitHubREST
    GitHubREST -->|Formatted Runs| Handler
    Handler -->|Run List| ActionsTool

    ActionsTool -->|Select Run| JobsView[Jobs View]
    JobsView -->|github:list-workflow-run-jobs| Handler
    Handler -->|Job List with Steps| JobsView

    JobsView -->|Select Job| LogsView[Logs View]
    LogsView -->|github:get-job-logs| Handler
    Handler -->|Raw Log Text| LogsView
```

### IPC Channels

| Channel                         | Direction        | Purpose                       |
| ------------------------------- | ---------------- | ----------------------------- |
| `github:list-workflow-runs`     | Renderer -> Main | List workflow runs for a repo |
| `github:list-workflow-run-jobs` | Renderer -> Main | List jobs for a specific run  |
| `github:get-job-logs`           | Renderer -> Main | Get raw log output for a job  |

---

## GitHub Releases Flow

The releases management flow enables listing, creating, updating, deleting, and publishing releases directly from the development tools panel.

### Data Flow

```mermaid
graph TD
    ReleasesTool[ReleasesTool Component] -->|github:list-releases| Handler[IPC Handler]
    Handler --> GitHubREST[GitHubRestService]
    GitHubREST --> ReleasesAPI[GitHub Releases API]
    ReleasesAPI -->|Release List| GitHubREST
    GitHubREST -->|Formatted Releases| Handler
    Handler -->|Releases| ReleasesTool

    ReleasesTool -->|Create| CreateFlow[Create Release]
    CreateFlow -->|github:create-release| Handler

    ReleasesTool -->|Edit| UpdateFlow[Update Release]
    UpdateFlow -->|github:update-release| Handler

    ReleasesTool -->|Delete| DeleteFlow[Delete Release]
    DeleteFlow -->|github:delete-release| Handler

    ReleasesTool -->|Publish Draft| PublishFlow[Publish Release]
    PublishFlow -->|github:publish-release| Handler
```

### IPC Channels

| Channel                  | Direction        | Purpose                      |
| ------------------------ | ---------------- | ---------------------------- |
| `github:list-releases`   | Renderer -> Main | List all releases for a repo |
| `github:get-release`     | Renderer -> Main | Get single release details   |
| `github:create-release`  | Renderer -> Main | Create a new release         |
| `github:update-release`  | Renderer -> Main | Update release metadata      |
| `github:delete-release`  | Renderer -> Main | Delete a release             |
| `github:publish-release` | Renderer -> Main | Publish a draft release      |

---

## Dashboard Data Flow

The DashboardScreen aggregates data from multiple GitHub API channels to populate six independent widgets. Each widget fetches its own data and manages loading, error, and empty states independently through the shared DashboardWidget wrapper.

### Data Flow

```mermaid
graph TD
    DashboardScreen[DashboardScreen] --> CSW[ContributionStatusWidget]
    DashboardScreen --> GPW[GitHubProfileWidget]
    DashboardScreen --> PRW[PRsNeedingAttentionWidget]
    DashboardScreen --> OIW[OpenIssuesWidget]
    DashboardScreen --> RAW[RecentActivityWidget]
    DashboardScreen --> CICD[CICDStatusWidget]

    CSW -->|github:search-issues-and-prs| IPC[IPC Handlers]
    GPW -->|github:get-authenticated-user| IPC
    GPW -->|github:list-user-repos| IPC
    RAW -->|github:list-user-events| IPC
    OIW -->|github:search-issues-and-prs| IPC
    PRW -->|github:search-issues-and-prs| IPC
    PRW -->|github:list-pr-reviews| IPC
    PRW -->|github:get-pr-check-status| IPC
    CICD -->|github:list-user-repos| IPC
    CICD -->|github:list-workflow-runs| IPC

    IPC --> GitHub[GitHub REST API]

    DashboardScreen -->|onOpenProject| ContribStore[contribution:get-all]
    ContribStore -->|Match repo| IDE[Open in IDE]
```

### Widget Data Sources

| Widget                    | IPC Channels Used                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| ContributionStatusWidget  | `github:search-issues-and-prs` (4 queries: open PRs, merged PRs, open issues, closed issues) |
| GitHubProfileWidget       | `github:get-authenticated-user`, `github:list-user-repos`                                    |
| RecentActivityWidget      | `github:get-authenticated-user`, `github:list-user-events`                                   |
| OpenIssuesWidget          | `github:get-authenticated-user`, `github:search-issues-and-prs` (assigned + authored)        |
| PRsNeedingAttentionWidget | `github:search-issues-and-prs`, `github:list-pr-reviews`, `github:get-pr-check-status`       |
| CICDStatusWidget          | `github:list-user-repos`, `github:list-workflow-runs`                                        |

---

## Documentation Viewer Flow

The DocumentationScreen provides an in-app markdown documentation viewer with mermaid diagram rendering. It loads the documentation file structure from the main process and renders selected files using ReactMarkdown.

### Data Flow

```mermaid
graph TD
    DocScreen[DocumentationScreen] -->|docs:get-structure| Handler[IPC Handler]
    Handler -->|Scan docs/ directory| FS[FileSystemService]
    FS -->|Category + File List| Handler
    Handler -->|DocsCategory Array| DocScreen

    DocScreen --> DocsSidebar[DocsSidebar]
    DocsSidebar -->|Select File| DocScreen

    DocScreen -->|fs:read-file| ReadHandler[IPC Handler]
    ReadHandler -->|File Content| DocScreen

    DocScreen --> DocsViewer[DocsViewer]
    DocsViewer -->|ReactMarkdown| Rendered[Rendered Markdown]
    DocsViewer -->|Mermaid Code Blocks| MermaidBlock[MermaidBlock]
    MermaidBlock -->|mermaid.render| SVG[Sanitized SVG via DOMPurify]
```

### Rendering Pipeline

1. **DocumentationScreen** mounts and invokes `docs:get-structure` to get categorized file list
2. **DocsSidebar** displays categories with expandable file lists
3. User selects a file; `fs:read-file` loads the raw markdown content
4. **DocsViewer** renders markdown via `ReactMarkdown` with `remarkGfm` and `rehypeRaw`
5. Code blocks with `language-mermaid` are intercepted and rendered by **MermaidBlock**
6. MermaidBlock uses `mermaid.render()` and sanitizes output SVG with `DOMPurify`

---

## Terminal Architecture

Cola Records provides an integrated terminal using `node-pty` for pseudo-terminal emulation, allowing developers to run shell commands directly within the application.

### Architecture Overview

```mermaid
graph TD
    subgraph Renderer["Renderer Process"]
        XTerm[XTermTerminal Component]
        TermTool[TerminalTool]
        FitAddon[xterm-addon-fit]
    end

    subgraph Main["Main Process"]
        Service[TerminalService]
        Sessions[(PTY Sessions Map)]
        PTY[node-pty Process]
    end

    subgraph Shell["Operating System"]
        GitBash[Git Bash]
        PowerShell[PowerShell]
        CMD[CMD]
        Zsh[Zsh / Bash]
    end

    XTerm --> FitAddon
    TermTool --> XTerm
    XTerm -->|terminal:spawn| Service
    XTerm -->|terminal:write| Service
    XTerm -->|terminal:resize| Service
    Service --> Sessions
    Sessions --> PTY
    PTY --> GitBash
    PTY --> PowerShell
    PTY --> CMD
    PTY --> Zsh
```

### PTY Lifecycle

```mermaid
sequenceDiagram
    participant Component as XTermTerminal
    participant IPC as IPC Handler
    participant Service as TerminalService
    participant PTY as node-pty

    Note over Component: Mount
    Component->>IPC: terminal:spawn(shellType, cwd)
    IPC->>Service: spawn(shellType, cwd)
    Service->>PTY: pty.spawn(shell, args, options)
    PTY-->>Service: IPty instance
    Service->>Service: Store in sessions Map
    Service-->>IPC: { id, shellType }
    IPC-->>Component: TerminalSession

    Note over Component: User Types
    Component->>IPC: terminal:write(id, data)
    IPC->>Service: write(id, data)
    Service->>PTY: pty.write(data)

    Note over PTY: Output Generated
    PTY-->>Service: onData callback
    Service->>Component: terminal:data event

    Note over Component: Window Resize
    Component->>IPC: terminal:resize(id, cols, rows)
    IPC->>Service: resize(id, cols, rows)
    Service->>PTY: pty.resize(cols, rows)

    Note over Component: Unmount
    Component->>IPC: terminal:kill(id)
    IPC->>Service: kill(id)
    Service->>PTY: pty.kill()
    Service->>Service: Remove from sessions
```

### Shell Type Selection

| Platform | Shell Type   | Executable Path                     |
| -------- | ------------ | ----------------------------------- |
| Windows  | `git-bash`   | `C:\Program Files\Git\bin\bash.exe` |
| Windows  | `powershell` | `powershell.exe`                    |
| Windows  | `cmd`        | `cmd.exe`                           |
| macOS    | Default      | `/bin/zsh`                          |
| Linux    | Default      | `/bin/bash`                         |

### PTY Configuration

```typescript
// Terminal spawn options
pty.spawn(shell, args, {
  name: 'xterm-256color', // Terminal type for color support
  cols: 80, // Initial columns
  rows: 24, // Initial rows
  cwd: workingDirectory, // Starting directory
  env: {
    ...process.env,
    TERM: 'xterm-256color',
  },
});
```

### IPC Channels

| Channel           | Direction        | Purpose                |
| ----------------- | ---------------- | ---------------------- |
| `terminal:spawn`  | Renderer -> Main | Create new PTY session |
| `terminal:write`  | Renderer -> Main | Send input to PTY      |
| `terminal:resize` | Renderer -> Main | Resize PTY dimensions  |
| `terminal:kill`   | Renderer -> Main | Terminate PTY session  |
| `terminal:data`   | Main -> Renderer | PTY output data        |
| `terminal:exit`   | Main -> Renderer | PTY process exited     |

### XTermTerminal Component Integration

The `XTermTerminal` component wraps xterm.js with:

- `xterm-addon-fit` for automatic terminal resizing
- `xterm-addon-webgl` for GPU-accelerated rendering
- Event listeners for IPC data and exit events
- Cleanup on component unmount

---

**Generated by:** APO (Documentation Specialist)
**Source:** JUNO Audit Report 2026-02-11
