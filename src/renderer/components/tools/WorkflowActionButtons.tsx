/**
 * WorkflowActionButtons
 *
 * Seven action buttons for AI-powered and git workflow operations:
 * Changelog, Stage, Commit, Push, Pull Request, Version, CLI.
 * Rendered in the Workflows section of MaintenanceTool.
 */

import {
  FileText,
  Plus,
  GitCommitHorizontal,
  ArrowUp,
  GitPullRequest,
  Tag,
  TerminalSquare,
} from 'lucide-react';

interface WorkflowActionButtonsProps {
  onChangelogClick: () => void;
  onStageClick: () => void;
  onCommitClick: () => void;
  onPushClick: () => void;
  onPullRequestClick: () => void;
  onVersionClick: () => void;
  onCliClick: () => void;
}

const buttons = [
  { id: 'changelog', label: 'Changelog', icon: FileText, handler: 'onChangelogClick' },
  { id: 'stage', label: 'Stage', icon: Plus, handler: 'onStageClick' },
  { id: 'commit', label: 'Commit', icon: GitCommitHorizontal, handler: 'onCommitClick' },
  { id: 'push', label: 'Push', icon: ArrowUp, handler: 'onPushClick' },
  { id: 'pr', label: 'Pull Request', icon: GitPullRequest, handler: 'onPullRequestClick' },
  { id: 'version', label: 'Version', icon: Tag, handler: 'onVersionClick' },
  { id: 'cli', label: 'CLI', icon: TerminalSquare, handler: 'onCliClick' },
] as const;

export function WorkflowActionButtons(props: WorkflowActionButtonsProps) {
  return (
    <>
      {buttons.map((btn) => {
        const Icon = btn.icon;
        const onClick = props[btn.handler];

        return (
          <button
            key={btn.id}
            onClick={onClick}
            className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent min-w-[64px] transition-colors"
            title={btn.label}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground leading-tight">{btn.label}</span>
          </button>
        );
      })}
    </>
  );
}
