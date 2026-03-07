/**
 * WizardStepEcosystem
 *
 * Step 2 of the New Project wizard.
 * Selects ecosystem, framework, monorepo tool, and package manager.
 * Shows inline validation banner when a selected PM is not installed.
 */

import * as React from 'react';
import { Loader2, AlertTriangle, Check } from 'lucide-react';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { cn } from '../../lib/utils';
import type { WizardConfig, Ecosystem } from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

export interface ToolValidationState {
  status: 'idle' | 'checking' | 'missing' | 'installing' | 'installed' | 'error';
  toolName: string;
  errorMessage?: string;
  installedVersion?: string;
  alternatives: { value: string; label: string }[];
}

interface WizardStepEcosystemProps extends WizardStepProps {
  toolValidation?: ToolValidationState;
  onInstallTool?: () => void;
  onDismissValidation?: () => void;
}

interface EcosystemCard {
  id: Ecosystem;
  label: string;
  icon: string;
}

const ECOSYSTEMS: EcosystemCard[] = [
  { id: 'node', label: 'Node.js', icon: 'JS' },
  { id: 'python', label: 'Python', icon: 'PY' },
  { id: 'rust', label: 'Rust', icon: 'RS' },
  { id: 'go', label: 'Go', icon: 'GO' },
  { id: 'ruby', label: 'Ruby', icon: 'RB' },
  { id: 'php', label: 'PHP', icon: 'PHP' },
  { id: 'java', label: 'Java', icon: 'JV' },
];

const FRAMEWORKS: Record<string, { value: string; label: string }[]> = {
  node: [
    { value: 'react', label: 'React' },
    { value: 'nextjs', label: 'Next.js' },
    { value: 'express', label: 'Express' },
    { value: 'vanilla-ts', label: 'Vanilla TS' },
    { value: 'none', label: 'None' },
  ],
  python: [
    { value: 'django', label: 'Django' },
    { value: 'flask', label: 'Flask' },
    { value: 'fastapi', label: 'FastAPI' },
    { value: 'none', label: 'None' },
  ],
  rust: [],
  go: [],
  ruby: [
    { value: 'rails', label: 'Rails' },
    { value: 'sinatra', label: 'Sinatra' },
    { value: 'none', label: 'None' },
  ],
  php: [
    { value: 'laravel', label: 'Laravel' },
    { value: 'symfony', label: 'Symfony' },
    { value: 'none', label: 'None' },
  ],
  java: [
    { value: 'spring-boot', label: 'Spring Boot' },
    { value: 'none', label: 'None' },
  ],
};

const MONOREPO_TOOLS: Record<string, { value: string; label: string }[]> = {
  node: [
    { value: 'turborepo', label: 'Turborepo' },
    { value: 'nx', label: 'Nx' },
    { value: 'pnpm-workspaces', label: 'pnpm workspaces' },
  ],
  rust: [{ value: 'cargo-workspaces', label: 'Cargo workspaces' }],
  go: [{ value: 'go-workspaces', label: 'Go workspaces' }],
  python: [{ value: 'uv-workspaces', label: 'uv workspaces' }],
  ruby: [],
  php: [],
  java: [],
};

export const PACKAGE_MANAGERS: Record<
  string,
  { value: string; label: string; readonly?: boolean }[]
> = {
  node: [
    { value: 'npm', label: 'npm' },
    { value: 'yarn', label: 'yarn' },
    { value: 'pnpm', label: 'pnpm' },
    { value: 'bun', label: 'bun' },
  ],
  python: [
    { value: 'pip', label: 'pip' },
    { value: 'poetry', label: 'poetry' },
    { value: 'uv', label: 'uv' },
  ],
  rust: [{ value: 'cargo', label: 'cargo', readonly: true }],
  go: [{ value: 'go', label: 'go', readonly: true }],
  ruby: [{ value: 'bundler', label: 'bundler', readonly: true }],
  php: [{ value: 'composer', label: 'composer', readonly: true }],
  java: [
    { value: 'maven', label: 'Maven' },
    { value: 'gradle', label: 'Gradle' },
  ],
};

/** Get the default package manager for an ecosystem */
function getDefaultPackageManager(ecosystem: Ecosystem): string {
  const managers = PACKAGE_MANAGERS[ecosystem];
  return managers?.[0]?.value ?? 'unknown';
}

