import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { BashProfileTab } from '../../../../src/renderer/components/settings/BashProfileTab';
import { createMockSettings, createMockAlias } from '../../../mocks/factories';

describe('BashProfileTab', () => {
  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  // =====================
  // Shell Aliases Tests
  // =====================

  describe('Shell Aliases', () => {
    it('renders empty state when no aliases', () => {
      render(
        <BashProfileTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />
      );
      expect(screen.getByText(/No custom aliases defined/)).toBeDefined();
    });

    it('renders existing aliases', () => {
      const settings = createMockSettings({
        aliases: [
          createMockAlias({ name: 'gp', command: 'git push' }),
          createMockAlias({ name: 'ga', command: 'git add .' }),
        ],
      });

      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('gp')).toBeDefined();
      expect(screen.getByText('git push')).toBeDefined();
      expect(screen.getByText('ga')).toBeDefined();
      expect(screen.getByText('git add .')).toBeDefined();
    });

    it('shows add alias form', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Add Alias')).toBeDefined();
      expect(screen.getByPlaceholderText('name (e.g. gp)')).toBeDefined();
      expect(screen.getByPlaceholderText('command (e.g. git push)')).toBeDefined();
    });

    it('validates empty alias name', async () => {
      const user = userEvent.setup();
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);

      // Type only command, not name
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
      // Button should be disabled since name is empty
      const addButton = screen.getByText('Add').closest('button');
      expect(addButton).toBeDisabled();
    });

    it('validates alias name with spaces', async () => {
      const user = userEvent.setup();
      render(
        <BashProfileTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />
      );

      await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'bad name');
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
      await user.click(screen.getByText('Add'));

      expect(screen.getByText('Alias name cannot contain spaces')).toBeDefined();
    });

    it('adds a new alias to local state (not saved until Save button)', async () => {
      const user = userEvent.setup();
      render(
        <BashProfileTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />
      );

      await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'gp');
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
      await user.click(screen.getByText('Add'));

      // Should NOT call onUpdate yet - changes are local only
      expect(mockOnUpdate).not.toHaveBeenCalled();
      // The alias should appear in the UI
      expect(screen.getByText('gp')).toBeDefined();
      expect(screen.getByText('git push')).toBeDefined();
    });

    it('shows default aliases info text', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(
        screen.getByText(/Default aliases.*ll, gs, gd, gl.*are always included/)
      ).toBeDefined();
    });

    it('shows error for duplicate alias name', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        aliases: [createMockAlias({ name: 'gp', command: 'git push' })],
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'gp');
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git pull');
      await user.click(screen.getByText('Add'));

      expect(screen.getByText('Alias "gp" already exists')).toBeDefined();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('deletes an alias from local state (not saved until Save button)', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        aliases: [
          createMockAlias({ name: 'gp', command: 'git push' }),
          createMockAlias({ name: 'll', command: 'ls -la' }),
        ],
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      const deleteButtons = screen.getAllByTestId('icon-trash2');
      await user.click(deleteButtons[0].closest('button')!);

      // Should NOT call onUpdate yet - changes are local only
      expect(mockOnUpdate).not.toHaveBeenCalled();
      // The alias should be removed from UI
      expect(screen.queryByText('gp')).toBeNull();
      // Other alias should still be visible
      expect(screen.getByText('ll')).toBeDefined();
    });
  });

  // =====================
  // Prompt Customization Tests
  // =====================

  describe('Prompt Customization', () => {
    it('renders prompt customization card', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Prompt Customization')).toBeDefined();
    });

    it('shows preview section', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Preview')).toBeDefined();
    });

    it('renders show username toggle', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Show Username')).toBeDefined();
      expect(screen.getByText(/Display your username at the start of the prompt/)).toBeDefined();
    });

    it('renders show git branch toggle', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Show Git Branch')).toBeDefined();
      expect(screen.getByText(/Display the current git branch in parentheses/)).toBeDefined();
    });

    it('renders color selects', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Username Color')).toBeDefined();
      expect(screen.getByText('Path Color')).toBeDefined();
      expect(screen.getByText('Git Branch Color')).toBeDefined();
    });

    it('uses default bash profile values when not set', () => {
      const settings = createMockSettings({ bashProfile: undefined });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // Should render with defaults (showUsername and showGitBranch both true)
      const toggles = screen.getAllByRole('switch');
      expect(toggles.length).toBe(2);
      // Both toggles should be checked (defaults)
      toggles.forEach((toggle) => {
        expect(toggle.getAttribute('data-state')).toBe('checked');
      });
    });

    it('respects existing bash profile settings', () => {
      const settings = createMockSettings({
        bashProfile: {
          showUsername: false,
          showGitBranch: true,
          usernameColor: 'red',
          pathColor: 'cyan',
          gitBranchColor: 'magenta',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      const toggles = screen.getAllByRole('switch');
      // First toggle (showUsername) should be unchecked
      expect(toggles[0].getAttribute('data-state')).toBe('unchecked');
      // Second toggle (showGitBranch) should be checked
      expect(toggles[1].getAttribute('data-state')).toBe('checked');
    });

    it('updates showUsername in local state (not saved until Save button)', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      const toggles = screen.getAllByRole('switch');
      await user.click(toggles[0]); // Click showUsername toggle

      // Should NOT call onUpdate yet - changes are local only
      expect(mockOnUpdate).not.toHaveBeenCalled();
      // Toggle should now be unchecked
      expect(toggles[0].getAttribute('data-state')).toBe('unchecked');
    });

    it('updates showGitBranch in local state (not saved until Save button)', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      const toggles = screen.getAllByRole('switch');
      await user.click(toggles[1]); // Click showGitBranch toggle

      // Should NOT call onUpdate yet - changes are local only
      expect(mockOnUpdate).not.toHaveBeenCalled();
      // Toggle should now be unchecked
      expect(toggles[1].getAttribute('data-state')).toBe('unchecked');
    });

    it('shows note about changes taking effect on next session', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(
        screen.getByText(/Changes take effect on the next Development session start/)
      ).toBeDefined();
    });

    it('shows custom username input when showUsername is true', () => {
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Custom Username')).toBeDefined();
      expect(screen.getByPlaceholderText('Leave empty to use system username')).toBeDefined();
    });

    it('hides custom username input when showUsername is false', () => {
      const settings = createMockSettings({
        bashProfile: {
          showUsername: false,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.queryByText('Custom Username')).toBeNull();
    });

    it('updates customUsername in local state (not saved until Save button)', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText('Leave empty to use system username');
      await user.type(input, 'devuser');

      // Should NOT call onUpdate yet - changes are local only
      expect(mockOnUpdate).not.toHaveBeenCalled();
      // Input should show the typed value
      expect(input).toHaveValue('devuser');
      // Preview should update to show the custom username
      expect(screen.getByText('devuser')).toBeDefined();
    });

    it('shows custom username in preview when set', () => {
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
          customUsername: 'devuser',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // The preview should show 'devuser' instead of 'user'
      expect(screen.getByText('devuser')).toBeDefined();
    });

    it('shows default user in preview when customUsername is empty', () => {
      const settings = createMockSettings({
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
          customUsername: '',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // The preview should show 'user' (default)
      expect(screen.getByText('user')).toBeDefined();
    });
  });

  // =====================
  // Save Settings Tests
  // =====================

  describe('Save Settings Button', () => {
    it('renders Save Settings button', () => {
      render(<BashProfileTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Save Settings')).toBeDefined();
    });

    it('calls onUpdate with aliases and bashProfile when Save is clicked', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        aliases: [createMockAlias({ name: 'existing', command: 'cmd' })],
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // Add a new alias
      await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'gp');
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
      await user.click(screen.getByText('Add'));

      // onUpdate should not have been called yet
      expect(mockOnUpdate).not.toHaveBeenCalled();

      // Click Save Settings
      await user.click(screen.getByText('Save Settings'));

      // Now onUpdate should have been called with all state
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith({
        aliases: [
          { name: 'existing', command: 'cmd' },
          { name: 'gp', command: 'git push' },
        ],
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
    });

    it('saves multiple changes at once when Save is clicked', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        aliases: [],
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // Toggle showUsername off
      const toggles = screen.getAllByRole('switch');
      await user.click(toggles[0]);

      // Add an alias
      await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'myalias');
      await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'my command');
      await user.click(screen.getByText('Add'));

      // Click Save Settings
      await user.click(screen.getByText('Save Settings'));

      // Both changes should be saved together
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith({
        aliases: [{ name: 'myalias', command: 'my command' }],
        bashProfile: {
          showUsername: false,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
    });

    it('saves custom username when Save is clicked', async () => {
      const user = userEvent.setup();
      const settings = createMockSettings({
        aliases: [],
        bashProfile: {
          showUsername: true,
          showGitBranch: true,
          usernameColor: 'green',
          pathColor: 'blue',
          gitBranchColor: 'yellow',
        },
      });
      render(<BashProfileTab settings={settings} onUpdate={mockOnUpdate} />);

      // Type custom username
      const input = screen.getByPlaceholderText('Leave empty to use system username');
      await user.type(input, 'myuser');

      // Click Save Settings
      await user.click(screen.getByText('Save Settings'));

      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      const call = mockOnUpdate.mock.calls[0][0];
      expect(call.bashProfile.customUsername).toBe('myuser');
    });
  });
});
