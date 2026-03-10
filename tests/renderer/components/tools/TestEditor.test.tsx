import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  // ── NEW TESTS ──────────────────────────────────────────────

  it('changes Jest collectCoverage toggle from true to false', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'jest',
          config: { testEnvironment: 'jsdom', collectCoverage: true, coverageProvider: 'v8' },
          configPath: '/test/project/jest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('jest-collectCoverage')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('jest-collectCoverage'), 'false');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'jest',
        expect.objectContaining({ collectCoverage: false })
      );
    });
  });

  it('changes Jest testEnvironment select to node', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'jest',
          config: { testEnvironment: 'jsdom', collectCoverage: true, coverageProvider: 'v8' },
          configPath: '/test/project/jest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('jest-testEnvironment')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('jest-testEnvironment'), 'node');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'jest',
        expect.objectContaining({ testEnvironment: 'node' })
      );
    });
  });

  it('changes Jest coverageProvider select to babel', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.json',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'jest',
          config: { testEnvironment: 'jsdom', collectCoverage: true, coverageProvider: 'v8' },
          configPath: '/test/project/jest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('jest-coverageProvider')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('jest-coverageProvider'), 'babel');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'jest',
        expect.objectContaining({ coverageProvider: 'babel' })
      );
    });
  });

  it('clears Vitest environment select to undefined', async () => {
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
          config: {
            environment: 'jsdom',
            globals: true,
            coverageProvider: 'v8',
            testTimeout: 5000,
          },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-environment')).toBeDefined();
    });

    // Clear environment to the "—" option (empty value)
    await user.selectOptions(screen.getByTestId('vitest-environment'), '');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-test-config'
      );
      expect(writeCall).toBeDefined();
      // When cleared, environment should be undefined (deleted from config)
      expect(writeCall![3]).not.toHaveProperty('environment');
    });
  });

  it('changes Vitest testTimeout number', async () => {
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
          config: { environment: 'jsdom', testTimeout: 5000 },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-testTimeout')).toBeDefined();
    });

    const input = screen.getByTestId('vitest-testTimeout');
    fireEvent.change(input, { target: { value: '10000' } });

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'vitest',
        expect.objectContaining({ testTimeout: 10000 })
      );
    });
  });

  it('clears Vitest testTimeout to undefined', async () => {
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
          config: { environment: 'jsdom', testTimeout: 5000 },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-testTimeout')).toBeDefined();
    });

    const input = screen.getByTestId('vitest-testTimeout');
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-test-config'
      );
      expect(writeCall).toBeDefined();
      // When cleared, testTimeout should be undefined (deleted from config)
      expect(writeCall![3]).not.toHaveProperty('testTimeout');
    });
  });

  it('changes Vitest coverageStatements number', async () => {
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
          config: { environment: 'jsdom', coverageStatements: 80 },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-coverageStatements')).toBeDefined();
    });

    const input = screen.getByTestId('vitest-coverageStatements');
    fireEvent.change(input, { target: { value: '90' } });

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'vitest',
        expect.objectContaining({ coverageStatements: 90 })
      );
    });
  });

  it('clears Vitest coverageProvider select to undefined', async () => {
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
          config: { environment: 'jsdom', coverageProvider: 'v8' },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-coverageProvider')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('vitest-coverageProvider'), '');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-test-config'
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![3]).not.toHaveProperty('coverageProvider');
    });
  });

  it('changes Vitest globals toggle to undefined (dash)', async () => {
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
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    // Change globals to '' (the dash/undefined option)
    await user.selectOptions(screen.getByTestId('vitest-globals'), '');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-test-config'
      );
      expect(writeCall).toBeDefined();
      // globals should be removed (undefined) from config
      expect(writeCall![3]).not.toHaveProperty('globals');
    });
  });

  it('shows "Failed to save" when write-test-config rejects', async () => {
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
      if (channel === 'dev-tools:write-test-config') return Promise.reject(new Error('Disk full'));
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('vitest-globals')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('vitest-globals'), 'false');

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  it('saves and closes when "Save and close" is clicked from unsaved prompt', async () => {
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

    // Make a change to dirty the config
    await user.selectOptions(screen.getByTestId('vitest-globals'), 'false');

    // Click close to trigger unsaved prompt
    await user.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();

    // Click "Save and close"
    await user.click(screen.getByText('Save and close'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'vitest',
        expect.objectContaining({ globals: false })
      );
    });

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('saves generic mode with _raw payload for non-rich framework', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'pytest',
          configPath: '/test/project/pytest.ini',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'pytest',
          config: { _raw: '[pytest]\naddopts = -v' },
          configPath: '/test/project/pytest.ini',
        });
      if (channel === 'dev-tools:write-test-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);

    // Wait for generic textarea to render with INI/TOML hint
    await waitFor(() => {
      expect(screen.getByText(/INI\/TOML format/)).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: '[pytest]\naddopts = -v --tb=short' } });

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-test-config',
        '/test/project',
        'pytest',
        { _raw: '[pytest]\naddopts = -v --tb=short' }
      );
    });
  });

  it('stops loading when detect-test-framework rejects', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.reject(new Error('Detection failed'));
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);

    // Initially shows loading
    expect(screen.getByText('Loading test config...')).toBeDefined();

    // After the rejection, loading should stop and show no-config fallback
    await waitFor(() => {
      expect(screen.queryByText('Loading test config...')).toBeNull();
    });
  });

  it('shows pytest hint in generic mode', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'pytest',
          configPath: '/test/project/pytest.ini',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'pytest',
          config: { _raw: '[pytest]\naddopts = -v' },
          configPath: '/test/project/pytest.ini',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('pytest Config')).toBeDefined();
    });

    expect(screen.getByText('INI/TOML format')).toBeDefined();
  });

  it('shows "RSpec Config" title for rspec framework', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'rspec',
          configPath: '/test/project/.rspec',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'rspec',
          config: { _raw: '--format documentation' },
          configPath: '/test/project/.rspec',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RSpec Config')).toBeDefined();
    });

    // Generic mode should show "Config file content" hint
    expect(screen.getByText('Config file content')).toBeDefined();
  });

  it('shows "Mocha Config" title for mocha framework', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'mocha',
          configPath: '/test/project/.mocharc.yml',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      if (channel === 'dev-tools:read-test-config')
        return Promise.resolve({
          framework: 'mocha',
          config: { _raw: 'spec: test/**/*.spec.js' },
          configPath: '/test/project/.mocharc.yml',
        });
      return Promise.resolve(null);
    });

    render(<TestEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Mocha Config')).toBeDefined();
    });
  });

  it('shows no-config message when framework detected but configPath is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
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
});
