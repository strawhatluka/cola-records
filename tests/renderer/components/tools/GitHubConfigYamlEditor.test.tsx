import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { GitHubConfigYamlEditor } from '../../../../src/renderer/components/tools/GitHubConfigYamlEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  feature: {
    id: 'dependabot',
    label: 'Dependabot',
    path: 'dependabot.yml',
    category: 'yaml' as const,
    exists: true,
    description: 'Dependabot configuration',
    files: ['.github/dependabot.yml'],
  },
  onClose: vi.fn(),
};

describe('GitHubConfigYamlEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:read-file') {
        return Promise.resolve('version: 2\nupdates:\n  - package-ecosystem: npm\n');
      }
      if (channel === 'github-config:write-file') {
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });
  });

  it('renders with feature label and path in the header', async () => {
    render(<GitHubConfigYamlEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Dependabot')).toBeDefined();
    });
    expect(screen.getByText('.github/dependabot.yml')).toBeDefined();
  });

  it('loads YAML content and parses into form fields', async () => {
    render(<GitHubConfigYamlEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('config-ecosystem')).toBeDefined();
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      'github-config:read-file',
      '/test/project',
      'dependabot.yml'
    );

    // Should have parsed ecosystem from YAML
    const ecosystemSelect = screen.getByTestId('config-ecosystem') as HTMLSelectElement;
    expect(ecosystemSelect.value).toBe('npm');
  });

  it('saves modified content via github-config:write-file', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigYamlEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('config-interval')).toBeDefined();
    });

    // Change the schedule interval dropdown
    const intervalSelect = screen.getByTestId('config-interval') as HTMLSelectElement;
    await user.selectOptions(intervalSelect, 'daily');

    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(false);
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/test/project',
        'dependabot.yml',
        expect.any(String)
      );
    });
  });

  it('close button calls onClose when content is clean', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GitHubConfigYamlEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Dependabot')).toBeDefined();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows unsaved changes prompt when closing with dirty content', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigYamlEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('config-directory')).toBeDefined();
    });

    // Modify a form field
    const directoryInput = screen.getByTestId('config-directory') as HTMLInputElement;
    await user.clear(directoryInput);
    await user.type(directoryInput, '/src');

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });
});
