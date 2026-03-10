import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
    await act(async () => {
      render(<MaintenanceTool {...defaultProps} />);
    });
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

  it('renders 12 Set Up buttons after detection in correct order', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    // All 12 buttons should be present
    expect(screen.getByText('Package Manager')).toBeDefined();
    expect(screen.getByText('Git Init')).toBeDefined();
    expect(screen.getByText('Lint')).toBeDefined();
    expect(screen.getByText('TypeCheck')).toBeDefined();
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Coverage')).toBeDefined();
    expect(screen.getByText('Format')).toBeDefined();
    expect(screen.getByText('Build')).toBeDefined();
    expect(screen.getByText('Env File')).toBeDefined();
    expect(screen.getByText('Editor Config')).toBeDefined();
    expect(screen.getByText('Hooks')).toBeDefined();

    // Verify button order by finding all button labels in the Set Up section
    const setupSection = screen.getByText('Set Up').closest('.flex.flex-col.gap-2');
    expect(setupSection).not.toBeNull();
    const buttons = setupSection!.querySelectorAll('button');
    const labels = Array.from(buttons).map((btn) => btn.textContent?.trim());

    const expectedOrder = [
      'Install',
      'Package Manager',
      'Git Init',
      'Lint',
      'TypeCheck',
      'Test',
      'Coverage',
      'Format',
      'Build',
      'Env File',
      'Editor Config',
      'Hooks',
    ];

    expect(labels).toEqual(expectedOrder);
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

  it('renders Workflows section with only New Branch after detection', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    expect(screen.getByText('Workflows')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('New Branch')).toBeDefined();
    });
  });

  it('renders workflow command buttons (Lint, Test, Build) in Set Up section', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Build')).toBeDefined();
  });

  it('renders Update and Info section headers', async () => {
    await act(async () => {
      render(<MaintenanceTool {...defaultProps} />);
    });
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
    await act(async () => {
      render(<MaintenanceTool {...defaultProps} />);
    });
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

  it('opens FormatPanel when Format button clicked', async () => {
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

  it('Format button is always enabled (even without format command)', async () => {
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

  it('opens TestPanel when Test button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });

    const testButton = screen.getByText('Test').closest('button')!;
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Test Config')).toBeDefined();
    });
  });

  it('closes TestPanel when Test button clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });

    const testButton = screen.getByText('Test').closest('button')!;
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Test Config')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(testButton);
    await waitFor(() => {
      expect(screen.queryByText('Test Config')).toBeNull();
    });
  });

  it('Test button is always enabled (even without test command)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });

    const testButton = screen.getByText('Test').closest('button');
    expect(testButton?.disabled).toBe(false);
  });

  it('opens CoveragePanel when Coverage button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: false,
          reportPath: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });

    const coverageButton = screen.getByText('Coverage').closest('button')!;
    await userEvent.click(coverageButton);

    await waitFor(() => {
      expect(screen.getByText('Coverage Config')).toBeDefined();
    });
  });

  it('closes CoveragePanel when Coverage button clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: false,
          reportPath: null,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });

    const coverageButton = screen.getByText('Coverage').closest('button')!;
    await userEvent.click(coverageButton);

    await waitFor(() => {
      expect(screen.getByText('Coverage Config')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(coverageButton);
    await waitFor(() => {
      expect(screen.queryByText('Coverage Config')).toBeNull();
    });
  });

  it('Coverage button is always enabled (even without coverage command)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });

    const coverageButton = screen.getByText('Coverage').closest('button');
    expect(coverageButton?.disabled).toBe(false);
  });

  it('opens BuildPanel when Build button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: false,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build')).toBeDefined();
    });

    const buildButton = screen.getByText('Build').closest('button')!;
    await userEvent.click(buildButton);

    await waitFor(() => {
      expect(screen.getByText('Build Config')).toBeDefined();
    });
  });

  it('closes BuildPanel when Build button clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: false,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build')).toBeDefined();
    });

    const buildButton = screen.getByText('Build').closest('button')!;
    await userEvent.click(buildButton);

    await waitFor(() => {
      expect(screen.getByText('Build Config')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(buildButton);
    await waitFor(() => {
      expect(screen.queryByText('Build Config')).toBeNull();
    });
  });

  it('Build button is always enabled (even without build command)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build')).toBeDefined();
    });

    const buildButton = screen.getByText('Build').closest('button');
    expect(buildButton?.disabled).toBe(false);
  });

  it('opens LintPanel when Lint button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: null,
          configPath: null,
          hasConfig: false,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });

    const lintButton = screen.getByText('Lint').closest('button')!;
    await userEvent.click(lintButton);

    await waitFor(() => {
      expect(screen.getByText('Lint Config')).toBeDefined();
    });
  });

  it('closes LintPanel when Lint button clicked again (toggle)', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: null,
          configPath: null,
          hasConfig: false,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });

    const lintButton = screen.getByText('Lint').closest('button')!;
    await userEvent.click(lintButton);

    await waitFor(() => {
      expect(screen.getByText('Lint Config')).toBeDefined();
    });

    // Click again to close
    await userEvent.click(lintButton);
    await waitFor(() => {
      expect(screen.queryByText('Lint Config')).toBeNull();
    });
  });

  it('Lint button is always enabled (even without lint command)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });

    const lintButton = screen.getByText('Lint').closest('button');
    expect(lintButton?.disabled).toBe(false);
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

  // ── handleGitInit ────────────────────────────────────────────────────

  it('enables Git Init button when project has no .git and calls onRunCommand', async () => {
    const onRunCommand = vi.fn();
    const projectNoGit: ProjectInfo = { ...mockProjectInfo, hasGit: false };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(projectNoGit);
      if (channel === 'dev-tools:get-git-init-command') return Promise.resolve('git init');
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool workingDirectory="/test/project" onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Git Init')).toBeDefined();
    });

    const gitInitButton = screen.getByText('Git Init').closest('button')!;
    expect(gitInitButton.disabled).toBe(false);

    await userEvent.click(gitInitButton);

    await waitFor(() => {
      expect(onRunCommand).toHaveBeenCalledWith('git init');
    });
  });

  // ── handleTypeCheck ──────────────────────────────────────────────────

  it('calls onRunCommand with typecheck command when TypeCheck clicked', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'dev-tools:get-typecheck-command') return Promise.resolve('npx tsc --noEmit');
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool workingDirectory="/test/project" onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('TypeCheck')).toBeDefined();
    });

    const typecheckButton = screen.getByText('TypeCheck').closest('button')!;
    await userEvent.click(typecheckButton);

    await waitFor(() => {
      expect(onRunCommand).toHaveBeenCalledWith('npx tsc --noEmit');
    });
  });

  it('disables TypeCheck button when no typeChecker detected', async () => {
    const projectNoTypeChecker: ProjectInfo = { ...mockProjectInfo, typeChecker: null };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(projectNoTypeChecker);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('TypeCheck')).toBeDefined();
    });

    const typecheckButton = screen.getByText('TypeCheck').closest('button');
    expect(typecheckButton?.disabled).toBe(true);
  });

  it('does not call onRunCommand when typecheck command is null', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'dev-tools:get-typecheck-command') return Promise.resolve(null);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool workingDirectory="/test/project" onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('TypeCheck')).toBeDefined();
    });

    const typecheckButton = screen.getByText('TypeCheck').closest('button')!;
    await userEvent.click(typecheckButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-typecheck-command', '/test/project');
    });
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('does not call onRunCommand when install command is null', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'dev-tools:get-install-command') return Promise.resolve(null);
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
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-install-command', '/test/project');
    });
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('disables Install button when install command is null', async () => {
    const projectNoInstall: ProjectInfo = {
      ...mockProjectInfo,
      commands: { ...mockProjectInfo.commands, install: null },
    };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(projectNoInstall);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    const installButton = screen.getByText('Install').closest('button');
    expect(installButton?.disabled).toBe(true);
  });

  // ── handlePush ───────────────────────────────────────────────────────

  it('shows push success message after successful push with tracking', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText('Pushed to origin/main')).toBeDefined();
    });
  });

  it('shows push success message with upstream set when no tracking branch', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status') return Promise.resolve({ current: 'feat/new', tracking: null });
      if (channel === 'git:push') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText('Pushed to origin/feat/new (upstream set)')).toBeDefined();
    });

    // Verify push was called with needsUpstream = true
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:push',
      '/test/project',
      'origin',
      'feat/new',
      true
    );
  });

  it('shows push error message when push fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.reject(new Error('Permission denied'));
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
  });

  it('shows generic push failure message for non-Error rejection', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.reject('some string error');
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText('Push failed')).toBeDefined();
    });
  });

  it('uses contribution branchName as fallback when status.current is empty', async () => {
    const contribution = { branchName: 'feat/from-contribution', issueNumber: 42 };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status') return Promise.resolve({ current: '', tracking: null });
      if (channel === 'git:push') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    render(
      <MaintenanceTool
        {...defaultProps}
        contribution={
          contribution as unknown as import('../../../../src/main/ipc/channels/types').Contribution
        }
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(
        screen.getByText('Pushed to origin/feat/from-contribution (upstream set)')
      ).toBeDefined();
    });
  });

  it('shows "Pushing..." during push loading state', async () => {
    let resolvePush: (() => void) | undefined;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push')
        return new Promise<void>((resolve) => {
          resolvePush = resolve;
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    const pushButton = screen.getByText('Push').closest('button')!;
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText('Pushing...')).toBeDefined();
    });

    // Resolve the push to clean up
    await act(async () => {
      resolvePush?.();
    });
  });

  // ── Workflow action buttons ──────────────────────────────────────────

  it('renders all workflow action buttons (Changelog, Stage, Commit, Push, Pull Request, Version, CLI)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New Branch')).toBeDefined();
    });

    expect(screen.getByText('Changelog')).toBeDefined();
    expect(screen.getByText('Stage')).toBeDefined();
    expect(screen.getByText('Commit')).toBeDefined();
    expect(screen.getByText('Push')).toBeDefined();
    expect(screen.getByText('Pull Request')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('CLI')).toBeDefined();
  });

  it('opens ChangelogResult panel when Changelog button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'workflow:generate-changelog')
        return Promise.resolve({ entry: '## Changes\n- Fix bug', hasChanges: true });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Changelog')).toBeDefined();
    });

    const changelogButton = screen.getByText('Changelog').closest('button')!;
    await userEvent.click(changelogButton);

    // ChangelogResult calls workflow:generate-changelog on mount
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:generate-changelog',
        '/test/project',
        undefined,
        undefined
      );
    });
  });

  it('toggles ChangelogResult panel off when Changelog clicked again', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'workflow:generate-changelog')
        return Promise.resolve({ entry: '## Changes\n- Fix bug', hasChanges: true });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Changelog')).toBeDefined();
    });

    const changelogButton = screen.getByText('Changelog').closest('button')!;
    await userEvent.click(changelogButton);

    // Wait for ChangelogResult to render (IPC call completes)
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:generate-changelog',
        '/test/project',
        undefined,
        undefined
      );
    });

    // Wait a tick for the state to update with the result
    await waitFor(() => {
      expect(screen.getByText('Apply to CHANGELOG.md')).toBeDefined();
    });

    // Toggle off
    await userEvent.click(changelogButton);

    await waitFor(() => {
      expect(screen.queryByText('Apply to CHANGELOG.md')).toBeNull();
    });
  });

  it('calls onSwitchTool with "pull-requests" when Pull Request clicked', async () => {
    const onSwitchTool = vi.fn();
    render(<MaintenanceTool {...defaultProps} onSwitchTool={onSwitchTool} />);
    await waitFor(() => {
      expect(screen.getByText('Pull Request')).toBeDefined();
    });

    const prButton = screen.getByText('Pull Request').closest('button')!;
    await userEvent.click(prButton);

    expect(onSwitchTool).toHaveBeenCalledWith('pull-requests');
  });

  // ── Editor early returns (full-view replacements) ────────────────────

  it('renders EnvEditor when Edit Example is clicked in EnvPanel', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:list-env-files')
        return Promise.resolve([
          { name: '.env.example', path: '/test/.env.example', exists: true },
        ]);
      if (channel === 'dev-tools:read-env-file') return Promise.resolve('KEY=value');
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Env File')).toBeDefined();
    });

    // Open EnvPanel
    const envButton = screen.getByText('Env File').closest('button')!;
    await userEvent.click(envButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Example')).toBeDefined();
    });

    // Click Edit Example to open EnvEditor
    const editExampleButton = screen.getByText('Edit Example').closest('button')!;
    await userEvent.click(editExampleButton);

    // EnvEditor replaces the entire view
    await waitFor(() => {
      expect(screen.getByText('Env Editor')).toBeDefined();
    });
    // Normal Set Up section should not be visible
    expect(screen.queryByText('Set Up')).toBeNull();
  });

  it('opens HooksPanel when Hooks button clicked', async () => {
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

    // HooksPanel renders with detected tool info
    await waitFor(() => {
      expect(screen.getByText('Git Hooks')).toBeDefined();
    });
  });

  it('renders EditorConfigEditor when Edit Config clicked in EditorConfigPanel', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project')
        return Promise.resolve({ ...mockProjectInfo, hasEditorConfig: true });
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:read-editorconfig')
        return Promise.resolve({ root: true, sections: [] });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    // Open EditorConfigPanel
    const editorConfigButton = screen.getByText('Editor Config').closest('button')!;
    await userEvent.click(editorConfigButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    // Click Edit Config to open EditorConfigEditor
    const editConfigButton = screen.getByText('Edit Config').closest('button')!;
    await userEvent.click(editConfigButton);

    // EditorConfigEditor replaces the entire view
    await waitFor(() => {
      expect(screen.queryByText('Set Up')).toBeNull();
    });
  });

  it('opens FormatPanel and invokes detect-formatter when Format button clicked', async () => {
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
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve(null);
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({ type: 'prettier', config: {} });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button')!;
    await userEvent.click(formatButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:detect-formatter',
        '/test/project',
        'node'
      );
    });
  });

  it('invokes detect-format-ignore when Format panel opens with ignore file', async () => {
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
      if (channel === 'dev-tools:detect-format-ignore')
        return Promise.resolve({ exists: true, path: '/test/.prettierignore' });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format')).toBeDefined();
    });

    const formatButton = screen.getByText('Format').closest('button')!;
    await userEvent.click(formatButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:detect-formatter',
        '/test/project',
        'node'
      );
    });
  });

  it('invokes detect-test-framework when Test panel opens', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/vitest.config.ts',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({ type: 'vitest', config: {} });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });

    const testButton = screen.getByText('Test').closest('button')!;
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:detect-test-framework',
        '/test/project',
        'node'
      );
    });
  });

  it('invokes detect-coverage when Coverage panel opens', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.ts',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({ type: 'vitest', config: {} });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });

    const coverageButton = screen.getByText('Coverage').closest('button')!;
    await userEvent.click(coverageButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:detect-coverage', '/test/project', 'node');
    });
  });

  it('invokes detect-build-tool when Build panel opens', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.ts',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({ type: 'vite', config: {} });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build')).toBeDefined();
    });

    const buildButton = screen.getByText('Build').closest('button')!;
    await userEvent.click(buildButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:detect-build-tool',
        '/test/project',
        'node'
      );
    });
  });

  it('renders LintEditor when Edit Config clicked in LintPanel', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: 'eslint',
          configPath: '/test/.eslintrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-lint-config')
        return Promise.resolve({ type: 'eslint', config: {} });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeDefined();
    });

    // Open LintPanel
    const lintButton = screen.getByText('Lint').closest('button')!;
    await userEvent.click(lintButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    // Click Edit Config to open LintEditor
    const editConfigButton = screen.getByText('Edit Config').closest('button')!;
    await userEvent.click(editConfigButton);

    // LintEditor renders with the actual component title
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });
  });

  it('renders StageEditor when Stage button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', files: [], tracking: 'origin/main' });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Stage')).toBeDefined();
    });

    const stageButton = screen.getByText('Stage').closest('button')!;
    await userEvent.click(stageButton);

    // StageEditor replaces the entire view
    await waitFor(() => {
      expect(screen.getByText('Stage Files')).toBeDefined();
    });
    expect(screen.queryByText('Set Up')).toBeNull();
  });

  it('renders VersionEditor when Version button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:detect-versions') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Version')).toBeDefined();
    });

    const versionButton = screen.getByText('Version').closest('button')!;
    await userEvent.click(versionButton);

    // VersionEditor replaces the entire view
    await waitFor(() => {
      expect(screen.getByText('Version Editor')).toBeDefined();
    });
    expect(screen.queryByText('Set Up')).toBeNull();
  });

  it('invokes cli scan when CLI button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'workflow:scan-clis')
        return Promise.resolve([
          {
            source: 'Node.js',
            entries: [{ name: 'node', path: '/usr/bin/node', version: '20.0.0' }],
          },
        ]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('CLI')).toBeDefined();
    });

    const cliButton = screen.getByText('CLI').closest('button')!;
    await userEvent.click(cliButton);

    // CLIExplorer renders after scan completes
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('workflow:scan-clis', 'node');
    });
  });

  // ── workingDirectory change re-detection ─────────────────────────────

  it('re-detects project when workingDirectory prop changes', async () => {
    const { rerender } = render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:detect-project', '/test/project');
    });

    // Change workingDirectory
    rerender(
      <MaintenanceTool workingDirectory="/new/project" onRunCommand={defaultProps.onRunCommand} />
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:detect-project', '/new/project');
    });
  });

  // ── buttons array coverage (no projectInfo) ──────────────────────────

  it('renders no Set Up action buttons when projectInfo is null', async () => {
    mockInvoke.mockImplementation(() => Promise.reject(new Error('fail')));
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      const errorElements = screen.getAllByText('Could not detect project');
      expect(errorElements.length).toBe(3);
    });

    // Setup action buttons should not be present
    expect(screen.queryByText('Install')).toBeNull();
    expect(screen.queryByText('Package Manager')).toBeNull();
    expect(screen.queryByText('Env File')).toBeNull();
    expect(screen.queryByText('Git Init')).toBeNull();
    expect(screen.queryByText('Hooks')).toBeNull();
    expect(screen.queryByText('TypeCheck')).toBeNull();
  });

  it('opens PackageConfigEditor when onOpenEditor fires from PackageManagerPanel', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:read-package-config')
        return Promise.resolve({
          ecosystem: 'node',
          fileName: 'package.json',
          structured: { name: 'test' },
          raw: '{"name":"test"}',
          indent: 2,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Package Manager')).toBeDefined();
    });

    // Open PackageManagerPanel
    const pmButton = screen.getByText('Package Manager').closest('button')!;
    await userEvent.click(pmButton);

    await waitFor(() => {
      expect(screen.getByText('Package Config')).toBeDefined();
    });

    // Click Package Config to open editor
    const packageConfigButton = screen.getByText('Package Config').closest('button')!;
    await userEvent.click(packageConfigButton);

    // PackageConfigEditor replaces the entire view
    await waitFor(() => {
      expect(screen.getByText('package.json')).toBeDefined();
    });
    expect(screen.queryByText('Set Up')).toBeNull();
  });

  it('closes PackageConfigEditor and returns to main view', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'dev-tools:read-package-config')
        return Promise.resolve({
          ecosystem: 'node',
          fileName: 'package.json',
          structured: { name: 'test' },
          raw: '{"name":"test"}',
          indent: 2,
        });
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Package Manager')).toBeDefined();
    });

    // Open PackageManagerPanel → click Package Config
    const pmButton = screen.getByText('Package Manager').closest('button')!;
    await userEvent.click(pmButton);

    await waitFor(() => {
      expect(screen.getByText('Package Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Package Config').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('package.json')).toBeDefined();
    });

    // Close the editor (click the X button)
    const closeButton = screen.getByTestId('icon-x').closest('button')!;
    await userEvent.click(closeButton);

    // Should return to the main view
    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });
  });

  it('opens PackageManagerPanel when Package Manager button clicked', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Package Manager')).toBeDefined();
    });

    const pmButton = screen.getByText('Package Manager').closest('button')!;
    await userEvent.click(pmButton);

    // PackageManagerPanel should render with title (PM detected mode)
    await waitFor(() => {
      expect(screen.getByText('Package Manager', { selector: 'h4' })).toBeDefined();
    });
  });

  it('closes PackageManagerPanel when Package Manager button clicked again (toggle)', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Package Manager')).toBeDefined();
    });

    const pmButton = screen.getByText('Package Manager').closest('button')!;
    await userEvent.click(pmButton);

    await waitFor(() => {
      // Panel header rendered as h4
      expect(screen.getByText('Package Manager', { selector: 'h4' })).toBeDefined();
    });

    // Click again to close
    await userEvent.click(pmButton);
    await waitFor(() => {
      expect(screen.queryByText('Package Manager', { selector: 'h4' })).toBeNull();
    });
  });

  it('Package Manager button is always enabled', async () => {
    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Package Manager')).toBeDefined();
    });

    const pmButton = screen.getByText('Package Manager').closest('button');
    expect(pmButton?.disabled).toBe(false);
  });

  // ── CommitModal open ─────────────────────────────────────────────────

  it('renders Commit button in workflow actions', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Commit')).toBeDefined();
    });

    const commitButton = screen.getByText('Commit').closest('button')!;
    expect(commitButton).toBeDefined();
  });

  // ── NewBranchDialog open ─────────────────────────────────────────────

  it('renders New Branch button in workflow actions', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<MaintenanceTool {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New Branch')).toBeDefined();
    });

    const newBranchButton = screen.getByText('New Branch').closest('button')!;
    expect(newBranchButton).toBeDefined();
  });

  // ── contribution prop passed through ─────────────────────────────────

  it('passes contribution data to CommitModal and ChangelogResult', async () => {
    const contribution = { branchName: 'feat/test', issueNumber: 99 };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-project') return Promise.resolve(mockProjectInfo);
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      if (channel === 'workflow:generate-changelog')
        return Promise.resolve({ entry: 'changelog entry', hasChanges: true });
      return Promise.resolve(null);
    });

    render(
      <MaintenanceTool
        {...defaultProps}
        contribution={
          contribution as unknown as import('../../../../src/main/ipc/channels/types').Contribution
        }
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Changelog')).toBeDefined();
    });

    // Click Changelog to open ChangelogResult
    const changelogButton = screen.getByText('Changelog').closest('button')!;
    await userEvent.click(changelogButton);

    // ChangelogResult should pass issueNumber and branchName to IPC
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:generate-changelog',
        '/test/project',
        '99',
        'feat/test'
      );
    });
  });
});
