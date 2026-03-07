import * as React from 'react';
import { Plus } from 'lucide-react';
import { ContributionList } from '../components/contributions/ContributionList';
import { NewProjectWizard } from '../components/projects/NewProjectWizard';
import { Button } from '../components/ui/Button';
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
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const scanProjects = React.useCallback(async () => {
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
  }, [defaultProfessionalProjectsPath, setProjects]);

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
          <h2 className="text-2xl font-bold">Professional Projects</h2>
          <p className="text-muted-foreground mt-1">Manage your professional projects</p>
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
          subtitle: 'Add git repositories to your professional projects directory',
        }}
      />

      <NewProjectWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
        defaultCategory="professional"
        defaultLocation={defaultProfessionalProjectsPath || ''}
      />
    </div>
  );
}
