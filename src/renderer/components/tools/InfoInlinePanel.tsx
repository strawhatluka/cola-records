/**
 * InfoInlinePanel
 *
 * Inline display panel for Disk Usage (progress bars with sizes)
 * and Project Info (key-value metadata). Rendered below Info section buttons.
 * Only one panel is visible at a time; a close button dismisses it.
 */

import { X } from 'lucide-react';
import { formatBytes, calculatePercentage, formatDuration } from './info-formatters';
import type { DiskUsageResult, ProjectInfo } from '../../../main/ipc/channels/types';

interface DiskUsagePanelProps {
  mode: 'disk-usage';
  data: DiskUsageResult;
  onClose: () => void;
}

interface ProjectInfoPanelProps {
  mode: 'project-info';
  data: ProjectInfo;
  onClose: () => void;
}

type InfoInlinePanelProps = DiskUsagePanelProps | ProjectInfoPanelProps;

function DiskUsagePanel({ data, onClose }: { data: DiskUsageResult; onClose: () => void }) {
  const maxBytes = data.entries.length > 0 ? Math.max(...data.entries.map((e) => e.sizeBytes)) : 0;

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">
          Disk Usage — {formatBytes(data.totalBytes)}
        </h4>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {data.entries.length > 0 ? (
        <ul className="space-y-1.5">
          {data.entries.map((entry) => (
            <li key={entry.path} className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">
                {entry.name}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full"
                  style={{
                    width: `${maxBytes > 0 ? calculatePercentage(entry.sizeBytes, maxBytes) : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                {formatBytes(entry.sizeBytes)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No notable directories found.</p>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground/70">
        Scanned in {formatDuration(data.scanDurationMs)}
      </p>
    </div>
  );
}

function ProjectInfoPanel({ data, onClose }: { data: ProjectInfo; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Ecosystem', value: data.ecosystem },
    { label: 'Package Manager', value: data.packageManager },
    { label: 'Git', value: data.hasGit ? 'Initialized' : 'Not initialized' },
    {
      label: 'Env File',
      value: data.hasEnv ? 'Present' : data.hasEnvExample ? '.env.example only' : 'None',
    },
    { label: 'Editor Config', value: data.hasEditorConfig ? 'Present' : 'None' },
    { label: 'Hook Tool', value: data.hookTool ?? 'None' },
    { label: 'Type Checker', value: data.typeChecker ?? 'None' },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Project Info</h4>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-xs font-mono text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      {data.scripts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <h5 className="text-[10px] font-semibold text-muted-foreground mb-1">
            Scripts ({data.scripts.length})
          </h5>
          <ul className="space-y-0.5">
            {data.scripts.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-foreground">{s.name}</span>
                <span className="text-muted-foreground truncate">{s.command}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function InfoInlinePanel(props: InfoInlinePanelProps) {
  if (props.mode === 'disk-usage') {
    return <DiskUsagePanel data={props.data} onClose={props.onClose} />;
  }
  return <ProjectInfoPanel data={props.data} onClose={props.onClose} />;
}
