import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { FormatPanel } from '../../../../src/renderer/components/tools/FormatPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  formatCommand: 'npm run format',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onOpenIgnoreEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('FormatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Detection ──

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<FormatPanel {...defaultProps} />);
    expect(screen.getByText('Detecting formatter...')).toBeDefined();
  });

  it('shows detected formatter with config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier')).toBeDefined();
    });
  });

  it('shows no-config setup when no config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: 'prettier', configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Detected: Prettier (no config file)')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('shows "No formatter detected" when nothing found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No formatter detected')).toBeDefined();
    });
  });

  // ── Config exists — actions ──

  it('renders action buttons when config exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
      expect(screen.getByText('Format Check')).toBeDefined();
      expect(screen.getByText('Edit Config')).toBeDefined();
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });
  });

  it('calls onRunCommand with format command when Run Format clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Run Format').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run format');
  });

  it('calls onRunCommand with --check flag for Format Check', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format Check')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Format Check').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run format --check');
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Config').closest('button')!);
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('calls create-format-ignore when Create Ignore clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.resolve({ success: true, message: 'Created .prettierignore' });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-format-ignore',
        '/test/project',
        'prettier'
      );
    });
  });

  it('calls onClose when close button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Edit Ignore button ──

  it('shows Edit Ignore instead of Create Ignore when ignore file exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore')
        return Promise.resolve('node_modules/\ndist/\n');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });
    expect(screen.queryByText('Create Ignore')).toBeNull();
  });

  it('calls onOpenIgnoreEditor when Edit Ignore clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Ignore').closest('button')!);
    expect(defaultProps.onOpenIgnoreEditor).toHaveBeenCalled();
  });

  it('switches from Create Ignore to Edit Ignore after successful creation', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.resolve({ success: true, message: 'Created .prettierignore' });
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });
    expect(screen.queryByText('Create Ignore')).toBeNull();
  });
});
