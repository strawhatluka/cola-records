import { useEffect, useMemo, useRef, useState } from 'react';
import { GitPullRequest, ArrowRight, GitCommit as GitCommitIcon, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { ipc } from '../../ipc/client';
import { MarkdownEditor } from './MarkdownEditor';
import type { BranchComparison } from '../../../main/ipc/channels';

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

interface CreatePullRequestModalProps {
  open: boolean;
  owner: string;
  repo: string;
  localPath: string;
  branches: string[];
  remotes: GitRemote[];
  defaultBranchName?: string;
  onClose: () => void;
  onCreated: () => void;
}

function branchToTitle(branchName: string): string {
  return branchName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DiffHunkLine {
  type: 'add' | 'remove' | 'context' | 'hunk-header';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface FileDiff {
  filename: string;
  oldFilename?: string;
  insertions: number;
  deletions: number;
  binary: boolean;
  lines: DiffHunkLine[];
}

function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function parseUnifiedDiff(rawDiff: string): FileDiff[] {
  // Strip any ANSI escape codes that might be in the diff
  const cleanDiff = stripAnsiCodes(rawDiff);
  if (!cleanDiff.trim()) return [];

  const files: FileDiff[] = [];
  const diffParts = cleanDiff.split(/^diff --git /m).filter(Boolean);

  for (const part of diffParts) {
    const lines = part.split('\n');
    // Extract filename from first line: "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    const filename = headerMatch ? headerMatch[2] : 'unknown';
    const oldFilename = headerMatch && headerMatch[1] !== headerMatch[2] ? headerMatch[1] : undefined;

    const binary = part.includes('Binary files');
    const diffLines: DiffHunkLine[] = [];
    let insertions = 0;
    let deletions = 0;
    let oldLine = 0;
    let newLine = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip meta lines (index, ---, +++)
      if (line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++') ||
          line.startsWith('old mode') || line.startsWith('new mode') ||
          line.startsWith('new file') || line.startsWith('deleted file') ||
          line.startsWith('similarity') || line.startsWith('rename') ||
          line.startsWith('Binary')) {
        continue;
      }

      // Hunk header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (hunkMatch) {
        oldLine = parseInt(hunkMatch[1], 10);
        newLine = parseInt(hunkMatch[2], 10);
        diffLines.push({ type: 'hunk-header', content: line });
        continue;
      }

      if (line.startsWith('+')) {
        insertions++;
        diffLines.push({ type: 'add', content: line.substring(1), newLine: newLine++ });
      } else if (line.startsWith('-')) {
        deletions++;
        diffLines.push({ type: 'remove', content: line.substring(1), oldLine: oldLine++ });
      } else if (line.startsWith(' ') || line === '') {
        diffLines.push({ type: 'context', content: line.substring(1) || '', oldLine: oldLine++, newLine: newLine++ });
      }
    }

    files.push({ filename, oldFilename, insertions, deletions, binary, lines: diffLines });
  }

  return files;
}

export function CreatePullRequestModal({
  open,
  owner,
  repo,
  localPath,
  branches,
  remotes,
  defaultBranchName,
  onClose,
  onCreated,
}: CreatePullRequestModalProps) {
  const [base, setBase] = useState('');
  const [compare, setCompare] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comparison preview state
  const [comparison, setComparison] = useState<BranchComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [showAllCommits, setShowAllCommits] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Track whether user has manually edited the title
  const autoTitleRef = useRef<string>('');
  const isMounted = useRef(true);

  // Initialize on open
  useEffect(() => {
    if (!open) return;
    isMounted.current = true;

    const init = async () => {
      // Default base to first branch (sorted: main first)
      const defaultBase = branches[0] || 'main';
      setBase(defaultBase);

      // Get current branch for compare default
      try {
        const currentBranch = await ipc.invoke('git:get-current-branch', localPath);
        const compareBranch = currentBranch || defaultBranchName || branches[1] || '';
        if (isMounted.current) {
          setCompare(compareBranch);
          const autoTitle = branchToTitle(compareBranch);
          autoTitleRef.current = autoTitle;
          setTitle(autoTitle);
        }
      } catch {
        const fallback = defaultBranchName || branches[1] || '';
        if (isMounted.current) {
          setCompare(fallback);
          const autoTitle = branchToTitle(fallback);
          autoTitleRef.current = autoTitle;
          setTitle(autoTitle);
        }
      }

      // Reset other state
      setBody('');
      setError(null);
      setComparison(null);
      setComparisonError(null);
      setShowAllCommits(false);
    };

    init();
    return () => { isMounted.current = false; };
  }, [open, localPath, branches, defaultBranchName]);

  // Fetch comparison when base/compare change (debounced)
  useEffect(() => {
    if (!open || !base || !compare || base === compare) {
      setComparison(null);
      setComparisonError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setComparisonLoading(true);
      setComparisonError(null);
      try {
        const result = await ipc.invoke('git:compare-branches', localPath, base, compare);
        if (isMounted.current) setComparison(result);
      } catch (err) {
        if (isMounted.current) {
          setComparisonError(err instanceof Error ? err.message : String(err));
          setComparison(null);
        }
      } finally {
        if (isMounted.current) setComparisonLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, base, compare, localPath]);

  // Update auto-title when compare branch changes (only if user hasn't edited)
  useEffect(() => {
    if (!compare) return;
    const newAutoTitle = branchToTitle(compare);
    if (title === autoTitleRef.current || title === '') {
      setTitle(newAutoTitle);
    }
    autoTitleRef.current = newAutoTitle;
  }, [compare]);

  const handleSubmit = async () => {
    if (!title.trim() || !base.trim() || !compare.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      // Check if branch exists on remote, push if not
      const remoteBranches = await ipc.invoke('git:get-remote-branches', localPath, 'origin');
      const branchExistsOnRemote = remoteBranches.some(
        (rb: string) => rb === compare || rb === `origin/${compare}`
      );

      if (!branchExistsOnRemote) {
        // Push the branch to remote first
        await ipc.invoke('git:push', localPath, 'origin', compare, true); // true = set upstream
      }

      // Determine if this is a fork by checking if origin URL differs from upstream target
      // When creating PR to upstream, we need head as "forkOwner:branch"
      let head = compare;
      const originRemote = remotes.find(r => r.name === 'origin');

      if (originRemote) {
        // Extract owner from origin URL
        const originMatch = originRemote.fetchUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
        if (originMatch) {
          const originOwner = originMatch[1];
          // If origin owner differs from target owner, this is a fork
          if (originOwner !== owner) {
            head = `${originOwner}:${compare}`;
          }
        }
      }

      await ipc.invoke(
        'github:create-pull-request',
        owner,
        repo,
        title.trim(),
        head,
        base.trim(),
        body.trim()
      );

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const visibleCommits = comparison?.commits
    ? showAllCommits ? comparison.commits : comparison.commits.slice(0, 20)
    : [];

  const parsedDiff = useMemo(() => {
    if (!comparison?.rawDiff) return [];
    return parseUnifiedDiff(comparison.rawDiff);
  }, [comparison?.rawDiff]);

  // Auto-expand all files when comparison loads
  useEffect(() => {
    if (parsedDiff.length > 0) {
      setExpandedFiles(new Set(parsedDiff.map((f) => f.filename)));
    } else {
      setExpandedFiles(new Set());
    }
  }, [parsedDiff]);

  const toggleFileExpanded = (filename: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto styled-scroll">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
          <DialogDescription>
            Submit a pull request to {owner}/{repo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Branch Selectors */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Base Branch</label>
              <Select value={base} onValueChange={setBase} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select base branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The branch you want to merge into
              </p>
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground mb-6" />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Compare Branch</label>
              <Select value={compare} onValueChange={setCompare} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compare branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The branch with your changes
              </p>
            </div>
          </div>

          {/* Comparison Preview */}
          {base && compare && base !== compare && (
            <div className="border rounded-md overflow-hidden">
              {comparisonLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
              ) : comparisonError ? (
                <div className="px-4 py-3 text-sm text-destructive">
                  Failed to compare branches: {comparisonError}
                </div>
              ) : comparison ? (
                comparison.commits.length === 0 && comparison.files.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    These branches are identical — no changes to show.
                  </div>
                ) : (
                  <>
                    {/* Summary bar */}
                    <div className="px-4 py-2 bg-muted/30 border-b text-sm flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <GitCommitIcon className="h-3.5 w-3.5" />
                        {comparison.commits.length} commit{comparison.commits.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {comparison.totalFilesChanged} file{comparison.totalFilesChanged !== 1 ? 's' : ''} changed
                      </span>
                      <span className="text-green-500">+{comparison.totalInsertions}</span>
                      <span className="text-red-500">-{comparison.totalDeletions}</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto styled-scroll">
                      {/* Commits */}
                      {visibleCommits.length > 0 && (
                        <div className="border-b">
                          <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                            Commits
                          </div>
                          {visibleCommits.map((commit) => (
                            <div
                              key={commit.hash}
                              className="px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-muted/20 border-b border-border/50 last:border-b-0"
                            >
                              <code className="text-[11px] font-mono text-muted-foreground shrink-0">
                                {commit.hash.substring(0, 7)}
                              </code>
                              <span className="truncate flex-1">{commit.message}</span>
                              <span className="text-muted-foreground shrink-0">
                                {commit.author.split(' <')[0]}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {new Date(commit.date).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                          {!showAllCommits && comparison.commits.length > 20 && (
                            <button
                              onClick={() => setShowAllCommits(true)}
                              className="w-full px-4 py-1.5 text-xs text-primary hover:bg-muted/20 transition-colors"
                            >
                              Show all {comparison.commits.length} commits
                            </button>
                          )}
                        </div>
                      )}

                      {/* Files changed — unified diff view */}
                      {parsedDiff.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 border-t">
                            Showing {comparison.totalFilesChanged} changed file{comparison.totalFilesChanged !== 1 ? 's' : ''} with {comparison.totalInsertions} addition{comparison.totalInsertions !== 1 ? 's' : ''} and {comparison.totalDeletions} deletion{comparison.totalDeletions !== 1 ? 's' : ''}
                          </div>
                          {parsedDiff.map((fileDiff) => {
                            const isExpanded = expandedFiles.has(fileDiff.filename);
                            const total = fileDiff.insertions + fileDiff.deletions;
                            const blocks = Math.min(5, Math.max(1, Math.ceil(total / Math.max(1, comparison.totalInsertions + comparison.totalDeletions) * 5)));
                            const addBlocks = total > 0 ? Math.round((fileDiff.insertions / total) * blocks) : 0;
                            const delBlocks = blocks - addBlocks;
                            return (
                              <div key={fileDiff.filename} className="border-t border-border/50">
                                {/* File header */}
                                <button
                                  onClick={() => toggleFileExpanded(fileDiff.filename)}
                                  className="w-full px-4 py-2 flex items-center gap-2 text-xs hover:bg-muted/20 transition-colors"
                                >
                                  {isExpanded
                                    ? <ChevronDown className="h-3 w-3 shrink-0" />
                                    : <ChevronRight className="h-3 w-3 shrink-0" />
                                  }
                                  <span className="font-mono text-[11px] truncate flex-1 text-left">
                                    {fileDiff.filename}
                                  </span>
                                  {fileDiff.binary ? (
                                    <span className="text-muted-foreground text-[10px] px-1.5 py-0.5 rounded bg-muted shrink-0">
                                      Binary
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-green-500 shrink-0">+{fileDiff.insertions}</span>
                                      <span className="text-red-500 shrink-0">-{fileDiff.deletions}</span>
                                      <span className="flex gap-px shrink-0">
                                        {Array.from({ length: addBlocks }).map((_, i) => (
                                          <span key={`a${i}`} className="w-2 h-2 bg-green-500 rounded-sm" />
                                        ))}
                                        {Array.from({ length: delBlocks }).map((_, i) => (
                                          <span key={`d${i}`} className="w-2 h-2 bg-red-500 rounded-sm" />
                                        ))}
                                        {Array.from({ length: 5 - blocks }).map((_, i) => (
                                          <span key={`n${i}`} className="w-2 h-2 bg-muted rounded-sm" />
                                        ))}
                                      </span>
                                    </>
                                  )}
                                </button>

                                {/* Diff content */}
                                {isExpanded && !fileDiff.binary && (
                                  <div className="overflow-x-auto border-t border-border/50">
                                    <table className="w-full text-[11px] font-mono leading-[1.6]">
                                      <tbody>
                                        {fileDiff.lines.map((line, idx) => {
                                          if (line.type === 'hunk-header') {
                                            return (
                                              <tr key={idx} className="bg-blue-500/5">
                                                <td className="px-2 text-muted-foreground select-none w-10 text-right">...</td>
                                                <td className="px-2 text-muted-foreground select-none w-10 text-right">...</td>
                                                <td className="px-2 py-0.5 text-blue-400">{line.content}</td>
                                              </tr>
                                            );
                                          }
                                          const bgClass = line.type === 'add'
                                            ? 'bg-green-500/10'
                                            : line.type === 'remove'
                                              ? 'bg-red-500/10'
                                              : '';
                                          const textClass = line.type === 'add'
                                            ? 'text-green-400'
                                            : line.type === 'remove'
                                              ? 'text-red-400'
                                              : '';
                                          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
                                          return (
                                            <tr key={idx} className={bgClass}>
                                              <td className="px-2 text-muted-foreground/50 select-none w-10 text-right border-r border-border/30">
                                                {line.type !== 'add' ? line.oldLine : ''}
                                              </td>
                                              <td className="px-2 text-muted-foreground/50 select-none w-10 text-right border-r border-border/30">
                                                {line.type !== 'remove' ? line.newLine : ''}
                                              </td>
                                              <td className={`px-2 py-0 whitespace-pre ${textClass}`}>
                                                <span className="select-none">{prefix}</span>{line.content}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )
              ) : null}
            </div>
          )}

          {base === compare && base !== '' && (
            <div className="border rounded-md px-4 py-3 text-sm text-muted-foreground text-center">
              Select different branches to see changes.
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pull request title"
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Describe your changes... (Markdown supported)"
              disabled={submitting}
              minHeight="160px"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !base.trim() || !compare.trim() || base === compare || submitting}
            >
              <GitPullRequest className="h-4 w-4 mr-2" />
              {submitting ? 'Creating...' : 'Create Pull Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
