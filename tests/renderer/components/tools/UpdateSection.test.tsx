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

import { UpdateSection } from '../../../../src/renderer/components/tools/UpdateSection';
import type { ProjectCommands, CleanTarget } from '../../../../src/main/ipc/channels/types';

const fullCommands: ProjectCommands = {
  install: 'npm install',
  lint: 'npm run lint',
  format: 'npm run format',
  test: 'npm test',
  coverage: 'npm run test:coverage',
  build: 'npm run build',
  typecheck: 'npm run typecheck',
  outdated: 'npm outdated',
  audit: 'npm audit',
  clean: null,
};

const emptyCommands: ProjectCommands = {
  install: null,
  lint: null,
  format: null,
  test: null,
  coverage: null,
  build: null,
  typecheck: null,
  outdated: null,
  audit: null,
  clean: null,
};

const defaultProps = {
  commands: fullCommands,
  workingDirectory: '/test/project',
  onRunCommand: vi.fn(),
};

const mockCleanTargets: CleanTarget[] = [
  { name: 'dist', path: '/test/project/dist', sizeBytes: 1048576 },
  { name: 'node_modules/.cache', path: '/test/project/node_modules/.cache', sizeBytes: 5242880 },
];

describe('UpdateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no upstream remote
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes')
        return Promise.resolve([{ name: 'origin', fetchUrl: '', pushUrl: '' }]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve(mockCleanTargets);
      return Promise.resolve(null);
    });
  });

  it('renders all 5 buttons', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    expect(screen.getByText('Audit')).toBeDefined();
    expect(screen.getByText('Pull Latest')).toBeDefined();
    expect(screen.getByText('Sync Fork')).toBeDefined();
    expect(screen.getByText('Clean')).toBeDefined();
  });

  it('enables Update Deps when outdated command exists', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    const btn = screen.getByText('Update Deps').closest('button');
    expect(btn?.disabled).toBe(false);
  });

  it('disables Update Deps when no outdated command', async () => {
    render(<UpdateSection {...defaultProps} commands={emptyCommands} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    const btn = screen.getByText('Update Deps').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('calls onRunCommand with outdated command on Update Deps click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    const btn = screen.getByText('Update Deps').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('npm outdated');
  });

  it('enables Audit when audit command exists', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Audit')).toBeDefined();
    });
    const btn = screen.getByText('Audit').closest('button');
    expect(btn?.disabled).toBe(false);
  });

  it('disables Audit when no audit command', async () => {
    render(<UpdateSection {...defaultProps} commands={emptyCommands} />);
    await waitFor(() => {
      expect(screen.getByText('Audit')).toBeDefined();
    });
    const btn = screen.getByText('Audit').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('calls onRunCommand with audit command on Audit click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Audit')).toBeDefined();
    });
    const btn = screen.getByText('Audit').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('npm audit');
  });

  it('Pull Latest is always enabled', async () => {
    render(<UpdateSection {...defaultProps} commands={emptyCommands} />);
    await waitFor(() => {
      expect(screen.getByText('Pull Latest')).toBeDefined();
    });
    const btn = screen.getByText('Pull Latest').closest('button');
    expect(btn?.disabled).toBe(false);
  });

  it('calls onRunCommand with git pull on Pull Latest click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Pull Latest')).toBeDefined();
    });
    const btn = screen.getByText('Pull Latest').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git pull');
  });

  it('disables Sync Fork when no upstream remote', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Sync Fork').closest('button');
      expect(btn?.disabled).toBe(true);
    });
  });

  it('enables Sync Fork when upstream remote exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes')
        return Promise.resolve([
          { name: 'origin', fetchUrl: '', pushUrl: '' },
          { name: 'upstream', fetchUrl: '', pushUrl: '' },
        ]);
      return Promise.resolve([]);
    });
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Sync Fork').closest('button');
      expect(btn?.disabled).toBe(false);
    });
  });

  it('calls onRunCommand with fetch upstream command on Sync Fork click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes')
        return Promise.resolve([
          { name: 'origin', fetchUrl: '', pushUrl: '' },
          { name: 'upstream', fetchUrl: '', pushUrl: '' },
        ]);
      return Promise.resolve([]);
    });
    render(<UpdateSection {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      const btn = screen.getByText('Sync Fork').closest('button');
      expect(btn?.disabled).toBe(false);
    });
    const btn = screen.getByText('Sync Fork').closest('button')!;
    await user.click(btn);
    expect(onRunCommand).toHaveBeenCalledWith('git fetch upstream && git merge upstream/main');
  });

  it('opens clean confirmation dialog on Clean click', async () => {
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const btn = screen.getByText('Clean').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Confirm Clean')).toBeDefined();
    });
  });

  it('shows clean targets with sizes in dialog', async () => {
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const btn = screen.getByText('Clean').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('dist')).toBeDefined();
    });
    expect(screen.getByText('node_modules/.cache')).toBeDefined();
    expect(screen.getByText('1.0 MB')).toBeDefined();
    expect(screen.getByText('5.0 MB')).toBeDefined();
  });

  it('shows total size in clean dialog', async () => {
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const btn = screen.getByText('Clean').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Total: 6.0 MB')).toBeDefined();
    });
  });

  it('shows warning text in clean dialog', async () => {
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const btn = screen.getByText('Clean').closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(
        screen.getByText('This will permanently delete these files and directories.')
      ).toBeDefined();
    });
  });

  it('calls onRunCommand with rm -rf on Confirm click', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const cleanBtn = screen.getByText('Clean').closest('button')!;
    await user.click(cleanBtn);
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeDefined();
    });
    const confirmBtn = screen.getByText('Confirm').closest('button')!;
    await user.click(confirmBtn);
    expect(onRunCommand).toHaveBeenCalledWith(
      'rm -rf "/test/project/dist" "/test/project/node_modules/.cache"'
    );
  });

  it('uses ecosystem clean command when available', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    const rustCommands = { ...fullCommands, clean: 'cargo clean' };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });
    render(
      <UpdateSection
        commands={rustCommands}
        workingDirectory="/test/project"
        onRunCommand={onRunCommand}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const cleanBtn = screen.getByText('Clean').closest('button')!;
    await user.click(cleanBtn);
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeDefined();
    });
    const confirmBtn = screen.getByText('Confirm').closest('button')!;
    await user.click(confirmBtn);
    expect(onRunCommand).toHaveBeenCalledWith('cargo clean');
  });

  it('closes clean dialog on Cancel click', async () => {
    const user = userEvent.setup();
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const cleanBtn = screen.getByText('Clean').closest('button')!;
    await user.click(cleanBtn);
    await waitFor(() => {
      expect(screen.getByText('Confirm Clean')).toBeDefined();
    });
    const cancelBtn = screen.getByText('Cancel').closest('button')!;
    await user.click(cancelBtn);
    expect(screen.queryByText('Confirm Clean')).toBeNull();
  });

  it('disables Confirm when no targets and no clean command', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes') return Promise.resolve([]);
      if (channel === 'dev-tools:get-clean-targets') return Promise.resolve([]);
      return Promise.resolve(null);
    });
    render(<UpdateSection {...defaultProps} commands={emptyCommands} />);
    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeDefined();
    });
    const cleanBtn = screen.getByText('Clean').closest('button')!;
    await user.click(cleanBtn);
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeDefined();
    });
    const confirmBtn = screen.getByText('Confirm').closest('button');
    expect(confirmBtn?.disabled).toBe(true);
  });

  it('shows tooltip on Update Deps with command', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    const btn = screen.getByText('Update Deps').closest('button');
    expect(btn?.title).toBe('npm outdated');
  });

  it('shows fallback tooltip when no outdated command', async () => {
    render(<UpdateSection {...defaultProps} commands={emptyCommands} />);
    await waitFor(() => {
      expect(screen.getByText('Update Deps')).toBeDefined();
    });
    const btn = screen.getByText('Update Deps').closest('button');
    expect(btn?.title).toBe('No outdated command detected');
  });

  it('shows tooltip on Sync Fork explaining how to add upstream', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Sync Fork').closest('button');
      expect(btn?.title).toBe('No upstream remote — add one with git remote add upstream <url>');
    });
  });

  it('calls git:get-remotes with workingDirectory on mount', async () => {
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:get-remotes', '/test/project');
    });
  });

  it('handles git:get-remotes failure gracefully', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-remotes') return Promise.reject(new Error('git error'));
      return Promise.resolve([]);
    });
    render(<UpdateSection {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Sync Fork').closest('button');
      expect(btn?.disabled).toBe(true);
    });
  });
});
