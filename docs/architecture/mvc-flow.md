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
    Store->>IPC: window.api.invoke(channel, data)
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

| Category     | Prefix          | Channels | Purpose                   |
| ------------ | --------------- | -------- | ------------------------- |
| File System  | `fs:`           | 8        | Local file operations     |
| Git          | `git:`          | 17       | Git CLI operations        |
| GitHub       | `github:`       | 45       | GitHub API interactions   |
| Contribution | `contribution:` | 7        | Contribution CRUD         |
| Settings     | `settings:`     | 4        | Application settings      |
| Spotify      | `spotify:`      | 18       | Music playback            |
| Discord      | `discord:`      | 29       | Discord messaging         |
| Terminal     | `terminal:`     | 4        | PTY terminal              |
| Dev Scripts  | `dev-scripts:`  | 3        | Custom scripts            |
| Code Server  | `code-server:`  | 6        | VS Code server            |
| Updater      | `updater:`      | 5        | Auto-update functionality |
| Project      | `project:`      | 1        | Project scanning          |
| Gitignore    | `gitignore:`    | 2        | Git ignore operations     |
| Dialog       | `dialog:`       | 1        | Native dialogs            |
| Shell        | `shell:`        | 3        | Shell operations          |

## Service Layer

The Main Process contains 15 services handling specific domains:

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
    end

    subgraph Integrations["Integration Services"]
        Spotify[spotify.service.ts]
        Discord[discord.service.ts]
        CodeServer[code-server.service.ts]
    end

    subgraph Utilities["Utility Services"]
        Terminal[terminal.service.ts]
        Scanner[contribution-scanner.service.ts]
        Updater[updater.service.ts]
    end
```

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
