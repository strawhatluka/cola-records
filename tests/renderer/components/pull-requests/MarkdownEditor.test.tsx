import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { MarkdownEditor } from '../../../../src/renderer/components/pull-requests/MarkdownEditor';

describe('MarkdownEditor', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Write and Preview tabs', () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByText('Write')).toBeDefined();
    expect(screen.getByText('Preview')).toBeDefined();
  });

  it('shows textarea in write mode by default', () => {
    render(<MarkdownEditor {...defaultProps} value="Hello" />);
    const textarea = screen.getByPlaceholderText('Write a description...');
    expect(textarea).toBeDefined();
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello');
  });

  it('shows custom placeholder', () => {
    render(<MarkdownEditor {...defaultProps} placeholder="Custom placeholder" />);
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeDefined();
  });

  it('calls onChange when typing in textarea', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor {...defaultProps} onChange={onChange} />);
    const user = userEvent.setup();

    const textarea = screen.getByPlaceholderText('Write a description...');
    await user.type(textarea, 'H');
    expect(onChange).toHaveBeenCalled();
  });

  it('switches to preview tab and shows markdown content', async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...defaultProps} value="**Bold text**" />);

    await user.click(screen.getByText('Preview'));
    expect(screen.getByTestId('markdown')).toBeDefined();
    expect(screen.getByText('**Bold text**')).toBeDefined();
  });

  it('shows "Nothing to preview" when value is empty in preview mode', async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...defaultProps} value="" />);

    await user.click(screen.getByText('Preview'));
    expect(screen.getByText('Nothing to preview')).toBeDefined();
  });

  it('renders toolbar buttons in write mode', () => {
    render(<MarkdownEditor {...defaultProps} />);
    // Check that toolbar icons are rendered (Heading, Bold, Italic, etc.)
    expect(screen.getByTestId('icon-heading')).toBeDefined();
    expect(screen.getByTestId('icon-bold')).toBeDefined();
    expect(screen.getByTestId('icon-italic')).toBeDefined();
  });

  it('hides toolbar in preview mode', async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...defaultProps} />);

    await user.click(screen.getByText('Preview'));
    expect(screen.queryByTestId('icon-heading')).toBeNull();
  });

  it('disables textarea when disabled prop is true', () => {
    render(<MarkdownEditor {...defaultProps} disabled />);
    const textarea = screen.getByPlaceholderText('Write a description...');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
  });
});
