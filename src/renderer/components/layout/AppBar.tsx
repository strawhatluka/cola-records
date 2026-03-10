import { useEffect } from 'react';
import { SpotifyPlayer } from '../spotify/SpotifyPlayer';
import { DiscordClient } from '../discord/DiscordClient';
import { ProjectTabBar } from '../projects/ProjectTabBar';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { ipc } from '../../ipc/client';
import type { OpenProject } from '../../stores/useOpenProjectsStore';
import { useUpdaterStore } from '../../stores/useUpdaterStore';
import { useNotificationStore } from '../../stores/useNotificationStore';

interface AppBarProps {
  title: string;
  projects?: OpenProject[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string) => void;
  onCloseProject?: (id: string) => void;
  onNavigate?: (screen: string, context?: string) => void;
}

export function AppBar({
  title,
  projects = [],
  activeProjectId = null,
  onSelectProject,
  onCloseProject,
  onNavigate,
}: AppBarProps) {
  const appVersion = useUpdaterStore((state) => state.appVersion);

  // Initialize notification listeners
  useEffect(() => {
    const cleanup = useNotificationStore.getState()._initializeListeners();
    return cleanup;
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <SpotifyPlayer />
        <DiscordClient />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          title="Google Chrome"
          onClick={() => ipc.invoke('shell:launch-app', 'chrome')}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848c.404.037.812.062 1.229.062 6.627 0 12-5.373 12-12 0-1.054-.135-2.076-.389-3.049H15.273zM12 8.727a3.273 3.273 0 1 0 0 6.546 3.273 3.273 0 0 0 0-6.546z" />
          </svg>
        </button>
      </div>

      {/* Project tabs in the middle - visible from any screen */}
      {projects.length > 0 && onSelectProject && onCloseProject && (
        <div className="flex-1 flex justify-center px-4">
          <ProjectTabBar
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={onSelectProject}
            onCloseProject={onCloseProject}
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        <NotificationCenter onNavigate={onNavigate} />
        {appVersion && <span className="text-xs text-muted-foreground">v{appVersion}</span>}
      </div>
    </header>
  );
}
