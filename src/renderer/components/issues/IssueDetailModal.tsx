import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ExternalLink, Calendar, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { RepositoryFileTree } from './RepositoryFileTree';
import { ipc } from '../../ipc/client';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto styled-scroll">
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
          <div className="github-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // Headers with GitHub-style bottom border
                h1: ({ children, ...props }) => (
                  <h1
                    className="text-2xl font-semibold pb-2 mb-4 border-b border-border"
                    {...props}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2
                    className="text-xl font-semibold pb-2 mb-3 mt-6 border-b border-border"
                    {...props}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold mb-2 mt-4" {...props}>
                    {children}
                  </h3>
                ),
                // Paragraphs
                p: ({ children, ...props }) => (
                  <p className="mb-4 leading-relaxed" {...props}>
                    {children}
                  </p>
                ),
                // Blockquotes with GitHub-style blue border
                blockquote: ({ children, ...props }) => (
                  <blockquote
                    className="pl-4 border-l-4 border-primary/50 text-muted-foreground my-4"
                    {...props}
                  >
                    {children}
                  </blockquote>
                ),
                // Code blocks
                pre: ({ children, ...props }) => (
                  <pre
                    className="bg-muted/50 border border-border rounded-md p-4 overflow-x-auto my-4 text-sm"
                    {...props}
                  >
                    {children}
                  </pre>
                ),
                // Inline code
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                // Lists
                ul: ({ children, ...props }) => (
                  <ul className="list-disc pl-6 mb-4 space-y-1" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal pl-6 mb-4 space-y-1" {...props}>
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="leading-relaxed" {...props}>
                    {children}
                  </li>
                ),
                // Links
                a: ({ children, href, ...props }) => (
                  <a href={href} className="text-primary hover:underline" {...props}>
                    {children}
                  </a>
                ),
                // Horizontal rule
                hr: ({ ...props }) => <hr className="my-6 border-border" {...props} />,
                // Checkbox rendering for task lists
                input: ({ type, checked, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="mr-2 accent-primary"
                        {...props}
                      />
                    );
                  }
                  return <input type={type} {...props} />;
                },
              }}
            >
              {issue.body || 'No description provided'}
            </ReactMarkdown>
          </div>

          {/* Repository File Tree */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Repository File Structure</h3>
            <RepositoryFileTree repository={issue.repository} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={async () => {
                try {
                  await ipc.invoke('shell:open-external', issue.url);
                } catch {
                  // URL open failed
                }
              }}
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
