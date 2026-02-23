import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { OpenProject } from '../../stores/useOpenProjectsStore';

export interface ProjectTabProps {
  project: OpenProject;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export const ProjectTab: React.FC<ProjectTabProps> = ({ project, isActive, onClick, onClose }) => {
  const { contribution, state } = project;

  // Extract project name from contribution
  const projectName = contribution.repositoryUrl
    ? decodeURIComponent(
        new URL(contribution.repositoryUrl).pathname.split('/').pop()?.replace('.git', '') ||
          'Unknown'
      )
    : 'Unknown Project';

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 text-sm rounded-t-md border-b-2 transition-colors cursor-pointer',
        'hover:bg-accent/50',
        isActive
          ? 'bg-background border-primary text-foreground'
          : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground'
      )}
      title={contribution.localPath}
    >
      {/* Status indicator */}
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          state === 'running' && 'bg-green-500',
          state === 'starting' && 'bg-yellow-500 animate-pulse',
          state === 'error' && 'bg-red-500',
          state === 'idle' && 'bg-gray-400'
        )}
      />

      {/* Project name */}
      <span className="max-w-[120px] truncate">{projectName}</span>

      {/* Close button */}
      <button
        onClick={handleClose}
        className={cn(
          'p-0.5 rounded hover:bg-destructive/20 hover:text-destructive',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isActive && 'opacity-100'
        )}
        title="Close project"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
