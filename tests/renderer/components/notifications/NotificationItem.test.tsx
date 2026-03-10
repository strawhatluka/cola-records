import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { NotificationItem } from '../../../../src/renderer/components/notifications/NotificationItem';
import type { AppNotification } from '../../../../src/main/ipc/channels';

function createNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notif-1',
    category: 'github-pr',
    priority: 'medium',
    title: 'Review Requested',
    message: 'Fix login bug in my-app',
    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    read: false,
    dismissed: false,
    dedupeKey: 'github-123',
    ...overrides,
  };
}

describe('NotificationItem', () => {
  const mockOnMarkRead = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderItem(overrides: Partial<AppNotification> = {}, onClick = mockOnClick) {
    return render(
      <NotificationItem
        notification={createNotification(overrides)}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
        onClick={onClick}
      />
    );
  }

  // ============================================
  // Rendering
  // ============================================
  it('renders notification title and message', () => {
    renderItem();
    expect(screen.getByText('Review Requested')).toBeDefined();
    expect(screen.getByText('Fix login bug in my-app')).toBeDefined();
  });

  it('renders relative timestamp', () => {
    renderItem({ timestamp: Date.now() - 1000 * 60 * 30 }); // 30 min ago
    expect(screen.getByText('30m ago')).toBeDefined();
  });

  it('shows "just now" for recent timestamps', () => {
    renderItem({ timestamp: Date.now() - 10_000 }); // 10 seconds ago
    expect(screen.getByText('just now')).toBeDefined();
  });

  it('shows hours for timestamps between 1-24 hours ago', () => {
    renderItem({ timestamp: Date.now() - 1000 * 60 * 60 * 3 }); // 3 hours ago
    expect(screen.getByText('3h ago')).toBeDefined();
  });

  it('shows days for timestamps older than 24 hours', () => {
    renderItem({ timestamp: Date.now() - 1000 * 60 * 60 * 48 }); // 2 days ago
    expect(screen.getByText('2d ago')).toBeDefined();
  });

  it('renders unread indicator for unread notifications', () => {
    const { container } = renderItem({ read: false });
    // Unread dot is a small circle
    const dot = container.querySelector('.bg-primary.rounded-full');
    expect(dot).not.toBeNull();
  });

  it('does not render unread indicator for read notifications', () => {
    const { container } = renderItem({ read: true });
    const dot = container.querySelector('.bg-primary.rounded-full');
    expect(dot).toBeNull();
  });

  it('renders dismiss button', () => {
    renderItem();
    expect(screen.getByTitle('Dismiss')).toBeDefined();
  });

  // ============================================
  // Category icons
  // ============================================
  it('renders correct icon for github-pr category', () => {
    renderItem({ category: 'github-pr' });
    expect(screen.getByTestId('icon-gitpullrequest')).toBeDefined();
  });

  it('renders correct icon for github-issue category', () => {
    renderItem({ category: 'github-issue' });
    expect(screen.getByTestId('icon-circledot')).toBeDefined();
  });

  it('renders correct icon for github-ci category', () => {
    renderItem({ category: 'github-ci' });
    expect(screen.getByTestId('icon-workflow')).toBeDefined();
  });

  it('renders correct icon for git category', () => {
    renderItem({ category: 'git' });
    expect(screen.getByTestId('icon-gitbranch')).toBeDefined();
  });

  it('renders correct icon for system category', () => {
    renderItem({ category: 'system' });
    expect(screen.getByTestId('icon-monitor')).toBeDefined();
  });

  it('renders correct icon for integration category', () => {
    renderItem({ category: 'integration' });
    expect(screen.getByTestId('icon-plug')).toBeDefined();
  });

  // ============================================
  // Priority styling
  // ============================================
  it('applies red border for high priority', () => {
    const { container } = renderItem({ priority: 'high' });
    const item = container.firstElementChild!;
    expect(item.className).toContain('border-l-red-500');
  });

  it('applies yellow border for medium priority', () => {
    const { container } = renderItem({ priority: 'medium' });
    const item = container.firstElementChild!;
    expect(item.className).toContain('border-l-yellow-500');
  });

  it('applies blue border for low priority', () => {
    const { container } = renderItem({ priority: 'low' });
    const item = container.firstElementChild!;
    expect(item.className).toContain('border-l-blue-500');
  });

  // ============================================
  // Interactions
  // ============================================
  it('calls onMarkRead and onClick when unread notification clicked', () => {
    renderItem({ read: false });
    fireEvent.click(screen.getByText('Review Requested'));
    expect(mockOnMarkRead).toHaveBeenCalledWith('notif-1');
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('does not call onMarkRead when already-read notification clicked', () => {
    renderItem({ read: true });
    fireEvent.click(screen.getByText('Review Requested'));
    expect(mockOnMarkRead).not.toHaveBeenCalled();
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('calls onDismiss and stops propagation when dismiss button clicked', () => {
    renderItem();
    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(mockOnDismiss).toHaveBeenCalledWith('notif-1');
    // onClick should NOT be called because stopPropagation is used
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('works without onClick prop', () => {
    render(
      <NotificationItem
        notification={createNotification()}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    // Should not throw when clicked
    fireEvent.click(screen.getByText('Review Requested'));
    expect(mockOnMarkRead).toHaveBeenCalledWith('notif-1');
  });
});
