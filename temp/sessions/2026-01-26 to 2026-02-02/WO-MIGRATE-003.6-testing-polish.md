# ORCHESTRATOR WORK ORDER #MIGRATE-003.6
## Type: IMPLEMENTATION
## Testing, Optimization & Polish

---

## MISSION OBJECTIVE

Complete comprehensive testing (component ≥80% coverage, integration tests), performance optimization, UI polish (loading skeletons, tooltips, focus management), and accessibility audit for the complete IDE implementation. This is Phase 6 (FINAL) of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Ensure the IDE is production-ready with comprehensive test coverage, excellent performance, polished UI, and full accessibility compliance. Final validation that all IDE features work together seamlessly.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- WO-MIGRATE-003.1 (file tree) - completed
- WO-MIGRATE-003.2 (Monaco editor) - completed
- WO-MIGRATE-003.3 (integrated terminal) - completed
- WO-MIGRATE-003.4 (git integration) - completed
- WO-MIGRATE-003.5 (IDE layout) - completed

---

## IMPLEMENTATION SCOPE

### Test Files to Create
```yaml
src/__tests__/components/ide/:
  - FileTreePanel.test.tsx       # File tree component tests
  - CodeEditorPanel.test.tsx     # Editor component tests
  - TerminalPanel.test.tsx       # Terminal component tests
  - GitPanel.test.tsx            # Git panel component tests
  - IDELayout.test.tsx           # Layout component tests

src/__tests__/integration/:
  - ide-workflow.test.ts         # Complete IDE workflows
  - git-operations.test.ts       # Git commit/push/pull/branch
  - file-operations.test.ts      # Create/edit/save/delete files
  - terminal-execution.test.ts   # Terminal command execution

src/__tests__/performance/:
  - file-tree-benchmark.test.ts  # Large repository loading
  - monaco-loading.test.ts       # Monaco Editor lazy loading
  - ipc-latency.test.ts          # IPC communication benchmarks
```

### Optimization Targets
- **File Tree Load**: <3.5 seconds for 10,000+ files
- **Monaco Editor Load**: <500ms first load, <100ms subsequent
- **Terminal Spawn**: <200ms
- **Git Status Refresh**: <500ms
- **IPC File Read**: <100ms for 1MB files

### UI Polish Additions
- Loading skeletons for all async operations
- Toast notifications for user feedback
- Tooltips for all buttons and actions
- Keyboard shortcut help overlay
- Focus management (tab, arrow keys)
- Accessibility attributes (ARIA labels, roles)

---

## IMPLEMENTATION APPROACH

### Step 1: Component Testing (2.5 hours)

**Create FileTreePanel tests:**
```typescript
// src/__tests__/components/ide/FileTreePanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FileTreePanel } from '../../../renderer/components/ide/file-tree/FileTreePanel';
import userEvent from '@testing-library/user-event';

vi.mock('../../../renderer/ipc/client');
import { ipc } from '../../../renderer/ipc/client';

describe('FileTreePanel', () => {
  it('should load and display file tree', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce([
      { name: 'src', type: 'directory', children: [] },
      { name: 'README.md', type: 'file' },
    ]);

    render(<FileTreePanel repository="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
  });

  it('should expand and collapse directories', async () => {
    const user = userEvent.setup();
    vi.mocked(ipc.invoke).mockResolvedValueOnce([
      {
        name: 'src',
        type: 'directory',
        children: [{ name: 'index.ts', type: 'file' }],
      },
    ]);

    render(<FileTreePanel repository="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Initially collapsed
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('src'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText('src'));
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });

  it('should show git status badges', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce([
      { name: 'modified.ts', type: 'file', gitStatus: 'M' },
      { name: 'added.ts', type: 'file', gitStatus: 'A' },
    ]);

    const { container } = render(<FileTreePanel repository="/test/repo" />);

    await waitFor(() => {
      const badges = container.querySelectorAll('[data-git-status]');
      expect(badges.length).toBe(2);
    });
  });

  it('should handle context menu actions', async () => {
    const user = userEvent.setup();
    vi.mocked(ipc.invoke).mockResolvedValueOnce([
      { name: 'test.ts', type: 'file' },
    ]);

    render(<FileTreePanel repository="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('test.ts')).toBeInTheDocument();
    });

    // Right-click for context menu
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByText('test.ts'),
    });

    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
  });
});
```

