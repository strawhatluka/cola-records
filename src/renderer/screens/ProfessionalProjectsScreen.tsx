import * as React from 'react';
import { ContributionList } from '../components/contributions/ContributionList';
import { useProfessionalProjectsStore } from '../stores/useProfessionalProjectsStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { ipc } from '../ipc/client';
import type { Contribution } from '../../main/ipc/channels';

interface ProfessionalProjectsScreenProps {
  onOpenIDE?: (contribution: Contribution) => void;
}

export function ProfessionalProjectsScreen({ onOpenIDE }: ProfessionalProjectsScreenProps) {
  const { projects, deleteProject, setProjects } = useProfessionalProjectsStore();
  const { defaultProfessionalProjectsPath } = useSettingsStore();
  const [isScanning, setIsScanning] = React.useState(true);

  React.useEffect(() => {
    const scanProjects = async () => {
      if (defaultProfessionalProjectsPath) {
        setIsScanning(true);
        try {
          const scannedProjects = await ipc.invoke(
            'project:scan-directory',
            defaultProfessionalProjectsPath
          );
          setProjects(scannedProjects);
        } catch {
          // Scan failure handled by empty state
        } finally {
          setIsScanning(false);
        }
      }
    };

    scanProjects();
  }, [defaultProfessionalProjectsPath, setProjects]);

  const handleOpenProject = (contribution: Contribution) => {
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Professional Projects</h2>
        <p className="text-muted-foreground mt-1">Manage your professional projects</p>
      </div>

      <ContributionList
        contributions={projects}
        onDelete={deleteProject}
        onOpenProject={handleOpenProject}
        loading={isScanning}
        emptyMessage={{
          title: 'No projects found',
          subtitle: 'Add git repositories to your professional projects directory',
        }}
      />
    </div>
  );
}
