
import { Folder, GitBranch, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from './StatusBadge';
import type { Contribution } from '../../../main/ipc/channels';

interface ContributionCardProps {
  contribution: Contribution;
  onDelete: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

export function ContributionCard({ contribution, onDelete, onOpenFolder }: ContributionCardProps) {
  const repoName = contribution.repositoryUrl.split('/').slice(-1)[0];

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the contribution for ${repoName}?`)) {
      onDelete(contribution.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{repoName}</CardTitle>
            <CardDescription className="mt-1">
              #{contribution.issueNumber}: {contribution.issueTitle}
            </CardDescription>
          </div>
          <StatusBadge status={contribution.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {contribution.branchName}
            </code>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Folder className="h-4 w-4" />
            <span className="truncate">{contribution.localPath}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenFolder(contribution.localPath)}
            className="flex-1"
          >
            <Folder className="h-4 w-4 mr-2" />
            Open Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(contribution.repositoryUrl, '_blank')}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on GitHub
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {new Date(contribution.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