**Create CodeEditorPanel tests:**
```typescript
// src/__tests__/components/ide/CodeEditorPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CodeEditorPanel } from '../../../renderer/components/ide/editor/CodeEditorPanel';
import userEvent from '@testing-library/user-event';

describe('CodeEditorPanel', () => {
  it('should open files in tabs', async () => {
    const { getByText } = render(<CodeEditorPanel />);

    // Simulate opening a file
    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/index.ts');

    await waitFor(() => {
      expect(getByText('index.ts')).toBeInTheDocument();
    });
  });

  it('should show modified indicator on unsaved changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeEditorPanel />);

    // Open file and make changes
    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/test.ts');
    updateContent('// Modified content');

    await waitFor(() => {
      const modifiedIndicator = container.querySelector('[data-modified="true"]');
      expect(modifiedIndicator).toBeInTheDocument();
    });
  });

  it('should save file with Ctrl+S', async () => {
    const user = userEvent.setup();
    vi.mocked(ipc.invoke).mockResolvedValueOnce(undefined);

    render(<CodeEditorPanel />);

    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/test.ts');
    updateContent('// New content');

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'file:write',
        '/test/repo/src/test.ts',
        '// New content'
      );
    });
  });

  it('should close tab with Ctrl+W', async () => {
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/index.ts');

    await waitFor(() => {
      expect(getByText('index.ts')).toBeInTheDocument();
    });

    await user.keyboard('{Control>}w{/Control}');

    await waitFor(() => {
      expect(queryByText('index.ts')).not.toBeInTheDocument();
    });
  });
});
```

**Create TerminalPanel tests:**
```typescript
// src/__tests__/components/ide/TerminalPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalPanel } from '../../../renderer/components/ide/terminal/TerminalPanel';

describe('TerminalPanel', () => {
  it('should spawn terminal session', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce('session-123');

    render(<TerminalPanel cwd="/test/repo" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'terminal:spawn',
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });
  });

  it('should execute commands and show output', async () => {
    const { container } = render(<TerminalPanel cwd="/test/repo" />);

    // Simulate command execution
    const { sessions } = useTerminalStore.getState();
    const sessionId = sessions.keys().next().value;

    // Simulate output from main process
    window.electronAPI.emit('terminal:data', {
      sessionId,
      data: 'Hello from terminal\n',
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Hello from terminal');
    });
  });

  it('should handle terminal resize', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce(undefined);

    render(<TerminalPanel cwd="/test/repo" />);

    // Simulate resize
    const { sessions } = useTerminalStore.getState();
    const sessionId = sessions.keys().next().value;

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'terminal:resize',
        sessionId,
        expect.any(Number),
        expect.any(Number)
      );
    });
  });
});
```

**Create GitPanel tests:**
```typescript
// src/__tests__/components/ide/GitPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GitPanel } from '../../../renderer/components/ide/git/GitPanel';
import userEvent from '@testing-library/user-event';

describe('GitPanel', () => {
  it('should show git status summary', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce({
      modified: ['file1.ts', 'file2.ts'],
      staged: ['file3.ts'],
      untracked: ['file4.ts'],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/2.*modified/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*staged/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*untracked/i)).toBeInTheDocument();
    });
  });

  it('should open commit dialog', async () => {
    const user = userEvent.setup();
    render(<GitPanel repoPath="/test/repo" />);

    const commitButton = screen.getByRole('button', { name: /commit/i });
    await user.click(commitButton);

    await waitFor(() => {
      expect(screen.getByText('Commit Changes')).toBeInTheDocument();
    });
  });

  it('should commit changes', async () => {
    const user = userEvent.setup();
    vi.mocked(ipc.invoke).mockResolvedValueOnce(undefined);

    render(<GitPanel repoPath="/test/repo" />);

    // Open commit dialog
    await user.click(screen.getByRole('button', { name: /commit/i }));

    // Enter commit message
    const messageInput = screen.getByPlaceholderText(/commit message/i);
    await user.type(messageInput, 'Test commit');

    // Select files
    const checkbox = screen.getByRole('checkbox', { name: /file1.ts/i });
    await user.click(checkbox);

    // Submit
    await user.click(screen.getByRole('button', { name: /commit/i }));

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'git:commit',
        '/test/repo',
        'Test commit',
        ['file1.ts']
      );
    });
  });
});
```

