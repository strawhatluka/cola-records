import { List } from 'react-window';
import { IssueCard } from './IssueCard';
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
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading issues...</p>
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
    <List
      defaultHeight={600}
      rowCount={issues.length}
      rowHeight={140}
      rowComponent={Row}
      rowProps={{} as any}
      className="px-4"
    />
  );
}
