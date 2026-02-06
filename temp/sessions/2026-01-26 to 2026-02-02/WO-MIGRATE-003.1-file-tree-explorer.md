# ORCHESTRATOR WORK ORDER #MIGRATE-003.1
## Type: IMPLEMENTATION
## File Tree Explorer Implementation

---

## MISSION OBJECTIVE

Implement VSCode-style file tree explorer with virtualization, git status badges, gitignore dimming, and file watcher integration. This is Phase 1 of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Create a fully functional file tree explorer that displays repository structure with git status indicators, supports expand/collapse, handles large repositories efficiently with virtualization, and updates in real-time via file watcher integration.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- FileSystemService, FileWatcherService, GitIgnoreService (existing services)

---

## IMPLEMENTATION SCOPE

### Components to Create
```yaml
src/renderer/components/ide/file-tree/:
  - FileTreePanel.tsx       # Main file tree container with virtualization
  - FileTreeNode.tsx        # Recursive tree node component
  - FileIcon.tsx            # Icon mapping by file extension
  - GitStatusBadge.tsx      # Git status indicator (M/A/D/C)

src/renderer/stores/:
  - useFileTreeStore.ts     # File tree state management (Zustand)
```

### File Tree Features
- **Virtualization**: Use react-window for performance with 10,000+ files
- **Git Status Badges**: Modified (M), Added (A), Deleted (D), Conflicted (C)
- **Gitignore Dimming**: 40% opacity for ignored files/folders
- **Context Menu**: Rename, Delete, Copy path, Reveal in Explorer
- **Live Updates**: File watcher integration for real-time changes
- **VSCode Loading Sequence**:
  1. Load bare file tree (fast display)
  2. Apply git status asynchronously
  3. Warm gitignore cache in background

---

## IMPLEMENTATION APPROACH

### Step 1: File Tree State Management (2 hours)

**Create useFileTreeStore:**
```typescript
// src/renderer/stores/useFileTreeStore.ts
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  gitStatus?: 'M' | 'A' | 'D' | 'C' | null;
  isGitIgnored?: boolean;
}

interface FileTreeStore {
  root: FileNode | null;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  gitStatus: GitStatus | null;
  gitIgnoreCache: Map<string, boolean>;
  loading: boolean;

  // Actions
  loadTree: (repoPath: string) => Promise<void>;
  toggleNode: (path: string) => void;
  selectNode: (path: string) => void;
  updateGitStatus: (status: GitStatus) => void;
  warmGitIgnoreCache: (root: FileNode, repoPath: string) => Promise<void>;
}
```

**Implementation Tasks:**
- [ ] Create Zustand store with FileTreeStore interface
- [ ] Implement loadTree() - calls FileSystemService IPC
- [ ] Implement toggleNode() - manages expandedPaths Set
- [ ] Implement selectNode() - tracks selected file
- [ ] Implement updateGitStatus() - merges git status into tree
- [ ] Implement warmGitIgnoreCache() - async gitignore check
- [ ] Test: Load tree → verify state updates correctly

---

### Step 2: File Tree Panel with Virtualization (3 hours)

**Create FileTreePanel:**
```typescript
// src/renderer/components/ide/file-tree/FileTreePanel.tsx
import { VariableSizeList } from 'react-window';

export function FileTreePanel() {
  const { root, expandedPaths, selectedPath, loadTree } = useFileTreeStore();

  // Flatten tree for virtualization
  const flattenedNodes = useMemo(() => {
    return flattenTree(root, expandedPaths);
  }, [root, expandedPaths]);

  return (
    <div className="h-full border-r">
      <VariableSizeList
        height={800}
        itemCount={flattenedNodes.length}
        itemSize={(index) => 24} // 24px per row
        width="100%"
      >
        {({ index, style }) => (
          <FileTreeNode
            node={flattenedNodes[index].node}
            depth={flattenedNodes[index].depth}
            style={style}
          />
        )}
      </VariableSizeList>
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Install react-window: `npm install react-window @types/react-window`
- [ ] Create flattenTree() utility function
- [ ] Implement VariableSizeList rendering
- [ ] Add loading skeleton while tree loads
- [ ] Handle empty state (no files)
- [ ] Test: Render 10,000 files → verify smooth scrolling

---

### Step 3: File Tree Node Component (2 hours)

**Create FileTreeNode:**
```typescript
// src/renderer/components/ide/file-tree/FileTreeNode.tsx
interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  style: React.CSSProperties;
}

