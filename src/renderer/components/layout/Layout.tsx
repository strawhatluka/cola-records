import * as React from 'react';
import { Sidebar, type Screen } from './Sidebar';
import { AppBar } from './AppBar';

interface LayoutProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  children: React.ReactNode;
}

const screenTitles: Record<Screen, string> = {
  dashboard: 'Dashboard',
  issues: 'Issue Discovery',
  contributions: 'My Contributions',
  settings: 'Settings',
};

export function Layout({ currentScreen, onScreenChange, children }: LayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        currentScreen={currentScreen}
        onScreenChange={onScreenChange}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <AppBar title={screenTitles[currentScreen]} />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
