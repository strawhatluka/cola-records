import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Use vi.hoisted to ensure mocks are available at vi.mock time
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    send: vi.fn(),
    on: mockOn,
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

// Mock BranchDetailModal to capture props
const mockBranchDetailModalOnClose = vi.fn();
const mockBranchDetailModalOnDeleted = vi.fn();
const mockBranchDetailModalOnSwitched = vi.fn();
vi.mock('../../../src/renderer/components/branches/BranchDetailModal', () => ({
  BranchDetailModal: ({
    branchName,
    localPath,
    onClose,
    onDeleted,
    onSwitched,
  }: {
    branchName: string;
    localPath: string;
    onClose: () => void;
    onDeleted: () => void;
    onSwitched: () => void;
  }) => {
    // Store callbacks so tests can invoke them
    mockBranchDetailModalOnClose.mockImplementation(onClose);
    mockBranchDetailModalOnDeleted.mockImplementation(onDeleted);
    mockBranchDetailModalOnSwitched.mockImplementation(onSwitched);
    return (
      <div data-testid="branch-detail-modal" data-branch={branchName} data-path={localPath}>
        <span>Branch Detail: {branchName}</span>
        <button onClick={onClose}>Close Branch Modal</button>
        <button onClick={onDeleted}>Delete Branch</button>
        <button onClick={onSwitched}>Switch Branch</button>
      </div>
    );
  },
}));

// Mock ToolsPanel
vi.mock('../../../src/renderer/components/tools/ToolsPanel', () => ({
  ToolsPanel: ({
    workingDirectory,
    onClose,
  }: {
    workingDirectory: string;
    onClose: () => void;
  }) => (
    <div data-testid="tools-panel" data-working-directory={workingDirectory}>
      <span>Tools Panel</span>
      <button onClick={onClose}>Close Tools</button>
    </div>
  ),
}));

// Mock useDevScriptsStore
vi.mock('../../../src/renderer/stores/useDevScriptsStore', () => ({
  useDevScriptsStore: () => ({
    scripts: [],
    globalScripts: [],
    loading: false,
    loadScripts: vi.fn(),
    toggleStates: {},
    flipToggleState: vi.fn(),
  }),
  selectScriptsForProject: (scripts: unknown[], _projectPath: string) =>
    (scripts as Array<{ projectPath: string }>).filter((s) => s.projectPath === _projectPath),
}));

// Mock ScriptButton
vi.mock('../../../src/renderer/components/tools/ScriptButton', () => ({
  ScriptButton: () => null,
}));

// Mock ScriptExecutionModal to capture onMoveToTerminal
vi.mock('../../../src/renderer/components/tools/ScriptExecutionModal', () => ({
  ScriptExecutionModal: ({
    isOpen,
    script,
    onClose,
    onMoveToTerminal,
  }: {
    isOpen: boolean;
    script: unknown;
    onClose: () => void;
    onMoveToTerminal: (
      sessions: Array<{ sessionId: string; output: string; name: string }>
    ) => void;
  }) =>
    isOpen && script ? (
      <div data-testid="script-execution-modal">
        <button onClick={onClose}>Close Script Modal</button>
        <button
          onClick={() =>
            onMoveToTerminal([{ sessionId: 'sess-1', output: 'test output', name: 'Test Session' }])
          }
        >
          Move To Terminal
        </button>
      </div>
    ) : null,
}));

import {
  DevelopmentScreen,
  extractOwnerRepo,
} from '../../../src/renderer/screens/DevelopmentScreen';
import type { Contribution } from '../../../src/main/ipc/channels';

// ---- Shared fixtures & helpers ----

