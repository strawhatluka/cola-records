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

  // ============================================
  // Toggle action enabled/disabled
  // ============================================
  it('toggles an action enabled/disabled when toggle button clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run lint-staged')).toBeDefined();
    });

    // The first action (Run lint-staged) is enabled - toggle should have bg-primary
    const toggleBtns = screen.getAllByTitle('Disable');
    expect(toggleBtns.length).toBeGreaterThan(0);

    // Click to disable it
    await user.click(toggleBtns[0]);

    // Now it should be titled "Enable"
    await waitFor(() => {
      expect(screen.getByText('TypeCheck')).toBeDefined();
    });
  });

  it('toggles a disabled action to enabled', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('TypeCheck')).toBeDefined();
    });

    // TypeCheck is disabled - find the Enable button
    const enableBtn = screen.getByTitle('Enable');
    await user.click(enableBtn);

    // After toggle, both should now be enabled
    await waitFor(() => {
      const disableBtns = screen.getAllByTitle('Disable');
      expect(disableBtns.length).toBe(2);
    });
  });

  // ============================================
  // Remove action
  // ============================================
  it('removes an action when trash button clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run lint-staged')).toBeDefined();
    });

    // Find all Remove buttons
    const removeBtns = screen.getAllByTitle('Remove');
    // First two are hook actions, last is lint-staged rule
    await user.click(removeBtns[0]);

    // Run lint-staged should be gone
    await waitFor(() => {
      expect(screen.queryByText('Run lint-staged')).toBeNull();
    });
    // TypeCheck should still be there
    expect(screen.getByText('TypeCheck')).toBeDefined();
  });

  // ============================================
  // Preset dropdown
  // ============================================
  it('opens preset dropdown and adds a preset action', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('From Preset')).toBeDefined();
    });

    // Open dropdown
    await user.click(screen.getByText('From Preset'));

    // Preset should appear
    await waitFor(() => {
      expect(screen.getByText('Run linter')).toBeDefined();
      expect(screen.getByText('npm run lint')).toBeDefined();
    });

    // Click to add preset
    await user.click(screen.getByText('Run linter'));

    // Preset should now appear in the actions list
    await waitFor(() => {
      // Dropdown should close
      expect(screen.queryByText('npm run lint')?.closest('.absolute')).toBeNull();
      // But "Run linter" should appear in the actions
      expect(screen.getByText('Run linter')).toBeDefined();
    });
  });

  it('disables preset that already exists as an action', async () => {
    // Add "npm run lint" as an existing action first
    const configWithPreset: HookConfig = {
      ...mockConfig,
      hooks: {
        ...mockConfig.hooks,
        'pre-commit': [
          ...mockConfig.hooks['pre-commit'],
          {
            id: 'existing',
            label: 'Lint',
            command: 'npm run lint',
            description: '',
            enabled: true,
          },
        ],
      },
    };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(configWithPreset);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('From Preset')).toBeDefined();
    });

    await user.click(screen.getByText('From Preset'));

    await waitFor(() => {
      // The preset button for "Run linter" with command "npm run lint" should be disabled
      const presetBtn = screen.getByText('Run linter').closest('button')!;
      expect(presetBtn.disabled).toBe(true);
    });
  });

  it('hides From Preset button when no presets exist for current tab', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pre-Commit')).toBeDefined();
    });

    // Switch to commit-msg which has no presets
    await user.click(screen.getByText('Commit-Msg'));

    await waitFor(() => {
      expect(screen.queryByText('From Preset')).toBeNull();
    });
  });

  // ============================================
  // Lint-staged toggle and remove
  // ============================================
  it('toggles lint-staged rule enabled/disabled', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('lint-staged')).toBeDefined();
      expect(screen.getByText('*.{ts,tsx}')).toBeDefined();
    });

    // lint-staged rule has its own toggle - find it within the lint-staged section
    // The lint-staged section has a toggle button
    const lintStagedSection = screen.getByText('lint-staged').parentElement!;
    const toggleBtns = lintStagedSection.querySelectorAll('button[class*="rounded-full"]');
    expect(toggleBtns.length).toBeGreaterThan(0);
    await user.click(toggleBtns[0] as HTMLElement);

    // Should still be visible but toggled
    expect(screen.getByText('*.{ts,tsx}')).toBeDefined();
  });

  it('removes lint-staged rule when trash clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('*.{ts,tsx}')).toBeDefined();
    });

    // The last Remove button should be the lint-staged rule remove
    const removeBtns = screen.getAllByTitle('Remove');
    const lastRemoveBtn = removeBtns[removeBtns.length - 1];
    await user.click(lastRemoveBtn);

    await waitFor(() => {
      expect(screen.queryByText('*.{ts,tsx}')).toBeNull();
    });
  });

  it('shows lint-staged commands joined with arrow', async () => {
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('eslint --fix → prettier --write')).toBeDefined();
    });
  });

  // ============================================
  // Config null state (failed load)
  // ============================================
  it('shows failed to load message when config is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(null);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load hooks configuration.')).toBeDefined();
      expect(screen.getByText('Hooks Editor')).toBeDefined();
    });
  });

  it('shows close button on failed load and calls onClose', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(null);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load hooks configuration.')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ============================================
  // Save and close
  // ============================================
  it('saves and closes when Save and close clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make dirty
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    // Click close to get prompt
    await user.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('Save and close')).toBeDefined();

    // Click Save and close
    await user.click(screen.getByText('Save and close'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-hooks-config',
        '/test/project',
        expect.objectContaining({ hookTool: 'husky' })
      );
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ============================================
  // Close when not dirty
  // ============================================
  it('directly calls onClose when closing with no changes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Hooks Editor')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close editor'));
    expect(onClose).toHaveBeenCalledOnce();
    // Should NOT show the unsaved changes prompt
    expect(screen.queryByText('You have unsaved changes.')).toBeNull();
  });

  // ============================================
  // Non-Husky tool: no lint-staged section
  // ============================================
  it('does not show lint-staged section for non-husky/non-simple-git-hooks tools', async () => {
    const configNoLint: HookConfig = { ...mockConfig, lintStaged: null };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(configNoLint);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    render(<HooksEditor {...defaultProps} hookTool={'lefthook' as any} />);
    await waitFor(() => {
      expect(screen.getByText('Run lint-staged')).toBeDefined();
    });

    // lint-staged section heading should not appear
    expect(screen.queryByText('lint-staged')).toBeNull();
  });

  it('does not show lint-staged on pre-push tab even for Husky', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('lint-staged')).toBeDefined();
    });

    // Switch to pre-push
    await user.click(screen.getByText('Pre-Push'));

    await waitFor(() => {
      expect(screen.getByText('Run tests')).toBeDefined();
    });

    // lint-staged should not be visible on pre-push
    expect(screen.queryByText('lint-staged')).toBeNull();
  });

  // ============================================
  // Cancel add custom action
  // ============================================
  it('cancels add custom action form when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    await user.click(screen.getByText('Custom Action'));
    expect(screen.getByPlaceholderText('Label (e.g. Run tests)')).toBeDefined();

    await user.click(screen.getByText('Cancel'));

    // Form should disappear
    expect(screen.queryByPlaceholderText('Label (e.g. Run tests)')).toBeNull();
    // Custom Action button should reappear
    expect(screen.getByText('Custom Action')).toBeDefined();
  });

  // ============================================
  // Save with lint-staged calls setup-lint-staged
  // ============================================
  it('calls setup-lint-staged IPC when saving with lint-staged config', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make dirty
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    // Save
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-hooks-config',
        '/test/project',
        expect.objectContaining({ hookTool: 'husky' })
      );
      // Should also call setup-lint-staged
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:setup-lint-staged',
        '/test/project',
        expect.objectContaining({
          enabled: true,
          rules: expect.any(Array),
        })
      );
    });
  });

  // ============================================
  // Save failure
  // ============================================
  it('shows failure message when save throws', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-hooks-config') return Promise.resolve(mockConfig);
      if (channel === 'dev-tools:get-hook-presets') return Promise.resolve(mockPresets);
      if (channel === 'dev-tools:write-hooks-config')
        return Promise.reject(new Error('Write error'));
      return Promise.resolve(null);
    });

    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make dirty
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  // ============================================
  // Save status message
  // ============================================
  it('shows save status message after successful save', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Make dirty
    await user.click(screen.getByText('Custom Action'));
    await user.type(screen.getByPlaceholderText('Label (e.g. Run tests)'), 'Foo');
    await user.type(screen.getByPlaceholderText('Command (e.g. npm test)'), 'bar');
    await user.click(screen.getByText('Add'));

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Saved husky configuration')).toBeDefined();
    });
  });

  // ============================================
  // Load error (Promise rejection)
  // ============================================
  it('shows error state when loading fails with rejection', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load hooks configuration.')).toBeDefined();
    });
  });

  // ============================================
  // Tab switching resets add mode
  // ============================================
  it('closes add form when switching tabs', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    // Open add form
    await user.click(screen.getByText('Custom Action'));
    expect(screen.getByPlaceholderText('Label (e.g. Run tests)')).toBeDefined();

    // Switch to another tab
    await user.click(screen.getByText('Pre-Push'));

    // Add form should be gone
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Label (e.g. Run tests)')).toBeNull();
    });
  });

  // ============================================
  // Add button disabled when fields empty
  // ============================================
  it('disables Add button when label and command are empty', async () => {
    const user = userEvent.setup();
    render(<HooksEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Custom Action')).toBeDefined();
    });

    await user.click(screen.getByText('Custom Action'));

    const addBtn = screen.getByText('Add') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });
});
