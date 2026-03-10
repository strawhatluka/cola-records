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

  // ============================================
  // Toolbar button clicks (insertMarkdown)
  // ============================================
  describe('toolbar buttons', () => {
    it('inserts bold markdown when Bold button clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      // Click the Bold button
      const boldBtn = screen.getByTestId('icon-bold').closest('button')!;
      await user.click(boldBtn);

      expect(onChange).toHaveBeenCalledWith('**text**');
    });

    it('inserts italic markdown when Italic button clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const italicBtn = screen.getByTestId('icon-italic').closest('button')!;
      await user.click(italicBtn);

      expect(onChange).toHaveBeenCalledWith('_text_');
    });

    it('inserts strikethrough markdown', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-strikethrough').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('~~text~~');
    });

    it('inserts heading prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-heading').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('### ');
    });

    it('inserts quote prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-quote').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('> ');
    });

    it('inserts inline code wrap', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-code').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('`text`');
    });

    it('inserts link markdown', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-link').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('[text](url)');
    });

    it('inserts ordered list prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-listordered').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('1. ');
    });

    it('inserts unordered list prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-list').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('- ');
    });

    it('inserts task list prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-listchecks').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('- [ ] ');
    });

    it('inserts mention @', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-atsign').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('@');
    });

    it('inserts reference #', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const btn = screen.getByTestId('icon-hash').closest('button')!;
      await user.click(btn);

      expect(onChange).toHaveBeenCalledWith('#');
    });

    it('does not insert when disabled button clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} />);

      // Saved replies is disabled
      const btn = screen.getByTestId('icon-bookmarked').closest('button')!;
      await user.click(btn);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not insert when editor is disabled', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<MarkdownEditor value="" onChange={onChange} disabled />);

      const boldBtn = screen.getByTestId('icon-bold').closest('button')!;
      await user.click(boldBtn);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('switches back from preview to write', async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...defaultProps} value="test" />);

    await user.click(screen.getByText('Preview'));
    expect(screen.queryByPlaceholderText('Write a description...')).toBeNull();

    await user.click(screen.getByText('Write'));
    expect(screen.getByPlaceholderText('Write a description...')).toBeDefined();
  });
});
