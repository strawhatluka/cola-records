import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { HooksPanel } from '../../../../src/renderer/components/tools/HooksPanel';
import type { HooksDetectionResult } from '../../../../src/main/ipc/channels/types';

const noHooksDetection: HooksDetectionResult = {
  detected: null,
  recommendations: [
    { tool: 'husky', reason: 'Most popular for Node.js', supportsLintStaged: true },
    { tool: 'lefthook', reason: 'Fast polyglot manager', supportsLintStaged: false },
  ],
  ecosystem: 'node',
  hasLintStaged: false,
  existingConfig: null,
};

const huskyDetection: HooksDetectionResult = {
  detected: 'husky',
  recommendations: [],
  ecosystem: 'node',
  hasLintStaged: false,
  existingConfig: {
    hookTool: 'husky',
    hooks: {
      'pre-commit': [
        {
          id: '1',
          label: 'lint-staged',
          command: 'npx lint-staged',
          description: '',
          enabled: true,
        },
      ],
      'commit-msg': [],
      'pre-push': [],
      'post-merge': [],
      'post-checkout': [],
    },
    lintStaged: null,
  },
};

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  hookTool: null as ReturnType<() => null>,
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onRunCommand: vi.fn(),
  onSetupComplete: vi.fn(),
};

describe('HooksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });
  });

  // ── Setup Wizard ──

  it('shows setup wizard when no hook tool detected', async () => {
    render(<HooksPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Git Hooks Setup')).toBeDefined();
    });
  });

  it('shows tool recommendations in setup wizard', async () => {
    render(<HooksPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('husky')).toBeDefined();
      expect(screen.getByText('lefthook')).toBeDefined();
    });
  });

  it('shows lint-staged badge for tools that support it', async () => {
    render(<HooksPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('lint-staged')).toBeDefined();
    });
  });

  it('shows Set Up button in wizard mode', async () => {
    render(<HooksPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });
  });

  it('calls setup-hook-tool and onSetupComplete when Set Up clicked', async () => {
    const onSetupComplete = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      if (channel === 'dev-tools:setup-hook-tool')
        return Promise.resolve({ success: true, message: 'Created husky configuration' });
      if (channel === 'dev-tools:get-lint-staged-presets') return Promise.resolve([]);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} onSetupComplete={onSetupComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });

    const setupBtn = screen.getByText('Set Up').closest('button')!;
    await user.click(setupBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:setup-hook-tool',
        '/test/project',
        'husky',
        'node'
      );
      expect(onSetupComplete).toHaveBeenCalledWith('husky');
    });
  });

  it('calls onClose when close button clicked in wizard', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Git Hooks Setup')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Action Buttons Mode ──

  it('shows action buttons when hook tool is detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Git Hooks')).toBeDefined();
      expect(screen.getByText('Install')).toBeDefined();
      expect(screen.getByText('Edit Config')).toBeDefined();
      expect(screen.getByText('Add Presets')).toBeDefined();
    });
  });

  it('shows Lint-Staged button for Husky', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Lint-Staged')).toBeDefined();
    });
  });

  it('hides Lint-Staged button for Lefthook', async () => {
    const lefthookDetection: HooksDetectionResult = {
      ...huskyDetection,
      detected: 'lefthook',
    };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(lefthookDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    render(<HooksPanel {...defaultProps} hookTool="lefthook" />);

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    expect(screen.queryByText('Lint-Staged')).toBeNull();
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    const onOpenEditor = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" onOpenEditor={onOpenEditor} />);

    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    const editBtn = screen.getByText('Edit Config').closest('button')!;
    await user.click(editBtn);
    expect(onOpenEditor).toHaveBeenCalledOnce();
  });

  it('calls onRunCommand with install command when Install clicked', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-hook-install-cmd') return Promise.resolve('npx husky init');
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" onRunCommand={onRunCommand} />);

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    const installBtn = screen.getByText('Install').closest('button')!;
    await user.click(installBtn);

    await waitFor(() => {
      expect(onRunCommand).toHaveBeenCalledWith('npx husky init');
    });
  });

  it('shows detecting state while loading', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<HooksPanel {...defaultProps} />);
    expect(screen.getByText('Detecting hooks...')).toBeDefined();
  });

  // ── Detection Error Path ──

  it('stops detecting when detection fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.reject(new Error('Network error'));
      return Promise.resolve({ success: true, message: 'Done' });
    });

    render(<HooksPanel {...defaultProps} />);

    // Initially shows detecting state
    expect(screen.getByText('Detecting hooks...')).toBeDefined();

    // After rejection, detecting becomes false but no detection result,
    // so it renders neither wizard nor action buttons (hookTool is null and detection is null)
    await waitFor(() => {
      expect(screen.queryByText('Detecting hooks...')).toBeNull();
    });
  });

  // ── Setup Wizard - Tool Selection ──

  it('selects a different tool when recommendation is clicked', async () => {
    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('lefthook')).toBeDefined();
    });

    // Click on lefthook recommendation
    const lefthookBtn = screen.getByText('lefthook').closest('button')!;
    await user.click(lefthookBtn);

    // Now click Set Up - it should invoke setup with lefthook
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      if (channel === 'dev-tools:setup-hook-tool')
        return Promise.resolve({ success: true, message: 'Configured lefthook' });
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const setupBtn = screen.getByText('Set Up').closest('button')!;
    await user.click(setupBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:setup-hook-tool',
        '/test/project',
        'lefthook',
        'node'
      );
    });
  });

  it('hides lint-staged checkbox when selected tool does not support it', async () => {
    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('husky')).toBeDefined();
    });

    // Initially husky is selected which supports lint-staged, so checkbox is shown
    expect(screen.getByText('Include lint-staged')).toBeDefined();

    // Click lefthook which does not support lint-staged
    const lefthookBtn = screen.getByText('lefthook').closest('button')!;
    await user.click(lefthookBtn);

    // Checkbox should disappear since lefthook does not support lint-staged
    expect(screen.queryByText('Include lint-staged')).toBeNull();
  });

  it('toggles lint-staged checkbox in setup wizard', async () => {
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Include lint-staged')).toBeDefined();
    });

    const checkbox = screen.getByRole('checkbox');

    // Default state: husky auto-selects includeLintStaged=true (supportsLintStaged)
    expect(checkbox).toBeChecked();

    // Uncheck the checkbox
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Re-check the checkbox
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  // ── Setup Wizard - Setup with lint-staged ──

  it('sets up lint-staged when setup succeeds and lint-staged is included', async () => {
    const onSetupComplete = vi.fn();
    const lintStagedPresets = [
      { id: 'p1', pattern: '*.ts', commands: ['eslint --fix'], enabled: true },
    ];

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      if (channel === 'dev-tools:setup-hook-tool')
        return Promise.resolve({ success: true, message: 'Created husky configuration' });
      if (channel === 'dev-tools:get-lint-staged-presets')
        return Promise.resolve(lintStagedPresets);
      if (channel === 'dev-tools:setup-lint-staged')
        return Promise.resolve({ success: true, message: 'Lint-staged configured' });
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} onSetupComplete={onSetupComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });

    // Ensure lint-staged checkbox is checked (husky auto-selects it)
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    const setupBtn = screen.getByText('Set Up').closest('button')!;
    await user.click(setupBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:setup-hook-tool',
        '/test/project',
        'husky',
        'node'
      );
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-lint-staged-presets', 'node');
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:setup-lint-staged', '/test/project', {
        enabled: true,
        rules: lintStagedPresets,
      });
      expect(onSetupComplete).toHaveBeenCalledWith('husky');
    });
  });

  it('shows status message when setup fails with success false', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      if (channel === 'dev-tools:setup-hook-tool')
        return Promise.resolve({ success: false, message: 'Permission denied' });
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });

    const setupBtn = screen.getByText('Set Up').closest('button')!;
    await user.click(setupBtn);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
  });

  it('shows Failed when setup throws an error', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(noHooksDetection);
      if (channel === 'dev-tools:setup-hook-tool')
        return Promise.reject(new Error('Network error'));
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });

    const setupBtn = screen.getByText('Set Up').closest('button')!;
    await user.click(setupBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── Detection with no recommendations (selectedTool remains null) ──

  it('does not call setup when selectedTool is null', async () => {
    const emptyRecsDetection: HooksDetectionResult = {
      detected: null,
      recommendations: [],
      ecosystem: 'node',
      hasLintStaged: false,
      existingConfig: null,
    };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(emptyRecsDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set Up')).toBeDefined();
    });

    // The Set Up button should be disabled since selectedTool is null
    const setupBtn = screen.getByText('Set Up').closest('button')!;
    expect(setupBtn).toBeDisabled();

    // Click anyway - handleSetup should early-return
    await user.click(setupBtn);

    // Verify setup-hook-tool was never called
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'dev-tools:setup-hook-tool',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  // ── Action Buttons - Lint-Staged ──

  it('calls lint-staged setup when Lint-Staged button clicked with presets', async () => {
    const lintStagedPresets = [
      { id: 'p1', pattern: '*.ts', commands: ['eslint --fix'], enabled: true },
    ];

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-lint-staged-presets')
        return Promise.resolve(lintStagedPresets);
      if (channel === 'dev-tools:setup-lint-staged')
        return Promise.resolve({ success: true, message: 'Lint-staged configured' });
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Lint-Staged')).toBeDefined();
    });

    const lintStagedBtn = screen.getByText('Lint-Staged').closest('button')!;
    await user.click(lintStagedBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-lint-staged-presets', 'node');
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:setup-lint-staged', '/test/project', {
        enabled: true,
        rules: lintStagedPresets,
      });
      expect(screen.getByText('Lint-staged configured')).toBeDefined();
    });
  });

  it('shows no presets message when lint-staged presets are empty', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-lint-staged-presets') return Promise.resolve([]);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Lint-Staged')).toBeDefined();
    });

    const lintStagedBtn = screen.getByText('Lint-Staged').closest('button')!;
    await user.click(lintStagedBtn);

    await waitFor(() => {
      expect(screen.getByText('No presets for this ecosystem')).toBeDefined();
    });
  });

  it('shows Failed when lint-staged setup throws an error', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-lint-staged-presets')
        return Promise.reject(new Error('Network error'));
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Lint-Staged')).toBeDefined();
    });

    const lintStagedBtn = screen.getByText('Lint-Staged').closest('button')!;
    await user.click(lintStagedBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── Action Buttons - Info ──

  it('shows tool info when Info button clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('husky')).toBeDefined();
    });

    // The Info button shows the hookTool name as its label
    const infoBtn = screen.getByText('husky').closest('button')!;
    await user.click(infoBtn);

    await waitFor(() => {
      expect(screen.getByText('Tool: husky')).toBeDefined();
    });
  });

  // ── Action Buttons - Add Presets ──

  it('writes hooks config when Add Presets clicked', async () => {
    const hookPresets = {
      'pre-commit': [
        { id: '1', label: 'lint', command: 'npm run lint', description: '', enabled: true },
      ],
    };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(hookPresets);
      if (channel === 'dev-tools:write-hooks-config')
        return Promise.resolve({ success: true, message: 'Hooks written' });
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Add Presets')).toBeDefined();
    });

    const presetsBtn = screen.getByText('Add Presets').closest('button')!;
    await user.click(presetsBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-hook-presets', 'node', 'husky');
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:write-hooks-config', '/test/project', {
        hookTool: 'husky',
        hooks: hookPresets,
        lintStaged: null,
      });
      expect(screen.getByText('Hooks written')).toBeDefined();
    });
  });

  it('shows Failed when Add Presets throws an error', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-hook-presets') return Promise.reject(new Error('Disk error'));
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Add Presets')).toBeDefined();
    });

    const presetsBtn = screen.getByText('Add Presets').closest('button')!;
    await user.click(presetsBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── Action Buttons - Install error ──

  it('shows Failed when Install throws an error', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      if (channel === 'dev-tools:get-hook-install-cmd')
        return Promise.reject(new Error('Command error'));
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" />);

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    const installBtn = screen.getByText('Install').closest('button')!;
    await user.click(installBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── Action Buttons - Close in action mode ──

  it('calls onClose when close button clicked in action mode', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(huskyDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    const user = userEvent.setup();
    render(<HooksPanel {...defaultProps} hookTool="husky" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Git Hooks')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Lint-Staged button for simple-git-hooks ──

  it('shows Lint-Staged button for simple-git-hooks', async () => {
    const simpleGitHooksDetection: HooksDetectionResult = {
      ...huskyDetection,
      detected: 'simple-git-hooks',
    };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-hooks') return Promise.resolve(simpleGitHooksDetection);
      return Promise.resolve({ success: true, message: 'Done' });
    });

    render(<HooksPanel {...defaultProps} hookTool="simple-git-hooks" />);

    await waitFor(() => {
      expect(screen.getByText('Lint-Staged')).toBeDefined();
    });
  });
});
