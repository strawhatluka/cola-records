import * as React from 'react';
import { Plus } from 'lucide-react';
import { ContributionList } from '../components/contributions/ContributionList';
import { NewProjectWizard } from '../components/projects/NewProjectWizard';
import { Button } from '../components/ui/Button';
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
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const scanProjects = React.useCallback(async () => {
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
  }, [defaultProjectsPath, setProjects]);

  React.useEffect(() => {
    scanProjects();
  }, [scanProjects]);

  const handleOpenProject = (contribution: Contribution) => {
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  const handleWizardComplete = (contribution: Contribution) => {
    setWizardOpen(false);
    scanProjects();
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Projects</h2>
          <p className="text-muted-foreground mt-1">Manage your personal projects</p>
        </div>
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
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

      <NewProjectWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
        defaultCategory="personal"
        defaultLocation={defaultProjectsPath || ''}
      />
    </div>
  );
}