**Implementation Tasks:**
- [ ] Write FileTreePanel tests (expand/collapse, git status, context menu)
- [ ] Write CodeEditorPanel tests (tabs, save, modified state, keyboard shortcuts)
- [ ] Write TerminalPanel tests (spawn, execute commands, output, resize)
- [ ] Write GitPanel tests (status, commit, push, pull, branch switching)
- [ ] Write IDELayout tests (panel resizing, persistence)
- [ ] Target: ≥80% component coverage
- [ ] Test: Run `npm run test:coverage` → verify coverage ≥80%

---

### Step 2: Integration Testing (2 hours)

**Create complete IDE workflow tests:**
```typescript
// src/__tests__/integration/ide-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderApp, cleanup } from '../test-utils';
import userEvent from '@testing-library/user-event';

describe('IDE Complete Workflow', () => {
  beforeEach(() => {
    // Setup test repository
  });

  afterEach(() => {
    cleanup();
  });

  it('should complete full workflow: load → edit → save → commit → push', async () => {
    const user = userEvent.setup();

    // 1. Initialize IDE
    const { getByText, getByPlaceholderText } = renderApp({
      route: '/ide/test-contribution',
    });

    // Wait for file tree to load
    await waitFor(() => {
      expect(getByText('src')).toBeInTheDocument();
    });

    // 2. Open file from tree
    await user.click(getByText('src'));
    await user.click(getByText('index.ts'));

    // Wait for editor to load
    await waitFor(() => {
      expect(getByText('index.ts')).toBeInTheDocument(); // Tab
    });

    // 3. Edit file
    const editor = document.querySelector('.monaco-editor');
    expect(editor).toBeInTheDocument();
    // Simulate Monaco edit...

    // 4. Save file (Ctrl+S)
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'file:write',
        expect.stringContaining('index.ts'),
        expect.any(String)
      );
    });

    // 5. Open git panel
    await user.click(getByText(/main/i)); // Branch button

    // 6. Commit changes
    await user.click(getByText(/commit/i));
    await user.type(
      getByPlaceholderText(/commit message/i),
      'Test commit'
    );
    await user.click(getByText('Commit'));

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'git:commit',
        expect.any(String),
        'Test commit',
        expect.any(Array)
      );
    });

    // 7. Push changes
    await user.click(getByText(/push/i));

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith(
        'git:push',
        expect.any(String),
        'origin',
        'main'
      );
    });
  });

  it('should handle branch switching with uncommitted changes', async () => {
    const user = userEvent.setup();
    const { getByText } = renderApp({ route: '/ide/test-contribution' });

    // Make uncommitted changes
    // ... edit file without saving ...

    // Try to switch branch
    await user.click(getByText(/main/i));
    await user.click(getByText(/switch branch/i));
    await user.click(getByText(/feature-branch/i));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(getByText(/uncommitted changes/i)).toBeInTheDocument();
    });
  });
});
```

**Create git operations integration tests:**
```typescript
// src/__tests__/integration/git-operations.test.ts
import { describe, it, expect } from 'vitest';

describe('Git Operations Integration', () => {
  it('should commit, push, pull, and switch branches', async () => {
    // Full git workflow integration test
  });

  it('should handle merge conflicts', async () => {
    // Test merge conflict resolution UI
  });

  it('should refresh git status after file save', async () => {
    // Test auto-refresh after save (debounced)
  });
});
```

**Implementation Tasks:**
- [ ] Create ide-workflow.test.ts (complete workflow: edit → save → commit → push)
- [ ] Create git-operations.test.ts (commit, branch, merge conflicts)
- [ ] Create file-operations.test.ts (create, edit, save, delete)
- [ ] Create terminal-execution.test.ts (command execution, output capture)
- [ ] Test error scenarios (permission denied, corrupted repo, network failures)
- [ ] Test: Run integration tests → verify all workflows pass

---

### Step 3: Performance Optimization (2 hours)

