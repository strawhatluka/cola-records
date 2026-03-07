/**
 * WizardStepReview
 *
 * Step 6 (final) of the New Project wizard.
 * Two modes:
 *   1. Review mode (status === 'idle'): Summary of all selected options.
 *   2. Creation mode (status !== 'idle'): Progress bar, current step, errors/warnings.
 */

import * as React from 'react';
import { Check, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Progress } from '../ui/Progress';
import { cn } from '../../lib/utils';
import type { WizardConfig } from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

interface CreationState {
  status: string;
  progress: number;
  currentStep: string;
  error: string | null;
  warnings: string[];
}

interface WizardStepReviewProps extends WizardStepProps {
  creationState: CreationState;
}

/** Render a key-value row in the review summary */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[11px] text-foreground text-right truncate">{value}</span>
    </div>
  );
}

/** Render a section heading in the review summary */
function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 pt-1">
        <h4 className="text-[11px] font-medium text-foreground">{title}</h4>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

export function WizardStepReview({ config, creationState }: WizardStepReviewProps) {
  const isCreating = creationState.status !== 'idle';
  const isError = creationState.status === 'error';
  const isComplete = creationState.status === 'complete';

  // ---------- Creation Mode ----------
  if (isCreating) {
    return (
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">
              {isComplete ? 'Project created' : isError ? 'Creation failed' : 'Creating project...'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(creationState.progress)}%
            </span>
          </div>
          <Progress
            value={creationState.progress}
            className={cn('h-2', isError && '[&>div]:bg-destructive')}
          />
        </div>

        {/* Current Step */}
        {!isError && !isComplete && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">{creationState.currentStep}</span>
          </div>
        )}

        {/* Complete Indicator */}
        {isComplete && (
          <div className="flex items-center gap-2 py-2 text-green-500">
            <Check className="h-4 w-4" />
            <span className="text-[11px] font-medium">
              Project created successfully at {config.location}/{config.projectName}
            </span>
          </div>
        )}

        {/* Error Display */}
        {isError && creationState.error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-destructive">Error</p>
              <p className="text-[10px] text-destructive/80 mt-0.5">{creationState.error}</p>
            </div>
          </div>
        )}

        {/* Warnings Display */}
        {creationState.warnings.length > 0 && (
          <div className="space-y-1.5">
            {creationState.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-600 dark:text-yellow-400">{warning}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Review Mode ----------
  const extrasLabels: string[] = [];
  if (config.extras.gitignore) extrasLabels.push('.gitignore');
  if (config.extras.editorconfig) extrasLabels.push('.editorconfig');
  if (config.extras.envFile) extrasLabels.push('.env');
  if (config.extras.hooks) extrasLabels.push('Git hooks');
  if (config.extras.readme) extrasLabels.push('README.md');

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Review your project configuration before creating.
      </p>

      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        {/* Basics */}
        <ReviewSection title="Basics">
          <ReviewRow label="Name" value={config.projectName || '(not set)'} />
          <ReviewRow
            label="Category"
            value={<span className="capitalize">{config.category}</span>}
          />
          <ReviewRow label="Location" value={`${config.location}/${config.projectName}`} />
          <ReviewRow
            label="Type"
            value={config.projectType === 'monorepo' ? 'Monorepo' : 'Single Project'}
          />
        </ReviewSection>

        {/* Ecosystem */}
        <ReviewSection title="Ecosystem">
          <ReviewRow label="Ecosystem" value={config.ecosystem} />
          {config.framework && <ReviewRow label="Framework" value={config.framework} />}
          {config.projectType === 'monorepo' && config.monorepoTool && (
            <ReviewRow label="Monorepo Tool" value={config.monorepoTool} />
          )}
          <ReviewRow label="Package Manager" value={config.packageManager} />
        </ReviewSection>

        {/* GitHub */}
        <ReviewSection title="GitHub">
          <ReviewRow label="Remote Repo" value={config.createGitHubRepo ? 'Yes' : 'No'} />
          {config.createGitHubRepo && (
            <>
              <ReviewRow label="Visibility" value={config.repoVisibility} />
              {config.repoDescription && (
                <ReviewRow label="Description" value={config.repoDescription} />
              )}
            </>
          )}
        </ReviewSection>

        {/* Extras */}
        <ReviewSection title="Extras">
          <ReviewRow
            label="Files"
            value={extrasLabels.length > 0 ? extrasLabels.join(', ') : 'None'}
          />
          <ReviewRow label="License" value={config.extras.license ?? 'None'} />
        </ReviewSection>

        {/* Database */}
        <ReviewSection title="Database">
          <ReviewRow
            label="Engine"
            value={config.database.engine === 'none' ? 'None' : config.database.engine}
          />
          {config.database.engine !== 'none' && (
            <>
              {config.database.orm && (
                <ReviewRow label="ORM / Driver" value={config.database.orm} />
              )}
              <ReviewRow
                label="Docker Compose"
                value={config.database.includeDocker ? 'Yes' : 'No'}
              />
              <ReviewRow label=".env vars" value={config.database.includeEnvVars ? 'Yes' : 'No'} />
              {config.database.additionalEngines.length > 0 && (
                <ReviewRow
                  label="Additional"
                  value={config.database.additionalEngines.join(', ')}
                />
              )}
            </>
          )}
        </ReviewSection>

        {/* GitHub Config */}
        {config.githubConfigSelections.length > 0 && (
          <ReviewSection title="GitHub Config">
            <ReviewRow
              label="Templates"
              value={`${config.githubConfigSelections.length} selected`}
            />
          </ReviewSection>
        )}
      </div>
    </div>
  );
}
