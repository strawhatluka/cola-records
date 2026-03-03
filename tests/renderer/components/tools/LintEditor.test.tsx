import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { LintEditor } from '../../../../src/renderer/components/tools/LintEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('LintEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<LintEditor {...defaultProps} />);
    expect(screen.getByText('Loading lint config...')).toBeDefined();
  });

  it('shows no config message when no linter detected', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No lint config found. Create one from the Lint panel first.')
      ).toBeDefined();
    });
  });

  it('shows rich ESLint editor for JSON config', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: {
          env: { browser: true, node: true },
          extends: ['eslint:recommended'],
          rules: { 'no-console': 'warn' },
        },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    expect(screen.getByText('Environments')).toBeDefined();
    expect(screen.getByText('Extends')).toBeDefined();
    expect(screen.getByText('Rules')).toBeDefined();
  });

  it('shows generic textarea for JS/TS ESLint config', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/eslint.config.js',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { _raw: 'export default []' },
        configPath: '/test/eslint.config.js',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
    expect((textarea as HTMLTextAreaElement).value).toBe('export default []');
  });

  it('shows generic textarea for non-eslint linters', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'AllCops:\n  TargetRubyVersion: 3.0' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe('AllCops:\n  TargetRubyVersion: 3.0');
  });

  it('Save button is disabled when no changes made', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { env: { browser: true }, extends: ['eslint:recommended'] },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('calls onClose when close button clicked with no changes', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint Editor')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows unsaved changes prompt when closing with dirty state', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'original content' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'modified content');

    await user.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('saves and closes when Save and close is clicked in prompt', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'original content' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'modified content');

    await user.click(screen.getByTitle('Close editor'));

    mockInvoke.mockResolvedValueOnce({ success: true, message: 'Saved' });
    await user.click(screen.getByText('Save and close'));
    expect(mockInvoke).toHaveBeenCalledWith(
      'dev-tools:write-lint-config',
      '/test/project',
      'rubocop',
      expect.objectContaining({ _raw: 'modified content' })
    );
  });
});
