import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { EditorConfigEditor } from '../../../../src/renderer/components/tools/EditorConfigEditor';
import type {
  EditorConfigFile,
  EditorConfigSection,
} from '../../../../src/main/ipc/channels/types';

const mockConfig: EditorConfigFile = {
  root: true,
  sections: [
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
  ],
};

const mockPresets: EditorConfigSection[] = [
  {
    glob: '*',
    properties: { indent_style: 'space', indent_size: 2 },
  },
];

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('EditorConfigEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(mockConfig);
      if (channel === 'dev-tools:write-editorconfig')
        return Promise.resolve({ success: true, message: 'Saved .editorconfig' });
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<EditorConfigEditor {...defaultProps} />);
    expect(screen.getByText('Loading .editorconfig...')).toBeDefined();
  });

  it('renders editor with section cards after loading', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    // Glob inputs for both sections
    const globInputs = screen.getAllByRole('textbox');
    expect(globInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('displays root = true checkbox as checked', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('root = true')).toBeDefined();
    });

    const checkbox = screen.getByText('root = true').previousSibling as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('renders section glob inputs', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });
    expect((screen.getByTestId('glob-input-0') as HTMLInputElement).value).toBe('*');
    expect((screen.getByTestId('glob-input-1') as HTMLInputElement).value).toBe('*.md');
  });

  it('adds a new empty section when Add Section is clicked', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Add Section')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Add Section'));

    expect(screen.getByTestId('glob-input-2')).toBeDefined();
    expect((screen.getByTestId('glob-input-2') as HTMLInputElement).value).toBe('');
  });

  it('removes a section when trash icon is clicked', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-1')).toBeDefined();
    });

    // Click the second section's remove button
    const removeButtons = screen.getAllByTitle('Remove section');
    await userEvent.click(removeButtons[1]);

    // Second section (*.md) should be gone
    expect(screen.queryByTestId('glob-input-1')).toBeNull();
  });

  it('enables Save button when config is modified', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(true);

    // Modify a glob
    const globInput = screen.getByTestId('glob-input-0');
    await userEvent.clear(globInput);
    await userEvent.type(globInput, '**');

    expect(saveButton.disabled).toBe(false);
  });

  it('calls write-editorconfig on Save', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Modify config to make it dirty
    await userEvent.click(screen.getByText('Add Section'));

    const saveButton = screen.getByText('Save').closest('button')!;
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-editorconfig',
        '/test/project',
        expect.objectContaining({ root: true })
      );
    });
  });

  it('shows save status message after save', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Add Section'));
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Saved .editorconfig')).toBeDefined();
    });
  });

  it('shows unsaved changes prompt when closing with dirty config', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Make dirty
    await userEvent.click(screen.getByText('Add Section'));

    // Click close
    await userEvent.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('closes directly when not dirty', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes without saving when Close without saving is clicked', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Add Section'));
    await userEvent.click(screen.getByTitle('Close editor'));
    await userEvent.click(screen.getByText('Close without saving'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
