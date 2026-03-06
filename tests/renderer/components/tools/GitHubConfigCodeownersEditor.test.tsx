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

import { GitHubConfigCodeownersEditor } from '../../../../src/renderer/components/tools/GitHubConfigCodeownersEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  onClose: vi.fn(),
};

describe('GitHubConfigCodeownersEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:read-file') {
        return Promise.resolve('# Frontend owners\n*.ts @frontend-team\n*.css @design-team\n');
      }
      if (channel === 'github-config:write-file') {
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });
  });

  it('renders the CODEOWNERS header and path', async () => {
    render(<GitHubConfigCodeownersEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('CODEOWNERS')).toBeDefined();
    });
    expect(screen.getByText('.github/CODEOWNERS')).toBeDefined();
  });

  it('shows Add Rule and Add Comment buttons', async () => {
    render(<GitHubConfigCodeownersEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Add Rule')).toBeDefined();
      expect(screen.getByText('Add Comment')).toBeDefined();
    });
  });

  it('renders parsed rows after loading content', async () => {
    render(<GitHubConfigCodeownersEditor {...defaultProps} />);
    await waitFor(() => {
      // The comment row should have its text parsed
      expect(screen.getByDisplayValue('Frontend owners')).toBeDefined();
      // Rule rows should show pattern and owners
      expect(screen.getByDisplayValue('*.ts')).toBeDefined();
      expect(screen.getByDisplayValue('@frontend-team')).toBeDefined();
      expect(screen.getByDisplayValue('*.css')).toBeDefined();
      expect(screen.getByDisplayValue('@design-team')).toBeDefined();
    });
  });

  it('adds a new rule row when Add Rule is clicked', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigCodeownersEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Add Rule')).toBeDefined();
    });

    await user.click(screen.getByText('Add Rule'));

    // A new empty rule row should appear with placeholder inputs
    await waitFor(() => {
      expect(screen.getByDisplayValue('@')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked with clean state', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GitHubConfigCodeownersEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('CODEOWNERS')).toBeDefined();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