export function FileTreeNode({ node, depth, style }: FileTreeNodeProps) {
  const { toggleNode, selectNode, selectedPath } = useFileTreeStore();
  const isSelected = node.path === selectedPath;
  const isDirectory = node.type === 'directory';

  return (
    <div
      style={{
        ...style,
        paddingLeft: `${depth * 16}px`,
        opacity: node.isGitIgnored ? 0.4 : 1,
      }}
      className={cn(
        "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={() => {
        if (isDirectory) toggleNode(node.path);
        selectNode(node.path);
      }}
    >
      {isDirectory && (
        <ChevronRightIcon
          className={cn(
            "h-4 w-4 transition-transform",
            expandedPaths.has(node.path) && "rotate-90"
          )}
        />
      )}
      <FileIcon extension={getExtension(node.name)} type={node.type} />
      <span className="flex-1 truncate">{node.name}</span>
      {node.gitStatus && <GitStatusBadge status={node.gitStatus} />}
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create FileTreeNode component
- [ ] Implement expand/collapse animation
- [ ] Add selected state styling
- [ ] Apply gitignore dimming (40% opacity)
- [ ] Handle click events (toggle/select)
- [ ] Test: Click directory → verify expands/collapses

---

### Step 4: File Icons & Git Status Badges (1.5 hours)

**Create FileIcon:**
```typescript
// src/renderer/components/ide/file-tree/FileIcon.tsx
const iconMap: Record<string, React.ComponentType> = {
  js: JavaScriptIcon,
  jsx: JavaScriptIcon,
  ts: TypeScriptIcon,
  tsx: TypeScriptIcon,
  py: PythonIcon,
  dart: DartIcon,
  md: MarkdownIcon,
  json: JsonIcon,
  html: HtmlIcon,
  css: CssIcon,
  // ... 50+ extensions
};

export function FileIcon({ extension, type }: Props) {
  if (type === 'directory') {
    return <FolderIcon className="h-4 w-4 text-blue-500" />;
  }

  const Icon = iconMap[extension] || FileIcon;
  return <Icon className="h-4 w-4" />;
}
```

**Create GitStatusBadge:**
```typescript
// src/renderer/components/ide/file-tree/GitStatusBadge.tsx
const statusColors = {
  M: '#E2C08D', // Modified (gold)
  A: '#73C991', // Added (green)
  D: '#C74E39', // Deleted (red)
  C: '#C74E39', // Conflicted (red)
};

export function GitStatusBadge({ status }: { status: 'M' | 'A' | 'D' | 'C' }) {
  return (
    <div
      className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
      style={{ backgroundColor: statusColors[status], color: 'white' }}
    >
      {status}
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create FileIcon with 50+ extension mappings
- [ ] Use lucide-react icons for consistency
- [ ] Create GitStatusBadge with VSCode colors
- [ ] Add folder icons (open/closed states)
- [ ] Test: Verify icons appear correctly for all types

---

### Step 5: Context Menu (1 hour)

**Add Context Menu:**
```typescript
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

// Inside FileTreeNode:
<ContextMenu>
  <ContextMenuTrigger asChild>
    {/* Existing node content */}
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => handleRename(node.path)}>
      Rename
    </ContextMenuItem>
    <ContextMenuItem onClick={() => handleDelete(node.path)}>
      Delete
    </ContextMenuItem>
    <ContextMenuItem onClick={() => handleCopyPath(node.path)}>
      Copy Path
    </ContextMenuItem>
    <ContextMenuItem onClick={() => handleRevealInExplorer(node.path)}>
      Reveal in Explorer
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Implementation Tasks:**
- [ ] Add context menu to FileTreeNode
- [ ] Implement rename functionality
- [ ] Implement delete functionality
- [ ] Implement copy path (clipboard)
- [ ] Implement reveal in OS file explorer
- [ ] Test: Right-click → verify menu appears → actions work

---

### Step 6: File Watcher Integration (1.5 hours)

**Connect File Watcher:**
```typescript
// Inside FileTreePanel useEffect:
useEffect(() => {
  if (!repoPath) return;

  const unsubscribe = ipc.on('file-watcher:change', (event) => {
    if (event.path.startsWith(repoPath)) {
      switch (event.type) {
        case 'created':
          // Add new node to tree
          addNodeToTree(event.path);
          break;
        case 'deleted':
          // Remove node from tree
          removeNodeFromTree(event.path);
          break;
        case 'modified':
          // Trigger git status refresh (debounced)
          debouncedRefreshGitStatus();
          break;
      }
    }
  });

  // Start watching
  ipc.invoke('file-watcher:watch', repoPath);

  return () => {
    unsubscribe();
    ipc.invoke('file-watcher:unwatch', repoPath);
  };
}, [repoPath]);
```

**Implementation Tasks:**
- [ ] Subscribe to file-watcher:change events
- [ ] Implement addNodeToTree() for created files
- [ ] Implement removeNodeFromTree() for deleted files
- [ ] Debounce git status refresh (500ms)
- [ ] Auto-expand parent folders for new files
- [ ] Test: Create file externally → verify appears in tree

---

### Step 7: VSCode Loading Sequence (1 hour)

**Implement Loading Orchestration:**
```typescript
async function initializeFileTree(repoPath: string) {
  // Phase 1: Load bare file tree (fast)
  setLoading(true);
  const tree = await ipc.invoke('filesystem:scan-directory', repoPath);
  setRoot(tree);
  setLoading(false);

  // Phase 2: Apply git status (async)
  const gitStatus = await ipc.invoke('git:status', repoPath);
  updateGitStatus(gitStatus);

  // Phase 3: Warm gitignore cache (async, low priority)
  warmGitIgnoreCache(tree, repoPath);
}
```

**Implementation Tasks:**
- [ ] Implement 3-phase loading sequence
- [ ] Show loading spinner only for phase 1
- [ ] Apply git status incrementally (don't block UI)
- [ ] Run gitignore cache warming in background
- [ ] Test: Verify tree appears <500ms, git status <1s

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `FILE-TREE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Components implemented
   - Features operational
   - Performance metrics

2. **Component Architecture**
   - File tree state flow diagram
   - IPC integration points
   - Virtualization implementation

3. **Feature Validation**
   - Virtualization: Tested with 10,000+ files
   - Git status: Badges accurate
   - Gitignore: Dimming working
   - File watcher: Live updates functional
   - Context menu: All actions working

4. **Performance Benchmarks**
   - File tree load time (target: <500ms for bare tree)
   - Git status application time (target: <1s)
   - Scroll performance (60fps target)
   - Memory usage with large repositories

5. **Test Results**
   - Component test coverage
   - Manual testing checklist
   - Edge case handling

### Evidence to Provide
- Screenshots of file tree with git status
- Performance benchmark results
- Test coverage report

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `FILE-TREE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003.1-file-tree-explorer.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003.1-file-tree-explorer.md`
   - [ ] Completion report exists in: `trinity/reports/FILE-TREE-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] File tree displays repository structure
- [ ] Virtualization handles 10,000+ files smoothly
- [ ] Git status badges appear (M/A/D/C)
- [ ] Gitignore dimming working (40% opacity)
- [ ] Expand/collapse animations smooth
- [ ] Context menu functional (rename, delete, copy path, reveal)
- [ ] File watcher updates tree in real-time
- [ ] VSCode loading sequence implemented (3 phases)
- [ ] Performance targets met:
  - Bare tree load: <500ms
  - Git status apply: <1s
  - Scroll: 60fps
- [ ] Component tests ≥80% coverage
- [ ] No TypeScript errors

---

## CONSTRAINTS & GUIDELINES

### Do NOT:
- [ ] Load entire tree in memory without virtualization
- [ ] Block UI thread during git status application
- [ ] Synchronously check gitignore for all files
- [ ] Skip error handling for IPC calls

### DO:
- [ ] Use react-window for virtualization
- [ ] Debounce file watcher events (500ms)
- [ ] Lazy-load git status and gitignore
- [ ] Implement proper cleanup (event listeners)
- [ ] Test with large repositories (>10,000 files)

---

## ROLLBACK STRATEGY

If issues arise:
1. **Performance Issues**: Reduce virtualization buffer, increase debounce time
2. **Memory Leaks**: Check event listener cleanup
3. **Git Status Errors**: Add error boundaries, graceful degradation

---

**Estimated Time:** 8 hours
**Priority:** HIGH (Phase 1 of 6)
**Dependencies:** FileSystemService, FileWatcherService, GitIgnoreService (must exist)