**Create performance benchmarks:**
```typescript
// src/__tests__/performance/file-tree-benchmark.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('File Tree Performance', () => {
  it('should load 10,000+ files in <3.5s', async () => {
    const start = performance.now();

    await fileTreeStore.loadTree('/large/repo'); // 10,000+ files

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(3500); // 3.5 seconds
  });

  it('should render virtualized list efficiently', async () => {
    // Benchmark react-window rendering performance
  });
});
```

**Optimization targets:**
```yaml
Performance Benchmarks:
  - File tree load (10,000 files): <3.5s ✅ Target
  - Monaco Editor first load: <500ms ✅ Target
  - Monaco Editor subsequent: <100ms ✅ Target
  - Terminal spawn: <200ms ✅ Target
  - Git status refresh: <500ms ✅ Target
  - IPC file read (1MB): <100ms ✅ Target
```

**Implementation Tasks:**
- [ ] Profile file tree rendering with 10,000+ files
- [ ] Optimize Monaco Editor lazy loading (code splitting)
- [ ] Benchmark IPC latency for large files
- [ ] Optimize terminal output streaming (chunking)
- [ ] Profile git status refresh performance
- [ ] Create performance benchmarks for all operations
- [ ] Test: Run benchmarks → verify all targets met

---

### Step 4: UI Polish (1.5 hours)

**Add loading skeletons:**
```typescript
// src/renderer/components/ide/file-tree/FileTreeSkeleton.tsx
export function FileTreeSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
```

**Add toast notifications:**
```typescript
// src/renderer/components/ide/git/GitPanel.tsx
import { toast } from 'sonner';

const handleCommit = async () => {
  try {
    await commit(repoPath, message, files);
    toast.success('Changes committed successfully');
  } catch (error) {
    toast.error(`Commit failed: ${error.message}`);
  }
};
```

**Add keyboard shortcut help:**
```typescript
// src/renderer/components/ide/KeyboardShortcutsHelp.tsx
export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>Keyboard Shortcuts</DialogHeader>
        <div className="space-y-2">
          <ShortcutRow keys="Ctrl+S" action="Save file" />
          <ShortcutRow keys="Ctrl+Shift+S" action="Save all files" />
          <ShortcutRow keys="Ctrl+W" action="Close tab" />
          <ShortcutRow keys="Ctrl+`" action="Toggle terminal focus" />
          <ShortcutRow keys="Ctrl+B" action="Toggle file tree" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Implementation Tasks:**
- [ ] Add loading skeletons for file tree, editor, terminal, git panel
- [ ] Add toast notifications for all git operations (success/error)
- [ ] Add tooltips for all buttons and controls
- [ ] Create keyboard shortcut help overlay (Ctrl+?)
- [ ] Ensure focus management (tab navigation, arrow keys in tree)
- [ ] Add ARIA labels and roles for accessibility
- [ ] Test: Tab through UI → verify focus order logical

---

### Step 5: Accessibility Audit (1 hour)

**Run axe-core audit:**
```typescript
// src/__tests__/accessibility/ide-a11y.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('IDE Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<IDELayout contribution={mockContribution} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', async () => {
    // Test keyboard-only navigation through entire IDE
  });

  it('should have proper ARIA labels', async () => {
    const { getByRole } = render(<IDELayout contribution={mockContribution} />);
    expect(getByRole('tree')).toBeInTheDocument(); // File tree
    expect(getByRole('tablist')).toBeInTheDocument(); // Editor tabs
    expect(getByRole('button', { name: /commit/i })).toBeInTheDocument();
  });
});
```

**Accessibility checklist:**
- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA labels and roles
- [ ] Focus indicators visible
- [ ] Color contrast ratios meet WCAG AA
- [ ] Screen reader announcements for state changes
- [ ] Skip links for keyboard navigation
- [ ] No accessibility violations in axe-core audit

