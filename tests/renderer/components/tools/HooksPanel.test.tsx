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
});
