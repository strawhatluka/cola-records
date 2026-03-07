import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { useProjectCreation } from '../../hooks/useProjectCreation';
import { ipc } from '../../ipc/client';
import type {
  WizardConfig,
  Contribution,
  ORMOption,
  GitHubConfigTemplate,
  Ecosystem,
} from '../../../main/ipc/channels';
import { WizardStepBasics } from './WizardStepBasics';
import { WizardStepEcosystem, PACKAGE_MANAGERS } from './WizardStepEcosystem';
import type { ToolValidationState } from './WizardStepEcosystem';
import { WizardStepOptions } from './WizardStepOptions';
import { WizardStepDatabase } from './WizardStepDatabase';
import { WizardStepGitHubConfig } from './WizardStepGitHubConfig';
import { WizardStepReview } from './WizardStepReview';

interface NewProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (contribution: Contribution) => void;
  defaultCategory: 'personal' | 'professional';
  defaultLocation: string;
}

const STEP_LABELS = ['Basics', 'Ecosystem', 'Options', 'Database', 'GitHub Config', 'Review'];

const GITHUB_CONFIG_FEATURE_IDS = [
  'workflows',
  'dependabot',
  'release-notes',
  'issue-templates',
  'pr-template',
  'labeler',
  'codeowners',
  'auto-assign',
  'copilot-instructions',
  'funding',
  'security',
  'stale',
] as const;

/** PMs that ship with their ecosystem runtime and don't need validation */
const BASE_PMS = new Set(['npm', 'pip', 'cargo', 'go', 'bundler', 'composer', 'maven']);

const DEFAULT_VALIDATION: ToolValidationState = {
  status: 'idle',
  toolName: '',
  alternatives: [],
};

