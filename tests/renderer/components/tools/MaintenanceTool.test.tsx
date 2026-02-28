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

  it('Editor Config button is always enabled (even when .editorconfig exists)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });
    const editorConfigButton = screen.getByText('Editor Config').closest('button');
    expect(editorConfigButton?.disabled).toBe(false);
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

  it('Env File button is never disabled (even when .env exists)', async () => {
    const projectWithEnv: ProjectInfo = { ...mockProjectInfo, hasEnv: true };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(projectWithEnv);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Env File')).toBeDefined();
    });
    const envButton = screen.getByText('Env File').closest('button');
    expect(envButton?.disabled).toBe(false);
  });

  it('opens EnvPanel when Env File clicked', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Env File')).toBeDefined();
    });

    const envButton = screen.getByText('Env File').closest('button')!;
    await userEvent.click(envButton);

    await waitFor(() => {
      expect(screen.getByText('Env File Management')).toBeDefined();
    });
  });

  it('closes EnvPanel when Env File clicked again (toggle)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Env File')).toBeDefined();
    });

    const envButton = screen.getByText('Env File').closest('button')!;
    await userEvent.click(envButton);

    await waitFor(() => {
      expect(screen.getByText('Env File Management')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(envButton);
    await waitFor(() => {
      expect(screen.queryByText('Env File Management')).toBeNull();
    });
  });

  it('Hooks button is always enabled (even when hookTool is null)', async () => {
    const projectNoHooks: ProjectInfo = { ...mockProjectInfo, hookTool: null };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(projectNoHooks);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeDefined();
    });
    const hooksButton = screen.getByText('Hooks').closest('button');
    expect(hooksButton?.disabled).toBe(false);
  });

  it('opens HooksPanel when Hooks clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-hooks')
        return Promise.resolve({
          detected: 'husky',
          recommendations: [],
          ecosystem: 'node',
          hasLintStaged: false,
          existingConfig: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeDefined();
    });

    const hooksButton = screen.getByText('Hooks').closest('button')!;
    await userEvent.click(hooksButton);

    await waitFor(() => {
      expect(screen.getByText('Git Hooks')).toBeDefined();
    });
  });

  it('closes HooksPanel when Hooks clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-hooks')
        return Promise.resolve({
          detected: 'husky',
          recommendations: [],
          ecosystem: 'node',
          hasLintStaged: false,
          existingConfig: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeDefined();
    });

    const hooksButton = screen.getByText('Hooks').closest('button')!;
    await userEvent.click(hooksButton);

    await waitFor(() => {
      expect(screen.getByText('Git Hooks')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(hooksButton);
    await waitFor(() => {
      expect(screen.queryByText('Git Hooks')).toBeNull();
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

  it('opens EditorConfigPanel when Editor Config clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project')
        return Promise.resolve({ ...mockProjectInfo, hasEditorConfig: false });
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    const editorConfigButton = screen.getByText('Editor Config').closest('button')!;
    await userEvent.click(editorConfigButton);

    await waitFor(() => {
      expect(screen.getByText('Editor Config Setup')).toBeDefined();
    });
  });

  it('closes EditorConfigPanel when Editor Config clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project')
        return Promise.resolve({ ...mockProjectInfo, hasEditorConfig: false });
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    const editorConfigButton = screen.getByText('Editor Config').closest('button')!;
    await userEvent.click(editorConfigButton);

    await waitFor(() => {
      expect(screen.getByText('Editor Config Setup')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(editorConfigButton);
    await waitFor(() => {
      expect(screen.queryByText('Editor Config Setup')).toBeNull();
    });
  });

  it('opens FormatPanel when Format button in Workflows clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button')!;
    await userEvent.click(formatButton);

    await waitFor(() => {
      expect(screen.getByText('Format Config')).toBeDefined();
    });
  });

  it('closes FormatPanel when Format button clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button')!;
    await userEvent.click(formatButton);

    await waitFor(() => {
      expect(screen.getByText('Format Config')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(formatButton);
    await waitFor(() => {
      expect(screen.queryByText('Format Config')).toBeNull();
    });
  });

  it('Format button in Workflows is always enabled (even without format command)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button');
    expect(formatButton?.disabled).toBe(false);
  });

  it('shows Edit Ignore in FormatPanel when ignore file exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button')!;
    await userEvent.click(formatButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });
    expect(screen.queryByText('Create Ignore')).toBeNull();
  });

  it('shows actions mode in EditorConfigPanel when hasEditorConfig is true', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project')
        return Promise.resolve({ ...mockProjectInfo, hasEditorConfig: true });
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    const editorConfigButton = screen.getByText('Editor Config').closest('button')!;
    await userEvent.click(editorConfigButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
      expect(screen.getByText('Reset to Default')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });
  });
});
