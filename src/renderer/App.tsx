import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './providers/ThemeProvider';
import { Layout } from './components/layout/Layout';
import { DashboardScreen } from './screens/DashboardScreen';
import { IssueDiscoveryScreen } from './screens/IssueDiscoveryScreen';
import { ContributionsScreen } from './screens/ContributionsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IDEInitializer } from './components/ide/IDEInitializer';
import type { Screen } from './components/layout/Sidebar';
import type { Contribution } from '../main/ipc/channels';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSettingsStore } from './stores/useSettingsStore';
import { useContributionsStore } from './stores/useContributionsStore';
import { ipc } from './ipc/client';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const { theme, fetchSettings, defaultClonePath } = useSettingsStore();
  const { setContributions } = useContributionsStore();

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

  const handleOpenIDE = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setCurrentScreen('ide');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'issues':
        return <IssueDiscoveryScreen onOpenIDE={handleOpenIDE} />;
      case 'contributions':
        return <ContributionsScreen onOpenIDE={handleOpenIDE} />;
      case 'settings':
        return <SettingsScreen />;
      case 'ide':
        return selectedContribution ? (
          <IDEInitializer
            contribution={selectedContribution}
            onNavigateBack={() => setCurrentScreen('contributions')}
          />
        ) : (
          <DashboardScreen />
        );
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme={theme}>
        <Layout currentScreen={currentScreen} onScreenChange={setCurrentScreen}>
          {renderScreen()}
        </Layout>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
