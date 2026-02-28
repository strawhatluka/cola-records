import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { EditorConfigPanel } from '../../../../src/renderer/components/tools/EditorConfigPanel';
import type { EditorConfigSection } from '../../../../src/main/ipc/channels/types';

const mockPresets: EditorConfigSection[] = [
  {
    glob: '*',
    properties: {
      indent_style: 'space',
      indent_size: 2,
      end_of_line: 'lf',
      charset: 'utf-8',
      trim_trailing_whitespace: true,
      insert_final_newline: true,
    },
  },
  {
    glob: '*.md',
    properties: { trim_trailing_whitespace: false },
  },
];

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  hasEditorConfig: false,
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onConfigCreated: vi.fn(),
  onConfigDeleted: vi.fn(),
};

describe('EditorConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve(mockPresets);
      if (channel === 'dev-tools:create-editorconfig')
        return Promise.resolve({ success: true, message: 'Created .editorconfig (node preset)' });
      if (channel === 'dev-tools:delete-editorconfig')
        return Promise.resolve({ success: true, message: 'Deleted .editorconfig' });
      return Promise.resolve(null);
    });
  });

  // ── Setup mode (no config) ──

  it('renders setup mode when hasEditorConfig is false', async () => {
    render(<EditorConfigPanel {...defaultProps} />);
    expect(screen.getByText('Editor Config Setup')).toBeDefined();
    expect(screen.getByText('Create .editorconfig')).toBeDefined();
  });

  it('loads and displays preset preview', async () => {
    render(<EditorConfigPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Preview:')).toBeDefined();
    });
    expect(screen.getByText('[*]')).toBeDefined();
    expect(screen.getByText('[*.md]')).toBeDefined();
  });

  it('calls create-editorconfig on Create button click', async () => {
    render(<EditorConfigPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create .editorconfig')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create .editorconfig'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-editorconfig',
        '/test/project',
        'node'
      );
    });
  });

  it('calls onConfigCreated after successful creation', async () => {
    render(<EditorConfigPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create .editorconfig')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create .editorconfig'));

    await waitFor(() => {
      expect(defaultProps.onConfigCreated).toHaveBeenCalled();
    });
  });

  it('allows changing ecosystem preset', async () => {
    render(<EditorConfigPanel {...defaultProps} />);

    const select = screen.getByDisplayValue('Node.js / TypeScript');
    await userEvent.selectOptions(select, 'python');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-editorconfig-presets', 'python');
    });
  });

  // ── Actions mode (config exists) ──

  it('renders actions mode when hasEditorConfig is true', () => {
    render(<EditorConfigPanel {...defaultProps} hasEditorConfig={true} />);
    expect(screen.getByText('Editor Config')).toBeDefined();
    expect(screen.getByText('Edit Config')).toBeDefined();
    expect(screen.getByText('Reset to Default')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('calls onOpenEditor when Edit Config is clicked', async () => {
    render(<EditorConfigPanel {...defaultProps} hasEditorConfig={true} />);
    await userEvent.click(screen.getByText('Edit Config'));
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('shows confirmation before reset', async () => {
    render(<EditorConfigPanel {...defaultProps} hasEditorConfig={true} />);
    await userEvent.click(screen.getByText('Reset to Default'));

    expect(screen.getByText(/Reset .editorconfig to/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('shows confirmation before delete', async () => {
    render(<EditorConfigPanel {...defaultProps} hasEditorConfig={true} />);
    await userEvent.click(screen.getByText('Delete'));

    expect(screen.getByText('Delete .editorconfig?')).toBeDefined();
  });

  it('calls onConfigDeleted after successful delete', async () => {
    render(<EditorConfigPanel {...defaultProps} hasEditorConfig={true} />);
    await userEvent.click(screen.getByText('Delete'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('dev-tools:delete-editorconfig', '/test/project');
      expect(defaultProps.onConfigDeleted).toHaveBeenCalled();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    render(<EditorConfigPanel {...defaultProps} />);
    const closeButton = screen.getByTitle('Close');
    await userEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
