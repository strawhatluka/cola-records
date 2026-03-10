import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { CreatePollModal } from '../../../../src/renderer/components/discord/CreatePollModal';

describe('CreatePollModal', () => {
  const mockOnSubmit = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal() {
    return render(<CreatePollModal onSubmit={mockOnSubmit} onClose={mockOnClose} />);
  }

  // ============================================
  // Rendering
  // ============================================
  it('renders the poll creation form', () => {
    renderModal();
    // "Create Poll" appears in both header and button
    expect(screen.getAllByText('Create Poll').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Ask a question...')).toBeDefined();
    expect(screen.getByPlaceholderText('Answer 1')).toBeDefined();
    expect(screen.getByPlaceholderText('Answer 2')).toBeDefined();
  });

  it('renders duration selector with default 24 hours', () => {
    renderModal();
    const select = screen.getByDisplayValue('24 Hours') as HTMLSelectElement;
    expect(select).toBeDefined();
  });

  it('renders all duration options', () => {
    renderModal();
    expect(screen.getByText('1 Hour')).toBeDefined();
    expect(screen.getByText('4 Hours')).toBeDefined();
    expect(screen.getByText('8 Hours')).toBeDefined();
    expect(screen.getByText('24 Hours')).toBeDefined();
    expect(screen.getByText('3 Days')).toBeDefined();
    expect(screen.getByText('1 Week')).toBeDefined();
  });

  it('renders multiselect checkbox', () => {
    renderModal();
    expect(screen.getByText('Allow selecting multiple answers')).toBeDefined();
  });

  it('renders Cancel and Create Poll buttons', () => {
    renderModal();
    expect(screen.getByText('Cancel')).toBeDefined();
    expect(screen.getAllByText('Create Poll').length).toBeGreaterThan(0);
  });

  it('renders Add Answer button', () => {
    renderModal();
    expect(screen.getByText('Add Answer')).toBeDefined();
  });

  // ============================================
  // Close
  // ============================================
  it('calls onClose when X button clicked', () => {
    renderModal();
    // The first X button in the header
    const closeButtons = screen.getAllByTestId('icon-x');
    fireEvent.click(closeButtons[0].closest('button')!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  // ============================================
  // Submit
  // ============================================
  it('disables Create Poll when question is empty', () => {
    renderModal();
    // The submit button is the last "Create Poll" element
    const createBtns = screen.getAllByText('Create Poll');
    const submitBtn = createBtns.find((el) => el.tagName === 'BUTTON')!;
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('disables Create Poll when fewer than 2 answers filled', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'What color?' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'Red' },
    });
    // Answer 2 is empty

    const createBtns = screen.getAllByText('Create Poll');
    const submitBtn = createBtns.find((el) => el.tagName === 'BUTTON')!;
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('enables Create Poll when question and 2+ answers filled', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'What color?' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'Red' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 2'), {
      target: { value: 'Blue' },
    });

    const createBtns = screen.getAllByText('Create Poll');
    const submitBtn = createBtns.find((el) => el.tagName === 'BUTTON')!;
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('calls onSubmit with correct data', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Best framework?' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'React' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 2'), {
      target: { value: 'Vue' },
    });

    const submitBtn = screen.getAllByText('Create Poll').find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith('Best framework?', ['React', 'Vue'], 24, false);
  });

  it('submits with custom duration', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Q?' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'A' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 2'), {
      target: { value: 'B' },
    });

    // Change duration
    const select = screen.getByDisplayValue('24 Hours');
    fireEvent.change(select, { target: { value: '72' } });

    const submitBtn = screen.getAllByText('Create Poll').find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith('Q?', ['A', 'B'], 72, false);
  });

  it('submits with multiselect enabled', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Pick colors' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'Red' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 2'), {
      target: { value: 'Blue' },
    });

    // Enable multiselect
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const submitBtn = screen.getAllByText('Create Poll').find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith('Pick colors', ['Red', 'Blue'], 24, true);
  });

  it('filters out empty answers on submit', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Q?' },
    });
    fireEvent.change(screen.getByPlaceholderText('Answer 1'), {
      target: { value: 'Yes' },
    });
    // Leave Answer 2 empty, add Answer 3
    fireEvent.click(screen.getByText('Add Answer'));
    const answer3 = screen.getByPlaceholderText('Answer 3');
    fireEvent.change(answer3, { target: { value: 'Maybe' } });

    const submitBtn = screen.getAllByText('Create Poll').find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith('Q?', ['Yes', 'Maybe'], 24, false);
  });

  it('does not submit when button is disabled', () => {
    renderModal();
    const submitBtn = screen.getAllByText('Create Poll').find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(submitBtn);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // ============================================
  // Add / Remove answers
  // ============================================
  it('adds a new answer field', () => {
    renderModal();
    fireEvent.click(screen.getByText('Add Answer'));
    expect(screen.getByPlaceholderText('Answer 3')).toBeDefined();
  });

  it('does not show remove button when only 2 answers', () => {
    renderModal();
    const trashIcons = screen.queryAllByTestId('icon-trash2');
    expect(trashIcons.length).toBe(0);
  });

  it('shows remove buttons when more than 2 answers', () => {
    renderModal();
    fireEvent.click(screen.getByText('Add Answer'));
    const trashIcons = screen.getAllByTestId('icon-trash2');
    expect(trashIcons.length).toBe(3);
  });

  it('removes an answer field', () => {
    renderModal();
    fireEvent.click(screen.getByText('Add Answer'));
    expect(screen.getByPlaceholderText('Answer 3')).toBeDefined();

    // Remove the first answer
    const trashIcons = screen.getAllByTestId('icon-trash2');
    fireEvent.click(trashIcons[0].closest('button')!);

    // Should be back to 2 answers
    expect(screen.queryByPlaceholderText('Answer 3')).toBeNull();
  });

  it('limits answers to 10', () => {
    renderModal();

    // Add 8 more answers (already have 2)
    for (let i = 0; i < 8; i++) {
      fireEvent.click(screen.getByText('Add Answer'));
    }

    // Add Answer button should be gone
    expect(screen.queryByText('Add Answer')).toBeNull();
  });

  // ============================================
  // Update answer
  // ============================================
  it('updates an answer value', () => {
    renderModal();
    const answer1 = screen.getByPlaceholderText('Answer 1');
    fireEvent.change(answer1, { target: { value: 'Updated' } });
    expect((answer1 as HTMLInputElement).value).toBe('Updated');
  });
});
