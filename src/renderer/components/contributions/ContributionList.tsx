import * as React from 'react';
import { ContributionCard } from './ContributionCard';
import type { Contribution } from '../../../main/ipc/channels';

interface ContributionListProps {
  contributions: Contribution[];
  onDelete: (id: string) => void;
  onOpenFolder: (path: string) => void;
  loading: boolean;
}

export function ContributionList({
  contributions,
  onDelete,
  onOpenFolder,
  loading,
}: ContributionListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading contributions...</p>
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No contributions yet</p>
          <p className="text-sm text-muted-foreground">
            Start by finding an issue in the <strong>Issues</strong> tab
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {contributions.map((contribution) => (
        <ContributionCard
          key={contribution.id}
          contribution={contribution}
          onDelete={onDelete}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </div>
  );
}
