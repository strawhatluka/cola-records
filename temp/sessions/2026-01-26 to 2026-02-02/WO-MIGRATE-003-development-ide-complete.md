# ORCHESTRATOR WORK ORDER #MIGRATE-003
## Type: IMPLEMENTATION
## Development IDE Environment (VSCode-like)

---

## MISSION OBJECTIVE

Migrate the complete Development IDE environment from Flutter to Electron/React, replicating VSCode-style functionality with file tree explorer, Monaco code editor, integrated terminal (xterm.js + node-pty), and full git operations panel. This is the final and most complex phase of the migration.

**Implementation Goal:** Create a fully functional VSCode-like IDE within the Electron app, accessible from the Contributions screen, with all file editing, terminal, and git capabilities operational.

**Based On:**
- WO-MIGRATE-001 complete (Core services operational)
- WO-MIGRATE-002 complete (UI foundation and screens ready)

---

## IMPLEMENTATION SCOPE

### IDE Components to Create
```yaml
src/renderer/:
  screens/:
    - DevelopmentIDEScreen.tsx    # Main IDE container

  components/:
    ide/:
      file-tree/:
        - FileTreePanel.tsx       # Left panel file explorer
        - FileTreeNode.tsx        # Recursive tree node
        - FileIcon.tsx            # Icon by file type
        - GitStatusBadge.tsx      # Git status indicator

      editor/:
        - CodeEditorPanel.tsx     # Main editor area
        - EditorTabBar.tsx        # File tabs
        - EditorTab.tsx           # Single tab component
        - MonacoEditor.tsx        # Monaco wrapper
        - ImageViewer.tsx         # PNG/JPG viewer
        - PdfViewer.tsx           # PDF viewer
        - UnsupportedViewer.tsx   # Fallback viewer

      terminal/:
        - TerminalPanel.tsx       # Bottom panel terminal
        - XTermWrapper.tsx        # xterm.js wrapper
        - TerminalControls.tsx    # Clear/restart buttons

      git/:
        - GitPanel.tsx            # Git dropdown panel
        - GitCommitDialog.tsx     # Commit UI
        - GitDiffViewer.tsx       # Diff side-by-side
        - BranchPicker.tsx        # Branch selector
        - MergeConflictDialog.tsx # Conflict resolution

      layout/:
        - IDELayout.tsx           # Resizable split view
        - IDEAppBar.tsx           # IDE-specific app bar
        - StatusBar.tsx           # Bottom status bar
```

### Additional Technologies
```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.45.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0",
    "xterm-addon-search": "^0.13.0",
    "react-resizable-panels": "^1.0.9",
    "react-pdf": "^7.7.0"
  }
}
```

---

## IMPLEMENTATION APPROACH

### Phase 1: File Tree Explorer (8 hours estimated)

#### Step 1.1: File Tree State Integration
- [ ] Connect useFileTreeStore to FileSystemService IPC:
  ```typescript
  interface FileTreeStore {
    root: FileNode | null;
    selectedPath: string | null;
    expandedPaths: Set<string>;
    gitStatus: GitStatus | null;
    gitIgnoreCache: Map<string, boolean>;
    loading: boolean;

    loadTree: (repoPath: string) => Promise<void>;
    toggleNode: (path: string) => void;
    selectNode: (path: string) => void;
    updateGitStatus: (status: GitStatus) => void;
    warmGitIgnoreCache: (root: FileNode, repoPath: string) => Promise<void>;
  }
  ```
- [ ] Implement VSCode loading sequence:
  1. Load bare file tree (fast)
  2. Apply git status (async after tree displays)
  3. Warm gitignore cache (async after git status)
- [ ] Integrate with FileWatcherService for live updates
- [ ] Test: Load tree → verify sequence timing matches VSCode