export function WizardStepEcosystem({
  config,
  onChange,
  toolValidation,
  onInstallTool,
  onDismissValidation,
}: WizardStepEcosystemProps) {
  const frameworks = FRAMEWORKS[config.ecosystem] ?? [];
  const monorepoTools = MONOREPO_TOOLS[config.ecosystem] ?? [];
  const packageManagers = PACKAGE_MANAGERS[config.ecosystem] ?? [];
  const isPackageManagerReadonly = packageManagers.length === 1 && packageManagers[0]?.readonly;
  const showMonorepoTool = config.projectType === 'monorepo' && monorepoTools.length > 0;

  const handleEcosystemChange = React.useCallback(
    (ecosystem: Ecosystem) => {
      const defaultPm = getDefaultPackageManager(ecosystem);
      const newFrameworks = FRAMEWORKS[ecosystem] ?? [];
      const newMonorepoTools = MONOREPO_TOOLS[ecosystem] ?? [];

      onChange({
        ecosystem,
        packageManager: defaultPm,
        framework: newFrameworks.length > 0 ? undefined : undefined,
        monorepoTool: newMonorepoTools.length > 0 ? newMonorepoTools[0].value : undefined,
      });
    },
    [onChange]
  );

  const showValidation = toolValidation && toolValidation.status !== 'idle';

  return (
    <div className="space-y-4">
      {/* Ecosystem Grid */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Ecosystem</Label>
        <div className="grid grid-cols-4 gap-2">
          {ECOSYSTEMS.map((eco) => (
            <button
              key={eco.id}
              type="button"
              onClick={() => handleEcosystemChange(eco.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2.5 transition-colors',
                config.ecosystem === eco.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-primary/50'
              )}
            >
              <span className="text-[11px] font-bold tracking-wider">{eco.icon}</span>
              <span className="text-[10px]">{eco.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Framework */}
      {frameworks.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Framework</Label>
          <Select
            value={config.framework ?? ''}
            onValueChange={(value) => onChange({ framework: value === 'none' ? undefined : value })}
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue placeholder="Select framework..." />
            </SelectTrigger>
            <SelectContent>
              {frameworks.map((fw) => (
                <SelectItem key={fw.value} value={fw.value} className="text-[11px]">
                  {fw.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Monorepo Tool */}
      {showMonorepoTool && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Monorepo Tool</Label>
          <Select
            value={config.monorepoTool ?? ''}
            onValueChange={(value) => onChange({ monorepoTool: value })}
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue placeholder="Select monorepo tool..." />
            </SelectTrigger>
            <SelectContent>
              {monorepoTools.map((tool) => (
                <SelectItem key={tool.value} value={tool.value} className="text-[11px]">
                  {tool.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Package Manager */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Package Manager</Label>
        {isPackageManagerReadonly ? (
          <div className="flex h-8 items-center rounded-md border border-input bg-muted/50 px-3">
            <span className="text-[11px] text-foreground">{packageManagers[0].label}</span>
          </div>
        ) : (
          <Select
            value={config.packageManager}
            onValueChange={(value) => onChange({ packageManager: value })}
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue placeholder="Select package manager..." />
            </SelectTrigger>
            <SelectContent>
              {packageManagers.map((pm) => (
                <SelectItem key={pm.value} value={pm.value} className="text-[11px]">
                  {pm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tool Validation Banner */}
      {showValidation && (
        <div className="mt-1">
          {toolValidation.status === 'checking' && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Checking if {toolValidation.toolName} is installed...
              </span>
            </div>
          )}

          {toolValidation.status === 'missing' && (
            <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                    {toolValidation.toolName} is not installed
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    The scaffold command requires {toolValidation.toolName} to be available on your
                    system.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {toolValidation.alternatives.map((alt) => (
                  <Button
                    key={alt.value}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      onChange({ packageManager: alt.value });
                      onDismissValidation?.();
                    }}
                  >
                    Use {alt.label} instead
                  </Button>
                ))}

                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={onInstallTool}
                >
                  Install {toolValidation.toolName}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] text-muted-foreground"
                  onClick={onDismissValidation}
                >
                  Continue anyway
                </Button>
              </div>
            </div>
          )}

          {toolValidation.status === 'installing' && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                Installing {toolValidation.toolName}... This may take a moment.
              </span>
            </div>
          )}

          {toolValidation.status === 'installed' && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/30">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] text-green-600 dark:text-green-400">
                {toolValidation.toolName}
                {toolValidation.installedVersion ? ` v${toolValidation.installedVersion}` : ''}{' '}
                installed successfully
              </span>
            </div>
          )}

          {toolValidation.status === 'error' && (
            <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[10px] text-destructive">{toolValidation.errorMessage}</p>
              </div>
              <div className="flex gap-1.5">
                {toolValidation.alternatives.map((alt) => (
                  <Button
                    key={alt.value}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      onChange({ packageManager: alt.value });
                      onDismissValidation?.();
                    }}
                  >
                    Use {alt.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={onDismissValidation}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
