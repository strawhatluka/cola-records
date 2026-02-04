import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { AliasesTab } from '../../../../src/renderer/components/settings/AliasesTab';
import { createMockSettings, createMockAlias } from '../../../mocks/factories';

describe('AliasesTab', () => {
  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  it('renders empty state when no aliases', () => {
    render(<AliasesTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/No custom aliases defined/)).toBeDefined();
  });

  it('renders existing aliases', () => {
    const settings = createMockSettings({
      aliases: [
        createMockAlias({ name: 'gp', command: 'git push' }),
        createMockAlias({ name: 'ga', command: 'git add .' }),
      ],
    });

    render(<AliasesTab settings={settings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('gp')).toBeDefined();
    expect(screen.getByText('git push')).toBeDefined();
    expect(screen.getByText('ga')).toBeDefined();
    expect(screen.getByText('git add .')).toBeDefined();
  });

  it('shows add alias form', () => {
    render(<AliasesTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Add Alias')).toBeDefined();
    expect(screen.getByPlaceholderText('name (e.g. gp)')).toBeDefined();
    expect(screen.getByPlaceholderText('command (e.g. git push)')).toBeDefined();
  });

  it('validates empty alias name', async () => {
    const user = userEvent.setup();
    render(<AliasesTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);

    // Type only command, not name
    await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
    // Button should be disabled since name is empty
    const addButton = screen.getByText('Add').closest('button');
    expect(addButton).toBeDisabled();
  });

  it('validates alias name with spaces', async () => {
    const user = userEvent.setup();
    render(<AliasesTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'bad name');
    await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
    await user.click(screen.getByText('Add'));

    expect(screen.getByText('Alias name cannot contain spaces')).toBeDefined();
  });

  it('adds a new alias', async () => {
    const user = userEvent.setup();
    render(<AliasesTab settings={createMockSettings({ aliases: [] })} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'gp');
    await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git push');
    await user.click(screen.getByText('Add'));

    expect(mockOnUpdate).toHaveBeenCalledWith({
      aliases: [{ name: 'gp', command: 'git push' }],
    });
  });

  it('shows default aliases info text', () => {
    render(<AliasesTab settings={createMockSettings()} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/Default aliases.*ll, gs, gd, gl.*are always included/)).toBeDefined();
  });

  it('shows error for duplicate alias name', async () => {
    const user = userEvent.setup();
    const settings = createMockSettings({
      aliases: [createMockAlias({ name: 'gp', command: 'git push' })],
    });
    render(<AliasesTab settings={settings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('name (e.g. gp)'), 'gp');
    await user.type(screen.getByPlaceholderText('command (e.g. git push)'), 'git pull');
    await user.click(screen.getByText('Add'));

    expect(screen.getByText('Alias "gp" already exists')).toBeDefined();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('deletes an alias when trash icon is clicked', async () => {
    const user = userEvent.setup();
    const settings = createMockSettings({
      aliases: [
        createMockAlias({ name: 'gp', command: 'git push' }),
        createMockAlias({ name: 'll', command: 'ls -la' }),
      ],
    });
    render(<AliasesTab settings={settings} onUpdate={mockOnUpdate} />);

    const deleteButtons = screen.getAllByTestId('icon-trash2');
    await user.click(deleteButtons[0].closest('button')!);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith({
        aliases: [{ name: 'll', command: 'ls -la' }],
      });
    });
  });
});
