/**
 * WizardStepGitHubConfig
 *
 * Step 5 of the New Project wizard.
 * Checklist of all 12 GitHub config templates grouped by tier (Repository / Community).
 * Selected templates are stored in config.githubConfigSelections.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { cn } from '../../lib/utils';
import type {
  WizardConfig,
  ProjectGitHubConfigSelection,
  GitHubConfigTemplate,
} from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

interface WizardStepGitHubConfigProps extends WizardStepProps {
  templates: Record<string, GitHubConfigTemplate[]>;
  loading: boolean;
}

/**
 * Feature display metadata grouped by tier, matching github-config.service.ts FEATURES.
 * Order within each tier matches the service definition.
 */
const FEATURE_TIERS: { tier: string; features: { id: string; label: string }[] }[] = [
  {
    tier: 'Repository',
    features: [
      { id: 'workflows', label: 'Workflows' },
      { id: 'dependabot', label: 'Dependabot' },
      { id: 'release-notes', label: 'Release Notes' },
      { id: 'issue-templates', label: 'Issue Templates' },
      { id: 'pr-template', label: 'PR Template' },
      { id: 'labeler', label: 'Labeler' },
      { id: 'codeowners', label: 'CODEOWNERS' },
    ],
  },
  {
    tier: 'Community',
    features: [
      { id: 'auto-assign', label: 'Auto-Assign' },
      { id: 'copilot-instructions', label: 'Copilot Instructions' },
      { id: 'funding', label: 'Funding' },
      { id: 'security', label: 'Security Policy' },
      { id: 'stale', label: 'Stale' },
    ],
  },
];

export function WizardStepGitHubConfig({
  config,
  onChange,
  templates,
  loading,
}: WizardStepGitHubConfigProps) {
  const selections = config.githubConfigSelections;

  const isSelected = React.useCallback(
    (templateId: string) => {
      return selections.some((s) => s.templateId === templateId);
    },
    [selections]
  );

  const handleToggle = React.useCallback(
    (template: GitHubConfigTemplate, featureId: string) => {
      const existing = selections.find((s) => s.templateId === template.id);
      let updated: ProjectGitHubConfigSelection[];

      if (existing) {
        updated = selections.filter((s) => s.templateId !== template.id);
      } else {
        updated = [...selections, { featureId, templateId: template.id }];
      }

      onChange({ githubConfigSelections: updated });
    },
    [selections, onChange]
  );

  const handleSelectAllFeature = React.useCallback(
    (featureId: string, featureTemplates: GitHubConfigTemplate[]) => {
      const allSelected = featureTemplates.every((t) => isSelected(t.id));

      let updated: ProjectGitHubConfigSelection[];
      if (allSelected) {
        const templateIds = new Set(featureTemplates.map((t) => t.id));
        updated = selections.filter((s) => !templateIds.has(s.templateId));
      } else {
        const existingIds = new Set(selections.map((s) => s.templateId));
        const newSelections = featureTemplates
          .filter((t) => !existingIds.has(t.id))
          .map((t) => ({ featureId, templateId: t.id }));
        updated = [...selections, ...newSelections];
      }

      onChange({ githubConfigSelections: updated });
    },
    [selections, isSelected, onChange]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-[11px]">Loading GitHub config templates...</p>
      </div>
    );
  }

  // Filter tiers to only those with at least one feature that has templates
  const activeTiers = FEATURE_TIERS.map((tier) => ({
    ...tier,
    features: tier.features.filter((f) => templates[f.id] && templates[f.id].length > 0),
  })).filter((tier) => tier.features.length > 0);

  if (activeTiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-[11px]">No GitHub config templates available.</p>
        <p className="text-[10px] mt-1">Templates will be generated based on your ecosystem.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-muted-foreground">
        Select GitHub configuration files to include in your project.
        {selections.length > 0 && (
          <span className="text-foreground font-medium ml-1">{selections.length} selected</span>
        )}
      </p>

      {activeTiers.map((tier) => (
        <div key={tier.tier} className="space-y-2">
          {/* Tier heading */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tier.tier}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Features within the tier */}
          {tier.features.map((feature) => {
            const featureTemplates = templates[feature.id];
            const allSelected = featureTemplates.every((t) => isSelected(t.id));
            const someSelected = featureTemplates.some((t) => isSelected(t.id));
            const singleTemplate = featureTemplates.length === 1;

            // Single-template features: one checkbox row (no expand)
            if (singleTemplate) {
              const template = featureTemplates[0];
              return (
                <label
                  key={feature.id}
                  className="flex items-start gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={isSelected(template.id)}
                    onCheckedChange={() => handleToggle(template, feature.id)}
                    className="h-3.5 w-3.5 mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] text-foreground">{feature.label}</span>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {template.description}
                    </p>
                  </div>
                </label>
              );
            }

            // Multi-template features: group header with select-all + children
            return (
              <div key={feature.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => handleSelectAllFeature(feature.id, featureTemplates)}
                      className={cn('h-3.5 w-3.5', someSelected && !allSelected && 'opacity-60')}
                    />
                    <span className="text-[11px] font-medium text-foreground">{feature.label}</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    {featureTemplates.filter((t) => isSelected(t.id)).length}/
                    {featureTemplates.length}
                  </span>
                </div>

                <div className="space-y-1 pl-2 ml-1 border-l border-border">
                  {featureTemplates.map((template) => (
                    <label
                      key={template.id}
                      className="flex items-start gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isSelected(template.id)}
                        onCheckedChange={() => handleToggle(template, feature.id)}
                        className="h-3.5 w-3.5 mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] text-foreground">{template.label}</span>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {template.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
