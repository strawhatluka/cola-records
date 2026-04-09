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

import { VersionEditor } from '../../../../src/renderer/components/tools/VersionEditor';

describe('VersionEditor', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<VersionEditor {...defaultProps} />);
    expect(screen.getByText(/detecting/i)).toBeDefined();
  });

  it('should display detected version files', async () => {
    mockInvoke.mockResolvedValue([
      {
        file: '/test/project/package.json',
        relativePath: 'package.json',
        currentVersion: '1.2.3',
        packageManager: 'npm',
      },
    ]);

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('package.json')).toBeDefined();
      expect(screen.getByText('v1.2.3')).toBeDefined();
      expect(screen.getByText('npm')).toBeDefined();
    });
  });

  it('should show "no version files" when none detected', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no version files/i)).toBeDefined();
    });
  });

  it('should render bump buttons', async () => {
    mockInvoke.mockResolvedValue([
      {
        file: '/test/project/package.json',
        relativePath: 'package.json',
        currentVersion: '1.0.0',
        packageManager: 'npm',
      },
    ]);

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('patch')).toBeDefined();
      expect(screen.getByText('minor')).toBeDefined();
      expect(screen.getByText('major')).toBeDefined();
    });
  });

  it('should update version input on bump click', async () => {
    mockInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
      if (channel === 'workflow:detect-versions') {
        return Promise.resolve([
          {
            file: '/test/project/package.json',
            relativePath: 'package.json',
            currentVersion: '1.0.0',
            packageManager: 'npm',
          },
        ]);
      }
      if (channel === 'workflow:bump-version') {
        const [, type] = args as [string, string];
        if (type === 'patch') return Promise.resolve('1.0.1');
        if (type === 'minor') return Promise.resolve('1.1.0');
        return Promise.resolve('2.0.0');
      }
      return Promise.resolve({ success: true, message: 'ok' });
    });

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('patch')).toBeDefined();
    });

    await userEvent.click(screen.getByText('minor'));

    await waitFor(() => {
      const input = screen.getByDisplayValue('1.1.0');
      expect(input).toBeDefined();
    });
  });

  it('should call update-version on Save', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:detect-versions') {
        return Promise.resolve([
          {
            file: '/test/project/package.json',
            relativePath: 'package.json',
            currentVersion: '1.0.0',
            packageManager: 'npm',
          },
        ]);
      }
      return Promise.resolve({ success: true, message: 'ok' });
    });

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('workflow:update-version', '/test/project', '1.0.0', [
        'package.json',
      ]);
    });
  });

  it('should call git IPC operations on Save & Push', async () => {
    const versionData = [
      {
        file: '/test/project/package.json',
        relativePath: 'package.json',
        currentVersion: '1.0.0',
        packageManager: 'npm',
      },
    ];
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:detect-versions') return Promise.resolve(versionData);
      if (channel === 'workflow:update-version') return Promise.resolve({ success: true });
      return Promise.resolve(undefined);
    });

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save & Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Save & Push'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:push-tags', '/test/project');
    });

    // Verify the full sequence of git IPC calls
    const calls = mockInvoke.mock.calls.map((c) => c[0]);
    expect(calls).toContain('git:add');
    expect(calls).toContain('git:commit');
    expect(calls).toContain('git:push');
    expect(calls).toContain('git:tag');
    expect(calls).toContain('git:push-tags');
  });

  it('should call onClose when Back button is clicked', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<VersionEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Back')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Back'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
