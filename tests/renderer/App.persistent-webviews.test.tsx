/**
 * App.persistent-webviews.test.tsx
 *
 * Tests that DevelopmentScreen instances are rendered persistently across
 * tab switches, preventing webview destruction and preserving background
 * processes (Claude Code, terminals, builds).
 *
 * Issue #6: Persistent Webview Sessions for Multi-Project Support
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createMockContribution } from '../mocks/factories';
import type { Contribution } from '../../src/main/ipc/channels';
import type { OpenProject } from '../../src/renderer/stores/useOpenProjectsStore';
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

// Mock all screen components to keep tests focused on rendering structure
vi.mock('../../src/renderer/screens/DashboardScreen', () => ({
  DashboardScreen: () => <div data-testid="dashboard-screen">Dashboard</div>,
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

// Mock DevelopmentScreen to render a simple identifiable element per project
vi.mock('../../src/renderer/screens/DevelopmentScreen', () => ({
  DevelopmentScreen: ({ contribution }: { contribution: Contribution }) => (
    <div data-testid={`dev-screen-${contribution.id}`}>DevelopmentScreen: {contribution.id}</div>
  ),
}));

// Mock Layout to expose onScreenChange for programmatic navigation.
// Renders children and a nav button for each screen so tests can trigger navigation.
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

// Mock non-essential providers and components
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

// Mock hooks
vi.mock('../../src/renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// ── Store mocks ────────────────────────────────────────────────────────

let mockSettingsState = {
  theme: 'dark' as const,
  fetchSettings: vi.fn(),
};

let mockContributionsState = {
  contributions: [] as Contribution[],
  loading: false,
  fetchContributions: vi.fn(),
};

let mockOpenProjectsState: {
  projects: OpenProject[];
  activeProjectId: string | null;
  openProject: ReturnType<typeof vi.fn>;
  closeProject: ReturnType<typeof vi.fn>;
  setActiveProject: ReturnType<typeof vi.fn>;
  updateProjectState: ReturnType<typeof vi.fn>;
  closeAll: ReturnType<typeof vi.fn>;
  isProjectOpen: ReturnType<typeof vi.fn>;
  maxProjects: number;
};

vi.mock('../../src/renderer/stores/useSettingsStore', () => ({
  useSettingsStore: () => mockSettingsState,
}));

vi.mock('../../src/renderer/stores/useContributionsStore', () => ({
  useContributionsStore: () => mockContributionsState,
}));

const mockGetState = vi.fn();

vi.mock('../../src/renderer/stores/useOpenProjectsStore', () => {
  const hook = () => mockOpenProjectsState;
  hook.getState = () => mockGetState();
  return { useOpenProjectsStore: hook };
});

// ── Helpers ────────────────────────────────────────────────────────────

function createOpenProject(
  contribution: Contribution,
  overrides?: Partial<OpenProject>
): OpenProject {
  return {
    id: contribution.id,
    contribution,
    codeServerUrl: `http://127.0.0.1:8080/?folder=${contribution.localPath}`,
    state: 'running',
    error: null,
    openedAt: new Date(),
    ...overrides,
  };
}

/** Navigate to a screen using the captured onScreenChange callback */
function navigateTo(screenId: Screen) {
  if (!capturedOnScreenChange) throw new Error('Layout not yet rendered');
  act(() => {
    capturedOnScreenChange!(screenId);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('App - Persistent Webview Sessions', () => {
  const contribA = createMockContribution({
    id: 'project-alpha',
    issueTitle: 'Alpha Project',
    localPath: '/mock/contributions/alpha',
  });
  const contribB = createMockContribution({
    id: 'project-beta',
    issueTitle: 'Beta Project',
    localPath: '/mock/contributions/beta',
  });

  const projectA = createOpenProject(contribA);
  const projectB = createOpenProject(contribB);

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnScreenChange = null;

    mockSettingsState = {
      theme: 'dark',
      fetchSettings: vi.fn(),
    };

    mockContributionsState = {
      contributions: [],
      loading: false,
      fetchContributions: vi.fn(),
    };

    mockOpenProjectsState = {
      projects: [],
      activeProjectId: null,
      openProject: vi.fn(),
      closeProject: vi.fn(),
      setActiveProject: vi.fn(),
      updateProjectState: vi.fn(),
      closeAll: vi.fn(),
      isProjectOpen: vi.fn(() => false),
      maxProjects: 5,
    };

    mockGetState.mockReturnValue({
      projects: [],
      activeProjectId: null,
      closeProject: vi.fn(),
    });
  });

  it('renders multiple DevelopmentScreens simultaneously when projects are open', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    // Both DevelopmentScreens should be in the DOM regardless of current screen
    expect(screen.getByTestId('dev-screen-project-alpha')).toBeDefined();
    expect(screen.getByTestId('dev-screen-project-beta')).toBeDefined();
  });

  it('hides inactive project with display: none on IDE screen', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    // Navigate to IDE screen
    navigateTo('ide');

    // Active project visible, inactive hidden
    const wrapperA = screen.getByTestId('dev-screen-project-alpha').parentElement!;
    const wrapperB = screen.getByTestId('dev-screen-project-beta').parentElement!;

    expect(wrapperA.style.display).toBe('contents');
    expect(wrapperB.style.display).toBe('none');
  });

  it('shows active project with display: contents on IDE screen', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    navigateTo('ide');

    const wrapperA = screen.getByTestId('dev-screen-project-alpha').parentElement!;
    expect(wrapperA.style.display).toBe('contents');
  });

  it('preserves DevelopmentScreen DOM when switching between projects', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    navigateTo('ide');

    // Both screens should exist in DOM
    expect(screen.getByTestId('dev-screen-project-alpha')).toBeDefined();
    expect(screen.getByTestId('dev-screen-project-beta')).toBeDefined();

    // Switch active project (simulates store update from setActiveProject)
    mockOpenProjectsState.activeProjectId = 'project-beta';

    // Navigate to IDE again to trigger re-render with new active project
    navigateTo('ide');

    // Both DevelopmentScreens should still be in the DOM (never unmounted)
    expect(screen.getByTestId('dev-screen-project-alpha')).toBeDefined();
    expect(screen.getByTestId('dev-screen-project-beta')).toBeDefined();
  });

  it('hides all project wrappers on non-IDE screens', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    // App starts on 'dashboard' screen — all project wrappers should have display: none
    const wrapperA = screen.getByTestId('dev-screen-project-alpha').parentElement!;
    const wrapperB = screen.getByTestId('dev-screen-project-beta').parentElement!;

    expect(wrapperA.style.display).toBe('none');
    expect(wrapperB.style.display).toBe('none');

    // Navigate to settings — still hidden
    navigateTo('settings');

    expect(wrapperA.style.display).toBe('none');
    expect(wrapperB.style.display).toBe('none');
  });

  it('removes only the closed project from DOM while preserving others', async () => {
    mockOpenProjectsState.projects = [projectA, projectB];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    const { default: App } = await import('../../src/renderer/App');

    const { rerender } = await act(async () => {
      return render(<App />);
    });

    // Both screens present
    expect(screen.getByTestId('dev-screen-project-alpha')).toBeDefined();
    expect(screen.getByTestId('dev-screen-project-beta')).toBeDefined();

    // Simulate closing project B: update mock state, re-render
    mockOpenProjectsState.projects = [projectA];
    mockOpenProjectsState.activeProjectId = 'project-alpha';

    await act(async () => {
      rerender(<App />);
    });

    // Project A should still be present
    expect(screen.getByTestId('dev-screen-project-alpha')).toBeDefined();
    // Project B should be removed from DOM
    expect(screen.queryByTestId('dev-screen-project-beta')).toBeNull();
  });

  it('shows empty state when on IDE screen with no projects', async () => {
    mockOpenProjectsState.projects = [];
    mockOpenProjectsState.activeProjectId = null;

    const { default: App } = await import('../../src/renderer/App');

    await act(async () => {
      render(<App />);
    });

    // Navigate to IDE screen
    navigateTo('ide');

    // Should show empty state message
    expect(screen.getByText(/No project selected/)).toBeDefined();

    // No DevelopmentScreens should exist
    expect(screen.queryByTestId('dev-screen-project-alpha')).toBeNull();
    expect(screen.queryByTestId('dev-screen-project-beta')).toBeNull();
  });
});
