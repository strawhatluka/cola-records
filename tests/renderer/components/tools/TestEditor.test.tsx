import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { TestEditor } from '../../../../src/renderer/components/tools/TestEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('TestEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<TestEditor {...defaultProps} />);
    expect(screen.getByText('Loading test config...')).toBeDefined();
  });

  it('shows no-config message when no framework detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No test config found. Create one from the Test panel first.')
      ).toBeDefined();
    });
  });

  it('renders Vitest rich GUI when vitest JSON config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: {
            environment: 'jsdom',
            globals: true,
            coverageProvider: 'v8',
            coverageStatements: 80,
            coverageBranches: 70,
            coverageFunctions: 75,
            coverageLines: 80,
            testTimeout: 5000,
          },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Config')).toBeDefined();
    });

    // Check that rich GUI controls exist
    expect(screen.getByTestId('vitest-environment')).toBeDefined();
    expect(screen.getByTestId('vitest-globals')).toBeDefined();
    expect(screen.getByTestId('vitest-coverageProvider')).toBeDefined();
    expect(screen.getByTestId('vitest-testTimeout')).toBeDefined();
    expect(screen.getByTestId('vitest-coverageStatements')).toBeDefined();
    expect(screen.getByTestId('vitest-coverageBranches')).toBeDefined();
    expect(screen.getByTestId('vitest-coverageFunctions')).toBeDefined();
    expect(screen.getByTestId('vitest-coverageLines')).toBeDefined();
  });

  it('renders Jest rich GUI when jest JSON config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.json',
          hasConfig: true,
          coverageCommand: 'npx jest --coverage',
          watchCommand: 'npx jest --watch',
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'jest',
          config: {
            testEnvironment: 'jsdom',
            collectCoverage: true,
            coverageProvider: 'v8',
          },
          configPath: '/test/project/jest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Jest Config')).toBeDefined();
    });

    expect(screen.getByTestId('jest-testEnvironment')).toBeDefined();
    expect(screen.getByTestId('jest-collectCoverage')).toBeDefined();
    expect(screen.getByTestId('jest-coverageProvider')).toBeDefined();
  });

  it('renders generic textarea for TS config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { _raw: 'export default defineConfig({ test: {} })' },
          configPath: '/test/project/vitest.config.ts',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Config')).toBeDefined();
    });
    // Should show a textarea with the raw content
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });

  it('Save button is disabled when no changes made', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom', globals: true },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('Save button is enabled after changes', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom', globals: true },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    // Change globals to false
    const globalsSelect = screen.getByTestId('vitest-globals');
    await user.selectOptions(globalsSelect, 'false');

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('calls write-test-config on save', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom', globals: true },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved vitest.config.json' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    // Change globals
    const globalsSelect = screen.getByTestId('vitest-globals');
    await user.selectOptions(globalsSelect, 'false');

    // Click save
    const saveButton = screen.getByText('Save').closest('button')!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'vitest',
        expect.objectContaining({ globals: false })
      );
    });
  });

  it('shows unsaved changes prompt when closing with dirty config', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom', globals: true },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    // Make change
    await user.selectOptions(screen.getByTestId('vitest-globals'), 'false');

    // Click close
    await user.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('calls onClose directly when closing with no changes', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom' },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest Config')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes without saving when "Close without saving" clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'vitest',
          config: { environment: 'jsdom', globals: true },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('vitest-globals'), 'false');
    await user.click(screen.getByTitle('Close editor'));
    await user.click(screen.getByText('Close without saving'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