#### Step 1.2: File Tree Component (Virtualized)
- [ ] Create FileTreePanel with react-window virtualization:
  ```typescript
  <VariableSizeList
    height={800}
    itemCount={flattenedNodes.length}
    itemSize={getNodeHeight}
    width="100%"
  >
    {({ index, style }) => (
      <FileTreeNode
        node={flattenedNodes[index]}
        depth={nodeDepths[index]}
        style={style}
      />
    )}
  </VariableSizeList>
  ```
- [ ] Implement FileTreeNode rendering:
  - Expand/collapse icon (directories only)
  - File/folder icon (with extension mapping)
  - File name (with git status color)
  - Git status badge
  - Gitignore dimming (40% opacity)
- [ ] Add context menu:
  - Rename file
  - Delete file
  - Copy path
  - Reveal in Explorer
- [ ] Test: Expand/collapse → verify virtualization smooth

#### Step 1.3: File Icons & Git Status Integration
- [ ] Create FileIcon component with extension mapping:
  ```typescript
  const iconMap = {
    js: JavaScriptIcon,
    ts: TypeScriptIcon,
    py: PythonIcon,
    dart: DartIcon,
    md: MarkdownIcon,
    json: JsonIcon,
    // ... 50+ extensions
  };
  ```
- [ ] Implement GitStatusBadge with VSCode colors:
  - Modified: `#E2C08D` (gold)
  - Added: `#73C991` (green)
  - Deleted: `#C74E39` (red)
  - Conflicted: `#C74E39` (red)
- [ ] Apply gitignore dimming (from cache)
- [ ] Test: Modify file → verify badge appears → check gitignore

#### Step 1.4: File Watcher Integration
- [ ] Connect FileWatcherService events to file tree:
  ```typescript
  useEffect(() => {
    const unsubscribe = ipc.fileWatcher.subscribe(repoPath, (event) => {
      if (event.type === 'created') {
        // Add new node to tree
      } else if (event.type === 'deleted') {
        // Remove node from tree
      } else if (event.type === 'modified') {
        // Trigger git status refresh
      }
    });
    return unsubscribe;
  }, [repoPath]);
  ```
- [ ] Debounce tree updates (500ms)
- [ ] Auto-expand new folders when files added
- [ ] Test: Create file externally → verify appears in tree

---

### Phase 2: Code Editor (Monaco) (10 hours estimated)

#### Step 2.1: Monaco Editor Integration
- [ ] Install Monaco Editor: `npm install @monaco-editor/react monaco-editor`
- [ ] Create MonacoEditor wrapper component:
  ```typescript
  <Editor
    height="100%"
    language={languageFromExtension(file.extension)}
    value={file.content}
    onChange={handleContentChange}
    theme={themeMode === 'dark' ? 'vs-dark' : 'vs'}
    options={{
      minimap: { enabled: true },
      lineNumbers: 'on',
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true,
    }}
  />
  ```
- [ ] Configure language support (TypeScript, JavaScript, Python, Dart, etc.)
- [ ] Setup syntax highlighting themes
- [ ] Test: Open .ts file → verify syntax highlighting + IntelliSense

#### Step 2.2: Code Editor State Management
- [ ] Implement useCodeEditorStore with multi-tab support:
  ```typescript
  interface CodeEditorStore {
    openFiles: Map<string, EditorFile>;
    activeFilePath: string | null;
    modifiedFiles: Set<string>;

    openFile: (path: string) => Promise<void>;
    closeFile: (path: string) => void;
    switchToTab: (path: string) => void;
    updateContent: (path: string, content: string) => void;
    saveFile: (path: string) => Promise<void>;
    saveAllFiles: () => Promise<void>;
    reloadFile: (path: string) => Promise<void>;
  }

  interface EditorFile {
    path: string;
    content: string;
    originalContent: string;
    isModified: boolean;
    extension: string;
    lastModified: Date;
  }
  ```
- [ ] Track file modifications (dirty state)
- [ ] Integrate with FileSystemService IPC (read/write)
- [ ] Test: Open file → edit → verify modified indicator

