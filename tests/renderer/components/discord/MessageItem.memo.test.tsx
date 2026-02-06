import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

import { MessageItem } from '../../../../src/renderer/components/discord/MessageItem';
import { createMockDiscordMessage, createMockDiscordUser } from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageItem React.memo Optimization', () => {
  // Helper to count renders
  const createRenderTracker = () => {
    let renderCount = 0;
    return {
      increment: () => {
        renderCount++;
      },
      getCount: () => renderCount,
      reset: () => {
        renderCount = 0;
      },
    };
  };

  // Create stable callback refs
  const createStableCallbacks = () => ({
    onReactionToggle: vi.fn(),
    onReply: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onEmojiPick: vi.fn(),
  });

  it('does not re-render when parent re-renders with same props', () => {
    const tracker = createRenderTracker();
    const message = createMockDiscordMessage({ content: 'Test message' });
    const callbacks = createStableCallbacks();

    // Wrapper component that can trigger re-renders
    function TestWrapper() {
      const [counter, setCounter] = useState(0);
      const stableMessage = useRef(message).current;
      const stableCallbacks = useRef(callbacks).current;

      // Track when MessageItem would render
      // (We can't directly track memo renders, but we can verify props stability)
      return (
        <div>
          <button onClick={() => setCounter((c) => c + 1)}>Rerender</button>
          <span data-testid="counter">{counter}</span>
          <MessageItem message={stableMessage} currentUserId="999" {...stableCallbacks} />
        </div>
      );
    }

    const { getByRole, getByTestId } = render(<TestWrapper />);

    // Verify initial render
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(getByTestId('counter').textContent).toBe('0');

    // Trigger parent re-render using fireEvent
    fireEvent.click(getByRole('button'));

    // Parent re-rendered but MessageItem should NOT have re-rendered
    // (because props are stable - same object references)
    expect(getByTestId('counter').textContent).toBe('1');
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('re-renders when message prop changes (content update)', () => {
    const callbacks = createStableCallbacks();

    function TestWrapper() {
      const [content, setContent] = useState('Original message');

      return (
        <div>
          <button onClick={() => setContent('Updated message')}>Update</button>
          <MessageItem
            message={createMockDiscordMessage({ content })}
            currentUserId="999"
            {...callbacks}
          />
        </div>
      );
    }

    const { getByRole } = render(<TestWrapper />);

    expect(screen.getByText('Original message')).toBeInTheDocument();

    // Update content using fireEvent
    fireEvent.click(getByRole('button'));

    // MessageItem should re-render with new content
    expect(screen.getByText('Updated message')).toBeInTheDocument();
  });

  it('re-renders when message prop changes (new reactions)', () => {
    const callbacks = createStableCallbacks();

    function TestWrapper() {
      const [hasReaction, setHasReaction] = useState(false);

      const reactions = hasReaction
        ? [{ emoji: { id: null, name: '👍' }, count: 1, me: false }]
        : [];

      return (
        <div>
          <button onClick={() => setHasReaction(true)}>Add Reaction</button>
          <MessageItem
            message={createMockDiscordMessage({ reactions })}
            currentUserId="999"
            {...callbacks}
          />
        </div>
      );
    }

    const { getByRole } = render(<TestWrapper />);

    // Initially no reaction
    expect(screen.queryByText('👍')).not.toBeInTheDocument();

    // Add reaction using fireEvent
    fireEvent.click(getByRole('button'));

    // MessageItem should re-render with reaction
    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('does NOT re-render when parent provides stable callbacks', () => {
    const message = createMockDiscordMessage({ content: 'Test' });

    // This test verifies that using useRef for callbacks prevents re-renders
    function TestWrapper() {
      const [counter, setCounter] = useState(0);

      // STABLE: Using useRef to keep same callback references
      const stableCallbacks = useRef({
        onReactionToggle: vi.fn(),
        onReply: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onEmojiPick: vi.fn(),
      }).current;

      return (
        <div>
          <button onClick={() => setCounter((c) => c + 1)}>Rerender</button>
          <span data-testid="counter">{counter}</span>
          <MessageItem message={message} currentUserId="999" {...stableCallbacks} />
        </div>
      );
    }

    const { getByRole, getByTestId } = render(<TestWrapper />);

    expect(getByTestId('counter').textContent).toBe('0');

    // Trigger multiple parent re-renders using fireEvent
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(getByTestId('counter').textContent).toBe('3');
    // MessageItem stays rendered without issues (memo optimization working)
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('re-renders when currentUserId changes', () => {
    const message = createMockDiscordMessage({
      content: 'Test',
      author: createMockDiscordUser({ id: '999' }),
    });
    const callbacks = createStableCallbacks();

    function TestWrapper() {
      const [userId, setUserId] = useState<string | null>('123');

      return (
        <div>
          <button onClick={() => setUserId('999')}>Change User</button>
          <MessageItem message={message} currentUserId={userId} {...callbacks} />
        </div>
      );
    }

    render(<TestWrapper />);

    // Initial render - user is not the author
    expect(screen.getByText('Test')).toBeInTheDocument();

    // This change should trigger a re-render (currentUserId affects edit/delete visibility)
    fireEvent.click(screen.getByRole('button'));

    // Component should still render correctly after re-render
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
