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

import { PackageManagerPanel } from '../../../../src/renderer/components/tools/PackageManagerPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  packageManager: 'npm' as const,
  onClose: vi.fn(),
  onRunCommand: vi.fn(),
  onOpenEditor: vi.fn(),
};

describe('PackageManagerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PM detected mode', () => {
    it('renders panel header with title and close button', () => {
      render(<PackageManagerPanel {...defaultProps} />);
      expect(screen.getByText('Package Manager')).toBeDefined();
      expect(screen.getByTestId('icon-x')).toBeDefined();
    });

    it('renders 6 action buttons including Package Config', () => {
      render(<PackageManagerPanel {...defaultProps} />);
      expect(screen.getByText('Package Config')).toBeDefined();
      expect(screen.getByText('Init')).toBeDefined();
      expect(screen.getByText('Registry')).toBeDefined();
      expect(screen.getByText('Dedupe')).toBeDefined();
      expect(screen.getByText('Lock Refresh')).toBeDefined();
      expect(screen.getByText('Info')).toBeDefined();
    });

    it('renders Package Config as first button in action grid', () => {
      render(<PackageManagerPanel {...defaultProps} />);
      const buttons = screen
        .getByText('Package Manager')
        .closest('.rounded-lg')!
        .querySelectorAll('button');
      // First button after the header close button is Package Config
      const actionButtons = Array.from(buttons).filter(
        (btn) =>
          btn.textContent?.includes('Package Config') ||
          btn.textContent?.includes('Init') ||
          btn.textContent?.includes('Registry') ||
          btn.textContent?.includes('Dedupe') ||
          btn.textContent?.includes('Lock Refresh') ||
          btn.textContent?.includes('Info')
      );
      expect(actionButtons[0]?.textContent).toContain('Package Config');
    });

    it('calls onOpenEditor when Package Config button clicked', async () => {
      const onOpenEditor = vi.fn();
      render(<PackageManagerPanel {...defaultProps} onOpenEditor={onOpenEditor} />);

      const packageConfigButton = screen.getByText('Package Config').closest('button')!;
      await userEvent.click(packageConfigButton);

      expect(onOpenEditor).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<PackageManagerPanel {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByTestId('icon-x').closest('button')!;
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles Init button click - sends command', async () => {
      const onRunCommand = vi.fn();
      mockInvoke.mockResolvedValueOnce('npm init -y');

      render(<PackageManagerPanel {...defaultProps} onRunCommand={onRunCommand} />);

      const initButton = screen.getByText('Init').closest('button')!;
      await userEvent.click(initButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-pm-init-command', 'npm');
        expect(onRunCommand).toHaveBeenCalledWith('npm init -y');
      });
    });

    it('handles Init button click - no command available', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      render(<PackageManagerPanel {...defaultProps} />);

      const initButton = screen.getByText('Init').closest('button')!;
      await userEvent.click(initButton);

      await waitFor(() => {
        expect(screen.getByText('No init command')).toBeDefined();
      });
    });

    it('handles Registry button click - shows registry URL', async () => {
      mockInvoke.mockResolvedValueOnce({
        name: 'npm',
        version: '10.0.0',
        lockFile: 'package-lock.json',
        registry: 'https://registry.npmjs.org/',
      });

      render(<PackageManagerPanel {...defaultProps} />);

      const registryButton = screen.getByText('Registry').closest('button')!;
      await userEvent.click(registryButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-pm-info', '/test/project', 'npm');
        expect(screen.getByText('https://registry.npmjs.org/')).toBeDefined();
      });
    });

    it('handles Dedupe button click - sends command', async () => {
      const onRunCommand = vi.fn();
      mockInvoke.mockResolvedValueOnce('npm dedupe');

      render(<PackageManagerPanel {...defaultProps} onRunCommand={onRunCommand} />);

      const dedupeButton = screen.getByText('Dedupe').closest('button')!;
      await userEvent.click(dedupeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-pm-dedupe-command', 'npm');
        expect(onRunCommand).toHaveBeenCalledWith('npm dedupe');
      });
    });

    it('handles Lock Refresh button click - sends command', async () => {
      const onRunCommand = vi.fn();
      mockInvoke.mockResolvedValueOnce('rm -f package-lock.json && npm install');

      render(<PackageManagerPanel {...defaultProps} onRunCommand={onRunCommand} />);

      const lockRefreshButton = screen.getByText('Lock Refresh').closest('button')!;
      await userEvent.click(lockRefreshButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-pm-lock-refresh-command', 'npm');
        expect(onRunCommand).toHaveBeenCalledWith('rm -f package-lock.json && npm install');
      });
    });

    it('handles Info button click - shows PM info', async () => {
      mockInvoke.mockResolvedValueOnce({
        name: 'npm',
        version: '10.0.0',
        lockFile: 'package-lock.json',
        registry: 'https://registry.npmjs.org/',
      });

      render(<PackageManagerPanel {...defaultProps} />);

      const infoButton = screen.getByText('Info').closest('button')!;
      await userEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.getByText('PM: npm | v10.0.0 | Lock: package-lock.json')).toBeDefined();
      });
    });

    it('shows "Failed" status when IPC call rejects', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC error'));

      render(<PackageManagerPanel {...defaultProps} />);

      const initButton = screen.getByText('Init').closest('button')!;
      await userEvent.click(initButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeDefined();
      });
    });
  });

  describe('setup wizard mode (unknown PM)', () => {
    const unknownProps = {
      ...defaultProps,
      packageManager: 'unknown' as const,
    };

    it('renders setup wizard header', () => {
      render(<PackageManagerPanel {...unknownProps} />);
      expect(screen.getByText('Package Manager Setup')).toBeDefined();
    });

    it('shows PM recommendations for node ecosystem', () => {
      render(<PackageManagerPanel {...unknownProps} />);
      expect(screen.getByText('npm')).toBeDefined();
      expect(screen.getByText('yarn')).toBeDefined();
      expect(screen.getByText('pnpm')).toBeDefined();
      expect(screen.getByText('bun')).toBeDefined();
    });

    it('shows PM recommendations for python ecosystem', () => {
      render(<PackageManagerPanel {...unknownProps} ecosystem="python" />);
      expect(screen.getByText('pip')).toBeDefined();
      expect(screen.getByText('poetry')).toBeDefined();
      expect(screen.getByText('uv')).toBeDefined();
    });

    it('shows PM recommendations for rust ecosystem', () => {
      render(<PackageManagerPanel {...unknownProps} ecosystem="rust" />);
      expect(screen.getByText('cargo')).toBeDefined();
    });

    it('renders Initialize button', () => {
      render(<PackageManagerPanel {...unknownProps} />);
      expect(screen.getByText('Initialize')).toBeDefined();
    });

    it('allows selecting a different PM', async () => {
      render(<PackageManagerPanel {...unknownProps} />);

      const pnpmButton = screen.getByText('pnpm').closest('button')!;
      await userEvent.click(pnpmButton);

      // pnpm should now have primary border
      expect(pnpmButton.className).toContain('border-primary');
    });

    it('calls onRunCommand with init command when Initialize clicked', async () => {
      const onRunCommand = vi.fn();
      mockInvoke.mockResolvedValueOnce('npm init -y');

      render(<PackageManagerPanel {...unknownProps} onRunCommand={onRunCommand} />);

      const initButton = screen.getByText('Initialize').closest('button')!;
      await userEvent.click(initButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-pm-init-command', 'npm');
        expect(onRunCommand).toHaveBeenCalledWith('npm init -y');
      });
    });

    it('shows status when setup command has no init command', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      render(<PackageManagerPanel {...unknownProps} />);

      const initButton = screen.getByText('Initialize').closest('button')!;
      await userEvent.click(initButton);

      await waitFor(() => {
        expect(screen.getByText('No init command for this PM')).toBeDefined();
      });
    });

    it('calls onClose when close button clicked in setup mode', async () => {
      const onClose = vi.fn();
      render(<PackageManagerPanel {...unknownProps} onClose={onClose} />);

      const closeButton = screen.getByTestId('icon-x').closest('button')!;
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
