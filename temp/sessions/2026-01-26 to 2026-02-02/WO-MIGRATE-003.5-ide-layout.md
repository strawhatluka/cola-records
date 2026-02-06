# ORCHESTRATOR WORK ORDER #MIGRATE-003.5
## Type: IMPLEMENTATION
## IDE Layout Integration

---

## MISSION OBJECTIVE

Implement resizable split view layout using react-resizable-panels, IDE app bar with controls, status bar, and initialization orchestration. Integrates all IDE components (file tree, editor, terminal, git) into cohesive layout. This is Phase 5 of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Create a professional IDE layout with resizable panels, persistent sizing, keyboard shortcuts, and orchestrated initialization sequence that brings all IDE components together.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- WO-MIGRATE-003.1 (file tree) - completed
- WO-MIGRATE-003.2 (Monaco editor) - completed
- WO-MIGRATE-003.3 (integrated terminal) - completed
- WO-MIGRATE-003.4 (git integration) - completed

---

## IMPLEMENTATION SCOPE

### Components to Create
```yaml
src/renderer/components/ide/:
  - IDELayout.tsx           # Main layout container with resizable panels
  - IDEAppBar.tsx           # Top bar with controls and git integration
  - IDEStatusBar.tsx        # Bottom status bar (line/col, branch, errors)
  - IDEInitializer.tsx      # Orchestrates IDE initialization sequence

src/renderer/stores/:
  - useIDEStore.ts          # IDE state management (panel sizes, focus)

src/renderer/hooks/:
  - useKeyboardShortcuts.ts # Global keyboard shortcuts
  - useIDEInitialization.ts # IDE initialization hook
```

### Integration Points
- **File Tree Panel** (from WO-003.1)
- **Code Editor Panel** (from WO-003.2)
- **Terminal Panel** (from WO-003.3)
- **Git Panel** (from WO-003.4)
- **Keyboard Shortcuts** (global IDE controls)
- **Panel Persistence** (localStorage for panel sizes)
- **File Watcher Integration** (auto-refresh)

---

## IMPLEMENTATION APPROACH

### Step 1: Resizable Split View (2 hours)

**Create IDELayout component:**
```typescript
// src/renderer/components/ide/IDELayout.tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileTreePanel } from './file-tree/FileTreePanel';
import { CodeEditorPanel } from './editor/CodeEditorPanel';
import { TerminalPanel } from './terminal/TerminalPanel';
import { IDEAppBar } from './IDEAppBar';
import { IDEStatusBar } from './IDEStatusBar';
import { useIDEStore } from '../stores/useIDEStore';

export function IDELayout({ contribution }: { contribution: Contribution }) {
  const { panelSizes, savePanelSizes } = useIDEStore();

  const handleLayoutChange = (sizes: number[]) => {
    savePanelSizes(sizes);
  };

  return (
    <div className="flex flex-col h-screen">
      <IDEAppBar contribution={contribution} />

      <div className="flex-1 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          onLayout={handleLayoutChange}
        >
          {/* File Tree Panel (20-40%) */}
          <Panel
            defaultSize={panelSizes.fileTree || 25}
            minSize={15}
            maxSize={40}
            id="file-tree"
          >
            <FileTreePanel repository={contribution.localPath} />
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

          {/* Editor + Terminal Panel (60-80%) */}
          <Panel defaultSize={panelSizes.main || 75}>
            <PanelGroup direction="vertical">
              {/* Code Editor (30-80%) */}
              <Panel
                defaultSize={panelSizes.editor || 60}
                minSize={30}
                id="editor"
              >
                <CodeEditorPanel />
              </Panel>

              <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

              {/* Terminal (20-70%) */}
              <Panel
                defaultSize={panelSizes.terminal || 40}
                minSize={20}
                id="terminal"
              >
                <TerminalPanel cwd={contribution.localPath} />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      <IDEStatusBar />
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create IDELayout with react-resizable-panels
- [ ] Configure horizontal split (file tree | editor+terminal)
- [ ] Configure vertical split (editor | terminal)
- [ ] Set min/max sizes for each panel
- [ ] Add resize handles with hover effects
- [ ] Test: Drag handles → verify panels resize smoothly

---

### Step 2: Panel Persistence (1 hour)

**Create useIDEStore:**
```typescript
// src/renderer/stores/useIDEStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PanelSizes {
  fileTree: number;
  main: number;
  editor: number;
  terminal: number;
}

interface IDEStore {
  panelSizes: PanelSizes;
  focusedPanel: 'file-tree' | 'editor' | 'terminal' | null;

  savePanelSizes: (sizes: number[]) => void;
  setFocusedPanel: (panel: IDEStore['focusedPanel']) => void;
  resetPanelSizes: () => void;
}

