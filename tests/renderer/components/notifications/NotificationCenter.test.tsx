// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// IPC
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

// lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

// Logger
vi.mock('../../../../src/renderer/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// Radix Popover mock
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children, asChild, ...props }: any) =>
    asChild ? (
      <div data-testid="popover-trigger">{children}</div>
    ) : (
      <button data-testid="popover-trigger" {...props}>
        {children}
      </button>
    ),
  Portal: ({ children }: any) => <div>{children}</div>,
  Content: ({ children, sideOffset, align, ...props }: any) => (
    <div data-testid="popover-content" {...props}>
      {children}
    </div>
  ),
}));

import { NotificationCenter } from '../../../../src/renderer/components/notifications/NotificationCenter';
import {
  useNotificationStore,
  DEFAULT_PREFERENCES,
} from '../../../../src/renderer/stores/useNotificationStore';
import type { AppNotification } from '../../../../src/main/ipc/channels';

const sampleNotification: AppNotification = {
  id: 'notif_1',
  category: 'github-pr' as const,
  priority: 'low' as const,
  title: 'PR Activity',
  message: 'Fix auth bug in org/repo',
  timestamp: Date.now(),
  read: false,
  dismissed: false,
  dedupeKey: 'git-push-1',
};

const readNotification: AppNotification = {
  id: 'notif_2',
  category: 'github-pr' as const,
  priority: 'medium' as const,
  title: 'PR Approved',
  message: 'Your PR #42 was approved',
  timestamp: Date.now() - 60000,
  read: true,
  dismissed: false,
  dedupeKey: 'pr-approved-42',
};

const groupedNotification1: AppNotification = {
  id: 'notif_3',
  category: 'github-ci' as const,
  priority: 'high' as const,
  title: 'CI Failed',
  message: 'Build failed on main',
  timestamp: Date.now() - 120000,
  read: false,
  dismissed: false,
  dedupeKey: 'ci-fail-1',
  groupKey: 'ci-main',
};

const groupedNotification2: AppNotification = {
  id: 'notif_4',
  category: 'github-ci' as const,
  priority: 'medium' as const,
  title: 'CI Retry',
  message: 'Build retried on main',
  timestamp: Date.now() - 90000,
  read: false,
  dismissed: false,
  dedupeKey: 'ci-retry-1',
  groupKey: 'ci-main',
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
      unreadCount: 0,
      loading: false,
    });
  });

  it('renders bell icon', () => {
    render(<NotificationCenter />);
    expect(screen.getAllByTestId('icon-bell').length).toBeGreaterThanOrEqual(1);
  });

  it('shows unread badge when unreadCount > 0', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification],
      unreadCount: 3,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides badge when unreadCount is 0', () => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
    });

    render(<NotificationCenter />);
    // The badge span displays the count; with 0 unread, no count element should exist
    const trigger = screen.getByTestId('popover-trigger');
    const badge = trigger.querySelector('.absolute');
    expect(badge).toBeNull();
  });

  it('shows BellOff icon when DND is enabled', () => {
    useNotificationStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, dndEnabled: true },
    });

    render(<NotificationCenter />);
    expect(screen.getByTestId('icon-belloff')).toBeInTheDocument();
    // The trigger shows BellOff; the empty-state area may still render a Bell icon
    const trigger = screen.getByTestId('popover-trigger');
    expect(trigger.querySelector('[data-testid="icon-belloff"]')).toBeTruthy();
  });

  it('shows "No notifications" empty state when notifications is empty', () => {
    render(<NotificationCenter />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('renders notification items when there are notifications', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification, readNotification],
      unreadCount: 1,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('Push Successful')).toBeInTheDocument();
    expect(screen.getByText('PR Approved')).toBeInTheDocument();
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('"Mark all read" button exists when there are unread notifications', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification],
      unreadCount: 1,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('Mark all read')).toBeInTheDocument();
  });

  it('"Clear all" button exists when there are active notifications', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification],
      unreadCount: 1,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('renders grouped notifications via NotificationGroup', () => {
    useNotificationStore.setState({
      notifications: [groupedNotification1, groupedNotification2],
      unreadCount: 2,
    });

    render(<NotificationCenter />);
    // NotificationGroup renders "X updates on <groupKey>" for groups with multiple items
    expect(screen.getByText('2 updates on ci-main')).toBeInTheDocument();
  });

  it('renders filter tabs for All and Unread', () => {
    render(<NotificationCenter />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('shows 99+ when unread count exceeds 99', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification],
      unreadCount: 150,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not show "Mark all read" when unreadCount is 0', () => {
    useNotificationStore.setState({
      notifications: [readNotification],
      unreadCount: 0,
    });

    render(<NotificationCenter />);
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  it('does not show "Clear all" footer when there are no active notifications', () => {
    render(<NotificationCenter />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('sets button title to "Notifications (Do Not Disturb)" when DND is enabled', () => {
    useNotificationStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, dndEnabled: true },
    });

    render(<NotificationCenter />);
    const trigger = screen.getByTestId('popover-trigger');
    const bellButton = trigger.querySelector('button') || trigger;
    expect(bellButton).toHaveAttribute('title', 'Notifications (Do Not Disturb)');
  });

  it('sets button title to "Notifications" when DND is disabled', () => {
    render(<NotificationCenter />);
    const trigger = screen.getByTestId('popover-trigger');
    const bellButton = trigger.querySelector('button') || trigger;
    expect(bellButton).toHaveAttribute('title', 'Notifications');
  });

  it('passes onNavigate prop without errors', () => {
    const onNavigate = vi.fn();
    const { container } = render(<NotificationCenter onNavigate={onNavigate} />);
    expect(container).toBeTruthy();
  });

  it('does not show dismissed notifications in the list', () => {
    const dismissedNotification: AppNotification = {
      ...sampleNotification,
      id: 'notif_dismissed',
      dismissed: true,
      dedupeKey: 'dismissed-1',
    };

    useNotificationStore.setState({
      notifications: [dismissedNotification],
      unreadCount: 0,
    });

    render(<NotificationCenter />);
    expect(screen.queryByText('Push Successful')).not.toBeInTheDocument();
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('shows unread count next to Unread tab when there are unread notifications', () => {
    useNotificationStore.setState({
      notifications: [sampleNotification],
      unreadCount: 5,
    });

    render(<NotificationCenter />);
    expect(screen.getByText('Unread (5)')).toBeInTheDocument();
  });
});
