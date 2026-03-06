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

import { GitHubConfigMarkdownEditor } from '../../../../src/renderer/components/tools/GitHubConfigMarkdownEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  feature: {
    id: 'pr-template',
    label: 'PR Template',
    path: 'PULL_REQUEST_TEMPLATE.md',
    category: 'markdown' as const,
    exists: true,
    description: 'Pull request template',
    files: ['.github/PULL_REQUEST_TEMPLATE.md'],
  },
  onClose: vi.fn(),
};

describe('GitHubConfigMarkdownEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:read-file') {
        return Promise.resolve('# PR Template\n\n## Description\n');
      }
      if (channel === 'github-config:write-file') {
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });
  });

  it('renders with feature label in the header', async () => {
    render(<GitHubConfigMarkdownEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('PR Template')).toBeDefined();
    });
    expect(screen.getByText('.github/PULL_REQUEST_TEMPLATE.md')).toBeDefined();
  });

  it('loads file content and parses into section form fields', async () => {
    render(<GitHubConfigMarkdownEditor {...defaultProps} />);
    await waitFor(() => {
      // Should parse "# PR Template" as section 1 heading
      const headingInputs = screen.getAllByPlaceholderText(/Section heading/);
      expect(headingInputs.length).toBeGreaterThan(0);
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      'github-config:read-file',
      '/test/project',
      'PULL_REQUEST_TEMPLATE.md'
    );

    // Should have parsed sections from markdown
    const headingInputs = screen.getAllByPlaceholderText(/Section heading/);
    expect((headingInputs[0] as HTMLInputElement).value).toBe('PR Template');
  });

  it('save button is disabled when content is not dirty', async () => {
    render(<GitHubConfigMarkdownEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('PR Template')).toBeDefined();
    });
    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(true);
  });

  it('save button enables when content is modified and saves via write-file', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigMarkdownEditor {...defaultProps} />);
    await waitFor(() => {
      const headingInputs = screen.getAllByPlaceholderText(/Section heading/);
      expect(headingInputs.length).toBeGreaterThan(0);
    });

    // Modify a section heading
    const headingInputs = screen.getAllByPlaceholderText(/Section heading/);
    await user.type(headingInputs[0], ' Modified');

    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(false);

    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/test/project',
        'PULL_REQUEST_TEMPLATE.md',
        expect.any(String)
      );
    });
  });

  it('close button calls onClose when content is clean', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GitHubConfigMarkdownEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('PR Template')).toBeDefined();
    });

    // The close button is the X icon button
    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