function createDefaultConfig(
  defaultCategory: 'personal' | 'professional',
  defaultLocation: string
): WizardConfig {
  return {
    projectName: '',
    category: defaultCategory,
    location: defaultLocation,
    projectType: 'single',
    ecosystem: 'node' as Ecosystem,
    packageManager: 'npm',
    createGitHubRepo: false,
    repoVisibility: 'private',
    repoDescription: '',
    extras: {
      gitignore: true,
      editorconfig: true,
      readme: true,
      envFile: false,
      hooks: false,
      license: null,
    },
    database: {
      engine: 'none',
      includeDocker: false,
      includeEnvVars: false,
      additionalEngines: [],
    },
    githubConfigSelections: [],
  };
}

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  defaultCategory,
  defaultLocation,
}) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [config, setConfig] = React.useState<WizardConfig>(() =>
    createDefaultConfig(defaultCategory, defaultLocation)
  );
  const [ormOptions, setOrmOptions] = React.useState<ORMOption[]>([]);
  const [githubTemplates, setGithubTemplates] = React.useState<
    Record<string, GitHubConfigTemplate[]>
  >({});
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [toolValidation, setToolValidation] =
    React.useState<ToolValidationState>(DEFAULT_VALIDATION);

  const { state: creationState, startCreation, reset: resetCreation } = useProjectCreation();
  const createdContributionRef = React.useRef<Contribution | null>(null);

  const handleConfigChange = (updates: Partial<WizardConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // Load ORM options when entering step 3 (Database)
  React.useEffect(() => {
    if (currentStep === 3) {
      ipc
        .invoke('project:get-orm-options', config.ecosystem, config.database.engine)
        .then((options) => setOrmOptions(options))
        .catch(() => setOrmOptions([]));
    }
  }, [currentStep, config.ecosystem, config.database.engine]);

  // Load GitHub config templates when entering step 4 (GitHub Config)
  React.useEffect(() => {
    if (currentStep === 4 && Object.keys(githubTemplates).length === 0) {
      setTemplatesLoading(true);

      Promise.all(
        GITHUB_CONFIG_FEATURE_IDS.map(async (featureId) => {
          const templates = await ipc.invoke('github-config:list-templates', featureId);
          return { featureId, templates };
        })
      )
        .then((results) => {
          const templateMap: Record<string, GitHubConfigTemplate[]> = {};
          for (const { featureId, templates } of results) {
            templateMap[featureId] = templates;
          }
          setGithubTemplates(templateMap);
        })
        .catch(() => {
          // Keep empty templates on failure
        })
        .finally(() => {
          setTemplatesLoading(false);
        });
    }
  }, [currentStep, githubTemplates]);

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return config.projectName.trim().length > 0;
      case 1:
        return !!config.ecosystem;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep >= STEP_LABELS.length - 1 || !isStepValid(currentStep)) return;

    // When leaving Ecosystem step (1), validate the selected PM
    if (currentStep === 1 && !BASE_PMS.has(config.packageManager)) {
      setToolValidation({
        status: 'checking',
        toolName: config.packageManager,
        alternatives: [],
      });

      try {
        const result = await ipc.invoke(
          'project:validate-package-manager',
          config.ecosystem,
          config.packageManager
        );

        if (!result.installed) {
          const allPms = PACKAGE_MANAGERS[config.ecosystem] ?? [];
          const alternatives = allPms.filter(
            (pm) => pm.value !== config.packageManager && BASE_PMS.has(pm.value)
          );

          setToolValidation({
            status: 'missing',
            toolName: config.packageManager,
            alternatives,
          });
          return; // Block step transition
        }
      } catch {
        // Detection failed — don't block on detection errors
      }

      setToolValidation(DEFAULT_VALIDATION);
    }

    setToolValidation(DEFAULT_VALIDATION);
    setCurrentStep((prev) => prev + 1);
  };

  const handleInstallTool = async () => {
    const toolName = toolValidation.toolName;
    setToolValidation((prev) => ({ ...prev, status: 'installing' }));

    try {
      const result = await ipc.invoke('project:install-tool', toolName);
      if (result.success) {
        setToolValidation((prev) => ({
          ...prev,
          status: 'installed',
          installedVersion: result.version,
        }));
        // Auto-advance after showing success
        setTimeout(() => {
          setToolValidation(DEFAULT_VALIDATION);
          setCurrentStep((prev) => prev + 1);
        }, 1500);
      } else {
        const allPms = PACKAGE_MANAGERS[config.ecosystem] ?? [];
        const alternatives = allPms.filter((pm) => pm.value !== toolName && BASE_PMS.has(pm.value));
        setToolValidation((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.message,
          alternatives,
        }));
      }
    } catch (error) {
      const allPms = PACKAGE_MANAGERS[config.ecosystem] ?? [];
      const alternatives = allPms.filter((pm) => pm.value !== toolName && BASE_PMS.has(pm.value));
      setToolValidation((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        alternatives,
      }));
    }
  };

  const handleDismissValidation = () => {
    setToolValidation(DEFAULT_VALIDATION);
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setToolValidation(DEFAULT_VALIDATION);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCreate = async () => {
    try {
      const contribution = await startCreation(config);
      createdContributionRef.current = contribution;
    } catch {
      // Error is tracked in creationState
    }
  };

  const handleOpenProject = () => {
    if (createdContributionRef.current) {
      onComplete(createdContributionRef.current);
    }
    handleClose();
  };

  const handleClose = () => {
    setConfig(createDefaultConfig(defaultCategory, defaultLocation));
    setCurrentStep(0);
    resetCreation();
    setOrmOptions([]);
    setGithubTemplates({});
    setTemplatesLoading(false);
    setToolValidation(DEFAULT_VALIDATION);
    createdContributionRef.current = null;
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <WizardStepBasics config={config} onChange={handleConfigChange} />;
      case 1:
        return (
          <WizardStepEcosystem
            config={config}
            onChange={handleConfigChange}
            toolValidation={toolValidation}
            onInstallTool={handleInstallTool}
            onDismissValidation={handleDismissValidation}
          />
        );
      case 2:
        return <WizardStepOptions config={config} onChange={handleConfigChange} />;
      case 3:
        return (
          <WizardStepDatabase
            config={config}
            onChange={handleConfigChange}
            ormOptions={ormOptions}
          />
        );
      case 4:
        return (
          <WizardStepGitHubConfig
            config={config}
            onChange={handleConfigChange}
            templates={githubTemplates}
            loading={templatesLoading}
          />
        );
      case 5:
        return (
          <WizardStepReview
            config={config}
            onChange={handleConfigChange}
            creationState={creationState}
          />
        );
      default:
        return null;
    }
  };

  const isCreating =
    creationState.status !== 'idle' &&
    creationState.status !== 'complete' &&
    creationState.status !== 'error';

  const isComplete = creationState.status === 'complete';

  const isNextDisabled =
    !isStepValid(currentStep) ||
    toolValidation.status === 'checking' ||
    toolValidation.status === 'installing';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2">
          {STEP_LABELS.map((label, index) => (
            <React.Fragment key={label}>
              {index > 0 && (
                <div
                  className={`flex-1 h-px ${index <= currentStep ? 'bg-primary' : 'bg-border'}`}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    index === currentStep
                      ? 'bg-primary ring-2 ring-primary/30'
                      : index < currentStep
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                  }`}
                />
                <span
                  className={`text-[10px] leading-none whitespace-nowrap ${
                    index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Progress bar during creation */}
        {isCreating && <Progress value={creationState.progress} className="h-1.5" />}

        {/* Step content area with scroll */}
        <div className="min-h-[320px] max-h-[420px] overflow-y-auto styled-scroll py-2">
          {renderStepContent()}
        </div>

        {/* Footer navigation */}
        <DialogFooter className="gap-2 sm:gap-0">
          {!isCreating && !isComplete && (
            <>
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              {currentStep < STEP_LABELS.length - 1 && (
                <Button onClick={handleNext} disabled={isNextDisabled}>
                  Next
                </Button>
              )}
              {currentStep === STEP_LABELS.length - 1 && (
                <Button onClick={handleCreate} disabled={!isStepValid(currentStep)}>
                  Create Project
                </Button>
              )}
            </>
          )}
          {isComplete && <Button onClick={handleOpenProject}>Open Project</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
