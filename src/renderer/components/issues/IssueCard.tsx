import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { GitHubIssue } from '../../../main/ipc/channels';

interface IssueCardProps {
  issue: GitHubIssue;
  onViewDetails: () => void;
  style?: React.CSSProperties;
}

export function IssueCard({ issue, onViewDetails, style }: IssueCardProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      style={style}
      onClick={onViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex-1">
          <CardTitle className="text-base line-clamp-2">{issue.title}</CardTitle>
          <CardDescription className="mt-1">{issue.repository}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-2">
          {issue.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
          {issue.labels.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{issue.labels.length - 3}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Opened {new Date(issue.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
