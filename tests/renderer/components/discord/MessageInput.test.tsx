import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock PickerPanel to avoid deep dependency chain
vi.mock('../../../../src/renderer/components/discord/PickerPanel', () => ({
  PickerPanel: ({ initialTab, onClose }: { initialTab: string; onClose: () => void }) => (
    <div data-testid={`picker-panel-${initialTab}`}>
      <button data-testid="close-picker" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { MessageInput } from '../../../../src/renderer/components/discord/MessageInput';

describe('MessageInput', () => {
  const defaultProps = {
    channelName: '#general',
    onSend: vi.fn(),
    onSendWithAttachments: vi.fn(),
    onEdit: vi.fn(),
    onTyping: vi.fn(),
    replyingTo: null,
    editingMessage: null,
    onCancelReply: vi.fn(),
    onCancelEdit: vi.fn(),
    onSendSticker: vi.fn(),
    onCreatePoll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderInput(overrides = {}) {
    return render(<MessageInput {...defaultProps} {...overrides} />);
  }

  // ============================================
  // Rendering
  // ============================================
  it('renders textarea with channel placeholder', () => {
    renderInput();
    expect(screen.getByPlaceholderText('Message #general')).toBeDefined();
  });

  it('renders send button', () => {
    renderInput();
    expect(screen.getByTitle('Send message')).toBeDefined();
  });

  it('renders GIF, sticker, and emoji buttons', () => {
    renderInput();
    expect(screen.getByTitle('GIFs')).toBeDefined();
    expect(screen.getByTitle('Stickers')).toBeDefined();
    expect(screen.getByTitle('Emoji')).toBeDefined();
  });

  it('renders plus button', () => {
    renderInput();
    expect(screen.getByTitle('Add')).toBeDefined();
  });

  // ============================================
  // Text input and send
  // ============================================
  it('sends text on Enter key', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onSend).toHaveBeenCalledWith('hello');
  });

  it('does not send on Shift+Enter (allows newline)', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('does not send empty message', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only message', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('clears text after sending', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(textarea.value).toBe('');
  });

  it('sends text on send button click', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.change(textarea, { target: { value: 'click send' } });
    fireEvent.click(screen.getByTitle('Send message'));
    expect(defaultProps.onSend).toHaveBeenCalledWith('click send');
  });

  it('trims whitespace from sent message', () => {
    renderInput();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.change(textarea, { target: { value: '  hello  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onSend).toHaveBeenCalledWith('hello');
  });

  // ============================================
  // Reply mode
  // ============================================
  it('shows reply banner when replyingTo is set', () => {
    const replyingTo = {
      id: 'msg-1',
      content: 'Original message',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ replyingTo });
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText(/Replying to/)).toBeDefined();
  });

  it('uses username when globalName is missing', () => {
    const replyingTo = {
      id: 'msg-1',
      content: 'Original',
      author: { id: 'u1', username: 'alice', globalName: undefined },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ replyingTo });
    expect(screen.getByText('alice')).toBeDefined();
  });

  it('calls onCancelReply when Escape pressed in reply mode', () => {
    const replyingTo = {
      id: 'msg-1',
      content: 'Original',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ replyingTo });
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(defaultProps.onCancelReply).toHaveBeenCalled();
  });

  // ============================================
  // Edit mode
  // ============================================
  it('shows edit banner and populates text when editing', () => {
    const editingMessage = {
      id: 'msg-2',
      content: 'Edit me',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ editingMessage });
    expect(screen.getByText('Editing message')).toBeDefined();
    expect(screen.getByPlaceholderText('Edit message')).toBeDefined();
  });

  it('hides GIF/sticker/emoji buttons in edit mode', () => {
    const editingMessage = {
      id: 'msg-2',
      content: 'Edit me',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ editingMessage });
    expect(screen.queryByTitle('GIFs')).toBeNull();
    expect(screen.queryByTitle('Stickers')).toBeNull();
    expect(screen.queryByTitle('Emoji')).toBeNull();
  });

  it('calls onEdit and onCancelEdit on send in edit mode', () => {
    const editingMessage = {
      id: 'msg-2',
      content: 'Edit me',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ editingMessage });
    const textarea = screen.getByPlaceholderText('Edit message');
    fireEvent.change(textarea, { target: { value: 'Edited text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onEdit).toHaveBeenCalledWith('msg-2', 'Edited text');
    expect(defaultProps.onCancelEdit).toHaveBeenCalled();
  });

  it('calls onCancelEdit when Escape pressed in edit mode', () => {
    const editingMessage = {
      id: 'msg-2',
      content: 'Edit me',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ editingMessage });
    const textarea = screen.getByPlaceholderText('Edit message');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(defaultProps.onCancelEdit).toHaveBeenCalled();
  });

  it('shows save edit title on send button in edit mode', () => {
    const editingMessage = {
      id: 'msg-2',
      content: 'Edit me',
      author: { id: 'u1', username: 'alice', globalName: 'Alice' },
      timestamp: new Date().toISOString(),
      channelId: 'ch-1',
    };
    renderInput({ editingMessage });
    expect(screen.getByTitle('Save edit')).toBeDefined();
  });

  // ============================================
  // Picker toggling
  // ============================================
  it('opens GIF picker when GIF button clicked', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('GIFs'));
    expect(screen.getByTestId('picker-panel-gif')).toBeDefined();
  });

  it('opens emoji picker when emoji button clicked', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('Emoji'));
    expect(screen.getByTestId('picker-panel-emoji')).toBeDefined();
  });

  it('closes picker when same button clicked again', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('GIFs'));
    expect(screen.getByTestId('picker-panel-gif')).toBeDefined();
    fireEvent.click(screen.getByTitle('GIFs'));
    expect(screen.queryByTestId('picker-panel-gif')).toBeNull();
  });

  it('closes picker when Escape pressed', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('GIFs'));
    expect(screen.getByTestId('picker-panel-gif')).toBeDefined();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByTestId('picker-panel-gif')).toBeNull();
  });

  // ============================================
  // Plus menu
  // ============================================
  it('toggles plus menu on plus button click', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('Add'));
    expect(screen.getByText('Upload a File')).toBeDefined();
    expect(screen.getByText('Create Poll')).toBeDefined();
  });

  it('calls onCreatePoll from plus menu', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('Add'));
    fireEvent.click(screen.getByText('Create Poll'));
    expect(defaultProps.onCreatePoll).toHaveBeenCalled();
  });

  it('closes plus menu when Escape pressed', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('Add'));
    expect(screen.getByText('Upload a File')).toBeDefined();
    const textarea = screen.getByPlaceholderText('Message #general');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByText('Upload a File')).toBeNull();
  });

  it('closes plus menu when picker is opened', () => {
    renderInput();
    fireEvent.click(screen.getByTitle('Add'));
    expect(screen.getByText('Upload a File')).toBeDefined();
    fireEvent.click(screen.getByTitle('GIFs'));
    expect(screen.queryByText('Upload a File')).toBeNull();
  });
});
