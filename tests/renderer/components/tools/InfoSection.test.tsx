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

import { InfoSection } from '../../../../src/renderer/components/tools/InfoSection';
import type { DiskUsageResult, ProjectInfo } from '../../../../src/main/ipc/channels/types';

const mockDiskUsage: DiskUsageResult = {
  totalBytes: 5242880,
  entries: [{ name: 'node_modules', path: '/test/node_modules', sizeBytes: 5242880, exists: true }],
  scanDurationMs: 100,
};

const mockProjectInfo: ProjectInfo = {
  ecosystem: 'node',
  packageManager: 'npm',
  scripts: [{ name: 'test', command: 'vitest' }],
  commands: {
    install: 'npm install',
    lint: null,
    format: null,
    test: 'npm test',
    coverage: null,
    build: null,
    typecheck: null,
    outdated: null,
    audit: null,
    clean: null,
  },
  hasGit: true,
  hasEnv: false,
  hasEnvExample: false,
  hasEditorConfig: false,
  hookTool: null,
  typeChecker: null,
};

const defaultProps = {
  workingDirectory: '/test/project',
  onRunCommand: vi.fn(),
};

describe('InfoSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:disk-usage') return Promise.resolve(mockDiskUsage);
      if (channel === 'dev-tools:project-info') return Promise.resolve(mockProjectInfo);
      return Promise.resolve(null);
    });
  });

  it('renders all 6 buttons', () => {
    render(<InfoSection {...defaultProps} />);
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Log')).toBeDefined();
    expect(screen.getByText('Branches')).toBeDefined();
    expect(screen.getByText('Remotes')).toBeDefined();
    expect(screen.getByText('Disk Usage')).toBeDefined();
    expect(screen.getByText('Project Info')).toBeDefined();
  });

  it('calls onRunCommand with git status on Status click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} onRunCommand={onRunCommand} />);
    const btn = screen.getByText('Status').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git status');
  });

  it('calls onRunCommand with git log on Log click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} onRunCommand={onRunCommand} />);
    const btn = screen.getByText('Log').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git log --oneline --graph -20');
  });

  it('calls onRunCommand with git branch -a on Branches click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} onRunCommand={onRunCommand} />);
    const btn = screen.getByText('Branches').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git branch -a');
  });

  it('calls onRunCommand with git remote -v on Remotes click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} onRunCommand={onRunCommand} />);
    const btn = screen.getByText('Remotes').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git remote -v');
  });

  it('shows disk usage inline panel on Disk Usage click', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Disk Usage — 5.0 MB')).toBeDefined();
    });
  });

  it('shows project info inline panel on Project Info click', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Project Info').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Ecosystem')).toBeDefined();
      expect(screen.getByText('node')).toBeDefined();
    });
  });

  it('toggles disk usage panel off when clicked again', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Disk Usage — 5.0 MB')).toBeDefined();
    });
    await user.click(btn);
    expect(screen.queryByText('Disk Usage — 5.0 MB')).toBeNull();
  });

  it('switches from disk usage to project info panel', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const diskBtn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(diskBtn);
    await waitFor(() => {
      expect(screen.getByText('Disk Usage — 5.0 MB')).toBeDefined();
    });
    const infoBtn = screen.getByText('Project Info').closest('button')!;
    await user.click(infoBtn);
    await waitFor(() => {
      expect(screen.queryByText('Disk Usage — 5.0 MB')).toBeNull();
      expect(screen.getByText('node')).toBeDefined();
    });
  });

  it('closes disk usage panel via close button', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Disk Usage — 5.0 MB')).toBeDefined();
    });
    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(screen.queryByText('Disk Usage — 5.0 MB')).toBeNull();
  });

  it('shows correct tooltips on git buttons', () => {
    render(<InfoSection {...defaultProps} />);
    expect(screen.getByText('Status').closest('button')?.title).toBe('git status');
    expect(screen.getByText('Log').closest('button')?.title).toBe('git log --oneline --graph -20');
    expect(screen.getByText('Branches').closest('button')?.title).toBe('git branch -a');
    expect(screen.getByText('Remotes').closest('button')?.title).toBe('git remote -v');
  });

  it('invokes dev-tools:disk-usage with workingDirectory', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:disk-usage', '/test/project');
    });
  });

  it('invokes dev-tools:project-info with workingDirectory', async () => {
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Project Info').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:project-info', '/test/project');
    });
  });

  it('handles disk usage IPC error gracefully', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:disk-usage') return Promise.reject(new Error('scan failed'));
      return Promise.resolve(null);
    });
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Disk Usage').closest('button')!;
    await user.click(btn);
    // Panel should not appear after error
    await waitFor(() => {
      expect(screen.queryByText(/Disk Usage —/)).toBeNull();
    });
  });

  it('handles project info IPC error gracefully', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:project-info') return Promise.reject(new Error('detect failed'));
      return Promise.resolve(null);
    });
    const user = userEvent.setup();
    render(<InfoSection {...defaultProps} />);
    const btn = screen.getByText('Project Info').closest('button')!;
    await user.click(btn);
    // Panel should not appear after error (only the button label "Project Info" text exists)
    await waitFor(() => {
      expect(screen.queryByText('node')).toBeNull();
    });
  });
});