const baseContribution: Contribution = {
  id: 'test-1',
  repositoryUrl: 'https://github.com/org/repo.git',
  localPath: '/mock/path/repo',
  issueNumber: 1,
  issueTitle: 'Test Issue',
  branchName: 'feature-branch',
  status: 'in_progress',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

/**
 * Sets up IPC mocks so the component reaches 'running' state via auto-start.
 */
function setupRunningIpc() {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'code-server:start':
        return { url: 'http://127.0.0.1:8080' };
      case 'code-server:remove-workspace':
        return undefined;
      case 'git:get-remotes':
        return [
          {
            name: 'origin',
            fetchUrl: 'https://github.com/user/repo.git',
            pushUrl: 'https://github.com/user/repo.git',
          },
        ];
      case 'git:get-branches':
        return ['main', 'feature-branch', 'dev'];
      case 'git:get-current-branch':
        return 'feature-branch';
      case 'github:get-authenticated-user':
        return { login: 'testuser', name: 'Test User', email: 'test@example.com' };
      case 'dev-scripts:get-all':
        return [];
      default:
        return undefined;
    }
  });
}

/**
 * Render the component and wait until it reaches the 'running' state
 * (signaled by the "Stop & Back" button appearing in the toolbar).
 */
async function renderRunning(
  overrides: Partial<Contribution> = {},
  props: {
    codeServerUrl?: string | null;
    projectState?: 'idle' | 'starting' | 'running' | 'error';
    projectError?: string | null;
  } = {}
) {
  setupRunningIpc();
  const contribution = { ...baseContribution, ...overrides };
  const onNavigateBack = vi.fn();

  await act(async () => {
    render(
      <DevelopmentScreen contribution={contribution} onNavigateBack={onNavigateBack} {...props} />
    );
  });

  await waitFor(() => {
    expect(screen.getByText('Stop & Back')).toBeDefined();
  });

  return { contribution, onNavigateBack };
}

// ---- Tests ----

describe('extractOwnerRepo', () => {
  it('extracts owner and repo from HTTPS URL with .git suffix', () => {
    const result = extractOwnerRepo('https://github.com/my-org/my-repo.git');
    expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' });
  });

  it('extracts owner and repo from HTTPS URL without .git suffix', () => {
    const result = extractOwnerRepo('https://github.com/my-org/my-repo');
    expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' });
  });

  it('extracts owner and repo from SSH-style URL', () => {
    const result = extractOwnerRepo('git@github.com:my-org/my-repo.git');
    expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' });
  });

  it('returns null for non-GitHub URLs', () => {
    const result = extractOwnerRepo('https://gitlab.com/org/repo');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = extractOwnerRepo('');
    expect(result).toBeNull();
  });

  it('handles repos with dots and hyphens in name', () => {
    const result = extractOwnerRepo('https://github.com/user-name/repo.name.git');
    expect(result).toEqual({ owner: 'user-name', repo: 'repo.name' });
  });
});