const DEFAULT_SIZES: PanelSizes = {
  fileTree: 25,
  main: 75,
  editor: 60,
  terminal: 40,
};

export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({
      panelSizes: DEFAULT_SIZES,
      focusedPanel: null,

      savePanelSizes: (sizes) =>
        set((state) => ({
          panelSizes: {
            fileTree: sizes[0] || state.panelSizes.fileTree,
            main: sizes[1] || state.panelSizes.main,
            editor: sizes[2] || state.panelSizes.editor,
            terminal: sizes[3] || state.panelSizes.terminal,
          },
        })),

      setFocusedPanel: (panel) => set({ focusedPanel: panel }),

      resetPanelSizes: () => set({ panelSizes: DEFAULT_SIZES }),
    }),
    {
      name: 'ide-store',
      partialize: (state) => ({ panelSizes: state.panelSizes }),
    }
  )
);
```

**Implementation Tasks:**
- [ ] Create useIDEStore with Zustand
- [ ] Add persist middleware for panel sizes
- [ ] Store panel sizes to localStorage on change
- [ ] Load panel sizes on mount
- [ ] Add resetPanelSizes action
- [ ] Test: Resize panels → refresh → verify sizes restored

---

### Step 3: IDE App Bar & Controls (1 hour)

**Create IDEAppBar:**
```typescript
// src/renderer/components/ide/IDEAppBar.tsx
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, X } from 'lucide-react';
import { GitPanel } from './git/GitPanel';
import { useNavigate } from 'react-router-dom';
import { useCodeEditorStore } from '../stores/useCodeEditorStore';

