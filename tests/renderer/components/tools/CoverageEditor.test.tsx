import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { CoverageEditor } from '../../../../src/renderer/components/tools/CoverageEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('CoverageEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<CoverageEditor {...defaultProps} />);
    expect(screen.getByText('Loading coverage config...')).toBeDefined();
  });

  it('shows no-config message when no provider detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: false,
          reportPath: null,
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No coverage config found. Create one from the Coverage panel first.')
      ).toBeDefined();
    });
  });

  it('renders rich GUI when v8 JSON config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: {
            provider: 'v8',
            statements: 80,
            branches: 70,
            functions: 75,
            lines: 80,
            reporters: ['text', 'html'],
            reportsDirectory: './coverage',
            all: false,
            cleanOnRerun: true,
          },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Coverage Config')).toBeDefined();
    });

    expect(screen.getByTestId('coverage-provider')).toBeDefined();
    expect(screen.getByTestId('coverage-all')).toBeDefined();
    expect(screen.getByTestId('coverage-cleanOnRerun')).toBeDefined();
    expect(screen.getByTestId('coverage-reportsDirectory')).toBeDefined();
    expect(screen.getByTestId('coverage-statements')).toBeDefined();
    expect(screen.getByTestId('coverage-branches')).toBeDefined();
    expect(screen.getByTestId('coverage-functions')).toBeDefined();
    expect(screen.getByTestId('coverage-lines')).toBeDefined();
    expect(screen.getByTestId('coverage-reporters')).toBeDefined();
    expect(screen.getByTestId('coverage-include')).toBeDefined();
    expect(screen.getByTestId('coverage-exclude')).toBeDefined();
  });

  it('renders Istanbul title for istanbul provider', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'istanbul',
          configPath: '/test/project/jest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'istanbul',
          config: { provider: 'istanbul', statements: 80 },
          configPath: '/test/project/jest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Jest Coverage Config')).toBeDefined();
    });
  });

  it('renders generic textarea for TS config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { _raw: 'export default defineConfig({ test: { coverage: {} } })' },
          configPath: '/test/project/vitest.config.ts',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Coverage Config')).toBeDefined();
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });

  it('Save button is disabled when no changes made', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8', statements: 80 },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Coverage Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('Save button is enabled after changes', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8', all: false },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('coverage-all'), 'true');

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('calls write-coverage-config on save', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8', all: false },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-coverage-config')
        return Promise.resolve({ success: true, message: 'Saved coverage config' });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('coverage-all'), 'true');

    const saveButton = screen.getByText('Save').closest('button')!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-coverage-config',
        '/test/project',
        'v8',
        expect.objectContaining({ all: true })
      );
    });
  });

  it('shows unsaved changes prompt when closing with dirty config', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8', all: false },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('coverage-all'), 'true');
    await user.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('calls onClose directly when closing with no changes', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8' },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Coverage Config')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes without saving when "Close without saving" clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'v8',
          config: { provider: 'v8', all: false },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('coverage-all'), 'true');
    await user.click(screen.getByTitle('Close editor'));
    await user.click(screen.getByText('Close without saving'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders generic textarea for non-node provider', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'coverage-py',
          configPath: '/test/project/.coveragerc',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'coverage-py',
          config: { _raw: '[run]\nomit = tests/*' },
          configPath: '/test/project/.coveragerc',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('Coverage Config')).toBeDefined();
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });
});