describe('DevelopmentScreen', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockOn.mockClear();
    mockBranchDetailModalOnClose.mockReset();
    mockBranchDetailModalOnDeleted.mockReset();
    mockBranchDetailModalOnSwitched.mockReset();
  });

  // ── State Machine Tests ────────────────────────────────────────

  describe('idle state', () => {
    it('renders initializing text when projectState is idle', async () => {
      const onNavigateBack = vi.fn();
      // Provide projectState='idle' so it never auto-starts
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="idle"
          />
        );
      });

      expect(screen.getByText('Initializing...')).toBeDefined();
    });
  });

  describe('starting state', () => {
    it('renders loading spinner text when projectState is starting', async () => {
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="starting"
          />
        );
      });

      expect(screen.getByText('Starting VS Code...')).toBeDefined();
      expect(
        screen.getByText('First launch may be slower while Docker pulls the image.')
      ).toBeDefined();
    });

    it('renders Cancel button during starting state', async () => {
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="starting"
          />
        );
      });

      expect(screen.getByText('Cancel')).toBeDefined();
    });

    it('calls stop and navigates back when Cancel is clicked in starting state', async () => {
      const user = userEvent.setup();
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="starting"
          />
        );
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(onNavigateBack).toHaveBeenCalled();
      });
    });
  });

  describe('error state', () => {
    it('renders error message when projectState is error', async () => {
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="error"
            projectError="Docker daemon is not running"
          />
        );
      });

      expect(screen.getByText('Failed to start VS Code')).toBeDefined();
      expect(screen.getByText('Docker daemon is not running')).toBeDefined();
    });

    it('renders Retry and Back buttons in error state', async () => {
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="error"
            projectError="Something went wrong"
          />
        );
      });

      expect(screen.getByText('Retry')).toBeDefined();
      expect(screen.getByText('Back')).toBeDefined();
    });

    it('calls onNavigateBack when Back button is clicked in error state', async () => {
      const user = userEvent.setup();
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="error"
            projectError="Failure"
          />
        );
      });

      await user.click(screen.getByText('Back'));

      expect(onNavigateBack).toHaveBeenCalledOnce();
    });

    it('invokes code-server:start when Retry is clicked in error state', async () => {
      const user = userEvent.setup();
      const onNavigateBack = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            projectState="error"
            projectError="Failure"
          />
        );
      });

      await user.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('code-server:start', baseContribution.localPath);
      });
    });
  });

  // ── Running State Layout Tests ─────────────────────────────────

  describe('running state - header bar', () => {
    it('displays repository name from URL in header', async () => {
      await renderRunning({
        repositoryUrl: 'https://github.com/cool-org/awesome-repo.git',
      });

      expect(screen.getByText('cool-org/awesome-repo')).toBeDefined();
    });

    it('displays "Unknown Issue" when repositoryUrl is empty', async () => {
      await renderRunning({ repositoryUrl: '' });

      expect(screen.getByText('Unknown Issue')).toBeDefined();
    });

    it('displays local path in header', async () => {
      await renderRunning({ localPath: '/home/user/projects/my-project' });

      expect(screen.getByText('/home/user/projects/my-project')).toBeDefined();
    });

    it('displays current branch name on the branches button', async () => {
      await renderRunning();

      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });
    });
  });

  // ── Branch Dropdown Tests (covers lines 380-429) ──────────────

  describe('running state - branches dropdown', () => {
    it('opens branches dropdown when branch button is clicked', async () => {
      const user = userEvent.setup();
      await renderRunning();

      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });

      await user.click(screen.getByText('feature-branch'));

      await waitFor(() => {
        expect(screen.getByText('Branches')).toBeDefined();
        expect(screen.getByText('main')).toBeDefined();
        expect(screen.getByText('dev')).toBeDefined();
      });
    });

    it('shows "current" badge next to the current branch', async () => {
      const user = userEvent.setup();
      await renderRunning();

      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });

      await user.click(screen.getByText('feature-branch'));

      await waitFor(() => {
        expect(screen.getByText('current')).toBeDefined();
      });
    });

    it('closes branches dropdown when same button is clicked again', async () => {
      const user = userEvent.setup();
      await renderRunning();

      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });

      // Open
      await user.click(screen.getByText('feature-branch'));
      await waitFor(() => {
        expect(screen.getByText('Branches')).toBeDefined();
      });

      // Close by clicking the button again (use getAllByText since dropdown also shows 'feature-branch')
      await user.click(screen.getAllByText('feature-branch')[0]);
      await waitFor(() => {
        expect(screen.queryByText('Branches')).toBeNull();
      });
    });

    it('shows "No branches found" when there are no branches', async () => {
      const user = userEvent.setup();
      // Override git:get-branches to return empty array
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            return { url: 'http://127.0.0.1:8080' };
          case 'git:get-remotes':
            return [];
          case 'git:get-branches':
            return [];
          case 'git:get-current-branch':
            return null;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();
      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      // The button should show 'Branches' when no current branch
      await user.click(screen.getByText('Branches'));

      await waitFor(() => {
        expect(screen.getByText('No branches found')).toBeDefined();
      });
    });

    it('opens BranchDetailModal when a branch is clicked in dropdown', async () => {
      const user = userEvent.setup();
      await renderRunning();

      // Open branches dropdown
      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });
      await user.click(screen.getByText('feature-branch'));

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByText('main')).toBeDefined();
      });

      // Click on 'main' branch
      await user.click(screen.getByText('main'));

      // BranchDetailModal should appear with the selected branch
      await waitFor(() => {
        expect(screen.getByTestId('branch-detail-modal')).toBeDefined();
        expect(screen.getByText('Branch Detail: main')).toBeDefined();
      });
    });

    it('closes BranchDetailModal when close callback fires', async () => {
      const user = userEvent.setup();
      await renderRunning();

      // Open dropdown and select branch
      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });
      await user.click(screen.getByText('feature-branch'));
      await waitFor(() => {
        expect(screen.getByText('main')).toBeDefined();
      });
      await user.click(screen.getByText('main'));

      // Modal opens
      await waitFor(() => {
        expect(screen.getByTestId('branch-detail-modal')).toBeDefined();
      });

      // Close the modal
      await user.click(screen.getByText('Close Branch Modal'));

      await waitFor(() => {
        expect(screen.queryByTestId('branch-detail-modal')).toBeNull();
      });
    });

    it('refreshes branches when onDeleted is called from BranchDetailModal', async () => {
      const user = userEvent.setup();
      await renderRunning();

      // Open dropdown and select branch
      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });
      await user.click(screen.getByText('feature-branch'));
      await waitFor(() => {
        expect(screen.getByText('main')).toBeDefined();
      });
      await user.click(screen.getByText('main'));

      // Modal should be open
      await waitFor(() => {
        expect(screen.getByTestId('branch-detail-modal')).toBeDefined();
      });

      // Clear invoke calls to isolate the onDeleted call
      mockInvoke.mockClear();
      setupRunningIpc();

      await user.click(screen.getByText('Delete Branch'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git:get-branches', '/mock/path/repo');
      });
    });

    it('refreshes current branch and branches list when onSwitched is called', async () => {
      const user = userEvent.setup();
      await renderRunning();

      // Open dropdown and select branch
      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeDefined();
      });
      await user.click(screen.getByText('feature-branch'));
      await waitFor(() => {
        expect(screen.getByText('main')).toBeDefined();
      });
      await user.click(screen.getByText('main'));

      await waitFor(() => {
        expect(screen.getByTestId('branch-detail-modal')).toBeDefined();
      });

      mockInvoke.mockClear();
      setupRunningIpc();

      await user.click(screen.getByText('Switch Branch'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git:get-current-branch', '/mock/path/repo');
      });
    });
  });

  // ── Stop & Back Tests ──────────────────────────────────────────

  describe('running state - Stop & Back', () => {
    it('calls code-server:remove-workspace and onNavigateBack', async () => {
      const user = userEvent.setup();
      const { onNavigateBack } = await renderRunning();

      await user.click(screen.getByText('Stop & Back'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('code-server:remove-workspace', '/mock/path/repo');
        expect(onNavigateBack).toHaveBeenCalled();
      });
    });
  });

  // ── Running state with codeServerUrl prop ──────────────────────

  describe('running state with codeServerUrl prop', () => {
    it('skips auto-start when codeServerUrl is provided', async () => {
      setupRunningIpc();
      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={baseContribution}
            onNavigateBack={onNavigateBack}
            codeServerUrl="http://localhost:9999"
            projectState="running"
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      // code-server:start should NOT have been called since URL was provided
      const startCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'code-server:start'
      );
      expect(startCalls).toHaveLength(0);
    });
  });

  // ── Tool Box Panel Toggle ──────────────────────────────────────

  describe('running state - Tool Box toggle', () => {
    it('renders Tool Box button', async () => {
      await renderRunning();
      expect(screen.getByText('Tool Box')).toBeDefined();
    });

    it('tools panel is open by default', async () => {
      await renderRunning();
      expect(screen.getByTestId('tools-panel')).toBeDefined();
    });

    it('hides tools panel when Tool Box button is toggled off', async () => {
      const user = userEvent.setup();
      await renderRunning();

      await user.click(screen.getByText('Tool Box'));

      await waitFor(() => {
        expect(screen.queryByTestId('tools-panel')).toBeNull();
      });
    });
  });

  // ── Auto-start behavior ────────────────────────────────────────

  describe('auto-start code server', () => {
    it('auto-starts code server when no codeServerUrl is provided', async () => {
      setupRunningIpc();
      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('code-server:start', baseContribution.localPath);
      });
    });
  });

  // ── IPC error handling on mount ────────────────────────────────

  describe('IPC error handling on mount', () => {
    it('handles git:get-remotes failure gracefully', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            return { url: 'http://127.0.0.1:8080' };
          case 'git:get-remotes':
            throw new Error('Network error');
          case 'git:get-branches':
            return ['main'];
          case 'git:get-current-branch':
            return 'main';
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      // Should still reach running state despite remotes failure
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });
    });

    it('handles github:get-authenticated-user failure gracefully', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            return { url: 'http://127.0.0.1:8080' };
          case 'git:get-remotes':
            return [];
          case 'git:get-branches':
            return ['main'];
          case 'git:get-current-branch':
            return 'main';
          case 'github:get-authenticated-user':
            throw new Error('Not authenticated');
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      // Should still reach running state despite auth failure
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });
    });

    it('handles git:get-branches failure gracefully', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            return { url: 'http://127.0.0.1:8080' };
          case 'git:get-remotes':
            return [];
          case 'git:get-branches':
            throw new Error('Not a git repo');
          case 'git:get-current-branch':
            return null;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });
    });
  });

  // ── Code-server start failure ──────────────────────────────────

  describe('code-server start failure', () => {
    it('shows error state when code-server:start rejects', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            throw new Error('Docker not found');
          case 'git:get-remotes':
            return [];
          case 'git:get-branches':
            return [];
          case 'git:get-current-branch':
            return null;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to start VS Code')).toBeDefined();
        expect(screen.getByText('Docker not found')).toBeDefined();
      });
    });

    it('shows error state when code-server:start rejects with non-Error', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'code-server:start':
            throw 'string error message';
          case 'git:get-remotes':
            return [];
          case 'git:get-branches':
            return [];
          case 'git:get-current-branch':
            return null;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'dev-scripts:get-all':
            return [];
          default:
            return undefined;
        }
      });

      const onNavigateBack = vi.fn();

      await act(async () => {
        render(
          <DevelopmentScreen contribution={baseContribution} onNavigateBack={onNavigateBack} />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to start VS Code')).toBeDefined();
        expect(screen.getByText('string error message')).toBeDefined();
      });
    });
  });

  // ── Webview rendering in running state ─────────────────────────

  describe('running state - webview', () => {
    it('renders a webview element with code-server URL', async () => {
      await renderRunning();

      const webview = document.querySelector('webview');
      expect(webview).not.toBeNull();
      expect(webview?.getAttribute('src')).toBe('http://127.0.0.1:8080');
    });
  });

  // ── Repository URL formatting in header ────────────────────────

  describe('running state - repository URL formatting', () => {
    it('strips https://github.com/ prefix and .git suffix from URL', async () => {
      await renderRunning({
        repositoryUrl: 'https://github.com/my-org/my-repo.git',
      });

      expect(screen.getByText('my-org/my-repo')).toBeDefined();
    });

    it('strips http://github.com/ prefix from URL', async () => {
      await renderRunning({
        repositoryUrl: 'http://github.com/user/project.git',
      });

      expect(screen.getByText('user/project')).toBeDefined();
    });
  });

  // ── localPath with no value ────────────────────────────────────

  describe('contribution with no localPath', () => {
    it('does not crash when localPath is empty string', async () => {
      setupRunningIpc();
      const onNavigateBack = vi.fn();

      // With projectState=running and codeServerUrl, the component
      // goes straight to running UI
      await act(async () => {
        render(
          <DevelopmentScreen
            contribution={{ ...baseContribution, localPath: '' }}
            onNavigateBack={onNavigateBack}
            codeServerUrl="http://localhost:8080"
            projectState="running"
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });
    });
  });
});
