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

import { GitHubConfigIssueTemplatesEditor } from '../../../../src/renderer/components/tools/GitHubConfigIssueTemplatesEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  onClose: vi.fn(),
};

describe('GitHubConfigIssueTemplatesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'issue-templates',
              label: 'Issue Templates',
              path: 'ISSUE_TEMPLATE',
              category: 'directory',
              exists: true,
              description: 'GitHub issue templates',
              files: ['bug_report.md', 'feature_request.md'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([
          { id: 'bug', label: 'Bug Report', description: 'Report a bug' },
          { id: 'feature', label: 'Feature Request', description: 'Suggest a feature' },
        ]);
      }
      return Promise.resolve(null);
    });
  });

  it('renders close button and header', async () => {
    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Issue Templates')).toBeDefined();
    });
    expect(screen.getByTestId('icon-x')).toBeDefined();
  });

  it('shows loading state then displays template files', async () => {
    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('bug_report.md')).toBeDefined();
      expect(screen.getByText('feature_request.md')).toBeDefined();
    });
  });

  it('shows New button to create templates', async () => {
    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Issue Templates')).toBeDefined();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows empty state when no templates exist', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'issue-templates',
              label: 'Issue Templates',
              path: 'ISSUE_TEMPLATE',
              category: 'directory',
              exists: false,
              description: 'GitHub issue templates',
              files: [],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No issue templates found/)).toBeDefined();
    });
  });

  it('opens edit view with structured form fields when clicking a template', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'issue-templates',
              label: 'Issue Templates',
              path: 'ISSUE_TEMPLATE',
              category: 'directory',
              exists: true,
              description: 'GitHub issue templates',
              files: ['bug_report.md'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([]);
      }
      if (channel === 'github-config:read-file') {
        return Promise.resolve(
          '---\nname: "Bug Report"\ndescription: "File a bug report"\ntitle: "[Bug]: "\nlabels: [bug, triage]\nassignees: @username\n---\n## Steps to reproduce\n\n1. First step\n2. Second step\n'
        );
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('bug_report.md')).toBeDefined();
    });

    const fileButton = screen.getByText('bug_report.md');
    await user.click(fileButton);

    // Should show structured form fields in edit view
    await waitFor(() => {
      expect(screen.getByText('Template Metadata')).toBeDefined();
      expect(screen.getByTestId('config-name')).toBeDefined();
      expect(screen.getByTestId('config-title')).toBeDefined();
      expect(screen.getByTestId('config-description')).toBeDefined();
      expect(screen.getByTestId('config-labels')).toBeDefined();
      expect(screen.getByTestId('config-assignees')).toBeDefined();
      expect(screen.getByTestId('config-body')).toBeDefined();
    });

    // Verify parsed values — name/title/description are text inputs
    const nameInput = screen.getByTestId('config-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Bug Report');

    const titleInput = screen.getByTestId('config-title') as HTMLInputElement;
    expect(titleInput.value).toBe('[Bug]: ');

    const descInput = screen.getByTestId('config-description') as HTMLInputElement;
    expect(descInput.value).toBe('File a bug report');

    // Labels are now ChipInput — verify chips rendered
    const labelsContainer = screen.getByTestId('config-labels');
    expect(labelsContainer.textContent).toContain('bug');
    expect(labelsContainer.textContent).toContain('triage');
  });

  it('saves modified template metadata via write-file', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'issue-templates',
              label: 'Issue Templates',
              path: 'ISSUE_TEMPLATE',
              category: 'directory',
              exists: true,
              description: 'GitHub issue templates',
              files: ['bug_report.md'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([]);
      }
      if (channel === 'github-config:read-file') {
        return Promise.resolve('---\nname: "Bug Report"\n---\nOriginal body\n');
      }
      if (channel === 'github-config:write-file') {
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigIssueTemplatesEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('bug_report.md')).toBeDefined();
    });

    const fileButton = screen.getByText('bug_report.md');
    await user.click(fileButton);

    await waitFor(() => {
      expect(screen.getByTestId('config-description')).toBeDefined();
    });

    // Modify a field
    const descInput = screen.getByTestId('config-description') as HTMLInputElement;
    await user.type(descInput, 'Updated description');

    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(false);
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/test/project',
        'ISSUE_TEMPLATE/bug_report.md',
        expect.any(String)
      );
    });
  });
});
