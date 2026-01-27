
import { ContributionCard } from './ContributionCard';
import { Skeleton } from '../ui/Skeleton';
import type { Contribution } from '../../../main/ipc/channels';

interface ContributionListProps {
  contributions: Contribution[];
  onDelete: (id: string) => void;
  onOpenProject: (contribution: Contribution) => void;
  loading: boolean;
}

export function ContributionList({
  contributions,
  onDelete,
  onOpenProject,
  loading,
}: ContributionListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
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
          onOpenProject={onOpenProject}
        />
      ))}
    </div>
  );
}
