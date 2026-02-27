import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock Radix UI (used by NewBranchDialog)
vi.mock('@radix-ui/react-dialog', async () => import('../../../mocks/radix-dialog'));
vi.mock('@radix-ui/react-select', async () => import('../../../mocks/radix-select'));

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
    outdated: 'npm outdated',
    audit: 'npm audit',
    clean: null,
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
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  it('renders the Set Up section header', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Set Up')).toBeDefined();
  });

  it('shows detecting state initially', () => {
    // Make the invoke never resolve so we stay in detecting state
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<MaintenanceTool {...defaultProps} />);
    // Set Up, Workflows, and Update all show detecting text
    const detectingElements = screen.getAllByText('Detecting project...');
    expect(detectingElements.length).toBe(3);
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
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
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

  it('renders Workflows section with buttons after detection', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Workflows')).toBeDefined();
    // Wait for detection to complete and buttons to render
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Build')).toBeDefined();
    expect(screen.getByText('New Branch')).toBeDefined();
  });

  it('renders Update and Info section headers', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Update')).toBeDefined();
    expect(screen.getByText('Info')).toBeDefined();
  });

  it('renders Update section with buttons after detection', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    expect(screen.getByText('Pull Latest')).toBeDefined();
    expect(screen.getByText('Clean')).toBeDefined();
  });

  it('renders Info section with 6 buttons', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Log')).toBeDefined();
    expect(screen.getByText('Branches')).toBeDefined();
    expect(screen.getByText('Remotes')).toBeDefined();
    expect(screen.getByText('Disk Usage')).toBeDefined();
    expect(screen.getByText('Project Info')).toBeDefined();
  });

  it('shows error state when detection fails', async () => {
    mockInvoke.mockImplementation(() => Promise.reject(new Error('Detection failed')));
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      // Set Up, Workflows, and Update all show error text
      const errorElements = screen.getAllByText('Could not detect project');
      expect(errorElements.length).toBe(3);
    });
  });

  it('calls detect-project with workingDirectory on mount', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:detect-project', '/test/project');
    });
  });

  it('shows "Could not detect project" for unknown ecosystem', async () => {
    const unknownProject: ProjectInfo = {
      ...mockProjectInfo,
      ecosystem: 'unknown',
      packageManager: 'unknown',
      scripts: [],
      commands: {
        install: null,
        lint: null,
        format: null,
        test: null,
        coverage: null,
        build: null,
        typecheck: null,
        outdated: null,
        audit: null,
        clean: null,
      },
    };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(unknownProject);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      const errorElements = screen.getAllByText('Could not detect project');
      expect(errorElements.length).toBe(3);
    });
    // Info section should still render its buttons
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Disk Usage')).toBeDefined();
  });
});
