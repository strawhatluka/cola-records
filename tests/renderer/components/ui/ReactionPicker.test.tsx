import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Reaction } from '../../../../src/main/ipc/channels';

import { ReactionDisplay } from '../../../../src/renderer/components/ui/ReactionPicker';

describe('ReactionDisplay', () => {
  const mockOnAdd = vi.fn().mockResolvedValue(undefined);
  const mockOnRemove = vi.fn().mockResolvedValue(undefined);

  const baseReactions: Reaction[] = [
    { id: 1, content: '+1', user: 'alice' },
    { id: 2, content: '+1', user: 'bob' },
    { id: 3, content: 'heart', user: 'testuser' },
  ];

  const defaultProps = {
    reactions: baseReactions,
    currentUser: 'testuser',
    onAdd: mockOnAdd,
    onRemove: mockOnRemove,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders grouped reactions as pills', () => {
    render(<ReactionDisplay {...defaultProps} />);
    // +1 has count 2, heart has count 1
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('renders the smiley add-reaction button', () => {
    render(<ReactionDisplay {...defaultProps} />);
    expect(screen.getByText('😀')).toBeDefined();
  });

  it('renders no reaction pills when reactions array is empty', () => {
    render(<ReactionDisplay {...defaultProps} reactions={[]} />);
    // Only the smiley button should be visible
    expect(screen.getByText('😀')).toBeDefined();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('opens picker when smiley button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReactionDisplay {...defaultProps} />);

    await user.click(screen.getByText('😀'));
    // Picker should show 8 emoji options (👍 appears twice: pill + picker)
    expect(screen.getAllByText('👍').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('👎')).toBeDefined();
    expect(screen.getByText('😄')).toBeDefined();
    expect(screen.getByText('🚀')).toBeDefined();
  });

  it('calls onAdd when selecting a new reaction from picker', async () => {
    const user = userEvent.setup();
    render(<ReactionDisplay {...defaultProps} />);

    await user.click(screen.getByText('😀'));
    await user.click(screen.getByText('🚀'));

    expect(mockOnAdd).toHaveBeenCalledWith('rocket');
  });

  it('calls onRemove when clicking an existing user reaction pill', async () => {
    const user = userEvent.setup();
    render(<ReactionDisplay {...defaultProps} />);

    // Heart reaction (id=3) belongs to testuser — clicking it should remove
    // Find the heart pill button (has count "1")
    const heartButton = screen.getByText('1').closest('button')!;
    await user.click(heartButton);

    expect(mockOnRemove).toHaveBeenCalledWith(3);
  });

  it('calls onAdd when clicking a reaction pill user has not reacted to', async () => {
    const user = userEvent.setup();
    render(<ReactionDisplay {...defaultProps} />);

    // +1 reaction — testuser has NOT reacted with +1
    const thumbsButton = screen.getByText('2').closest('button')!;
    await user.click(thumbsButton);

    expect(mockOnAdd).toHaveBeenCalledWith('+1');
  });
});
