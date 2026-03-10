import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ChipInput } from '../../../../src/renderer/components/tools/ChipInput';

describe('ChipInput', () => {
  it('renders existing values as chips', () => {
    render(<ChipInput values={['bug', 'feature']} onChange={vi.fn()} testId="labels" />);
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('feature')).toBeDefined();
  });

  it('adds a chip when Enter is pressed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={['bug']} onChange={onChange} testId="labels" />);

    const input = screen.getByTestId('labels-input');
    await user.type(input, 'docs{Enter}');

    expect(onChange).toHaveBeenCalledWith(['bug', 'docs']);
  });

  it('adds a chip when comma is typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={[]} onChange={onChange} testId="labels" />);

    const input = screen.getByTestId('labels-input');
    await user.type(input, 'enhancement,');

    expect(onChange).toHaveBeenCalledWith(['enhancement']);
  });

  it('removes a chip when X button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={['bug', 'feature']} onChange={onChange} testId="labels" />);

    const removeBtn = screen.getByTestId('labels-remove-0');
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(['feature']);
  });

  it('removes last chip on Backspace when input is empty', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={['bug', 'feature']} onChange={onChange} testId="labels" />);

    const input = screen.getByTestId('labels-input');
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['bug']);
  });

  it('prevents duplicate values', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={['bug']} onChange={onChange} testId="labels" />);

    const input = screen.getByTestId('labels-input');
    await user.type(input, 'bug{Enter}');

    // Should not call onChange since 'bug' already exists
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add empty chips', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChipInput values={[]} onChange={onChange} testId="labels" />);

    const input = screen.getByTestId('labels-input');
    await user.type(input, '{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows placeholder when no values exist', () => {
    render(<ChipInput values={[]} onChange={vi.fn()} placeholder="Add labels" testId="labels" />);
    const input = screen.getByTestId('labels-input');
    expect(input.getAttribute('placeholder')).toBe('Add labels');
  });
});
