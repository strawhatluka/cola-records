# ORCHESTRATOR WORK ORDER #MIGRATE-003.4
## Type: IMPLEMENTATION
## Git Integration Panel Implementation

---

## MISSION OBJECTIVE

Implement complete git operations panel with commit dialog, diff viewer, branch management, and auto-refresh integration. This is Phase 4 of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Create a comprehensive git integration panel that provides full git workflow capabilities including staging files, committing changes, pushing/pulling, branch management, diff viewing, and automatic status refresh after file saves.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- GitService (existing service for git operations)
- WO-MIGRATE-003.2 complete (editor save triggers git refresh)

---

## IMPLEMENTATION SCOPE

### Components to Create
```yaml
src/renderer/components/ide/git/:
  - GitPanel.tsx            # Git dropdown panel in IDE app bar
  - GitCommitDialog.tsx     # Commit UI with file selection
  - GitDiffViewer.tsx       # Side-by-side diff viewer
  - BranchPicker.tsx        # Branch selector and creator
  - GitStatusSummary.tsx    # Modified/staged/untracked counts
  - GitQuickActions.tsx     # Commit, push, pull, refresh buttons

src/renderer/stores/:
  - useGitStore.ts          # Git state management (Zustand)
```

### Git Features
- **Status Summary**: Modified, staged, untracked file counts
- **Commit Dialog**: Stage files, write message, commit
- **Push/Pull**: Remote synchronization
- **Branch Management**: Switch branches, create new branches
- **Diff Viewer**: Side-by-side diff with syntax highlighting
- **Auto-Refresh**: Debounced git status refresh after file saves
- **Visual Feedback**: Loading states, success/error toasts

---

## IMPLEMENTATION APPROACH

### Step 1: Git State Management (2 hours)

**Create useGitStore:**
```typescript
// src/renderer/stores/useGitStore.ts
interface GitStore {
  status: GitStatus | null;
  branches: string[];
  currentBranch: string | null;
  loading: boolean;
  lastRefresh: Date | null;

  // Actions
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
  refreshStatus: (repoPath: string) => Promise<void>; // Debounced
}
```

**Implementation Tasks:**
- [ ] Create Zustand store with GitStore interface
- [ ] Implement fetchStatus() - calls GitService IPC
- [ ] Implement fetchBranches() - gets all branches
- [ ] Implement commit() - stages and commits files
- [ ] Implement push/pull() - remote sync operations
- [ ] Implement switchBranch() - checkout branch
- [ ] Implement createBranch() - create new branch
- [ ] Implement stageFiles/unstageFiles() - staging control
- [ ] Implement fetchDiff() - get file diff
- [ ] Add debounced refreshStatus() (500ms delay)
- [ ] Test: Modify file → save → verify status refreshes

---

### Step 2: Git Panel Component (2 hours)

**Create GitPanel dropdown:**
```typescript
// src/renderer/components/ide/git/GitPanel.tsx
export function GitPanel({ repoPath }: { repoPath: string }) {
  const { status, currentBranch, fetchStatus, fetchBranches } = useGitStore();
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  const modifiedCount = status?.modified.length || 0;
  const stagedCount = status?.staged.length || 0;

  useEffect(() => {
    if (repoPath) {
      fetchStatus(repoPath);
      fetchBranches(repoPath);
    }
  }, [repoPath]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <GitBranchIcon className="h-4 w-4 mr-2" />
            {currentBranch || 'main'}
            {modifiedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {modifiedCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-80">
          <div className="p-4 space-y-4">
            <GitStatusSummary status={status} />
            <Separator />
            <GitQuickActions
              repoPath={repoPath}
              onCommit={() => setShowCommitDialog(true)}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <GitCommitDialog
        open={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        repoPath={repoPath}
      />
    </>
  );
}
```

**Implementation Tasks:**
- [ ] Create GitPanel dropdown component
- [ ] Show current branch in trigger button
- [ ] Show modified files count badge
- [ ] Fetch git status on mount
- [ ] Fetch branches on mount
- [ ] Test: Open panel → verify status displays

---

### Step 3: Git Commit Dialog (2.5 hours)

