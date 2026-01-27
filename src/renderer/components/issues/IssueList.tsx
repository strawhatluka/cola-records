import { List } from 'react-window';
import { IssueCard } from './IssueCard';
import { Skeleton } from '../ui/Skeleton';
import type { GitHubIssue } from '../../../main/ipc/channels';
import type { CSSProperties } from 'react';

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

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const issue = issues[index];
    return (
      <div style={{ ...style, padding: '8px' }}>
        <IssueCard
          issue={issue}
          onViewDetails={() => onIssueSelect(issue)}
        />
      </div>
    );
  };

  return (
    <div className="h-full px-4">
      <List
        height={600}
        itemCount={issues.length}
        itemSize={140}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
}
