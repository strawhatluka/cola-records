import * as React from 'react';
import { ContributionList } from '../components/contributions/ContributionList';
import { useContributionsStore } from '../stores/useContributionsStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { ipc } from '../ipc/client';
import type { Contribution } from '../../main/ipc/channels';

interface ContributionsScreenProps {
  onOpenIDE?: (contribution: Contribution) => void;
}

export function ContributionsScreen({ onOpenIDE }: ContributionsScreenProps) {
  const { contributions, deleteContribution, setContributions } = useContributionsStore();
  const { defaultClonePath } = useSettingsStore();
  const [isScanning, setIsScanning] = React.useState(true);

  // ONLY scan contributions directory - don't fetch from database
  // The scanner will sync with the database automatically
  React.useEffect(() => {
    const scanContributions = async () => {
      if (defaultClonePath) {
        setIsScanning(true);
        try {
          const scannedContributions = await ipc.invoke(
            'contribution:scan-directory',
            defaultClonePath
          );
          setContributions(scannedContributions);
        } catch {
          // Scan failure handled by empty state
        } finally {
          setIsScanning(false);
        }
      }
    };

    scanContributions();
  }, [defaultClonePath, setContributions]);

  const handleOpenProject = (contribution: Contribution) => {
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">My Contributions</h2>
        <p className="text-muted-foreground mt-1">Manage your active open source contributions</p>
      </div>

      <ContributionList
        contributions={contributions}
        onDelete={deleteContribution}
        onOpenProject={handleOpenProject}
        loading={isScanning}
      />
    </div>
  );
}
