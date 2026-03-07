/**
 * WizardStepOptions
 *
 * Step 3 of the New Project wizard.
 * Configures GitHub repo creation, extras (.gitignore, .editorconfig, etc.), and license.
 */

import * as React from 'react';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { Switch } from '../ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { cn } from '../../lib/utils';
import type { WizardConfig } from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

const LICENSES = [
  { value: 'MIT', label: 'MIT' },
  { value: 'Apache-2.0', label: 'Apache 2.0' },
  { value: 'GPL-3.0', label: 'GPL 3.0' },
  { value: 'BSD-2-Clause', label: 'BSD 2-Clause' },
  { value: 'ISC', label: 'ISC' },
  { value: 'Unlicense', label: 'Unlicense' },
  { value: 'none', label: 'None' },
];

export function WizardStepOptions({ config, onChange }: WizardStepProps) {
  const handleExtrasChange = React.useCallback(
    (key: keyof WizardConfig['extras'], value: boolean | string | null) => {
      onChange({
        extras: { ...config.extras, [key]: value },
      });
    },
    [config.extras, onChange]
  );

  return (
    <div className="space-y-5">
      {/* GitHub Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-medium text-foreground">GitHub</h4>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Create Remote Repo Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px] text-foreground">Create remote repository</Label>
            <p className="text-[10px] text-muted-foreground">
              Create a new GitHub repository for this project
            </p>
          </div>
          <Switch
            checked={config.createGitHubRepo}
            onCheckedChange={(checked) => onChange({ createGitHubRepo: checked })}
          />
        </div>

        {/* Conditional GitHub fields */}
        {config.createGitHubRepo && (
          <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-1">
            {/* Visibility */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Visibility</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ repoVisibility: 'public' })}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-[11px] text-center transition-colors',
                    config.repoVisibility === 'public'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:border-primary/50'
                  )}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ repoVisibility: 'private' })}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-[11px] text-center transition-colors',
                    config.repoVisibility === 'private'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:border-primary/50'
                  )}
                >
                  Private
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input
                type="text"
                value={config.repoDescription}
                onChange={(e) => onChange({ repoDescription: e.target.value })}
                placeholder="A short description of this project"
                className="h-8 text-[11px]"
                data-testid="wizard-repo-description"
              />
            </div>
          </div>
        )}
      </div>

      {/* Extras Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-medium text-foreground">Extras</h4>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-2">
          {/* .gitignore */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.extras.gitignore}
              onCheckedChange={(checked) => handleExtrasChange('gitignore', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">.gitignore</span>
            <span className="text-[10px] text-muted-foreground">
              Ignore build artifacts and dependencies
            </span>
          </label>

          {/* .editorconfig */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.extras.editorconfig}
              onCheckedChange={(checked) => handleExtrasChange('editorconfig', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">.editorconfig</span>
            <span className="text-[10px] text-muted-foreground">
              Consistent editor settings across IDEs
            </span>
          </label>

          {/* .env file */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.extras.envFile}
              onCheckedChange={(checked) => handleExtrasChange('envFile', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">.env file</span>
            <span className="text-[10px] text-muted-foreground">
              Environment variables template
            </span>
          </label>

          {/* Git hooks */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.extras.hooks}
              onCheckedChange={(checked) => handleExtrasChange('hooks', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">Git hooks</span>
            <span className="text-[10px] text-muted-foreground">
              Pre-commit and commit-msg hooks
            </span>
          </label>

          {/* README.md */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.extras.readme}
              onCheckedChange={(checked) => handleExtrasChange('readme', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">README.md</span>
            <span className="text-[10px] text-muted-foreground">Project documentation starter</span>
          </label>
        </div>
      </div>

      {/* License */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-medium text-foreground">License</h4>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Select
          value={config.extras.license ?? 'none'}
          onValueChange={(value) => handleExtrasChange('license', value === 'none' ? null : value)}
        >
          <SelectTrigger className="h-8 text-[11px]">
            <SelectValue placeholder="Select license..." />
          </SelectTrigger>
          <SelectContent>
            {LICENSES.map((lic) => (
              <SelectItem key={lic.value} value={lic.value} className="text-[11px]">
                {lic.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
