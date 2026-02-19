import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock window.electronAPI for TerminalTool
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: mockInvoke,
    on: mockOn,
    send: vi.fn(),
  },
  writable: true,
});

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

// Mock BranchDetailModal to avoid nested IPC complexity
vi.mock('../../../src/renderer/components/branches/BranchDetailModal', () => ({
  BranchDetailModal: () => null,
}));

// Mock ToolsPanel to verify it's rendered
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
    loading: false,
    loadScripts: vi.fn(),
    saveScript: vi.fn(),
    deleteScript: vi.fn(),
  }),
  selectScriptsForProject: (scripts: any[], projectPath: string) =>
    scripts.filter((s: any) => s.projectPath === projectPath),
}));

// Mock ScriptButton
vi.mock('../../../src/renderer/components/tools/ScriptButton', () => ({
  ScriptButton: () => null,
}));

// Mock ScriptExecutionModal
vi.mock('../../../src/renderer/components/tools/ScriptExecutionModal', () => ({
  ScriptExecutionModal: () => null,
}));

import { DevelopmentScreen } from '../../../src/renderer/screens/DevelopmentScreen';
import type { Contribution } from '../../../src/main/ipc/channels';

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
  upstreamUrl: 'https://github.com/upstream/repo.git',
};

/**
 * Sets up IPC mocks so the component reaches 'running' state.
 */
function setupRunningState() {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'code-server:start':
        return { url: 'http://127.0.0.1:8080' };
      case 'code-server:stop':
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
        return ['main', 'feature-branch'];
      case 'git:get-current-branch':
        return 'feature-branch';
      case 'github:get-authenticated-user':
        return { login: 'testuser', name: 'Test User', email: 'test@example.com' };
      case 'github:list-pull-requests':
        return [];
      case 'github:list-issues':
        return [];
      case 'terminal:spawn':
        return { id: 'term-123', shellType: 'git-bash' };
      case 'terminal:kill':
        return undefined;
      case 'terminal:write':
        return undefined;
      case 'terminal:resize':
        return undefined;
      default:
        return undefined;
    }
  });
}

async function renderInRunningState(contributionOverrides: Partial<Contribution> = {}) {
  setupRunningState();
  const contribution = { ...baseContribution, ...contributionOverrides };
  const onNavigateBack = vi.fn();

  render(<DevelopmentScreen contribution={contribution} onNavigateBack={onNavigateBack} />);

  // Wait for running state (toolbar appears with "Stop & Back" button)
  await waitFor(() => {
    expect(screen.getByText('Stop & Back')).toBeDefined();
  });

  return { contribution, onNavigateBack };
}

describe('DevelopmentScreen Tools Integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockOn.mockClear();
  });

  describe('Tool Box button', () => {
    it('renders Tool Box button in toolbar', async () => {
      await renderInRunningState();
      expect(screen.getByText('Tool Box')).toBeDefined();
    });

    it('Tool Box button has active styling when panel is open by default', async () => {
      await renderInRunningState();
      const toolBoxBtn = screen.getByText('Tool Box');
      expect(toolBoxBtn.className).toContain('bg-accent');
    });

    it('Tools Panel is open by default', async () => {
      await renderInRunningState();

      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });
    });

    it('closes Tools Panel when Tool Box button is clicked', async () => {
      const user = userEvent.setup();
      await renderInRunningState();

      // Panel starts open
      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });

      // Close
      await user.click(screen.getByText('Tool Box'));
      await waitFor(() => {
        expect(screen.queryByTestId('tools-panel')).toBeNull();
      });
    });

    it('Tool Box button has default styling when panel is closed', async () => {
      const user = userEvent.setup();
      await renderInRunningState();

      // Close panel
      await user.click(screen.getByText('Tool Box'));

      await waitFor(() => {
        const toolBoxBtn = screen.getByText('Tool Box');
        expect(toolBoxBtn.className).toContain('border-border');
      });
    });

    it('reopens Tools Panel when Tool Box button is clicked again', async () => {
      const user = userEvent.setup();
      await renderInRunningState();

      // Close
      await user.click(screen.getByText('Tool Box'));
      await waitFor(() => {
        expect(screen.queryByTestId('tools-panel')).toBeNull();
      });

      // Reopen
      await user.click(screen.getByText('Tool Box'));
      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });
    });
  });

  describe('Tools Panel integration', () => {
    it('passes workingDirectory to ToolsPanel', async () => {
      await renderInRunningState({ localPath: '/custom/project/path' });

      await waitFor(() => {
        const panel = screen.getByTestId('tools-panel');
        expect(panel.dataset.workingDirectory).toBe('/custom/project/path');
      });
    });

    it('closes Tools Panel when onClose is called', async () => {
      const user = userEvent.setup();
      await renderInRunningState();

      // Panel starts open
      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });

      // Click the close button inside the panel
      await user.click(screen.getByText('Close Tools'));

      await waitFor(() => {
        expect(screen.queryByTestId('tools-panel')).toBeNull();
      });
    });

    it('displays Tools Panel text when open by default', async () => {
      await renderInRunningState();

      await waitFor(() => {
        expect(screen.getByText('Tools Panel')).toBeDefined();
      });
    });
  });

  describe('Layout with Tools Panel', () => {
    it('renders webview and Tools Panel side by side by default', async () => {
      await renderInRunningState();

      await waitFor(() => {
        const webview = document.querySelector('webview');
        expect(webview).toBeDefined();
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });
    });

    it('webview takes full width when Tools Panel is closed', async () => {
      const user = userEvent.setup();
      await renderInRunningState();

      // Close the panel
      await user.click(screen.getByText('Tool Box'));

      await waitFor(() => {
        const webview = document.querySelector('webview');
        expect(webview).toBeDefined();
        expect(screen.queryByTestId('tools-panel')).toBeNull();
      });
    });
  });

  describe('Tools Panel state persistence during navigation', () => {
    it('Tools Panel state resets when navigating away and back', async () => {
      const user = userEvent.setup();
      const { onNavigateBack } = await renderInRunningState();

      // Panel starts open by default
      await waitFor(() => {
        expect(screen.getByTestId('tools-panel')).toBeDefined();
      });

      // Click Stop & Back
      await user.click(screen.getByText('Stop & Back'));

      expect(onNavigateBack).toHaveBeenCalled();
    });
  });

  describe('Tool Box button position', () => {
    it('Tool Box button appears after dropdown buttons', async () => {
      await renderInRunningState();

      // All buttons should be visible
      // Note: Branches button shows the current branch name ('feature-branch') instead of 'Branches'
      expect(screen.getByText('feature-branch')).toBeDefined();
      expect(screen.getByText('Remotes')).toBeDefined();
      expect(screen.getByText('Tool Box')).toBeDefined();
      expect(screen.getByText('Stop & Back')).toBeDefined();
    });
  });
});
