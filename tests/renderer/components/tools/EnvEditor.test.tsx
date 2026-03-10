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

import { EnvEditor } from '../../../../src/renderer/components/tools/EnvEditor';
import type { EnvFileInfo } from '../../../../src/main/ipc/channels/types';

const mockEnvFiles: EnvFileInfo[] = [
  {
    name: '.env',
    relativePath: '.env',
    absolutePath: '/test/project/.env',
    content: 'APP_KEY=secret\n',
    isExample: false,
  },
  {
    name: '.env.example',
    relativePath: '.env.example',
    absolutePath: '/test/project/.env.example',
    content: 'APP_KEY=\nDB_URL=\n',
    isExample: true,
  },
];

const defaultProps = {
  workingDirectory: '/test/project',
  onClose: vi.fn(),
};

describe('EnvEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:discover-env-files') {
        return Promise.resolve(mockEnvFiles);
      }
      if (channel === 'dev-tools:write-env-file') {
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });
  });

  it('shows loading state initially', () => {
    // Never resolve so we stay in loading
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<EnvEditor {...defaultProps} />);
    expect(screen.getByText('Loading env files...')).toBeDefined();
  });

  it('renders file tabs after loading', async () => {
    render(<EnvEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.env')).toBeDefined();
      expect(screen.getByText('.env.example')).toBeDefined();
    });
  });

  it('defaults to .env.example tab when available', async () => {
    render(<EnvEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('.env.example')).toBeDefined();
    });

    // The textarea should contain .env.example content
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('APP_KEY=\nDB_URL=\n');
  });

  it('switches tabs on click', async () => {
    const user = userEvent.setup();
    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('.env')).toBeDefined();
    });

    // Click the .env tab
    await user.click(screen.getByText('.env'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('APP_KEY=secret\n');
  });

  it('calls write-env-file on save', async () => {
    const user = userEvent.setup();
    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('.env.example')).toBeDefined();
    });

    // Modify content
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'NEW_VAR=value');

    // Click save
    const saveBtn = screen.getByText('Save').closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-env-file',
        '/test/project/.env.example',
        'NEW_VAR=value'
      );
    });
  });

  it('calls onClose when close button clicked (no unsaved changes)', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EnvEditor {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('.env.example')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('Close editor');
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows unsaved changes prompt when closing with dirty tab', async () => {
    const user = userEvent.setup();
    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('.env.example')).toBeDefined();
    });

    // Make a change
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'EXTRA=1');

    // Try to close
    const closeBtn = screen.getByTitle('Close editor');
    await user.click(closeBtn);

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('shows "no files found" when no env files exist', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:discover-env-files') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No .env files found. Create one first.')).toBeDefined();
    });
  });

  it('renders Save button and close button', async () => {
    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
      expect(screen.getByTitle('Close editor')).toBeDefined();
    });
  });

  it('shows dirty indicator on modified tab', async () => {
    const user = userEvent.setup();
    render(<EnvEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('.env.example')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'EXTRA');

    // The tab should show a * indicator
    expect(screen.getByText('*')).toBeDefined();
  });
});
