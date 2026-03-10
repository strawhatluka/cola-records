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

import { EnvPanel } from '../../../../src/renderer/components/tools/EnvPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
};

describe('EnvPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ success: true, message: 'Done' });
  });

  it('renders the panel header', () => {
    render(<EnvPanel {...defaultProps} />);
    expect(screen.getByText('Env File Management')).toBeDefined();
  });

  it('renders all 6 action buttons', () => {
    render(<EnvPanel {...defaultProps} />);
    expect(screen.getByText('.env.example')).toBeDefined();
    expect(screen.getByText('.env')).toBeDefined();
    expect(screen.getByText('.env.local')).toBeDefined();
    expect(screen.getByText('.env.CUSTOM')).toBeDefined();
    expect(screen.getByText('Edit Example')).toBeDefined();
    expect(screen.getByText('ENV Sync')).toBeDefined();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls create-env-example IPC when .env.example clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({ success: true, message: 'Created .env.example' });

    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('.env.example').closest('button')!;
    await user.click(btn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-env-example',
        '/test/project',
        'node'
      );
    });
  });

  it('calls create-env-file IPC for .env', async () => {
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('.env').closest('button')!;
    await user.click(btn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:create-env-file', '/test/project', '.env');
    });
  });

  it('calls create-env-file IPC for .env.local', async () => {
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('.env.local').closest('button')!;
    await user.click(btn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-env-file',
        '/test/project',
        '.env.local'
      );
    });
  });

  it('shows text input when .env.CUSTOM clicked', async () => {
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('.env.CUSTOM').closest('button')!;
    await user.click(btn);

    expect(screen.getByPlaceholderText('suffix')).toBeDefined();
  });

  it('creates custom env file on Enter', async () => {
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} />);

    // Click .env.CUSTOM to open input
    const btn = screen.getByText('.env.CUSTOM').closest('button')!;
    await user.click(btn);

    // Type suffix and press Enter
    const input = screen.getByPlaceholderText('suffix');
    await user.type(input, 'staging{Enter}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-env-file',
        '/test/project',
        '.env.staging'
      );
    });
  });

  it('calls onOpenEditor when Edit Example clicked', async () => {
    const onOpenEditor = vi.fn();
    const user = userEvent.setup();
    render(<EnvPanel {...defaultProps} onOpenEditor={onOpenEditor} />);
    const btn = screen.getByText('Edit Example').closest('button')!;
    await user.click(btn);

    expect(onOpenEditor).toHaveBeenCalledOnce();
  });

  it('calls sync-env-files IPC when ENV Sync clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      newVariablesFound: 2,
      filesUpdated: ['.env'],
      message: 'Synced',
    });

    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('ENV Sync').closest('button')!;
    await user.click(btn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:sync-env-files', '/test/project', 'node');
    });
  });

  it('displays status message after action', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: true,
      message: 'Created .env.example with 5 variables',
    });

    render(<EnvPanel {...defaultProps} />);
    const btn = screen.getByText('.env.example').closest('button')!;
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Created .env.example with 5 variables')).toBeDefined();
    });
  });
});
