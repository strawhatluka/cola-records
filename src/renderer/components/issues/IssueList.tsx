import * as React from 'react';
import { FixedSizeList as List } from 'react-window';
import { IssueCard } from './IssueCard';
import type { GitHubIssue } from '../../../main/ipc/channels';

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

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
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
      height={600}
      itemCount={issues.length}
      itemSize={140}
      width="100%"
      className="px-4"
    >
      {Row}
    </List>
  );
}
