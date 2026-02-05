import { IssueCard } from './IssueCard';
import { Skeleton } from '../ui/Skeleton';
import type { GitHubIssue } from '../../../main/ipc/channels';

interface IssueListProps {
  issues: GitHubIssue[];
  onIssueSelect: (issue: GitHubIssue) => void;
  loading: boolean;
}

export function IssueList({ issues, onIssueSelect, loading }: IssueListProps) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No issues found. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto styled-scroll">
      <div className="space-y-3 p-4">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onViewDetails={() => onIssueSelect(issue)}
          />
        ))}
      </div>
    </div>
  );
}
