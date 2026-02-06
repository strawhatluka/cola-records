import * as React from 'react';
import { ContributionList } from '../components/contributions/ContributionList';
import { useProjectsStore } from '../stores/useProjectsStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { ipc } from '../ipc/client';
import type { Contribution } from '../../main/ipc/channels';

interface ProjectsScreenProps {
  onOpenIDE?: (contribution: Contribution) => void;
}

export function ProjectsScreen({ onOpenIDE }: ProjectsScreenProps) {
  const { projects, deleteProject, setProjects } = useProjectsStore();
  const { defaultProjectsPath } = useSettingsStore();
  const [isScanning, setIsScanning] = React.useState(true);

  React.useEffect(() => {
    const scanProjects = async () => {
      if (defaultProjectsPath) {
        setIsScanning(true);
        try {
          const scannedProjects = await ipc.invoke('project:scan-directory', defaultProjectsPath);
          setProjects(scannedProjects);
        } catch {
          // Scan failure handled by empty state
        } finally {
          setIsScanning(false);
        }
      }
    };

    scanProjects();
  }, [defaultProjectsPath, setProjects]);

  const handleOpenProject = (contribution: Contribution) => {
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">My Projects</h2>
        <p className="text-muted-foreground mt-1">Manage your personal projects</p>
      </div>

      <ContributionList
        contributions={projects}
        onDelete={deleteProject}
        onOpenProject={handleOpenProject}
        loading={isScanning}
        emptyMessage={{
          title: 'No projects found',
          subtitle: 'Add git repositories to your projects directory',
        }}
      />
    </div>
  );
}
