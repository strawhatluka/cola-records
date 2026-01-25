import React, { useState } from 'react';
import { ThemeProvider } from './providers/ThemeProvider';
import { Layout } from './components/layout/Layout';
import { DashboardScreen } from './screens/DashboardScreen';
import { IssueDiscoveryScreen } from './screens/IssueDiscoveryScreen';
import { ContributionsScreen } from './screens/ContributionsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Screen } from './components/layout/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

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

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'issues':
        return <IssueDiscoveryScreen />;
      case 'contributions':
        return <ContributionsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <Layout currentScreen={currentScreen} onScreenChange={setCurrentScreen}>
          {renderScreen()}
        </Layout>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
