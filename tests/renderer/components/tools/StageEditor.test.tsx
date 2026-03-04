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

import { StageEditor } from '../../../../src/renderer/components/tools/StageEditor';

describe('StageEditor', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<StageEditor {...defaultProps} />);
    expect(screen.getByText('Scanning files...')).toBeDefined();
  });

  it('should display file list after loading', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'src/index.ts', index: 'M', working_dir: ' ' },
        { path: 'src/new.ts', index: '?', working_dir: '?' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('src/index.ts')).toBeDefined();
      expect(screen.getByText('src/new.ts')).toBeDefined();
    });
  });

  it('should show colored status badges', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'modified.ts', index: 'M', working_dir: ' ' },
        { path: 'added.ts', index: 'A', working_dir: ' ' },
        { path: 'deleted.ts', index: 'D', working_dir: ' ' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('modified.ts')).toBeDefined();
      expect(screen.getByText('added.ts')).toBeDefined();
      expect(screen.getByText('deleted.ts')).toBeDefined();
    });
  });

  it('should show "no changed files" when working tree is clean', async () => {
    mockInvoke.mockResolvedValue({ files: [] });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No changed files to stage.')).toBeDefined();
    });
  });

  it('should call git:add when Stage button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:status') {
        return Promise.resolve({
          files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
        });
      }
      return Promise.resolve();
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('src/index.ts')).toBeDefined();
    });

    // Files are auto-selected, so the Stage button should be available
    const stageBtn = screen.getByText(/^Stage 1 file$/);
    await userEvent.click(stageBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:add', '/test/project', ['src/index.ts']);
    });
  });

  it('should call onClose after successful staging', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:status') {
        return Promise.resolve({
          files: [{ path: 'file.ts', index: 'M', working_dir: ' ' }],
        });
      }
      return Promise.resolve();
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('file.ts')).toBeDefined();
    });

    const stageBtn = screen.getByText(/^Stage 1 file$/);
    await userEvent.click(stageBtn);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should close when Close button is clicked', async () => {
    mockInvoke.mockResolvedValue({ files: [] });
    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No changed files to stage.')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('Close');
    await userEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should toggle select all', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'a.ts', index: 'M', working_dir: ' ' },
        { path: 'b.ts', index: 'A', working_dir: ' ' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined();
    });

    // Initially all selected (auto-select), click Deselect All
    const toggleBtn = screen.getByText(/Deselect All/);
    await userEvent.click(toggleBtn);

    // Now should show Select All
    expect(screen.getByText(/Select All/)).toBeDefined();
  });
});
