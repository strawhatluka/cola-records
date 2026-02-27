import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { MaintenanceTool } from '../../../../src/renderer/components/tools/MaintenanceTool';
import type { ProjectInfo } from '../../../../src/main/ipc/channels/types';

const mockProjectInfo: ProjectInfo = {
  ecosystem: 'node',
  packageManager: 'npm',
  scripts: [
    { name: 'test', command: 'vitest' },
    { name: 'lint', command: 'eslint src/' },
    { name: 'build', command: 'vite build' },
  ],
  commands: {
    install: 'npm install',
    lint: 'npm run lint',
    format: null,
    test: 'npm test',
    coverage: null,
    build: 'npm run build',
    typecheck: 'npm run typecheck',
  },
  hasGit: true,
  hasEnv: false,
  hasEnvExample: true,
  hasEditorConfig: true,
  hookTool: 'husky',
  typeChecker: 'tsc',
};

const defaultProps = {
  workingDirectory: '/test/project',
  onRunCommand: vi.fn(),
};

describe('MaintenanceTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockProjectInfo);
  });

  it('renders the Set Up section header', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Set Up')).toBeDefined();
  });

  it('shows detecting state initially', () => {
    // Make the invoke never resolve so we stay in detecting state
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Detecting project...')).toBeDefined();
  });

  it('renders 6 Set Up buttons after detection', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });
    expect(screen.getByText('Env File')).toBeDefined();
    expect(screen.getByText('Git Init')).toBeDefined();
    expect(screen.getByText('Hooks')).toBeDefined();
    expect(screen.getByText('Editor Config')).toBeDefined();
    expect(screen.getByText('TypeCheck')).toBeDefined();
  });

  it('disables Git Init when .git exists', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Git Init')).toBeDefined();
    });
    const gitInitButton = screen.getByText('Git Init').closest('button');
    expect(gitInitButton?.disabled).toBe(true);
  });

  it('disables Editor Config when .editorconfig exists', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });
    const editorConfigButton = screen.getByText('Editor Config').closest('button');
    expect(editorConfigButton?.disabled).toBe(true);
  });

  it('calls onRunCommand with install command when Install clicked', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'dev-tools:get-install-command') return Promise.resolve('npm install');
      return Promise.resolve(null);
    });

    render(<MaintenanceTool workingDirectory="/test/project" onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    const installButton = screen.getByText('Install').closest('button')!;
    await userEvent.click(installButton);

    await waitFor(() => {
      expect(onRunCommand).toHaveBeenCalledWith('npm install');
    });
  });

  it('renders placeholder sections for Workflows, Update, Info', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Workflows')).toBeDefined();
    expect(screen.getByText('Update')).toBeDefined();
    expect(screen.getByText('Info')).toBeDefined();
  });

  it('shows Coming soon for placeholder sections', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    const comingSoonElements = screen.getAllByText('Coming soon');
    expect(comingSoonElements.length).toBe(3);
  });

  it('shows error state when detection fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Detection failed'));
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Could not detect project')).toBeDefined();
    });
  });

  it('calls detect-project with workingDirectory on mount', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:detect-project', '/test/project');
    });
  });
});
