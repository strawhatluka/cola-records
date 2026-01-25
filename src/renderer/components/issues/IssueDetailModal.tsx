import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Calendar, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { GitHubIssue } from '../../../main/ipc/channels';

interface IssueDetailModalProps {
  issue: GitHubIssue | null;
  onClose: () => void;
  onContribute?: (issue: GitHubIssue) => void;
}

export function IssueDetailModal({ issue, onClose, onContribute }: IssueDetailModalProps) {
  if (!issue) return null;

  return (
    <Dialog open={!!issue} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl pr-8">{issue.title}</DialogTitle>
              <DialogDescription className="mt-2">
                {issue.repository} • #{issue.number}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Labels */}
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <Badge key={label} variant="secondary">
                <Tag className="h-3 w-3 mr-1" />
                {label}
              </Badge>
            ))}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Opened {new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Issue Body */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{issue.body || 'No description provided'}</ReactMarkdown>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => window.open(issue.url, '_blank')}
              variant="outline"
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on GitHub
            </Button>
            {onContribute && (
              <Button onClick={() => onContribute(issue)} className="flex-1">
                Contribute to this Issue
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