export function IDEAppBar({ contribution }: { contribution: Contribution }) {
  const navigate = useNavigate();
  const { saveAllFiles, hasUnsavedChanges } = useCodeEditorStore();

  const handleGoBack = () => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    navigate('/contributions');
  };

  return (
    <header className="flex items-center justify-between border-b px-4 py-2 bg-background">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-lg">
            {contribution.repository.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GitPanel repoPath={contribution.localPath} />

        <Button
          variant="outline"
          size="sm"
          onClick={saveAllFiles}
          disabled={!hasUnsavedChanges()}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save All
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          className="gap-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
```

**Create IDEStatusBar:**
```typescript
// src/renderer/components/ide/IDEStatusBar.tsx
import { useCodeEditorStore } from '../stores/useCodeEditorStore';
import { useGitStore } from '../stores/useGitStore';
import { GitBranch, AlertCircle } from 'lucide-react';

export function IDEStatusBar() {
  const { activeFile, cursorPosition } = useCodeEditorStore();
  const { currentBranch, status } = useGitStore();

  const modifiedCount = status?.modified.length || 0;

  return (
    <footer className="flex items-center justify-between border-t px-4 py-1 bg-muted/50 text-xs">
      <div className="flex items-center gap-4">
        {activeFile && (
          <>
            <span className="text-muted-foreground">
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
            <span className="text-muted-foreground">|</span>
            <span>{activeFile.language}</span>
            <span className="text-muted-foreground">|</span>
            <span>UTF-8</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {modifiedCount > 0 && (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-3 w-3" />
            <span>{modifiedCount} unsaved</span>
          </div>
        )}

        {currentBranch && (
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{currentBranch}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
```

**Implementation Tasks:**
- [ ] Create IDEAppBar with back button, repo name, git panel, save all
- [ ] Confirm before leaving with unsaved changes
- [ ] Create IDEStatusBar with line/col, language, git branch, modified count
- [ ] Update cursor position on editor selection change
- [ ] Test: Click buttons → verify actions trigger

---

### Step 4: Keyboard Shortcuts (1 hour)

**Create useKeyboardShortcuts hook:**
```typescript
// src/renderer/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useCodeEditorStore } from '../stores/useCodeEditorStore';
import { useIDEStore } from '../stores/useIDEStore';

export function useKeyboardShortcuts() {
  const { saveActiveFile, saveAllFiles, closeActiveFile } = useCodeEditorStore();
  const { setFocusedPanel, focusedPanel } = useIDEStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save active file
      if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        saveActiveFile();
        return;
      }

      // Ctrl+Shift+S: Save all files
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveAllFiles();
        return;
      }

      // Ctrl+W: Close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        closeActiveFile();
        return;
      }

      // Ctrl+`: Toggle terminal focus
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        const newFocus = focusedPanel === 'terminal' ? 'editor' : 'terminal';
        setFocusedPanel(newFocus);
        return;
      }

      // Ctrl+B: Toggle file tree
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        // Toggle file tree visibility
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPanel]);
}
```

**Implementation Tasks:**
- [ ] Create useKeyboardShortcuts hook
- [ ] Implement Ctrl+S (save file)
- [ ] Implement Ctrl+Shift+S (save all)
- [ ] Implement Ctrl+W (close tab)
- [ ] Implement Ctrl+` (toggle terminal focus)
- [ ] Implement Ctrl+B (toggle file tree)
- [ ] Prevent default browser shortcuts
- [ ] Test: Press shortcuts → verify actions trigger

---

### Step 5: IDE Initialization Orchestration (30 minutes)

**Create useIDEInitialization hook:**
```typescript
// src/renderer/hooks/useIDEInitialization.ts
import { useEffect, useState } from 'react';
import { useFileTreeStore } from '../stores/useFileTreeStore';
import { useGitStore } from '../stores/useGitStore';
import { useCodeEditorStore } from '../stores/useCodeEditorStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { ipc } from '../ipc/client';

export function useIDEInitialization(contribution: Contribution) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { loadTree } = useFileTreeStore();
  const { fetchStatus, fetchBranches } = useGitStore();
  const { openFile } = useCodeEditorStore();
  const { createSession } = useTerminalStore();

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        // 1. Load file tree
        await loadTree(contribution.localPath);

        // 2. Fetch git status
        await fetchStatus(contribution.localPath);

        // 3. Fetch branches
        await fetchBranches(contribution.localPath);

        // 4. Open last file (if any)
        const lastFile = localStorage.getItem(
          `lastFile:${contribution.id}`
        );
        if (lastFile) {
          await openFile(lastFile);
        }

        // 5. Initialize terminal in working directory
        await createSession(contribution.localPath);

        // 6. Start file watcher
        await ipc.invoke('file-watcher:watch', contribution.localPath);

        setLoading(false);
      } catch (err) {
        console.error('IDE initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    initialize();
  }, [contribution.id]);

  return { loading, error };
}
```

**Create IDEInitializer wrapper:**
```typescript
// src/renderer/components/ide/IDEInitializer.tsx
import { useIDEInitialization } from '../../hooks/useIDEInitialization';
import { IDELayout } from './IDELayout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function IDEInitializer({ contribution }: { contribution: Contribution }) {
  const { loading, error } = useIDEInitialization(contribution);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Initializing IDE...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to initialize IDE: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <IDELayout contribution={contribution} />;
}
```

**Implementation Tasks:**
- [ ] Create useIDEInitialization hook
- [ ] Orchestrate initialization sequence (file tree → git → terminal → file watcher)
- [ ] Create IDEInitializer wrapper component
- [ ] Show loading spinner during initialization
- [ ] Handle initialization errors gracefully
- [ ] Restore last opened file from localStorage
- [ ] Test: Open IDE → verify all panels initialize correctly

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `IDE-LAYOUT-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - IDE layout complete, all panels integrated
2. **Components Created** - IDELayout, IDEAppBar, IDEStatusBar, IDEInitializer
3. **Features Implemented** - Resizable panels, keyboard shortcuts, initialization
4. **Integration Testing** - All 4 IDE components working together
5. **Performance Metrics** - Initialization time, panel resize performance
6. **Next Steps** - Move to WO-MIGRATE-003.6 (Testing & Polish)

### Evidence to Provide
- Screenshot of complete IDE with all panels
- Video of panel resizing and persistence
- Keyboard shortcuts working (Ctrl+S, Ctrl+W, etc.)
- Initialization sequence timing
- Test results for all keyboard shortcuts

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `IDE-LAYOUT-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit report generated automatically (if applicable)
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003.5-ide-layout.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003.5-ide-layout.md`
   - [ ] Completion report exists in: `trinity/reports/IDE-LAYOUT-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion report → `trinity/archive/reports/YYYY-MM-DD/`
- JUNO audit report → `trinity/archive/reports/YYYY-MM-DD/` (if applicable)
- Session summary → `trinity/archive/sessions/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

- [ ] IDELayout component renders with all 4 panels
- [ ] File tree panel resizable (15-40%)
- [ ] Editor panel resizable (30-80% of right section)
- [ ] Terminal panel resizable (20-70% of right section)
- [ ] Panel sizes persist across refreshes
- [ ] IDEAppBar shows back button, repo name, git panel, save all
- [ ] IDEStatusBar shows line/col, language, git branch, modified count
- [ ] Keyboard shortcuts working (Ctrl+S, Ctrl+Shift+S, Ctrl+W, Ctrl+`)
- [ ] IDE initialization sequence completes in <3 seconds
- [ ] Loading spinner shown during initialization
- [ ] Error handling for corrupted repos/missing files
- [ ] All keyboard shortcuts tested and working
- [ ] Component tests ≥80% coverage
- [ ] No TypeScript errors

---

**Estimated Time:** 5.5 hours
**Priority:** HIGH (Phase 5 of 6)
**Dependencies:** WO-MIGRATE-003.1, WO-MIGRATE-003.2, WO-MIGRATE-003.3, WO-MIGRATE-003.4

