// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

import { NotificationsTab } from '../../../../src/renderer/components/settings/NotificationsTab';
import {
  useNotificationStore,
  DEFAULT_PREFERENCES,
} from '../../../../src/renderer/stores/useNotificationStore';

describe('NotificationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
      unreadCount: 0,
      loading: false,
    });
  });

  it('renders "Notifications" heading', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Notifications')).toBeDefined();
  });

  it('renders "Enable Notifications" label', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Enable Notifications')).toBeDefined();
  });

  it('renders "In-App Toasts" label', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('In-App Toasts')).toBeDefined();
  });

  it('renders "Native OS Notifications" label', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Native OS Notifications')).toBeDefined();
  });

  it('renders "Sound" label', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Sound')).toBeDefined();
  });

  it('renders "Do Not Disturb" label', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Do Not Disturb')).toBeDefined();
  });

  it('renders category labels (Pull Requests, Issues, CI/CD)', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Pull Requests')).toBeDefined();
    expect(screen.getByText('Issues')).toBeDefined();
    expect(screen.getByText('CI/CD')).toBeDefined();
  });

  it('renders poll interval selector with default 5 minutes', () => {
    render(<NotificationsTab />);
    const select = screen.getByDisplayValue('5 minutes');
    expect(select).toBeDefined();
  });

  it('renders "Save Preferences" button', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('Save Preferences')).toBeDefined();
  });

  it('Save button triggers updatePreferences', async () => {
    const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
    useNotificationStore.setState({ updatePreferences: mockUpdatePreferences });

    const user = userEvent.setup();
    render(<NotificationsTab />);

    await user.click(screen.getByText('Save Preferences'));

    expect(mockUpdatePreferences).toHaveBeenCalledWith(DEFAULT_PREFERENCES);
  });
});
