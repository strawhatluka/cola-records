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

import { HooksEditor } from '../../../../src/renderer/components/tools/HooksEditor';
import type { HookConfig, HookAction, GitHookName } from '../../../../src/main/ipc/channels/types';

const mockConfig: HookConfig = {
  hookTool: 'husky',
  hooks: {
    'pre-commit': [
      {
        id: 'act-1',
        label: 'Run lint-staged',
        command: 'npx lint-staged',
        description: 'Run linters on staged files',
        enabled: true,
      },
      {
        id: 'act-2',
        label: 'TypeCheck',
        command: 'npx tsc --noEmit',
        description: 'Run TypeScript checks',
        enabled: false,
      },
    ],
    'commit-msg': [],
    'pre-push': [
      {
        id: 'act-3',
        label: 'Run tests',
        command: 'npm test',
        description: 'Run tests',
        enabled: true,
      },
    ],
    'post-merge': [],
    'post-checkout': [],
  },
  lintStaged: {
    enabled: true,
    rules: [
      {
        id: 'ls-1',
        pattern: '*.{ts,tsx}',
        commands: ['eslint --fix', 'prettier --write'],
        enabled: true,
      },
    ],
  },
};

const mockPresets: Record<GitHookName, HookAction[]> = {
  'pre-commit': [
    {
      id: 'p1',
      label: 'Run linter',
      command: 'npm run lint',
      description: 'ESLint',
      enabled: true,
    },
  ],
  'commit-msg': [],
  'pre-push': [],
  'post-merge': [],
  'post-checkout': [],
};

const defaultProps = {
  workingDirectory: '/test/project',
  hookTool: 'husky' as const,
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('HooksEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(mockConfig);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      if (channel === 'dev-tools:write-hooks-config')
        return Promise.resolve({ success: true, message: 'Saved husky configuration' });
      if (channel === 'dev-tools:setup-lint-staged')
        return Promise.resolve({ success: true, message: 'Saved lint-staged config' });
      return Promise.resolve(null);
    });
  });

  it('renders the editor header with tool name badge', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('husky')).toBeDefined();
      expect(screen.getByText('Hooks Editor')).toBeDefined();
    });
  });

  it('renders all 5 hook tabs', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pre-Commit')).toBeDefined();
    });
    expect(screen.getByText('Commit-Msg')).toBeDefined();
    expect(screen.getByText('Pre-Push')).toBeDefined();
    expect(screen.getByText('Post-Merge')).toBeDefined();
    expect(screen.getByText('Post-Checkout')).toBeDefined();
  });

  it('shows actions for the active tab', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run lint-staged')).toBeDefined();
      expect(screen.getByText('npx lint-staged')).toBeDefined();
    });
    expect(screen.getByText('TypeCheck')).toBeDefined();
  });

  it('shows action count badge on tabs with actions', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      // Pre-commit has 1 enabled action (lint-staged is enabled, TypeCheck is disabled)
      const preCommitTab = screen.getByText('Pre-Commit');
      const badge = preCommitTab.parentElement?.querySelector('.bg-primary\\/10');
      expect(badge?.textContent).toBe('1');
    });
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pre-Commit')).toBeDefined();
    });

    const prePushTab = screen.getByText('Pre-Push');
    await user.click(prePushTab);

    await waitFor(() => {
      expect(screen.getByText('Run tests')).toBeDefined();
      expect(screen.getByText('npm test')).toBeDefined();
    });
  });

  it('shows empty state for tabs with no actions', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pre-Commit')).toBeDefined();
    });

    await user.click(screen.getByText('Commit-Msg'));

    await waitFor(() => {
      expect(screen.getByText('No actions configured for commit-msg.')).toBeDefined();
    });
  });

  it('shows Custom Action and From Preset buttons', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
      expect(screen.getByText('From Preset')).toBeDefined();
    });
  });

  it('opens add custom action form when Custom Action clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    await user.click(screen.getByText('Custom Action'));
    expect(screen.getByPlaceholderText('Label (e.g. Run tests)')).toBeDefined();
    expect(screen.getByPlaceholderText('Command (e.g. npm test)')).toBeDefined();
  });

  it('adds custom action when form submitted', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    await user.click(screen.getByText('Custom Action'));

    const labelInput = screen.getByPlaceholderText('Label (e.g. Run tests)');
    const commandInput = screen.getByPlaceholderText('Command (e.g. npm test)');

    await user.type(labelInput, 'Build project');
    await user.type(commandInput, 'npm run build');

    const addBtn = screen.getByText('Add');
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Build project')).toBeDefined();
      expect(screen.getByText('npm run build')).toBeDefined();
    });
  });

  it('calls write-hooks-config when Save clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make a change to enable dirty state
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Test');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'npm test');
    await user.click(screen.getByText('Add'));

    // Click Save
    const saveBtn = screen.getByText('Save').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-hooks-config',
        '/test/project',
        expect.objectContaining({ hookTool: 'husky' })
      );
    });
  });

  it('shows lint-staged section on pre-commit tab for Husky', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('lint-staged')).toBeDefined();
      expect(screen.getByText('*.{ts,tsx}')).toBeDefined();
    });
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<HooksEditor {...defaultProps} />);
    expect(screen.getByText('Loading hooks config...')).toBeDefined();
  });

  it('shows unsaved changes prompt when closing with dirty state', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make a change
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    // Click close
    const closeBtn = screen.getByTitle('Close editor');
    await user.click(closeBtn);

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('calls onClose when Close without saving clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make a change
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    await user.click(screen.getByTitle('Close editor'));
    await user.click(screen.getByText('Close without saving'));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
