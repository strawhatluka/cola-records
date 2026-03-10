import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  // ─── NEW TESTS: StringListEditor ───────────────────────────

  it('adds reporter via Enter key', async () => {
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
          config: { provider: 'v8', reporters: ['text'] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-reporters-input')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-reporters-input');
    await user.type(input, 'lcov');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTitle('Remove lcov')).toBeDefined();
    });
  });

  it('adds reporter via Plus button click', async () => {
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
          config: { provider: 'v8', reporters: [] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-reporters-input')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-reporters-input');
    await user.type(input, 'html');

    const addButton = screen.getByTestId('coverage-reporters-add');
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByTitle('Remove html')).toBeDefined();
    });
  });

  it('removes reporter chip on trash button click', async () => {
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
          config: { provider: 'v8', reporters: ['text', 'html'] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Remove text')).toBeDefined();
    });

    await user.click(screen.getByTitle('Remove text'));

    await waitFor(() => {
      expect(screen.queryByTitle('Remove text')).toBeNull();
    });
    expect(screen.getByTitle('Remove html')).toBeDefined();
  });

  it('prevents adding duplicate reporter', async () => {
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
          config: { provider: 'v8', reporters: ['text'] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-reporters-input')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-reporters-input');
    await user.type(input, 'text');
    await user.keyboard('{Enter}');

    // Only one "Remove text" button should exist (the original)
    const removeButtons = screen.getAllByTitle('Remove text');
    expect(removeButtons).toHaveLength(1);
  });

  it('does not add empty input when Plus button clicked', async () => {
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
          config: { provider: 'v8', reporters: ['text'] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-reporters-add')).toBeDefined();
    });

    const addButton = screen.getByTestId('coverage-reporters-add');
    // Button should be disabled when input is empty
    expect(addButton.hasAttribute('disabled')).toBe(true);
    await user.click(addButton);

    // Still only the original chip
    const removeButtons = screen.getAllByTitle('Remove text');
    expect(removeButtons).toHaveLength(1);
  });

  // ─── NEW TESTS: ConfigNumber ───────────────────────────────

  it('updates statements number input', async () => {
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
      expect(screen.getByTestId('coverage-statements')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-statements');
    fireEvent.change(input, { target: { value: '90' } });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('90');
    });

    // Save should be enabled after the change
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('clears number field to undefined', async () => {
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
          config: { provider: 'v8', statements: 80 },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-coverage-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-statements')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-statements');
    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });

    const saveButton = screen.getByText('Save').closest('button')!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-coverage-config',
        '/test/project',
        'v8',
        expect.not.objectContaining({ statements: expect.anything() })
      );
    });
  });

  // ─── NEW TESTS: ConfigToggle ───────────────────────────────

  it('toggles all to true then back to dash (undefined)', async () => {
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
          config: { provider: 'v8' },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    const select = screen.getByTestId('coverage-all');

    // Toggle to true
    await user.selectOptions(select, 'true');
    expect((select as HTMLSelectElement).value).toBe('true');

    // Toggle back to dash (undefined)
    await user.selectOptions(select, '');
    expect((select as HTMLSelectElement).value).toBe('');

    // No longer dirty since we returned to the initial state
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('changes cleanOnRerun toggle', async () => {
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
          config: { provider: 'v8', cleanOnRerun: true },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-cleanOnRerun')).toBeDefined();
    });

    const select = screen.getByTestId('coverage-cleanOnRerun');
    expect((select as HTMLSelectElement).value).toBe('true');

    await user.selectOptions(select, 'false');
    expect((select as HTMLSelectElement).value).toBe('false');

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  // ─── NEW TESTS: ConfigText ────────────────────────────────

  it('changes reportsDirectory text input', async () => {
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
          config: { provider: 'v8', reportsDirectory: './coverage' },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-reportsDirectory')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-reportsDirectory');
    await user.clear(input);
    await user.type(input, './out');

    expect((input as HTMLInputElement).value).toBe('./out');
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  // ─── NEW TESTS: ConfigSelect (provider) ───────────────────

  it('changes provider select to istanbul', async () => {
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
          config: { provider: 'v8' },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-provider')).toBeDefined();
    });

    const select = screen.getByTestId('coverage-provider');
    await user.selectOptions(select, 'istanbul');
    expect((select as HTMLSelectElement).value).toBe('istanbul');

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('clears provider select to undefined', async () => {
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
          config: { provider: 'v8' },
          configPath: '/test/project/vitest.config.json',
        });
      if (channel === 'dev-tools:write-coverage-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-provider')).toBeDefined();
    });

    const select = screen.getByTestId('coverage-provider');
    await user.selectOptions(select, '');
    expect((select as HTMLSelectElement).value).toBe('');

    const saveButton = screen.getByText('Save').closest('button')!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-coverage-config',
        '/test/project',
        'v8',
        expect.not.objectContaining({ provider: expect.anything() })
      );
    });
  });

  // ─── NEW TESTS: Save failure ──────────────────────────────

  it('shows "Failed to save" when write-coverage-config rejects', async () => {
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
        return Promise.reject(new Error('Write error'));
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
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  // ─── NEW TESTS: Save and close flow ───────────────────────

  it('saves and closes when "Save and close" clicked in unsaved prompt', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
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
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-all')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('coverage-all'), 'true');
    await user.click(screen.getByTitle('Close editor'));

    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    });

    await user.click(screen.getByText('Save and close'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-coverage-config',
        '/test/project',
        'v8',
        expect.objectContaining({ all: true })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  // ─── NEW TESTS: Generic mode save with _raw ───────────────

  it('saves generic mode with _raw payload for non-rich provider', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'nyc',
          configPath: '/test/project/.nycrc',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'nyc',
          config: { _raw: '{"all": true}' },
          configPath: '/test/project/.nycrc',
        });
      if (channel === 'dev-tools:write-coverage-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);

    // Wait for generic textarea with nyc hint
    await waitFor(() => {
      expect(screen.getByText(/nyc config/)).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    fireEvent.change(textarea, { target: { value: '{"all": false}' } });

    const saveButton = screen.getByText('Save').closest('button')!;
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-coverage-config',
        '/test/project',
        'nyc',
        { _raw: '{"all": false}' }
      );
    });
  });

  // ─── NEW TESTS: Load error fallback ───────────────────────

  it('ends loading state when detect-coverage rejects', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.reject(new Error('Network error'));
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);

    // Initially shows loading
    expect(screen.getByText('Loading coverage config...')).toBeDefined();

    // After rejection, loading should end and show no-config fallback
    await waitFor(() => {
      expect(screen.queryByText('Loading coverage config...')).toBeNull();
    });
  });

  // ─── NEW TESTS: Generic hint text ─────────────────────────

  it('shows nyc hint in generic mode', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage')
        return Promise.resolve({
          provider: 'nyc',
          configPath: '/test/project/.nycrc',
          hasConfig: true,
          reportPath: null,
        });
      if (channel === 'dev-tools:read-coverage-config')
        return Promise.resolve({
          provider: 'nyc',
          config: { _raw: '{}' },
          configPath: '/test/project/.nycrc',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('nyc config (JSON/YAML)')).toBeDefined();
    });
  });

  it('shows JS/TS config hint for v8 generic mode', async () => {
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
          config: { _raw: 'export default {}' },
          configPath: '/test/project/vitest.config.ts',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('JavaScript/TypeScript config file')).toBeDefined();
    });
  });

  it('shows INI format hint for coverage-py generic mode', async () => {
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
      expect(screen.getByText('INI format (.coveragerc)')).toBeDefined();
    });
  });

  // ─── NEW TESTS: Include/Exclude StringListEditors ─────────

  it('adds item to include list', async () => {
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
          config: { provider: 'v8', include: [] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-include-input')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-include-input');
    await user.type(input, 'src/**/*.ts');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTitle('Remove src/**/*.ts')).toBeDefined();
    });
  });

  it('adds item to exclude list', async () => {
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
          config: { provider: 'v8', exclude: [] },
          configPath: '/test/project/vitest.config.json',
        });
      return Promise.resolve(null);
    });

    render(<CoverageEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('coverage-exclude-input')).toBeDefined();
    });

    const input = screen.getByTestId('coverage-exclude-input');
    await user.type(input, 'node_modules');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTitle('Remove node_modules')).toBeDefined();
    });
  });
});
