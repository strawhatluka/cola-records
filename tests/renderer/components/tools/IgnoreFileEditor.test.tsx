import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { IgnoreFileEditor } from '../../../../src/renderer/components/tools/IgnoreFileEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('IgnoreFileEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<IgnoreFileEditor {...defaultProps} />);
    expect(screen.getByText('Loading ignore file...')).toBeDefined();
  });

  it('shows error when no formatter detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve('');
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No formatter detected. Create a formatter config first.')
      ).toBeDefined();
    });
  });

  it('renders textarea with ignore file content', async () => {
    const ignoreContent = 'node_modules/\ndist/\ncoverage/\n';
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve(ignoreContent);
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(ignoreContent);
  });

  it('shows hint text about pattern format', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('One pattern per line. Lines starting with # are comments.')
      ).toBeDefined();
    });
  });

  it('Save button is disabled when not dirty', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    const saveButton = screen.getByTitle('Save (Ctrl+S)');
    expect(saveButton.closest('button')?.disabled).toBe(true);
  });

  it('Save button enabled after editing', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'build/\n');

    const saveButton = screen.getByTitle('Save (Ctrl+S)').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('calls write-format-ignore on save', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      if (channel === 'dev-tools:write-format-ignore')
        return Promise.resolve({ success: true, message: 'Saved .prettierignore' });
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'dist/\n');

    await userEvent.click(screen.getByTitle('Save (Ctrl+S)').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-ignore',
        '/test/project',
        'prettier',
        'node_modules/\ndist/\n'
      );
    });
  });

  it('shows unsaved changes prompt when closing with changes', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'extra/\n');

    await userEvent.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('closes directly when no changes made', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<IgnoreFileEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.prettierignore')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