**Implementation Tasks:**
- [ ] Add ARIA labels to file tree (role="tree", role="treeitem")
- [ ] Add ARIA labels to editor tabs (role="tablist", role="tab")
- [ ] Add ARIA labels to git panel (role="menu", role="menuitem")
- [ ] Add ARIA labels to terminal (role="log", aria-live="polite")
- [ ] Ensure focus indicators visible on all interactive elements
- [ ] Run axe-core accessibility audit
- [ ] Fix all accessibility violations
- [ ] Test: Navigate IDE with keyboard only → verify fully accessible

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `IDE-TESTING-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Test coverage achieved (component, integration)
   - Performance benchmarks met
   - UI polish complete
   - Accessibility compliance verified

2. **Test Results**
   - Component test coverage (≥80% target)
   - Integration test results (all workflows passing)
   - Performance benchmark results
   - Accessibility audit results (0 violations)

3. **Performance Metrics**
   - File tree load: X ms (target: <3500ms)
   - Monaco Editor load: X ms (target: <500ms)
   - Terminal spawn: X ms (target: <200ms)
   - Git status refresh: X ms (target: <500ms)
   - IPC file read (1MB): X ms (target: <100ms)

4. **UI Polish Validation**
   - Loading skeletons implemented (screenshots)
   - Toast notifications working (success/error)
   - Tooltips added to all buttons
   - Keyboard shortcuts help overlay functional
   - Focus management working

5. **WO-MIGRATE-003 COMPLETE Summary**
   - All 6 phases complete (3.1 - 3.6)
   - 49 hours of work completed
   - Full IDE implementation validated
   - Production-ready status confirmed

### Evidence to Provide
- Test coverage report (≥80%)
- Performance benchmark results (all targets met)
- Accessibility audit report (0 violations)
- Screenshots of UI polish (skeletons, toasts, tooltips)
- Video of complete IDE workflow (edit → commit → push)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `IDE-TESTING-COMPLETE-[TIMESTAMP].md`
   - [ ] JUNO audit report generated automatically (if applicable)
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003.6-testing-polish.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003.6-testing-polish.md`
   - [ ] Completion report exists in: `trinity/reports/IDE-TESTING-COMPLETE-[TIMESTAMP].md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: 🚨 MOVE PARENT WORK ORDER 🚨** ✅
   - [ ] **MOVE** parent work order from `trinity/work-orders/WO-MIGRATE-003-development-ide-complete.md` to `trinity/sessions/`
   - [ ] This marks the ENTIRE WO-MIGRATE-003 work order chain as complete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003-development-ide-complete.md trinity/sessions/
   ```

**Step 5: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`
   - [ ] Next session starts with empty sessions/ and reports/ folders

**Archive Destination (via trinity-end):**
- Work orders → `trinity/archive/work-orders/YYYY-MM-DD/`
- Completion reports → `trinity/archive/reports/YYYY-MM-DD/`
- JUNO audit reports → `trinity/archive/reports/YYYY-MM-DD/` (if applicable)
- Session summary → `trinity/archive/sessions/YYYY-MM-DD/`

---

## SUCCESS CRITERIA

**Testing:**
- [ ] Component test coverage ≥80%
- [ ] All component tests passing
- [ ] All integration tests passing
- [ ] All workflows tested (edit → save → commit → push)
- [ ] Error scenarios tested (merge conflicts, permission denied, network failures)

**Performance:**
- [ ] File tree load <3.5s for 10,000+ files
- [ ] Monaco Editor first load <500ms
- [ ] Monaco Editor subsequent loads <100ms
- [ ] Terminal spawn <200ms
- [ ] Git status refresh <500ms
- [ ] IPC file read (1MB) <100ms

**UI Polish:**
- [ ] Loading skeletons for all async operations
- [ ] Toast notifications for all git operations
- [ ] Tooltips on all buttons
- [ ] Keyboard shortcut help overlay (Ctrl+?)
- [ ] Focus management working (tab, arrow keys)

**Accessibility:**
- [ ] axe-core audit: 0 violations
- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA labels and roles
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible

**Overall:**
- [ ] All 6 WO-MIGRATE-003 phases complete (3.1 - 3.6)
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] IDE production-ready
- [ ] Implementation report submitted to trinity/reports/

---

**Estimated Time:** 9 hours
**Priority:** CRITICAL (Final phase of 6)
**Dependencies:** WO-MIGRATE-003.1, WO-MIGRATE-003.2, WO-MIGRATE-003.3, WO-MIGRATE-003.4, WO-MIGRATE-003.5

