import * as React from 'react';
import { ContributionList } from '../components/contributions/ContributionList';
import { useContributionsStore } from '../stores/useContributionsStore';
import type { Contribution } from '../../main/ipc/channels';

interface ContributionsScreenProps {
  onOpenIDE?: (contribution: Contribution) => void;
}

export function ContributionsScreen({ onOpenIDE }: ContributionsScreenProps) {
  const { contributions, loading, fetchContributions, deleteContribution } = useContributionsStore();

  React.useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handleOpenProject = (contribution: Contribution) => {
    if (onOpenIDE) {
      onOpenIDE(contribution);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">My Contributions</h2>
        <p className="text-muted-foreground mt-1">
          Manage your active open source contributions
        </p>
      </div>

      <ContributionList
        contributions={contributions}
        onDelete={deleteContribution}
        onOpenProject={handleOpenProject}
        loading={loading}
      />
    </div>
  );
}
