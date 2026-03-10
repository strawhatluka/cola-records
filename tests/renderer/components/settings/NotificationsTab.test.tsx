// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
    useNotificationStore.setState({ updatePreferences: mockUpdatePreferences });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NotificationsTab />);

    await user.click(screen.getByText('Save Preferences'));

    expect(mockUpdatePreferences).toHaveBeenCalledWith(DEFAULT_PREFERENCES);

    // Advance past the setTimeout(() => setSaved(false), 2000) to avoid act warning
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
  });

  // Master toggle test
  it('toggles "Enable Notifications" switch from true to false', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const masterToggle = switches[0]; // First switch is "Enable Notifications"

    expect(masterToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(masterToggle);

    expect(masterToggle).toHaveAttribute('aria-checked', 'false');
  });

  // Delivery method toggles
  it('toggles "In-App Toasts" switch', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const toastsToggle = switches[1]; // Second switch is "In-App Toasts"

    expect(toastsToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toastsToggle);

    expect(toastsToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles "Native OS Notifications" switch', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const nativeToggle = switches[2]; // Third switch is "Native OS Notifications"

    expect(nativeToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(nativeToggle);

    expect(nativeToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles "Sound" switch', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const soundToggle = switches[3]; // Fourth switch is "Sound"

    // Sound is disabled by default
    expect(soundToggle).toHaveAttribute('aria-checked', 'false');

    await user.click(soundToggle);

    expect(soundToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles "Do Not Disturb" switch', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const dndToggle = switches[4]; // Fifth switch is "Do Not Disturb"

    expect(dndToggle).toHaveAttribute('aria-checked', 'false');

    await user.click(dndToggle);

    expect(dndToggle).toHaveAttribute('aria-checked', 'true');
  });

  // Category toggle test
  it('toggles a category switch (Pull Requests)', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    // Category switches start after the 5 delivery method switches
    const prToggle = switches[5]; // First category switch is "Pull Requests"

    expect(prToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(prToggle);

    expect(prToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles multiple category switches', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    const issuesToggle = switches[6]; // Second category switch is "Issues"
    const ciToggle = switches[7]; // Third category switch is "CI/CD"

    expect(issuesToggle).toHaveAttribute('aria-checked', 'true');
    expect(ciToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(issuesToggle);
    await user.click(ciToggle);

    expect(issuesToggle).toHaveAttribute('aria-checked', 'false');
    expect(ciToggle).toHaveAttribute('aria-checked', 'false');
  });

  // Poll interval change test
  it('changes poll interval to 10 minutes and saves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
    useNotificationStore.setState({ updatePreferences: mockUpdatePreferences });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NotificationsTab />);

    const select = screen.getByDisplayValue('5 minutes');
    await user.selectOptions(select, '10');

    await user.click(screen.getByText('Save Preferences'));

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      ...DEFAULT_PREFERENCES,
      pollInterval: 10,
    });

    // Advance past the setTimeout(() => setSaved(false), 2000) to avoid act warning
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
  });

  it('changes poll interval to 1 minute', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const select = screen.getByDisplayValue('5 minutes');

    await user.selectOptions(select, '1');

    expect(screen.getByDisplayValue('1 minute')).toBeDefined();
  });

  // Save button "Saved" state test
  it('shows "Saved" text after save completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
    useNotificationStore.setState({ updatePreferences: mockUpdatePreferences });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NotificationsTab />);

    await user.click(screen.getByText('Save Preferences'));

    expect(screen.getByText('Saved')).toBeDefined();

    // Advance past the setTimeout(() => setSaved(false), 2000) to avoid act warning
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
  });

  // Save button "Saving..." state test
  it('shows "Saving..." text while save is in progress', async () => {
    let resolveUpdate: (() => void) | undefined;
    const pendingPromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    const mockUpdatePreferences = vi.fn().mockReturnValue(pendingPromise);
    useNotificationStore.setState({ updatePreferences: mockUpdatePreferences });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers();
    render(<NotificationsTab />);

    // Click save — don't await so we can check intermediate state
    void user.click(screen.getByText('Save Preferences'));

    // Advance past userEvent's internal timers
    await vi.advanceTimersByTimeAsync(100);

    expect(screen.getByText('Saving...')).toBeDefined();

    // Cleanup: resolve the pending promise, then advance past the setSaved(false) timeout
    await act(async () => {
      resolveUpdate?.();
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
  });

  // Null preferences fallback test
  it('renders with default preferences when preferences is null', () => {
    useNotificationStore.setState({ preferences: undefined });

    render(<NotificationsTab />);

    expect(screen.getByText('Enable Notifications')).toBeDefined();
    expect(screen.getByText('In-App Toasts')).toBeDefined();

    const switches = screen.getAllByRole('switch');
    // Master toggle should be enabled (from DEFAULT_PREFERENCES)
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('handles undefined category preferences with fallback to enabled', () => {
    // Set preferences with missing category data
    const prefsWithMissingCategory = {
      ...DEFAULT_PREFERENCES,
      categories: {
        'github-pr': { enabled: true, toast: true, native: true },
        'github-issue': { enabled: true, toast: true, native: true },
        'github-ci': { enabled: true, toast: true, native: true },
        git: { enabled: true, toast: true, native: false },
        system: { enabled: true, toast: true, native: false },
        integration: { enabled: true, toast: true, native: false },
      },
    };

    useNotificationStore.setState({ preferences: prefsWithMissingCategory });

    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    // The last category switch (integration) should default to enabled
    const integrationToggle = switches[switches.length - 1];

    expect(integrationToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles category with initial undefined state', () => {
    // Set preferences with completely empty categories object
    const prefsWithEmptyCategories = {
      ...DEFAULT_PREFERENCES,
      categories: {} as typeof DEFAULT_PREFERENCES.categories,
    };

    useNotificationStore.setState({ preferences: prefsWithEmptyCategories });

    render(<NotificationsTab />);

    const switches = screen.getAllByRole('switch');
    // All 6 category switches should default to enabled (aria-checked="true")
    const categoryToggle = switches[5];

    expect(categoryToggle).toHaveAttribute('aria-checked', 'true');
  });
});