#### Step 2.3: Code Editor Panel & Tabs
- [ ] Create EditorTabBar component:
  ```typescript
  <div className="flex overflow-x-auto border-b">
    {Array.from(openFiles.values()).map((file) => (
      <EditorTab
        key={file.path}
        file={file}
        isActive={file.path === activeFilePath}
        onClose={() => closeFile(file.path)}
        onClick={() => switchToTab(file.path)}
      />
    ))}
  </div>
  ```
- [ ] Style tabs with:
  - Modified indicator (dot)
  - Close button (X)
  - Active state (highlighted)
  - File icon
- [ ] Implement tab switching (click or keyboard)
- [ ] Add "Close All" and "Close Others" context menu
- [ ] Test: Open 10 files → switch tabs → close tabs

#### Step 2.4: Save Functionality & Keyboard Shortcuts
- [ ] Implement save operations:
  - `Ctrl+S`: Save active file
  - `Ctrl+Shift+S`: Save all files
- [ ] Trigger git status refresh after save
- [ ] Show save confirmation notification
- [ ] Handle save errors (permission denied, disk full)
- [ ] Test: Edit file → Ctrl+S → verify saved → git status updates

#### Step 2.5: Special File Viewers
- [ ] Create ImageViewer for PNG/JPG:
  ```typescript
  <img src={`file://${filePath}`} alt={fileName} />
  ```
- [ ] Create PdfViewer using react-pdf:
  ```typescript
  <Document file={`file://${filePath}`}>
    <Page pageNumber={pageNumber} />
  </Document>
  ```
- [ ] Create UnsupportedViewer for binary files:
  ```typescript
  <div className="p-8 text-center">
    <FileIcon size={64} />
    <p>Cannot preview {extension} files</p>
    <Button onClick={openInDefault}>Open in Default App</Button>
  </div>
  ```
- [ ] Route file types to appropriate viewer
- [ ] Test: Open image → PDF → binary → verify correct viewer

---

### Phase 3: Integrated Terminal (7.5 hours estimated)

#### Step 3.1: Terminal Service (node-pty)
- [ ] Implement TerminalService in main process:
  ```typescript
  class TerminalService {
    private sessions = new Map<string, IPty>();

    spawn(sessionId: string, cwd: string): void {
      const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      const pty = ptyNode.spawn(shell, [], {
        cwd,
        cols: 80,
        rows: 24,
        env: process.env,
      });

      pty.onData((data) => {
        // Send data to renderer via IPC
        mainWindow.webContents.send('terminal:data', { sessionId, data });
      });

      this.sessions.set(sessionId, pty);
    }

    write(sessionId: string, data: string): void {
      this.sessions.get(sessionId)?.write(data);
    }

    resize(sessionId: string, cols: number, rows: number): void {
      this.sessions.get(sessionId)?.resize(cols, rows);
    }

    kill(sessionId: string): void {
      this.sessions.get(sessionId)?.kill();
      this.sessions.delete(sessionId);
    }
  }
  ```
- [ ] Create IPC handlers for: spawn, write, resize, kill
- [ ] Handle platform-specific shells
- [ ] Test: Spawn PTY → send command → verify output

#### Step 3.2: xterm.js Integration
- [ ] Create XTermWrapper component:
  ```typescript
  const XTermWrapper = ({ sessionId, cwd }: Props) => {
    const termRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal>();

    useEffect(() => {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        theme: {
          background: '#1E1E1E',
          foreground: '#D4D4D4',
        },
      });

      term.loadAddon(new FitAddon());
      term.loadAddon(new WebLinksAddon());
      term.open(termRef.current!);

      // Initialize PTY
      ipc.terminal.spawn(sessionId, cwd);

      // Handle input
      term.onData((data) => ipc.terminal.write(sessionId, data));

      // Handle output
      const unsubscribe = ipc.terminal.onData(sessionId, (data) => {
        term.write(data);
      });

      xtermRef.current = term;
      return () => {
        unsubscribe();
        ipc.terminal.kill(sessionId);
      };
    }, [sessionId, cwd]);

    return <div ref={termRef} className="h-full w-full" />;
  };
  ```
- [ ] Configure xterm.js addons (fit, web-links, search)
- [ ] Match theme colors to Monaco Editor
- [ ] Test: Type command → verify executes → see output

#### Step 3.3: Terminal State Management & UI
- [ ] Implement useTerminalStore:
  ```typescript
  interface TerminalStore {
    sessions: Map<string, TerminalSession>;
    activeSessionId: string | null;

    createSession: (cwd: string) => string;
    switchSession: (sessionId: string) => void;
    closeSession: (sessionId: string) => void;
    clearTerminal: (sessionId: string) => void;
    restartTerminal: (sessionId: string) => void;
  }
  ```
- [ ] Create TerminalPanel component with:
  - Terminal tabs (if multiple sessions)
  - Clear button
  - Restart button
  - Working directory display
- [ ] Handle terminal resize on panel resize
- [ ] Test: Run command → clear → restart → verify working

---

### Phase 4: Git Integration Panel (9 hours estimated)

#### Step 4.1: Git State Management
- [ ] Implement useGitStore:
  ```typescript
  interface GitStore {
    status: GitStatus | null;
    branches: string[];
    currentBranch: string | null;
    loading: boolean;

    fetchStatus: (repoPath: string) => Promise<void>;
    fetchBranches: (repoPath: string) => Promise<void>;
    commit: (repoPath: string, message: string, files: string[]) => Promise<void>;
    push: (repoPath: string, remote: string, branch: string) => Promise<void>;
    pull: (repoPath: string, remote: string, branch: string) => Promise<void>;
    switchBranch: (repoPath: string, branch: string) => Promise<void>;
    createBranch: (repoPath: string, branchName: string) => Promise<void>;
    stageFiles: (repoPath: string, files: string[]) => Promise<void>;
    unstageFiles: (repoPath: string, files: string[]) => Promise<void>;
    fetchDiff: (repoPath: string, filePath?: string) => Promise<string>;
  }
  ```
- [ ] Integrate with GitService IPC
- [ ] Auto-refresh on file save (debounced 500ms)
- [ ] Test: Modify file → save → verify git status updates

#### Step 4.2: Git Panel Component
- [ ] Create GitPanel dropdown in IDE AppBar:
  ```typescript
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button variant="ghost">
        <GitBranchIcon />
        {currentBranch}
        <Badge>{modifiedCount}</Badge>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <div className="p-4 w-80">
        <StatusSummary />
        <Separator />
        <QuickActions />
        <Separator />
        <BranchList />
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
  ```
- [ ] Show status summary:
  - Modified files count
  - Staged files count
  - Untracked files count
- [ ] Add quick actions:
  - Commit button
  - Push button
  - Pull button
  - Refresh button
- [ ] Test: Open panel → verify status accurate

#### Step 4.3: Git Commit Dialog
- [ ] Create GitCommitDialog:
  ```typescript
  <Dialog open={showCommitDialog}>
    <DialogContent>
      <DialogHeader>Commit Changes</DialogHeader>

      <div className="space-y-4">
        <Textarea
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={4}
        />

        <div className="border rounded p-4 max-h-64 overflow-y-auto">
          <h4>Staged Files ({stagedFiles.length})</h4>
          {stagedFiles.map((file) => (
            <FileCheckbox key={file} path={file} status={status[file]} />
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleCommit}>Commit</Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
  ```
- [ ] Validate commit message (not empty)
- [ ] Show staged files with status badges
- [ ] Allow staging/unstaging files from dialog
- [ ] Test: Stage files → write message → commit → verify success

#### Step 4.4: Git Diff Viewer
- [ ] Create GitDiffViewer with side-by-side diff:
  ```typescript
  <Dialog open={showDiffDialog}>
    <DialogContent className="max-w-6xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 dark:bg-red-950/20">
          <pre>{oldContent}</pre>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20">
          <pre>{newContent}</pre>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  ```
- [ ] Parse git diff output
- [ ] Highlight changed lines
- [ ] Add line numbers
- [ ] Test: Modify file → view diff → verify highlighting

#### Step 4.5: Branch Management
- [ ] Create BranchPicker component:
  ```typescript
  <Dialog open={showBranchPicker}>
    <DialogContent>
      <Input placeholder="Search branches..." value={searchTerm} />

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredBranches.map((branch) => (
          <div
            key={branch}
            className={cn("p-2 rounded cursor-pointer hover:bg-accent",
              branch === currentBranch && "bg-primary text-primary-foreground"
            )}
            onClick={() => switchBranch(branch)}
          >
            {branch}
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <Input placeholder="New branch name..." value={newBranchName} />
        <Button onClick={createBranch}>Create Branch</Button>
      </div>
    </DialogContent>
  </Dialog>
  ```
- [ ] Show current branch highlighted
- [ ] Support branch creation
- [ ] Confirm before switching (if uncommitted changes)
- [ ] Test: Switch branch → create branch → verify file tree updates

#### Step 4.6: Auto-Refresh Integration
- [ ] Connect file save → git status refresh:
  ```typescript
  useEffect(() => {
    const unsubscribe = codeEditorStore.subscribe((state) => {
      if (state.lastSavedFile) {
        // Debounce git status refresh
        debouncedRefreshGitStatus();
      }
    });
    return unsubscribe;
  }, []);
  ```
- [ ] Connect file watcher → git status refresh
- [ ] Debounce multiple rapid changes (500ms)
- [ ] Test: Save 5 files quickly → verify single git status call

---

### Phase 5: IDE Layout Integration (5.5 hours estimated)

#### Step 5.1: Resizable Split View
- [ ] Create IDELayout using react-resizable-panels:
  ```typescript
  <PanelGroup direction="horizontal">
    {/* File Tree (20-40%) */}
    <Panel defaultSize={25} minSize={15} maxSize={40}>
      <FileTreePanel />
    </Panel>

    <PanelResizeHandle />

    {/* Editor + Terminal (60-80%) */}
    <Panel defaultSize={75}>
      <PanelGroup direction="vertical">
        {/* Code Editor (30-80%) */}
        <Panel defaultSize={60} minSize={30}>
          <CodeEditorPanel />
        </Panel>

        <PanelResizeHandle />

        {/* Terminal (20-70%) */}
        <Panel defaultSize={40} minSize={20}>
          <TerminalPanel />
        </Panel>
      </PanelGroup>
    </Panel>
  </PanelGroup>
  ```
- [ ] Persist panel sizes to localStorage
- [ ] Add collapse/expand buttons
- [ ] Test: Resize panels → refresh → verify sizes persisted

#### Step 5.2: IDE App Bar & Controls
- [ ] Create IDEAppBar component:
  ```typescript
  <header className="flex items-center justify-between border-b p-2">
    <div className="flex items-center gap-4">
      <BackButton onClick={goToContributions} />
      <RepoIcon />
      <span className="font-semibold">{repositoryName}</span>
      <BranchBadge branch={currentBranch} />
    </div>

    <div className="flex items-center gap-2">
      <GitPanel />
      <Button onClick={saveAllFiles}>
        <SaveIcon /> Save All
      </Button>
      <Button onClick={closeIDE}>
        <CloseIcon />
      </Button>
    </div>
  </header>
  ```
- [ ] Add keyboard shortcuts:
  - `Ctrl+S`: Save file
  - `Ctrl+Shift+S`: Save all
  - `Ctrl+W`: Close tab
  - `Ctrl+\``: Toggle terminal focus
- [ ] Test: Click buttons → verify actions trigger

#### Step 5.3: IDE Initialization Orchestration
- [ ] Implement IDE initialization sequence:
  ```typescript
  async function initializeIDE(contribution: Contribution) {
    // 1. Load file tree
    await fileTreeStore.loadTree(contribution.localPath);

    // 2. Fetch git status
    await gitStore.fetchStatus(contribution.localPath);

    // 3. Fetch branches
    await gitStore.fetchBranches(contribution.localPath);

    // 4. Open last file (if any)
    const lastFile = localStorage.getItem(`lastFile:${contribution.id}`);
    if (lastFile) {
      await codeEditorStore.openFile(lastFile);
    }

    // 5. Initialize terminal in working directory
    terminalStore.createSession(contribution.localPath);

    // 6. Start file watcher
    ipc.fileWatcher.watch(contribution.localPath);
  }
  ```
- [ ] Show loading overlay during init
- [ ] Handle errors gracefully (corrupted repo, missing files)
- [ ] Test: Open IDE → verify all panels initialize

---

### Phase 6: Testing, Optimization & Polish (9 hours estimated)

#### Step 6.1: Component Testing
- [ ] Write tests for:
  - FileTreePanel (expand/collapse, git status)
  - CodeEditorPanel (tabs, save, modified state)
  - TerminalPanel (command execution)
  - GitPanel (commit, branch switching)
- [ ] Target: ≥80% component coverage

#### Step 6.2: Integration Testing
- [ ] Test complete workflows:
  - Open IDE → load tree → edit file → save → commit → push
  - Create file → stage → commit
  - Switch branch → verify file tree updates
  - Terminal command → verify output
- [ ] Test error scenarios:
  - Merge conflicts
  - Permission denied
  - Corrupted repository
  - Network failures (push/pull)

#### Step 6.3: Performance Optimization
- [ ] Profile file tree rendering (target: <200ms)
- [ ] Optimize Monaco Editor lazy loading
- [ ] Benchmark IPC latency for large files (target: <100ms for 1MB)
- [ ] Optimize terminal output streaming
- [ ] Test with large repository (>10,000 files)

#### Step 6.4: UI Polish
- [ ] Add loading skeletons for async operations
- [ ] Implement toast notifications for user feedback
- [ ] Add keyboard shortcut help overlay
- [ ] Ensure focus management (tab, arrow keys)
- [ ] Add tooltips for all buttons
- [ ] Test: Run axe-core accessibility audit

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `IDE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - IDE components implemented (count)
   - Features operational (file tree, editor, terminal, git)
   - Performance metrics

2. **Component Architecture**
   - IDE layout diagram
   - State management flow (stores + IPC)
   - Integration points (file watcher, git service)

3. **Feature Validation**
   - File tree: Virtualization working, git status accurate
   - Editor: Monaco working, multi-tab functional
   - Terminal: xterm.js working, commands execute
   - Git: All operations tested (commit, push, pull, branch)

4. **Performance Benchmarks**
   - File tree load time (target: ≤3.5s)
   - Monaco Editor load time
   - Terminal spawn time
   - Git status refresh time (target: ≤500ms)
   - IPC latency for file read/write

5. **Test Results**
   - Component test coverage
   - Integration test results
   - Manual testing checklist
   - Accessibility audit results

6. **Migration Complete Summary**
   - All 3 work orders complete
   - Full feature parity with Flutter
   - Performance comparison (Flutter vs Electron)
   - Known limitations
   - Future enhancements

### Evidence to Provide
- Screenshots of IDE with all panels
- Video of complete workflow (edit → commit → push)
- Performance benchmark results
- Test coverage report
- Accessibility audit results

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `IDE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY**

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003-development-ide-complete.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003-development-ide-complete.md`
   - [ ] Completion report exists in: `trinity/reports/IDE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 4: Migration Complete:**
   - [ ] Inform user that ALL 3 work orders are complete
   - [ ] Flutter → Electron migration is FINISHED
   - [ ] Ready for packaging & distribution (Phase 17 from TRA plan)

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] File tree displays with virtualization
- [ ] Git status badges appear on files
- [ ] Gitignore dimming working (40% opacity)
- [ ] Monaco Editor loads files with syntax highlighting
- [ ] Multi-tab editing functional
- [ ] File save working (Ctrl+S)
- [ ] Terminal spawns and executes commands
- [ ] xterm.js displays output correctly
- [ ] Git commit dialog functional
- [ ] Git push/pull working
- [ ] Branch switching updates file tree
- [ ] Diff viewer shows changes
- [ ] Resizable panels persist sizes
- [ ] File watcher triggers updates
- [ ] All keyboard shortcuts working
- [ ] Component tests ≥80% coverage
- [ ] Performance targets met:
  - File tree: ≤3.5 seconds
  - Git status: ≤500ms
  - IPC latency: <100ms for 1MB file
- [ ] No TypeScript errors
- [ ] Accessibility audit passes

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**Git Operations Only Allowed On:**
- ✅ The NEW `cola-records-electron/` project
- ❌ The existing `cola-records/` Flutter project (LUKA only)

### Do NOT:
- [ ] Use any type in TypeScript
- [ ] Block main thread with heavy computation
- [ ] Load entire file tree in memory (use virtualization)
- [ ] Synchronously read large files
- [ ] Skip error handling for git operations
- [ ] Hard-code file paths or shell commands

### DO:
- [ ] Use virtualization for file tree (react-window)
- [ ] Lazy load Monaco Editor models
- [ ] Stream terminal output (don't buffer)
- [ ] Debounce git status calls
- [ ] Validate all git operations (merge conflicts, network errors)
- [ ] Implement proper cleanup (PTY processes, Monaco models)
- [ ] Add comprehensive keyboard shortcuts
- [ ] Test with large repositories

---

## ROLLBACK STRATEGY

If issues arise:

1. **File Tree Performance Issues**
   - Check: Virtualization rendering
   - Check: Git status debouncing
   - Profile: React DevTools profiler
   - Rollback: Reduce max depth to 8

2. **Monaco Editor Memory Leaks**
   - Check: Model disposal on tab close
   - Check: Event listener cleanup
   - Test: Open 100 files → close all → verify memory released
   - Rollback: Limit max open tabs to 20

3. **Terminal Not Spawning**
   - Check: node-pty compiled correctly
   - Check: Shell path valid for platform
   - Test: Spawn PTY directly in main process
   - Rollback: Use child_process.exec as fallback

4. **Git Operations Failing**
   - Check: simple-git error logs
   - Check: Git executable in PATH
   - Test: Run git commands via CLI
   - Rollback: Use direct CLI spawn instead of simple-git

---

## CONTEXT FROM PREVIOUS WORK

**Prerequisites:**
- WO-MIGRATE-001 complete (All services operational)
- WO-MIGRATE-002 complete (UI foundation ready)

**Dependencies:**
- FileSystemService (file tree scanning)
- FileWatcherService (live updates)
- GitService (all git operations)
- GitIgnoreService (dimming)
- IPC architecture (all channels)
- Zustand stores (file tree, editor, terminal, git)

**Migration Reference:**
- File Tree: Flutter `FileTreePanel` behavior
- Editor: Flutter `CodeEditorPanel` with flutter_code_editor
- Terminal: Flutter `TerminalPanel` with flutter_pty
- Git: Flutter `GitPanel` with dart-lang/git

**Performance Baselines (from Flutter):**
- File tree load: 3.5 seconds
- Git status: ~100ms
- Terminal spawn: ~200ms

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The 49-hour estimate is for planning purposes only, NOT a deadline.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE (Complete VSCode-like IDE)
**Completeness Required:** 100% - All IDE features must be fully functional
**Risk Level:** VERY HIGH
**Risk Factors:**
- Most complex component of entire migration
- Monaco Editor integration can be tricky
- node-pty platform-specific compilation issues
- File tree performance critical (10,000+ files)
- Git merge conflicts must be handled gracefully
- Terminal PTY process management

**Mitigation:**
- Follow @monaco-editor/react best practices
- Test node-pty compilation on all platforms early
- Use react-window for virtualization (proven solution)
- Implement comprehensive error handling for git
- Add proper PTY cleanup on component unmount
- Profile performance continuously

---

**Remember:** This is the final and most important phase. The IDE is the core value proposition of the application. Take extra time to ensure quality, performance, and user experience are exceptional.
