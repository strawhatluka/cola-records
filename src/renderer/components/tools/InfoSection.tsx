/**
 * InfoSection
 *
 * Six read-only Info buttons with hybrid output:
 * - Status, Log, Branches, Remotes → send git commands to terminal
 * - Disk Usage, Project Info → fetch structured data via IPC and display inline
 */

import { useState, useCallback } from 'react';
import { Activity, List, GitFork, Globe, HardDrive, FolderSearch, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { InfoInlinePanel } from './InfoInlinePanel';
import type { DiskUsageResult, ProjectInfo } from '../../../main/ipc/channels/types';

interface InfoSectionProps {
  workingDirectory: string;
  onRunCommand: (command: string) => void;
}

type PanelMode = 'disk-usage' | 'project-info' | null;

export function InfoSection({ workingDirectory, onRunCommand }: InfoSectionProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [diskUsageData, setDiskUsageData] = useState<DiskUsageResult | null>(null);
  const [projectInfoData, setProjectInfoData] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleDiskUsage = useCallback(async () => {
    if (panelMode === 'disk-usage') {
      setPanelMode(null);
      return;
    }
    setLoading('disk-usage');
    try {
      const result = await ipc.invoke('dev-tools:disk-usage', workingDirectory);
      setDiskUsageData(result);
      setPanelMode('disk-usage');
    } catch {
      setDiskUsageData(null);
    } finally {
      setLoading(null);
    }
  }, [workingDirectory, panelMode]);

  const handleProjectInfo = useCallback(async () => {
    if (panelMode === 'project-info') {
      setPanelMode(null);
      return;
    }
    setLoading('project-info');
    try {
      const result = await ipc.invoke('dev-tools:project-info', workingDirectory);
      setProjectInfoData(result);
      setPanelMode('project-info');
    } catch {
      setProjectInfoData(null);
    } finally {
      setLoading(null);
    }
  }, [workingDirectory, panelMode]);

  const buttons = [
    {
      id: 'status',
      label: 'Status',
      icon: Activity,
      title: 'git status',
      onClick: () => onRunCommand('git status'),
    },
    {
      id: 'log',
      label: 'Log',
      icon: List,
      title: 'git log --oneline --graph -20',
      onClick: () => onRunCommand('git log --oneline --graph -20'),
    },
    {
      id: 'branches',
      label: 'Branches',
      icon: GitFork,
      title: 'git branch -a',
      onClick: () => onRunCommand('git branch -a'),
    },
    {
      id: 'remotes',
      label: 'Remotes',
      icon: Globe,
      title: 'git remote -v',
      onClick: () => onRunCommand('git remote -v'),
    },
    {
      id: 'disk-usage',
      label: 'Disk Usage',
      icon: HardDrive,
      title: 'Scan directory sizes',
      onClick: handleDiskUsage,
    },
    {
      id: 'project-info',
      label: 'Project Info',
      icon: FolderSearch,
      title: 'Show project metadata',
      onClick: handleProjectInfo,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const isLoading = loading === btn.id;
          return (
            <button
              key={btn.id}
              disabled={isLoading}
              onClick={btn.onClick}
              className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
              title={btn.title}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[10px] text-muted-foreground leading-tight">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {panelMode === 'disk-usage' && diskUsageData && (
        <InfoInlinePanel
          mode="disk-usage"
          data={diskUsageData}
          onClose={() => setPanelMode(null)}
        />
      )}

      {panelMode === 'project-info' && projectInfoData && (
        <InfoInlinePanel
          mode="project-info"
          data={projectInfoData}
          onClose={() => setPanelMode(null)}
        />
      )}
    </>
  );
}
