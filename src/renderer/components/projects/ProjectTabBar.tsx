import React from 'react';
import { Plus } from 'lucide-react';
import { ProjectTab } from './ProjectTab';
import { cn } from '../../lib/utils';
import type { OpenProject } from '../../stores/useOpenProjectsStore';

export interface ProjectTabBarProps {
  projects: OpenProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onAddProject?: () => void;
  maxProjects?: number;
}

export const ProjectTabBar: React.FC<ProjectTabBarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCloseProject,
  onAddProject,
  maxProjects = 5,
}) => {
  const canAddMore = projects.length < maxProjects;

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="flex items-end gap-1 px-2 pt-1 bg-muted/30 border-b border-border">
      {projects.map((project) => (
        <ProjectTab
          key={project.id}
          project={project}
          isActive={project.id === activeProjectId}
          onClick={() => onSelectProject(project.id)}
          onClose={() => onCloseProject(project.id)}
        />
      ))}

      {/* Add project button */}
      {onAddProject && canAddMore && (
        <button
          onClick={onAddProject}
          className={cn(
            'flex items-center justify-center w-8 h-8 mb-0.5',
            'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            'rounded transition-colors'
          )}
          title="Open another project"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      {/* Max projects indicator */}
      {!canAddMore && (
        <span className="text-xs text-muted-foreground px-2 py-1">Max {maxProjects} projects</span>
      )}
    </div>
  );
};