**Create GitCommitDialog:**
```typescript
// src/renderer/components/ide/git/GitCommitDialog.tsx
export function GitCommitDialog({ open, onClose, repoPath }: Props) {
  const { status, commit } = useGitStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const allFiles = [
    ...(status?.modified || []),
    ...(status?.untracked || []),
  ];

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Commit message is required');
      return;
    }

    if (selectedFiles.size === 0) {
      toast.error('Select at least one file to commit');
      return;
    }

    try {
      await commit(repoPath, commitMessage, Array.from(selectedFiles));
      toast.success('Changes committed successfully');
      setCommitMessage('');
      setSelectedFiles(new Set());
      onClose();
    } catch (error) {
      toast.error(`Commit failed: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            rows={4}
            className="font-mono"
          />

          <div className="border rounded p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Files ({allFiles.length})</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (selectedFiles.size === allFiles.length) {
                    setSelectedFiles(new Set());
                  } else {
                    setSelectedFiles(new Set(allFiles));
                  }
                }}
              >
                {selectedFiles.size === allFiles.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {allFiles.map((file) => (
              <div
                key={file}
                className="flex items-center gap-2 py-1 hover:bg-accent rounded px-2"
              >
                <Checkbox
                  checked={selectedFiles.has(file)}
                  onCheckedChange={(checked) => {
                    const newSelected = new Set(selectedFiles);
                    if (checked) {
                      newSelected.add(file);
                    } else {
                      newSelected.delete(file);
                    }
                    setSelectedFiles(newSelected);
                  }}
                />
                <span className="text-sm font-mono flex-1">{file}</span>
                <GitStatusBadge status={getFileStatus(file, status)} />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCommit}>Commit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Implementation Tasks:**
- [ ] Create GitCommitDialog component
- [ ] Add commit message textarea
- [ ] List all modified/untracked files with checkboxes
- [ ] Add select/deselect all button
- [ ] Validate commit message not empty
- [ ] Validate at least one file selected
- [ ] Show git status badges on files
- [ ] Call commit() action on submit
- [ ] Test: Select files → write message → commit → verify success

---

### Step 4: Branch Management (2 hours)

**Create BranchPicker:**
```typescript
// src/renderer/components/ide/git/BranchPicker.tsx
export function BranchPicker({ repoPath }: { repoPath: string }) {
  const { branches, currentBranch, switchBranch, createBranch } = useGitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);

  const filteredBranches = branches.filter((branch) =>
    branch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSwitchBranch = async (branch: string) => {
    try {
      await switchBranch(repoPath, branch);
      toast.success(`Switched to branch: ${branch}`);
    } catch (error) {
      toast.error(`Failed to switch branch: ${error.message}`);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      await createBranch(repoPath, newBranchName);
      toast.success(`Created branch: ${newBranchName}`);
      setNewBranchName('');
      setShowCreateBranch(false);
    } catch (error) {
      toast.error(`Failed to create branch: ${error.message}`);
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch Branch</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search branches..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filteredBranches.map((branch) => (
            <div
              key={branch}
              className={cn(
                "p-2 rounded cursor-pointer hover:bg-accent",
                branch === currentBranch && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleSwitchBranch(branch)}
            >
              {branch}
            </div>
          ))}
        </div>

        <Separator />

        {!showCreateBranch ? (
          <Button onClick={() => setShowCreateBranch(true)}>
            New Branch
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Branch name..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <Button onClick={handleCreateBranch}>Create</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Implementation Tasks:**
- [ ] Create BranchPicker component
- [ ] Show current branch highlighted
- [ ] Add search/filter functionality
- [ ] Implement branch switching
- [ ] Implement branch creation
- [ ] Confirm before switching if uncommitted changes
- [ ] Test: Switch branch → create branch → verify works

---

### Step 5: Auto-Refresh Integration (1.5 hours)

**Connect to file save events:**
```typescript
// Inside GitPanel or IDE component
useEffect(() => {
  const { refreshStatus } = useGitStore.getState();

  // Subscribe to file save events from code editor
  const unsubscribe = useCodeEditorStore.subscribe(
    (state) => state.modifiedFiles,
    (modifiedFiles, prevModifiedFiles) => {
      // If files were saved (modified count decreased)
      if (modifiedFiles.size < prevModifiedFiles.size) {
        // Debounced refresh
        debouncedRefreshGitStatus(repoPath);
      }
    }
  );

  return unsubscribe;
}, [repoPath]);
```

**Implementation Tasks:**
- [ ] Subscribe to code editor save events
- [ ] Trigger debounced git status refresh (500ms)
- [ ] Subscribe to file watcher events
- [ ] Refresh git status when files change externally
- [ ] Update file tree git badges after refresh
- [ ] Test: Save 5 files → verify single git refresh call

---

### Step 6: Git Diff Viewer (1 hour)

**Create GitDiffViewer:**
```typescript
// src/renderer/components/ide/git/GitDiffViewer.tsx
export function GitDiffViewer({ filePath, repoPath }: Props) {
  const { fetchDiff } = useGitStore();
  const [diff, setDiff] = useState<string>('');

  useEffect(() => {
    fetchDiff(repoPath, filePath).then(setDiff);
  }, [filePath, repoPath]);

  const parsedDiff = parseDiffString(diff);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{filePath}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 overflow-auto">
          <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded">
            <h4 className="font-semibold mb-2">Original</h4>
            <pre className="text-sm font-mono">{parsedDiff.old}</pre>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded">
            <h4 className="font-semibold mb-2">Modified</h4>
            <pre className="text-sm font-mono">{parsedDiff.new}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Implementation Tasks:**
- [ ] Create GitDiffViewer component
- [ ] Fetch diff from GitService
- [ ] Parse diff output (old vs new)
- [ ] Show side-by-side comparison
- [ ] Highlight changed lines
- [ ] Add line numbers
- [ ] Test: Modify file → view diff → verify accurate

---

## SUCCESS CRITERIA

- [ ] Git panel shows current branch and modified count
- [ ] Commit dialog functional (select files, write message, commit)
- [ ] Push/pull operations work
- [ ] Branch switching updates file tree
- [ ] Branch creation functional
- [ ] Diff viewer shows changes accurately
- [ ] Auto-refresh after file save working (debounced 500ms)
- [ ] All git operations show loading states
- [ ] Success/error toasts display
- [ ] Component tests ≥80% coverage
- [ ] No TypeScript errors

---

**Estimated Time:** 9 hours
**Priority:** HIGH (Phase 4 of 6)
**Dependencies:** GitService, WO-MIGRATE-003.1 (file tree), WO-MIGRATE-003.2 (editor save events)
