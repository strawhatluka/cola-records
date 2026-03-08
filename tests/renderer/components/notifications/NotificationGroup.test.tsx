import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { NotificationGroup } from '../../../../src/renderer/components/notifications/NotificationGroup';
import type { AppNotification } from '../../../../src/main/ipc/channels';

function createNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: `notif-${Math.random().toString(36).substr(2, 5)}`,
    category: 'github-pr',
    priority: 'medium',
    title: 'PR Activity',
    message: 'Updated pull request',
    timestamp: Date.now() - 1000 * 60 * 5,
    read: false,
    dismissed: false,
    dedupeKey: `key-${Math.random().toString(36).substr(2, 5)}`,
    ...overrides,
  };
}

describe('NotificationGroup', () => {
  const mockOnMarkRead = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Single notification
  // ============================================
  it('renders a single notification directly (no group header)', () => {
    const notif = createNotification({ title: 'Single PR' });
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={[notif]}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
        onClick={mockOnClick}
      />
    );
    expect(screen.getByText('Single PR')).toBeDefined();
    // Should not show group header text
    expect(screen.queryByText(/updates on/)).toBeNull();
  });

  // ============================================
  // Empty list
  // ============================================
  it('returns null for empty notifications array', () => {
    const { container } = render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={[]}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  // ============================================
  // Grouped notifications
  // ============================================
  it('shows group header with count for multiple notifications', () => {
    const notifications = [
      createNotification({ title: 'PR 1' }),
      createNotification({ title: 'PR 2' }),
      createNotification({ title: 'PR 3' }),
    ];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    expect(screen.getByText('3 updates on my-repo/PullRequest')).toBeDefined();
  });

  it('shows unread badge when group has unread notifications', () => {
    const notifications = [
      createNotification({ read: false }),
      createNotification({ read: true }),
      createNotification({ read: false }),
    ];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    // Unread count badge should show "2"
    expect(screen.getByText('2')).toBeDefined();
  });

  it('does not show unread badge when all notifications are read', () => {
    const notifications = [createNotification({ read: true }), createNotification({ read: true })];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    // No unread badge
    expect(screen.queryByText('0')).toBeNull();
  });

  // ============================================
  // Expand / collapse
  // ============================================
  it('starts collapsed (individual items hidden)', () => {
    const notifications = [
      createNotification({ title: 'PR 1' }),
      createNotification({ title: 'PR 2' }),
    ];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    // Individual items should not be visible when collapsed
    expect(screen.queryByText('PR 1')).toBeNull();
    expect(screen.queryByText('PR 2')).toBeNull();
  });

  it('expands to show individual items when header clicked', () => {
    const notifications = [
      createNotification({ title: 'PR 1' }),
      createNotification({ title: 'PR 2' }),
    ];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
        onClick={mockOnClick}
      />
    );
    // Click group header to expand
    fireEvent.click(screen.getByText('2 updates on my-repo/PullRequest'));
    expect(screen.getByText('PR 1')).toBeDefined();
    expect(screen.getByText('PR 2')).toBeDefined();
  });

  it('collapses again when header clicked twice', () => {
    const notifications = [
      createNotification({ title: 'PR A' }),
      createNotification({ title: 'PR B' }),
    ];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    const header = screen.getByText('2 updates on my-repo/PullRequest');
    // Expand
    fireEvent.click(header);
    expect(screen.getByText('PR A')).toBeDefined();
    // Collapse
    fireEvent.click(header);
    expect(screen.queryByText('PR A')).toBeNull();
  });

  // ============================================
  // Interactions on expanded items
  // ============================================
  it('propagates onMarkRead from expanded items', () => {
    const notif = createNotification({ id: 'n1', title: 'PR 1', read: false });
    const notifications = [notif, createNotification({ title: 'PR 2' })];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
        onClick={mockOnClick}
      />
    );
    // Expand
    fireEvent.click(screen.getByText('2 updates on my-repo/PullRequest'));
    // Click the first notification
    fireEvent.click(screen.getByText('PR 1'));
    expect(mockOnMarkRead).toHaveBeenCalledWith('n1');
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('propagates onDismiss from expanded items', () => {
    const notif = createNotification({ id: 'n-dismiss', title: 'PR Dismiss' });
    const notifications = [notif, createNotification({ title: 'PR Other' })];
    render(
      <NotificationGroup
        groupKey="my-repo/PullRequest"
        notifications={notifications}
        onMarkRead={mockOnMarkRead}
        onDismiss={mockOnDismiss}
      />
    );
    // Expand
    fireEvent.click(screen.getByText('2 updates on my-repo/PullRequest'));
    // Click dismiss on the first notification
    const dismissButtons = screen.getAllByTitle('Dismiss');
    fireEvent.click(dismissButtons[0]);
    expect(mockOnDismiss).toHaveBeenCalledWith('n-dismiss');
  });
});
