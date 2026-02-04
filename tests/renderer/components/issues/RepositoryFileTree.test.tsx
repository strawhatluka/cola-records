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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { RepositoryFileTree } from '../../../../src/renderer/components/issues/RepositoryFileTree';

const mockTreeData = [
  {
    name: 'src',
    type: 'tree',
    mode: '040000',
    object: {
      entries: [
        { name: 'index.ts', type: 'blob', mode: '100644', object: { byteSize: 1024 } },
        { name: 'utils.ts', type: 'blob', mode: '100644', object: { byteSize: 512 } },
      ],
    },
  },
  {
    name: 'README.md',
    type: 'blob',
    mode: '100644',
    object: { byteSize: 2048 },
  },
];

describe('RepositoryFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockTreeData);
  });

  it('shows loading skeletons initially', () => {
    // Never resolves so we see loading state
    mockInvoke.mockReturnValue(new Promise(() => {}));
    const { container } = render(<RepositoryFileTree repository="org/repo" />);
    expect(container.querySelectorAll('.h-6').length).toBeGreaterThan(0);
  });

  it('fetches tree data on mount', async () => {
    render(<RepositoryFileTree repository="org/repo" />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github:get-repository-tree', 'org', 'repo', 'main');
    });
  });

  it('uses custom branch when specified', async () => {
    render(<RepositoryFileTree repository="org/repo" branch="develop" />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github:get-repository-tree', 'org', 'repo', 'develop');
    });
  });

  it('renders file and folder names after loading', async () => {
    render(<RepositoryFileTree repository="org/repo" />);
    await waitFor(() => {
      expect(screen.getByText('src')).toBeDefined();
      expect(screen.getByText('README.md')).toBeDefined();
    });
  });

  it('shows error message on fetch failure', async () => {
    mockInvoke.mockRejectedValue(new Error('API rate limit'));
    render(<RepositoryFileTree repository="org/repo" />);
    await waitFor(() => {
      expect(screen.getByText('API rate limit')).toBeDefined();
    });
  });

  it('shows empty message when no files', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<RepositoryFileTree repository="org/repo" />);
    await waitFor(() => {
      expect(screen.getByText('No files found')).toBeDefined();
    });
  });

  it('expands directory on click to show children', async () => {
    const user = userEvent.setup();
    render(<RepositoryFileTree repository="org/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeDefined();
    });

    // Children should not be visible initially
    expect(screen.queryByText('index.ts')).toBeNull();

    // Click directory to expand
    await user.click(screen.getByText('src'));

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined();
      expect(screen.getByText('utils.ts')).toBeDefined();
    });
  });

  it('collapses directory on second click', async () => {
    const user = userEvent.setup();
    render(<RepositoryFileTree repository="org/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeDefined();
    });

    // Expand
    await user.click(screen.getByText('src'));
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined();
    });

    // Collapse
    await user.click(screen.getByText('src'));
    await waitFor(() => {
      expect(screen.queryByText('index.ts')).toBeNull();
    });
  });

  it('displays file sizes', async () => {
    const user = userEvent.setup();
    render(<RepositoryFileTree repository="org/repo" />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeDefined();
    });

    // README.md has byteSize: 2048 which should format as "2 KB"
    expect(screen.getByText('2 KB')).toBeDefined();
  });
});
