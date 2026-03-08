import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Contribution } from '../../src/main/ipc/channels';
import type { Screen } from '../../src/renderer/components/layout/Sidebar';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    send: vi.fn(),
    on: mockOn,
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock all screen components
vi.mock('../../src/renderer/screens/DashboardScreen', () => ({
  DashboardScreen: ({ onOpenIDE }: { onOpenIDE?: (c: Contribution) => void }) => (
    <div data-testid="dashboard-screen" onClick={() => onOpenIDE?.({} as Contribution)}>
      Dashboard
    </div>
  ),
}));
vi.mock('../../src/renderer/screens/IssueDiscoveryScreen', () => ({
  IssueDiscoveryScreen: () => <div data-testid="issues-screen">Issues</div>,
}));
vi.mock('../../src/renderer/screens/ContributionsScreen', () => ({
  ContributionsScreen: () => <div data-testid="contributions-screen">Contributions</div>,
}));
vi.mock('../../src/renderer/screens/ProjectsScreen', () => ({
  ProjectsScreen: () => <div data-testid="projects-screen">Projects</div>,
}));
vi.mock('../../src/renderer/screens/ProfessionalProjectsScreen', () => ({
  ProfessionalProjectsScreen: () => <div data-testid="professional-screen">Professional</div>,
}));
vi.mock('../../src/renderer/screens/SettingsScreen', () => ({
  SettingsScreen: () => <div data-testid="settings-screen">Settings</div>,
}));
vi.mock('../../src/renderer/screens/DocumentationScreen', () => ({
  DocumentationScreen: () => <div data-testid="documentation-screen">Documentation</div>,
}));
vi.mock('../../src/renderer/screens/DevelopmentScreen', () => ({
  DevelopmentScreen: () => <div data-testid="dev-screen">Development</div>,
}));

// Capture onScreenChange for navigation tests
let capturedOnScreenChange: ((screen: Screen) => void) | null = null;

vi.mock('../../src/renderer/components/layout/Layout', () => ({
  Layout: ({
    children,
    onScreenChange,
  }: {
    children: React.ReactNode;
    currentScreen: Screen;
    onScreenChange: (screen: Screen) => void;
    projects?: unknown[];
    activeProjectId?: string | null;
    onSelectProject?: (id: string) => void;
    onCloseProject?: (id: string) => void;
  }) => {
    capturedOnScreenChange = onScreenChange;
    return <div data-testid="layout">{children}</div>;
  },
}));

vi.mock('../../src/renderer/providers/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../src/renderer/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../src/renderer/components/ui/Toaster', () => ({
  Toaster: () => null,
}));
vi.mock('../../src/renderer/components/updates', () => ({
  UpdateNotification: () => null,
}));

const mockUseKeyboardShortcuts = vi.fn();
vi.mock('../../src/renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (...args: unknown[]) => mockUseKeyboardShortcuts(...args),
}));

// ── Store mocks ────────────────────────────────────────────────────────

const mockFetchSettings = vi.fn();

vi.mock('../../src/renderer/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    theme: 'dark',
    fetchSettings: mockFetchSettings,
  }),
}));

vi.mock('../../src/renderer/stores/useContributionsStore', () => ({
  useContributionsStore: () => ({
    contributions: [],
    loading: false,
    fetchContributions: vi.fn(),
  }),
}));

vi.mock('../../src/renderer/stores/useOpenProjectsStore', () => {
  const hook = () => ({
    projects: [],
    activeProjectId: null,
    openProject: vi.fn(),
    closeProject: vi.fn(),
    setActiveProject: vi.fn(),
    updateProjectState: vi.fn(),
    closeAll: vi.fn(),
    isProjectOpen: vi.fn(() => false),
    maxProjects: 5,
  });
  hook.getState = () => ({
    projects: [],
    activeProjectId: null,
    closeProject: vi.fn(),
  });
  return { useOpenProjectsStore: hook };
});

// ── Import (after mocks) ─────────────────────────────────────────────

import App from '../../src/renderer/App';

// ── Helpers ────────────────────────────────────────────────────────────

function navigateTo(screenId: Screen) {
  if (!capturedOnScreenChange) throw new Error('Layout not yet rendered');
  act(() => {
    capturedOnScreenChange!(screenId);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnScreenChange = null;
  });

  // ============================================
  // Initial rendering
  // ============================================
  it('renders layout wrapper', () => {
    render(<App />);
    expect(screen.getByTestId('layout')).toBeDefined();
  });

  it('shows dashboard screen by default', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard-screen')).toBeDefined();
  });

  it('calls fetchSettings on mount', () => {
    render(<App />);
    expect(mockFetchSettings).toHaveBeenCalled();
  });

  it('sets up keyboard shortcuts', () => {
    render(<App />);
    expect(mockUseKeyboardShortcuts).toHaveBeenCalled();
  });

  // ============================================
  // Screen navigation
  // ============================================
  it('navigates to issues screen', () => {
    render(<App />);
    navigateTo('issues');
    expect(screen.getByTestId('issues-screen')).toBeDefined();
    expect(screen.queryByTestId('dashboard-screen')).toBeNull();
  });

  it('navigates to contributions screen', () => {
    render(<App />);
    navigateTo('contributions');
    expect(screen.getByTestId('contributions-screen')).toBeDefined();
  });

  it('navigates to projects screen', () => {
    render(<App />);
    navigateTo('projects');
    expect(screen.getByTestId('projects-screen')).toBeDefined();
  });

  it('navigates to professional screen', () => {
    render(<App />);
    navigateTo('professional');
    expect(screen.getByTestId('professional-screen')).toBeDefined();
  });

  it('navigates to settings screen', () => {
    render(<App />);
    navigateTo('settings');
    expect(screen.getByTestId('settings-screen')).toBeDefined();
  });

  it('navigates to documentation screen', () => {
    render(<App />);
    navigateTo('documentation');
    expect(screen.getByTestId('documentation-screen')).toBeDefined();
  });

  it('shows empty IDE state when no projects', () => {
    render(<App />);
    navigateTo('ide');
    expect(screen.getByText(/No project selected/)).toBeDefined();
  });

  it('navigates back to dashboard on unknown screen', () => {
    render(<App />);
    navigateTo('unknown' as Screen);
    // Default case returns DashboardScreen
    expect(screen.getByTestId('dashboard-screen')).toBeDefined();
  });

  // ============================================
  // Keyboard shortcut handlers
  // ============================================
  it('passes onSettingsOpen that navigates to settings', () => {
    render(<App />);
    const call = mockUseKeyboardShortcuts.mock.calls[0][0];
    act(() => {
      call.onSettingsOpen();
    });
    expect(screen.getByTestId('settings-screen')).toBeDefined();
  });
});
