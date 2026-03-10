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

import { CLIExplorer } from '../../../../src/renderer/components/tools/CLIExplorer';

describe('CLIExplorer', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onRunCommand: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state while scanning', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<CLIExplorer {...defaultProps} />);
    expect(screen.getByText(/scanning/i)).toBeDefined();
  });

  it('should display groups after scanning', async () => {
    mockInvoke.mockResolvedValue([
      {
        source: 'System',
        entries: [
          { name: 'git', path: '/usr/bin/git', version: '2.40.0' },
          { name: 'curl', path: '/usr/bin/curl' },
        ],
      },
      {
        source: 'Node.js',
        entries: [{ name: 'npm', path: '/usr/local/bin/npm', version: '10.0.0' }],
      },
    ]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeDefined();
      expect(screen.getByText('Node.js')).toBeDefined();
    });
  });

  it('should show tool count in header', async () => {
    mockInvoke.mockResolvedValue([
      {
        source: 'System',
        entries: [
          { name: 'git', path: '/usr/bin/git' },
          { name: 'node', path: '/usr/bin/node' },
        ],
      },
    ]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('2 tools found')).toBeDefined();
    });
  });

  it('should show entries when group is expanded', async () => {
    mockInvoke.mockResolvedValue([
      {
        source: 'System',
        entries: [{ name: 'git', path: '/usr/bin/git', version: '2.40.0' }],
      },
    ]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      // First group auto-expanded
      expect(screen.getByText('git')).toBeDefined();
      expect(screen.getByText('2.40.0')).toBeDefined();
    });
  });

  it('should toggle group collapse/expand', async () => {
    mockInvoke.mockResolvedValue([
      {
        source: 'System',
        entries: [{ name: 'git', path: '/usr/bin/git' }],
      },
    ]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    // Click System header to collapse
    await userEvent.click(screen.getByText('System'));

    // git entry should be hidden
    expect(screen.queryByText('git')).toBeNull();
  });

  it('should load help when CLI entry is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'The Git version control system',
          usage: 'git [options] <command>',
          subcommands: [
            { name: 'clone', description: 'Clone a repository' },
            { name: 'init', description: 'Create empty Git repository' },
          ],
          flags: [{ flag: '--version', description: 'Show version', required: false }],
          rawOutput: 'git help output',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('clone')).toBeDefined();
      expect(screen.getByText('Clone a repository')).toBeDefined();
      expect(screen.getByText('--version')).toBeDefined();
    });
  });

  it('should filter tools by search query', async () => {
    mockInvoke.mockResolvedValue([
      {
        source: 'System',
        entries: [
          { name: 'git', path: '/usr/bin/git' },
          { name: 'curl', path: '/usr/bin/curl' },
        ],
      },
    ]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
      expect(screen.getByText('curl')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/filter/i);
    await userEvent.type(searchInput, 'git');

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
      expect(screen.queryByText('curl')).toBeNull();
    });
  });

  it('should send run command to terminal', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'Git',
          usage: 'git <command>',
          subcommands: [],
          flags: [],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('Run')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Run'));
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('git');
  });

  it('should pass ecosystem to IPC call', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<CLIExplorer {...defaultProps} ecosystem="node" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('workflow:scan-clis', 'node');
    });
  });

  it('should highlight selected subcommand and compose command', async () => {
    mockInvoke.mockImplementation((channel: string, _path?: string, sub?: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        if (sub === 'clone') {
          return Promise.resolve({
            description: 'Clone a repository',
            usage: 'git clone <url>',
            subcommands: [],
            flags: [
              { flag: '--depth', description: 'Shallow clone depth', required: false },
              { flag: '--branch', description: 'Clone specific branch', required: false },
            ],
            rawOutput: '',
          });
        }
        return Promise.resolve({
          description: 'Git',
          usage: 'git <command>',
          subcommands: [
            { name: 'clone', description: 'Clone a repository' },
            { name: 'commit', description: 'Record changes' },
          ],
          flags: [{ flag: '--version', description: 'Show version', required: false }],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    // Open git help panel
    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('clone')).toBeDefined();
      expect(screen.getByText('commit')).toBeDefined();
    });

    // Command input should show base command
    const cmdInput = screen.getByPlaceholderText('Enter command...') as HTMLInputElement;
    expect(cmdInput.value).toBe('git');

    // Click a subcommand
    await userEvent.click(screen.getByText('clone'));

    await waitFor(() => {
      expect(cmdInput.value).toBe('git clone');
    });
  });

  it('should toggle flags and update composed command', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'npm', path: '/usr/bin/npm' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'Node Package Manager',
          usage: 'npm <command>',
          subcommands: [],
          flags: [
            { flag: '--verbose', description: 'Verbose output', required: false },
            { flag: '--json', description: 'JSON output', required: false },
          ],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('npm')).toBeDefined();
    });

    await userEvent.click(screen.getByText('npm'));

    await waitFor(() => {
      expect(screen.getByText('--verbose')).toBeDefined();
    });

    // Click a flag to select it
    await userEvent.click(screen.getByText('--verbose'));

    await waitFor(() => {
      const cmdInput = screen.getByPlaceholderText('Enter command...') as HTMLInputElement;
      expect(cmdInput.value).toBe('npm --verbose');
    });

    // Click Run to execute
    await userEvent.click(screen.getByText('Run'));
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm --verbose');
  });

  it('should display subcommand usage next to flags header', async () => {
    mockInvoke.mockImplementation((channel: string, _path?: string, sub?: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        if (sub === 'clone') {
          return Promise.resolve({
            description: 'Clone a repository',
            usage: 'git clone [<options>] <repository>',
            subcommands: [],
            flags: [{ flag: '--depth', description: 'Shallow clone depth', required: false }],
            rawOutput: '',
          });
        }
        return Promise.resolve({
          description: 'Git',
          usage: 'git <command>',
          subcommands: [{ name: 'clone', description: 'Clone a repository' }],
          flags: [],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('clone')).toBeDefined();
    });

    await userEvent.click(screen.getByText('clone'));

    await waitFor(() => {
      // Usage should appear near the flags header
      expect(screen.getByText('git clone [<options>] <repository>')).toBeDefined();
    });
  });

  it('should show raw help output as fallback when no subcommands/flags', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'sometool', path: '/usr/bin/sometool' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'Some tool for doing things',
          usage: '',
          subcommands: [],
          flags: [],
          rawOutput: 'sometool v1.0 - A useful tool\nRun with arguments.',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('sometool')).toBeDefined();
    });

    await userEvent.click(screen.getByText('sometool'));

    await waitFor(() => {
      expect(screen.getByText('Help Output')).toBeDefined();
      expect(screen.getByText(/sometool v1\.0/)).toBeDefined();
    });
  });

  it('should show "no tools" when PATH is empty', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no cli tools/i)).toBeDefined();
    });
  });

  it('should show error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Scan failed'));

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/scan failed/i)).toBeDefined();
    });
  });

  it('should call onClose when Back button is clicked', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Back')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Back'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should toggle-close inline panel when clicking the same CLI tool again', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'Git',
          usage: 'git <command>',
          subcommands: [{ name: 'clone', description: 'Clone a repository' }],
          flags: [],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    // Open the help panel
    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('clone')).toBeDefined();
    });

    // Click the same CLI tool again — should close the panel
    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.queryByText('clone')).toBeNull();
    });
  });

  it('should close inline panel when close button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:scan-clis') {
        return Promise.resolve([
          {
            source: 'System',
            entries: [{ name: 'git', path: '/usr/bin/git' }],
          },
        ]);
      }
      if (channel === 'workflow:get-cli-help') {
        return Promise.resolve({
          description: 'Git',
          usage: 'git <command>',
          subcommands: [{ name: 'clone', description: 'Clone a repository' }],
          flags: [],
          rawOutput: '',
        });
      }
      return Promise.resolve();
    });

    render(<CLIExplorer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('git')).toBeDefined();
    });

    // Open the help panel
    await userEvent.click(screen.getByText('git'));

    await waitFor(() => {
      expect(screen.getByText('clone')).toBeDefined();
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    // Click close button
    await userEvent.click(screen.getByTitle('Close'));

    await waitFor(() => {
      expect(screen.queryByText('clone')).toBeNull();
    });
  });
});
