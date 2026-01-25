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

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

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
          </ThemeProvider>
      <Toaster />
    </ErrorBoundary>
  );
};

export default App;
