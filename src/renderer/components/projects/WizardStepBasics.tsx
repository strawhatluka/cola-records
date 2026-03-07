/**
 * WizardStepBasics
 *
 * Step 1 of the New Project wizard.
 * Collects project name, category, location, and project type (single vs monorepo).
 */

import * as React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';
import { cn } from '../../lib/utils';
import type { WizardConfig } from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

/** Convert a string to kebab-case, stripping invalid characters */
function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Validate a project name (kebab-case, no spaces/special chars) */
function validateProjectName(name: string): string | null {
  if (!name) return 'Project name is required';
  if (/\s/.test(name)) return 'Spaces are not allowed (use hyphens)';
  if (/[^a-z0-9-]/.test(name)) return 'Only lowercase letters, numbers, and hyphens allowed';
  if (name.startsWith('-') || name.endsWith('-')) return 'Cannot start or end with a hyphen';
  if (/--/.test(name)) return 'Cannot contain consecutive hyphens';
  return null;
}

export function WizardStepBasics({ config, onChange }: WizardStepProps) {
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [rawName, setRawName] = React.useState(config.projectName);

  const handleNameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setRawName(raw);
      const kebab = toKebabCase(raw);
      const error = kebab ? validateProjectName(kebab) : null;
      setNameError(error);
      onChange({ projectName: kebab });
    },
    [onChange]
  );

  const handleBrowse = React.useCallback(async () => {
    try {
      const result = await ipc.invoke('dialog:open-directory');
      if (result) {
        onChange({ location: result as string });
      }
    } catch {
      // User cancelled or dialog error — no action needed
    }
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* Project Name */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Project Name</Label>
        <Input
          type="text"
          value={rawName}
          onChange={handleNameChange}
          placeholder="my-awesome-project"
          className="h-8 text-[11px] font-mono"
          data-testid="wizard-project-name"
        />
        {rawName && rawName !== config.projectName && (
          <p className="text-[10px] text-muted-foreground">
            Will be created as:{' '}
            <span className="font-mono text-foreground">{config.projectName}</span>
          </p>
        )}
        {nameError && <p className="text-[10px] text-destructive">{nameError}</p>}
      </div>

      {/* Category (readonly) */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Category</Label>
        <div className="flex h-8 items-center rounded-md border border-input bg-muted/50 px-3">
          <span className="text-[11px] capitalize text-foreground">{config.category}</span>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Location</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={config.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="/home/user/projects"
            className="h-8 text-[11px] font-mono flex-1"
            data-testid="wizard-location"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[11px]"
            onClick={handleBrowse}
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Browse
          </Button>
        </div>
        {config.location && config.projectName && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {config.location}/{config.projectName}
          </p>
        )}
      </div>

      {/* Project Type */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Project Type</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ projectType: 'single' })}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors',
              config.projectType === 'single'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input bg-background text-muted-foreground hover:border-primary/50'
            )}
          >
            <span className="text-[11px] font-medium">Single Project</span>
            <span className="text-[10px] text-muted-foreground">Standard project structure</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ projectType: 'monorepo' })}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors',
              config.projectType === 'monorepo'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input bg-background text-muted-foreground hover:border-primary/50'
            )}
          >
            <span className="text-[11px] font-medium">Monorepo</span>
            <span className="text-[10px] text-muted-foreground">Multiple packages in one repo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
