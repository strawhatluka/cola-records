import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  // ── Property control tests ──

  it('changes indent_style select to tab and marks dirty', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(true);

    const selects = screen.getAllByTestId('prop-indent_style');
    await userEvent.selectOptions(selects[0], 'tab');

    expect((selects[0] as HTMLSelectElement).value).toBe('tab');
    expect(saveButton.disabled).toBe(false);
  });

  it('changes end_of_line select to crlf', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const selects = screen.getAllByTestId('prop-end_of_line');
    await userEvent.selectOptions(selects[0], 'crlf');

    expect((selects[0] as HTMLSelectElement).value).toBe('crlf');
  });

  it('changes charset select to utf-8-bom', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const selects = screen.getAllByTestId('prop-charset');
    await userEvent.selectOptions(selects[0], 'utf-8-bom');

    expect((selects[0] as HTMLSelectElement).value).toBe('utf-8-bom');
  });

  it('changes indent_size number input', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const inputs = screen.getAllByTestId('prop-indent_size');
    fireEvent.change(inputs[0], { target: { value: '4' } });

    expect((inputs[0] as HTMLInputElement).value).toBe('4');
  });

  it('clears indent_size to undefined when emptied', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const inputs = screen.getAllByTestId('prop-indent_size');
    fireEvent.change(inputs[0], { target: { value: '' } });

    expect((inputs[0] as HTMLInputElement).value).toBe('');

    // Config is dirty because indent_size was deleted
    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(false);
  });

  it('changes tab_width number input', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const inputs = screen.getAllByTestId('prop-tab_width');
    fireEvent.change(inputs[0], { target: { value: '8' } });

    expect((inputs[0] as HTMLInputElement).value).toBe('8');
  });

  it('changes trim_trailing_whitespace toggle to false', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const selects = screen.getAllByTestId('prop-trim_trailing_whitespace');
    await userEvent.selectOptions(selects[0], 'false');

    expect((selects[0] as HTMLSelectElement).value).toBe('false');
  });

  it('changes insert_final_newline toggle to false', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const selects = screen.getAllByTestId('prop-insert_final_newline');
    await userEvent.selectOptions(selects[0], 'false');

    expect((selects[0] as HTMLSelectElement).value).toBe('false');
  });

  it('clears indent_style to — (empty) and removes property', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const selects = screen.getAllByTestId('prop-indent_style');
    await userEvent.selectOptions(selects[0], '');

    expect((selects[0] as HTMLSelectElement).value).toBe('');

    // Config is dirty because indent_style was deleted
    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(false);
  });

  // ── max_line_length tests ──

  it('changes max_line_length number input', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    const inputs = screen.getAllByTestId('prop-max_line_length');
    fireEvent.change(inputs[0], { target: { value: '120' } });

    expect((inputs[0] as HTMLInputElement).value).toBe('120');
  });

  it('checks max_line_length off checkbox to set value to off', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Find the "off" checkbox - it's inside a label with text "off"
    const offLabels = screen.getAllByText('off');
    const offCheckbox = offLabels[0].previousSibling as HTMLInputElement;

    fireEvent.click(offCheckbox);

    await waitFor(() => {
      expect(offCheckbox.checked).toBe(true);
    });

    // Number input should be disabled when off is checked
    const inputs = screen.getAllByTestId('prop-max_line_length');
    expect((inputs[0] as HTMLInputElement).disabled).toBe(true);
  });

  it('unchecks max_line_length off checkbox to set value to undefined', async () => {
    // Start with max_line_length = 'off' in the config
    const configWithOff: EditorConfigFile = {
      root: true,
      sections: [
        {
          glob: '*',
          properties: {
            indent_style: 'space',
            max_line_length: 'off',
          },
        },
      ],
    };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(configWithOff);
      if (channel === 'dev-tools:write-editorconfig')
        return Promise.resolve({ success: true, message: 'Saved .editorconfig' });
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // The "off" checkbox should start checked
    const offLabels = screen.getAllByText('off');
    const offCheckbox = offLabels[0].previousSibling as HTMLInputElement;
    expect(offCheckbox.checked).toBe(true);

    // Uncheck it
    fireEvent.click(offCheckbox);

    await waitFor(() => {
      expect(offCheckbox.checked).toBe(false);
    });

    // Number input should be re-enabled
    const inputs = screen.getAllByTestId('prop-max_line_length');
    expect((inputs[0] as HTMLInputElement).disabled).toBe(false);
  });

  // ── Root checkbox uncheck ──

  it('unchecks root checkbox to set root to false', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('root = true')).toBeDefined();
    });

    const checkbox = screen.getByText('root = true').previousSibling as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(false);

    // Config is now dirty
    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(false);
  });

  // ── Preset tests ──

  it('shows Add Preset button when there are no sections', async () => {
    const emptyConfig: EditorConfigFile = { root: true, sections: [] };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(emptyConfig);
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Editor Config')).toBeDefined();
    });

    expect(screen.getByText('Add Preset')).toBeDefined();
  });

  it('adds preset sections when Add Preset is clicked', async () => {
    const emptyConfig: EditorConfigFile = { root: true, sections: [] };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(emptyConfig);
      if (channel === 'dev-tools:get-editorconfig-presets') return Promise.resolve(mockPresets);
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Add Preset')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Add Preset'));

    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    expect((screen.getByTestId('glob-input-0') as HTMLInputElement).value).toBe('*');
    expect(mockInvoke).toHaveBeenCalledWith('dev-tools:get-editorconfig-presets', 'node');
  });

  it('shows error status when Add Preset IPC fails', async () => {
    const emptyConfig: EditorConfigFile = { root: true, sections: [] };

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(emptyConfig);
      if (channel === 'dev-tools:get-editorconfig-presets')
        return Promise.reject(new Error('Network error'));
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Add Preset')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Add Preset'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load presets')).toBeDefined();
    });
  });

  // ── Save failure tests ──

  it('shows Failed to save when write-editorconfig rejects', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(mockConfig);
      if (channel === 'dev-tools:write-editorconfig') return Promise.reject(new Error('Disk full'));
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Make dirty
    await userEvent.click(screen.getByText('Add Section'));

    await waitFor(() => {
      expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
    });

    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  it('saves and closes when Save and close is clicked in prompt', async () => {
    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Make dirty
    await userEvent.click(screen.getByText('Add Section'));

    // Click close to trigger prompt
    await userEvent.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();

    // Click "Save and close"
    await userEvent.click(screen.getByText('Save and close'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-editorconfig',
        '/test/project',
        expect.objectContaining({ root: true })
      );
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('stops loading without crashing when read-editorconfig rejects', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig')
        return Promise.reject(new Error('File not found'));
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);

    // Should eventually stop loading (no longer show loading text)
    await waitFor(() => {
      expect(screen.queryByText('Loading .editorconfig...')).toBeNull();
    });

    // Editor should still render (with empty defaults)
    expect(screen.getByText('Editor Config')).toBeDefined();
  });

  it('shows error message when write-editorconfig returns success=false', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-editorconfig') return Promise.resolve(mockConfig);
      if (channel === 'dev-tools:write-editorconfig')
        return Promise.resolve({ success: false, message: 'Permission denied' });
      return Promise.resolve(null);
    });

    render(<EditorConfigEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('glob-input-0')).toBeDefined();
    });

    // Make dirty
    await userEvent.click(screen.getByText('Add Section'));

    await waitFor(() => {
      expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
    });

    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });

    // Config should still be dirty since save was not successful
    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(false);
  });
});
