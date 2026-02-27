import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

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

// Mock BranchDetailModal
vi.mock('../../../src/renderer/components/branches/BranchDetailModal', () => ({
  BranchDetailModal: () => null,
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
 * code-server:start must resolve for the toolbar to appear.
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
          {
            name: 'upstream',
            fetchUrl: 'https://github.com/upstream/repo.git',
            pushUrl: 'https://github.com/upstream/repo.git',
          },
        ];
      case 'git:get-branches':
        return ['main', 'feature-branch'];
      case 'git:get-current-branch':
        return 'feature-branch';
      case 'github:get-authenticated-user':
        return { login: 'testuser', name: 'Test User', email: 'test@example.com' };
      case 'github:list-pull-requests':
        return [
          {
            number: 1,
            title: 'Test PR',
            url: 'https://github.com/upstream/repo/pull/1',
            state: 'open',
            merged: false,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'testuser',
            headBranch: 'feature-branch',
          },
          {
            number: 2,
            title: 'Merged PR',
            url: 'https://github.com/upstream/repo/pull/2',
            state: 'closed',
            merged: true,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'testuser',
            headBranch: 'old-branch',
          },
        ];
      case 'github:list-pr-comments':
        return [];
      case 'github:list-pr-reviews':
        return [];
      case 'github:list-issues':
        return [
          {
            number: 10,
            title: 'Fix login bug',
            body: 'Login is broken',
            url: 'https://github.com/upstream/repo/issues/10',
            state: 'open',
            labels: ['bug'],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'reporter',
            authorAvatarUrl: 'https://avatar.url/reporter',
          },
          {
            number: 1,
            title: 'Matching branch issue',
            body: 'This matches the branch',
            url: 'https://github.com/upstream/repo/issues/1',
            state: 'open',
            labels: ['enhancement'],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'contributor',
            authorAvatarUrl: '',
          },
        ];
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

describe('DevelopmentScreen Toolbar Buttons', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('Toolbar button position', () => {
    it('all toolbar buttons are visible', async () => {
      await renderInRunningState();

      expect(screen.getByText('feature-branch')).toBeDefined();
      expect(screen.getByText('Tool Box')).toBeDefined();
      expect(screen.getByText('Stop & Back')).toBeDefined();
    });
  });
});
