import React, { useState, useEffect, useCallback } from 'react';
import { createLogger } from './utils/logger';
import { ThemeProvider } from './providers/ThemeProvider';

const logger = createLogger('App');
import { Layout } from './components/layout/Layout';
import { DashboardScreen } from './screens/DashboardScreen';
import { IssueDiscoveryScreen } from './screens/IssueDiscoveryScreen';
import { ContributionsScreen } from './screens/ContributionsScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { ProfessionalProjectsScreen } from './screens/ProfessionalProjectsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DevelopmentScreen } from './screens/DevelopmentScreen';
import { DocumentationScreen } from './screens/DocumentationScreen';
import type { Screen } from './components/layout/Sidebar';
import type { Contribution } from '../main/ipc/channels';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { UpdateNotification } from './components/updates';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSettingsStore } from './stores/useSettingsStore';
import { useContributionsStore } from './stores/useContributionsStore';
import { useOpenProjectsStore } from './stores/useOpenProjectsStore';
import { ipc } from './ipc/client';
import { useNotificationStore } from './stores/useNotificationStore';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [ideOrigin, setIdeOrigin] = useState<Screen>('contributions');
  const { theme, fetchSettings } = useSettingsStore();
  useContributionsStore(); // Store needed for global state management

  // Multi-project state management
  const {
    projects,
    activeProjectId,
    openProject,
    closeProject,
    setActiveProject,
    updateProjectState,
  } = useOpenProjectsStore();

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Note: Contributions are scanned on-demand in ContributionsScreen
  // This ensures we always show the live state of the contributions folder

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onSearchFocus: () => {
      // Focus search input in IssueDiscoveryScreen
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      searchInput?.focus();
    },
    onEscapePress: () => {
      // Close any open modals (handled by Dialog components)
      // This is a fallback - Dialog components handle Esc natively
    },
    onSettingsOpen: () => {
      setCurrentScreen('settings');
    },
  });

  // Handle opening a project in the IDE (multi-project support)
  const handleOpenIDE = useCallback(
    async (contribution: Contribution, origin: Screen = 'contributions') => {
      setIdeOrigin(origin);

      // Try to open the project in the store
      const project = openProject(contribution);
      if (!project) {
        // Max projects reached - could show a toast here
        logger.warn('Max projects reached');
        return;
      }

      // Switch to IDE screen
      setCurrentScreen('ide');

      // Check if container is already running
      try {
        updateProjectState(project.id, 'starting');
        const status = await ipc.invoke('code-server:status');

        if (status.running) {
          // Container already running - just add workspace and get URL with folder param
          const url = await ipc.invoke('code-server:add-workspace', contribution.localPath);
          updateProjectState(project.id, 'running', url);
        } else {
          // Container not running - start it (creates container with all workspace mounts)
          const result = await ipc.invoke('code-server:start', contribution.localPath);
          updateProjectState(project.id, 'running', result.url);
        }
      } catch (error) {
        updateProjectState(project.id, 'error', null, (error as Error).message);
        useNotificationStore.getState().addNotification({
          category: 'integration',
          priority: 'high',
          title: 'Code Server Error',
          message: (error as Error).message,
          dedupeKey: `code-server-error-${project.id}`,
        });
      }
    },
    [openProject, updateProjectState]
  );

  // Handle closing a project
  const handleCloseProject = useCallback(
    async (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      // Remove workspace from container
      await ipc.invoke('code-server:remove-workspace', project.contribution.localPath);

      // Close from store
      closeProject(projectId);

      // If no more projects, navigate back to origin screen
      if (projects.length === 1) {
        setCurrentScreen(ideOrigin);
      }
    },
    [projects, closeProject, ideOrigin]
  );

  // Handle selecting a project tab (also navigates to IDE screen)
  const handleSelectProject = useCallback(
    (projectId: string) => {
      setActiveProject(projectId);
      // Navigate to IDE screen when clicking a project tab from any screen
      setCurrentScreen('ide');
    },
    [setActiveProject]
  );

  // Handle navigating back from IDE (closes only the active project)
  const handleNavigateBack = useCallback(() => {
    const { activeProjectId, closeProject } = useOpenProjectsStore.getState();
    if (activeProjectId) {
      closeProject(activeProjectId);
    }
    // Navigate back only if no projects remain
    const { projects } = useOpenProjectsStore.getState();
    if (projects.length === 0) {
      setCurrentScreen(ideOrigin);
    }
  }, [ideOrigin]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen onOpenIDE={(c) => handleOpenIDE(c, 'dashboard')} />;
      case 'issues':
        return <IssueDiscoveryScreen onOpenIDE={handleOpenIDE} />;
      case 'projects':
        return <ProjectsScreen onOpenIDE={(c) => handleOpenIDE(c, 'projects')} />;
      case 'professional':
        return <ProfessionalProjectsScreen onOpenIDE={(c) => handleOpenIDE(c, 'professional')} />;
      case 'contributions':
        return <ContributionsScreen onOpenIDE={(c) => handleOpenIDE(c, 'contributions')} />;
      case 'settings':
        return <SettingsScreen />;
      case 'documentation':
        return <DocumentationScreen />;
      case 'ide':
        // DevelopmentScreens are rendered persistently below — only show empty state here
        return projects.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No project selected. Go to Contributions to open a project.
          </div>
        ) : null;
      default:
        return <DashboardScreen onOpenIDE={(c) => handleOpenIDE(c, 'dashboard')} />;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme={theme}>
        <Layout
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCloseProject={handleCloseProject}
        >
          {renderScreen()}
          {/* Render ALL open DevelopmentScreens persistently to preserve webview
              connections and background processes across tab switches (#6) */}
          {projects.map((project) => (
            <div
              key={project.id}
              data-project-id={project.id}
              style={{
                display:
                  currentScreen === 'ide' && project.id === activeProjectId ? 'contents' : 'none',
              }}
            >
              <DevelopmentScreen
                contribution={project.contribution}
                onNavigateBack={handleNavigateBack}
                codeServerUrl={project.codeServerUrl}
                projectState={project.state}
                projectError={project.error}
              />
            </div>
          ))}
        </Layout>
        <Toaster />
        <UpdateNotification />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
