import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { SSHRemotesTab } from '../../../../src/renderer/components/settings/SSHRemotesTab';

function createRemote(
  overrides: Partial<{
    id: string;
    name: string;
    hostname: string;
    user: string;
    port: number;
    keyPath: string;
    identitiesOnly: boolean;
  }> = {}
) {
  return {
    id: overrides.id ?? 'r1',
    name: overrides.name ?? 'my-pi',
    hostname: overrides.hostname ?? '192.168.1.10',
    user: overrides.user ?? 'pi',
    port: overrides.port ?? 22,
    keyPath: overrides.keyPath ?? '/home/user/.ssh/id_rsa',
    identitiesOnly: overrides.identitiesOnly ?? true,
  };
}

describe('SSHRemotesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  // ============================================
  // Loading state
  // ============================================
  it('shows loading state initially', () => {
    // Don't resolve the invoke immediately
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<SSHRemotesTab />);
    expect(screen.getByText('Loading SSH remotes...')).toBeDefined();
  });

  // ============================================
  // Empty state
  // ============================================
  it('renders empty state when no remotes', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });
    expect(screen.getByText('No SSH remotes configured yet.')).toBeDefined();
    expect(screen.getByText('Add SSH Remote')).toBeDefined();
  });

  it('renders title and description', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });
    expect(screen.getByText('SSH Remotes')).toBeDefined();
    expect(screen.getByText('Configured Remotes')).toBeDefined();
  });

  // ============================================
  // Remotes list
  // ============================================
  it('renders list of remotes', async () => {
    const remotes = [
      createRemote({ id: 'r1', name: 'server-1', hostname: '10.0.0.1', user: 'admin' }),
      createRemote({ id: 'r2', name: 'server-2', hostname: '10.0.0.2', user: 'root' }),
    ];
    mockInvoke.mockResolvedValue(remotes);

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    expect(screen.getByText('server-1')).toBeDefined();
    expect(screen.getByText('server-2')).toBeDefined();
    expect(screen.getByText('admin@10.0.0.1:22')).toBeDefined();
    expect(screen.getByText('root@10.0.0.2:22')).toBeDefined();
    expect(screen.getByText('2 remotes configured')).toBeDefined();
  });

  it('shows singular text for one remote', async () => {
    mockInvoke.mockResolvedValue([createRemote()]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });
    expect(screen.getByText('1 remote configured')).toBeDefined();
  });

  // ============================================
  // Add form
  // ============================================
  it('opens add form on button click', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));
    expect(screen.getByText('Add New Remote')).toBeDefined();
    expect(screen.getByLabelText('Host Name *')).toBeDefined();
    expect(screen.getByLabelText('Hostname / IP Address *')).toBeDefined();
    expect(screen.getByLabelText('Username *')).toBeDefined();
    expect(screen.getByLabelText('Port')).toBeDefined();
    expect(screen.getByLabelText('Private Key Path *')).toBeDefined();
  });

  it('cancels add form', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));
    expect(screen.getByText('Add New Remote')).toBeDefined();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add New Remote')).toBeNull();
  });

  it('cancels form on Escape key', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));
    expect(screen.getByText('Add New Remote')).toBeDefined();

    // Fire keydown on the form container
    const nameInput = screen.getByLabelText('Host Name *');
    fireEvent.keyDown(nameInput, { key: 'Escape' });
    expect(screen.queryByText('Add New Remote')).toBeNull();
  });

  // ============================================
  // Validation
  // ============================================
  it('validates empty host name', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    // Fill hostname/user/keyPath but leave name empty
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/path/to/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Host name is required')).toBeDefined();
    });
  });

  it('validates host name with spaces', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'my server' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Host name cannot contain spaces')).toBeDefined();
    });
  });

  it('validates host name with special characters', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'my@server!' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(
        screen.getByText('Host name can only contain letters, numbers, hyphens, and underscores')
      ).toBeDefined();
    });
  });

  it('validates empty hostname/IP', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'valid-name' },
    });
    // Leave hostname empty
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Hostname/IP is required')).toBeDefined();
    });
  });

  it('validates empty key path', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'valid-name' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    // Leave keyPath empty (default is empty string)

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Private key path is required')).toBeDefined();
    });
  });

  it('validates duplicate host name', async () => {
    mockInvoke.mockResolvedValue([createRemote({ name: 'existing-host' })]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'existing-host' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Host "existing-host" already exists')).toBeDefined();
    });
  });

  // ============================================
  // Save remote
  // ============================================
  it('saves a new remote successfully', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [];
      if (channel === 'settings:save-ssh-remotes') return undefined;
      return undefined;
    });

    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'test-uuid-123' as `${string}-${string}-${string}-${string}-${string}`
    );

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'new-server' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/home/user/.ssh/id_rsa' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Add Remote'));
    });

    expect(mockInvoke).toHaveBeenCalledWith('settings:save-ssh-remotes', [
      expect.objectContaining({
        id: 'test-uuid-123',
        name: 'new-server',
        hostname: '10.0.0.1',
        user: 'admin',
        keyPath: '/home/user/.ssh/id_rsa',
      }),
    ]);
  });

  it('handles save failure', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [];
      if (channel === 'settings:save-ssh-remotes') throw new Error('Save failed');
      return undefined;
    });

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'server' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Add Remote'));
    });

    expect(screen.getByText(/Failed to save/)).toBeDefined();
  });

  // ============================================
  // Edit remote
  // ============================================
  it('opens edit form with existing data', async () => {
    const remote = createRemote({
      name: 'edit-me',
      hostname: '10.0.0.5',
      user: 'devuser',
      port: 2222,
      keyPath: '/custom/key',
    });
    mockInvoke.mockResolvedValue([remote]);

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    // Find the edit button (Pencil icon button)
    const editButtons = screen.getAllByTestId('icon-pencil');
    fireEvent.click(editButtons[0].closest('button')!);

    expect(screen.getByText('Edit Remote')).toBeDefined();
    expect((screen.getByLabelText('Host Name *') as HTMLInputElement).value).toBe('edit-me');
    expect((screen.getByLabelText('Hostname / IP Address *') as HTMLInputElement).value).toBe(
      '10.0.0.5'
    );
    expect((screen.getByLabelText('Username *') as HTMLInputElement).value).toBe('devuser');
    expect((screen.getByLabelText('Port') as HTMLInputElement).value).toBe('2222');
    expect((screen.getByLabelText('Private Key Path *') as HTMLInputElement).value).toBe(
      '/custom/key'
    );
  });

  // ============================================
  // Delete remote
  // ============================================
  it('deletes a remote after confirmation', async () => {
    const remote = createRemote({ id: 'del-me', name: 'delete-this' });
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [remote];
      if (channel === 'settings:save-ssh-remotes') return undefined;
      return undefined;
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    const deleteButtons = screen.getAllByTestId('icon-trash2');
    await act(async () => {
      fireEvent.click(deleteButtons[0].closest('button')!);
    });

    expect(window.confirm).toHaveBeenCalledWith('Delete SSH remote "delete-this"?');
    expect(mockInvoke).toHaveBeenCalledWith('settings:save-ssh-remotes', []);
  });

  it('cancels delete when confirmation denied', async () => {
    const remote = createRemote({ id: 'keep-me' });
    mockInvoke.mockResolvedValue([remote]);

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    const deleteButtons = screen.getAllByTestId('icon-trash2');
    fireEvent.click(deleteButtons[0].closest('button')!);

    // Should NOT call save
    expect(mockInvoke).not.toHaveBeenCalledWith('settings:save-ssh-remotes', expect.anything());
  });

  // ============================================
  // Save edited remote (lines 130-131)
  // ============================================
  it('saves changes when editing an existing remote', async () => {
    const existingRemote = createRemote({
      id: 'edit-save-1',
      name: 'original-name',
      hostname: '10.0.0.1',
      user: 'pi',
      port: 22,
      keyPath: '/home/pi/.ssh/id_rsa',
    });

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [existingRemote];
      if (channel === 'settings:save-ssh-remotes') return undefined;
      return undefined;
    });

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    // Click the edit button
    const editButtons = screen.getAllByTestId('icon-pencil');
    fireEvent.click(editButtons[0].closest('button')!);

    // Verify we are in edit mode
    expect(screen.getByText('Edit Remote')).toBeDefined();
    expect(screen.getByText('Save Changes')).toBeDefined();

    // Change the hostname
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.99' },
    });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });

    // Verify it saved with the updated data mapped over the existing remote
    expect(mockInvoke).toHaveBeenCalledWith('settings:save-ssh-remotes', [
      expect.objectContaining({
        id: 'edit-save-1',
        name: 'original-name',
        hostname: '10.0.0.99',
        user: 'pi',
        port: 22,
        keyPath: '/home/pi/.ssh/id_rsa',
      }),
    ]);

    // Form should be closed after save
    expect(screen.queryByText('Edit Remote')).toBeNull();
  });

  // ============================================
  // Delete while editing (lines 163-164)
  // ============================================
  it('cancels edit form when deleting the remote being edited', async () => {
    const remote = createRemote({ id: 'edit-del-1', name: 'edit-then-delete' });
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [remote];
      if (channel === 'settings:save-ssh-remotes') return undefined;
      return undefined;
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    // Click edit to enter edit mode
    const editButtons = screen.getAllByTestId('icon-pencil');
    fireEvent.click(editButtons[0].closest('button')!);

    // Verify we are in edit mode
    expect(screen.getByText('Edit Remote')).toBeDefined();

    // Now delete the same remote we are editing
    const deleteButtons = screen.getAllByTestId('icon-trash2');
    await act(async () => {
      fireEvent.click(deleteButtons[0].closest('button')!);
    });

    // Confirm was called
    expect(window.confirm).toHaveBeenCalledWith('Delete SSH remote "edit-then-delete"?');

    // Edit form should be closed (handleCancel called)
    expect(screen.queryByText('Edit Remote')).toBeNull();

    // Remote should be deleted
    expect(mockInvoke).toHaveBeenCalledWith('settings:save-ssh-remotes', []);
  });

  // ============================================
  // Delete failure (lines 166-167)
  // ============================================
  it('shows alert when delete fails', async () => {
    const remote = createRemote({ id: 'fail-del', name: 'fail-to-delete' });
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [remote];
      if (channel === 'settings:save-ssh-remotes') throw new Error('Delete failed');
      return undefined;
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    const deleteButtons = screen.getAllByTestId('icon-trash2');
    await act(async () => {
      fireEvent.click(deleteButtons[0].closest('button')!);
    });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete'));
  });

  // ============================================
  // Port input fallback (line 334)
  // ============================================
  it('falls back to port 22 when non-numeric value entered', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    const portInput = screen.getByLabelText('Port') as HTMLInputElement;

    // Set a non-numeric value that parseInt will return NaN for
    fireEvent.change(portInput, { target: { value: '' } });

    // The fallback || 22 should set port to 22
    expect(portInput.value).toBe('22');
  });

  // ============================================
  // IdentitiesOnly switch toggle (line 372)
  // ============================================
  it('toggles identitiesOnly switch', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    // Find the switch by role
    const switchEl = screen.getByRole('switch');

    // Default is true (checked), so clicking should toggle to false
    expect(switchEl.getAttribute('data-state')).toBe('checked');

    fireEvent.click(switchEl);

    await waitFor(() => {
      expect(switchEl.getAttribute('data-state')).toBe('unchecked');
    });
  });

  // ============================================
  // Port validation (line 68)
  // ============================================
  it('validates port out of range', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    // Fill all required fields
    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'valid-name' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });
    // Set port to 99999 (out of range - above 65535)
    fireEvent.change(screen.getByLabelText('Port'), {
      target: { value: '99999' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Port must be between 1 and 65535')).toBeDefined();
    });
  });

  // ============================================
  // Empty username validation (line 67)
  // ============================================
  it('validates empty username', async () => {
    mockInvoke.mockResolvedValue([]);
    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    fireEvent.change(screen.getByLabelText('Host Name *'), {
      target: { value: 'valid-name' },
    });
    fireEvent.change(screen.getByLabelText('Hostname / IP Address *'), {
      target: { value: '10.0.0.1' },
    });
    // Clear the default username
    fireEvent.change(screen.getByLabelText('Username *'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/key' },
    });

    fireEvent.click(screen.getByText('Add Remote'));

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeDefined();
    });
  });

  // ============================================
  // Browse key path dialog cancelled (line 82-84)
  // ============================================
  it('handles browse dialog returning null (cancelled)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [];
      if (channel === 'dialog:open-directory') return null;
      return undefined;
    });

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    // Set an initial key path
    fireEvent.change(screen.getByLabelText('Private Key Path *'), {
      target: { value: '/original/path' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Browse'));
    });

    // Key path should remain unchanged when dialog returns null
    expect((screen.getByLabelText('Private Key Path *') as HTMLInputElement).value).toBe(
      '/original/path'
    );
  });

  // ============================================
  // Browse key path
  // ============================================
  it('browses for key path via dialog', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-ssh-remotes') return [];
      if (channel === 'dialog:open-directory') return '/selected/path/.ssh/key';
      return undefined;
    });

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    fireEvent.click(screen.getByText('Add SSH Remote'));

    await act(async () => {
      fireEvent.click(screen.getByText('Browse'));
    });

    expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
    expect((screen.getByLabelText('Private Key Path *') as HTMLInputElement).value).toBe(
      '/selected/path/.ssh/key'
    );
  });

  // ============================================
  // Load error
  // ============================================
  it('handles load error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Load failed'));

    await act(async () => {
      render(<SSHRemotesTab />);
    });

    // Should still render the page (not crash)
    expect(screen.getByText('SSH Remotes')).toBeDefined();
  });
});
