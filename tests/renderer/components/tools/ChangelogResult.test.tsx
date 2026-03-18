import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ChangelogResult } from '../../../../src/renderer/components/tools/ChangelogResult';

describe('ChangelogResult', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<ChangelogResult {...defaultProps} />);
    expect(screen.getByText(/generating/i)).toBeDefined();
  });

  it('should display generated changelog entry in editable textarea', async () => {
    mockInvoke.mockResolvedValue({
      entry: '### Added\n- New button component',
      hasChanges: true,
    });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDefined();
      expect((textarea as HTMLTextAreaElement).value).toContain('New button component');
    });
  });

  it('should show "no changes" when hasChanges is false', async () => {
    mockInvoke.mockResolvedValue({ entry: '', hasChanges: false });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no changes/i)).toBeDefined();
    });
  });

  it('should show error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('AI not configured'));

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/AI not configured/)).toBeDefined();
    });
  });

  it('should apply changelog entry on Apply click', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-changelog') {
        return Promise.resolve({
          entry: '### Added\n- Feature X',
          hasChanges: true,
        });
      }
      return Promise.resolve();
    });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Apply to CHANGELOG/)).toBeDefined();
    });

    await userEvent.click(screen.getByText(/Apply to CHANGELOG/));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:apply-changelog',
        '/test/project',
        '### Added\n- Feature X'
      );
    });
  });

  it('should show "Applied" after successful apply', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-changelog') {
        return Promise.resolve({ entry: '### Fixed\n- Bug', hasChanges: true });
      }
      return Promise.resolve();
    });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Apply to CHANGELOG/)).toBeDefined();
    });

    await userEvent.click(screen.getByText(/Apply to CHANGELOG/));

    await waitFor(() => {
      expect(screen.getByText(/Applied/)).toBeDefined();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    mockInvoke.mockResolvedValue({ entry: '', hasChanges: false });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should allow user to edit the generated entry and apply edited content', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-changelog') {
        return Promise.resolve({
          entry: '### Added\n- Feature X',
          hasChanges: true,
        });
      }
      return Promise.resolve();
    });

    render(<ChangelogResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // User edits the draft
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '### Added\n- Feature X (updated)\n- Feature Y');

    await userEvent.click(screen.getByText(/Apply to CHANGELOG/));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:apply-changelog',
        '/test/project',
        '### Added\n- Feature X (updated)\n- Feature Y'
      );
    });
  });

  it('should pass issue number and branch name', async () => {
    mockInvoke.mockResolvedValue({ entry: 'test', hasChanges: true });

    render(<ChangelogResult {...defaultProps} issueNumber="99" branchName="feat/issue-99" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:generate-changelog',
        '/test/project',
        '99',
        'feat/issue-99'
      );
    });
  });
});
