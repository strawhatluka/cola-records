import * as React from 'react';
import { Sidebar, type Screen } from './Sidebar';
import { AppBar } from './AppBar';
import type { OpenProject } from '../../stores/useOpenProjectsStore';

interface LayoutProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  children: React.ReactNode;
  projects?: OpenProject[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string) => void;
  onCloseProject?: (id: string) => void;
}

const screenTitles: Record<Screen, string> = {
  dashboard: 'Dashboard',
  issues: 'Issue Discovery',
  projects: 'My Projects',
  professional: 'Professional Projects',
  contributions: 'My Contributions',
  settings: 'Settings',
  documentation: 'Documentation',
  ide: 'Development',
};

export function Layout({
  currentScreen,
  onScreenChange,
  children,
  projects = [],
  activeProjectId = null,
  onSelectProject,
  onCloseProject,
}: LayoutProps) {
  const [collapsed, setCollapsed] = React.useState(true); // Start collapsed by default

  // Collapse sidebar when screen changes
  React.useEffect(() => {
    setCollapsed(true);
  }, [currentScreen]);

  const handleScreenChange = (screen: Screen) => {
    onScreenChange(screen);
    // Sidebar will auto-collapse via useEffect above
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        currentScreen={currentScreen}
        onScreenChange={handleScreenChange}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <AppBar
          title={screenTitles[currentScreen]}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={onSelectProject}
          onCloseProject={onCloseProject}
        />
        <div className="flex-1 overflow-auto styled-scroll">{children}</div>
      </main>
    </div>
  );
}
