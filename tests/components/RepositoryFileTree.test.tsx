import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RepositoryFileTree } from '@renderer/components/issues/RepositoryFileTree';
import userEvent from '@testing-library/user-event';

// Mock the IPC client
vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

// Import the mocked module AFTER the mock declaration
import { ipc } from '@renderer/ipc/client';

describe('RepositoryFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(ipc.invoke).mockImplementation(() => new Promise(() => {})); // Never resolves

    const { container } = render(<RepositoryFileTree repository="owner/repo" />);

    // Verify skeleton loading state is shown
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('should fetch and display file tree', async () => {
    const mockTree = [
      {
        name: 'src',
        type: 'tree',
        mode: '040000',
        object: {
          entries: [
            { name: 'index.ts', type: 'blob', mode: '100644', object: { byteSize: 1024 } },
          ],
        },
      },
      {
        name: 'README.md',
        type: 'blob',
        mode: '100644',
        object: { byteSize: 512 },
      },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'main');
  });

  it('should use custom branch when provided', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce([]);

    render(<RepositoryFileTree repository="owner/repo" branch="develop" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'develop');
    });
  });

  it('should show error state on fetch failure', async () => {
    vi.mocked(ipc.invoke).mockRejectedValueOnce(new Error('Failed to fetch tree'));

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch tree/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no files found', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce([]);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('No files found')).toBeInTheDocument();
    });
  });

  it('should expand and collapse directories', async () => {
    const user = userEvent.setup();

    const mockTree = [
      {
        name: 'src',
        type: 'tree',
        mode: '040000',
        object: {
          entries: [
            { name: 'index.ts', type: 'blob', mode: '100644', object: { byteSize: 1024 } },
          ],
        },
      },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Initially, nested file should not be visible
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('src'));

    // Now nested file should be visible
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText('src'));

    // Nested file should be hidden again
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });

  it('should display file sizes in human-readable format', async () => {
    const mockTree = [
      { name: 'small.txt', type: 'blob', mode: '100644', object: { byteSize: 512 } },
      { name: 'medium.txt', type: 'blob', mode: '100644', object: { byteSize: 1024 } },
      { name: 'large.txt', type: 'blob', mode: '100644', object: { byteSize: 1048576 } },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('512 B')).toBeInTheDocument();
      expect(screen.getByText('1 KB')).toBeInTheDocument();
      expect(screen.getByText('1 MB')).toBeInTheDocument();
    });
  });

  it('should show folder icons for directories', async () => {
    const mockTree = [
      {
        name: 'src',
        type: 'tree',
        mode: '040000',
        object: { entries: [] },
      },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockTree);

    const { container } = render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Check for folder icon (Lucide icons render as SVG)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('should handle nested directory structures', async () => {
    const user = userEvent.setup();

    const mockTree = [
      {
        name: 'src',
        type: 'tree',
        mode: '040000',
        object: {
          entries: [
            {
              name: 'components',
              type: 'tree',
              mode: '040000',
              object: {
                entries: [
                  { name: 'Button.tsx', type: 'blob', mode: '100644', object: { byteSize: 2048 } },
                ],
              },
            },
          ],
        },
      },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand src
    await user.click(screen.getByText('src'));
    expect(screen.getByText('components')).toBeInTheDocument();

    // Expand components
    await user.click(screen.getByText('components'));
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
  });

  it('should parse repository owner and name correctly', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce([]);

    render(<RepositoryFileTree repository="facebook/react" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'facebook', 'react', 'main');
    });
  });
});
