import { useState } from 'react';
import { ipc } from '../ipc/client';
import { createLogger } from '../utils/logger';
import type {
  WizardConfig,
  Contribution,
  ToolDetectionResult,
  ScaffoldConfig,
  DatabaseScaffoldConfig,
  Ecosystem,
} from '../../main/ipc/channels';

const logger = createLogger('ProjectCreation');

type CreationStatus =
  | 'idle'
  | 'validating_tools'
  | 'creating_directory'
  | 'scaffolding'
  | 'scaffolding_database'
  | 'writing_extras'
  | 'applying_github_config'
  | 'initializing_git'
  | 'creating_github_repo'
  | 'pushing'
  | 'saving_to_db'
  | 'complete'
  | 'error';

interface CreationState {
  status: CreationStatus;
  progress: number;
  currentStep: string;
  error: string | null;
  warnings: string[];
  projectId: string | null;
}

const initialState: CreationState = {
  status: 'idle',
  progress: 0,
  currentStep: '',
  error: null,
  warnings: [],
  projectId: null,
};

export function useProjectCreation() {
  const [state, setState] = useState<CreationState>(initialState);

  const checkTools = async (
    ecosystem: Ecosystem,
    isMonorepo?: boolean,
    monorepoTool?: string
  ): Promise<ToolDetectionResult[]> => {
    return ipc.invoke('project:check-cli-tools', ecosystem, isMonorepo, monorepoTool);
  };

  const startCreation = async (config: WizardConfig): Promise<Contribution> => {
    const projectPath = `${config.location}/${config.projectName}`;
    const warnings: string[] = [];

    try {
      // Step 1 (10%): Validate CLI tools
      setState({
        status: 'validating_tools',
        progress: 10,
        currentStep: 'Validating CLI tools...',
        error: null,
        warnings: [],
        projectId: null,
      });
      logger.info('Validating CLI tools', { ecosystem: config.ecosystem });

      const tools = await checkTools(
        config.ecosystem,
        config.projectType === 'monorepo',
        config.monorepoTool
      );
      const missingRequired = tools.filter((t) => t.required && !t.installed);
      if (missingRequired.length > 0) {
        const names = missingRequired.map((t) => t.name).join(', ');
        throw new Error(`Missing required tools: ${names}. Please install them and try again.`);
      }

      // Step 2 (20%): Create directory
      setState({
        status: 'creating_directory',
        progress: 20,
        currentStep: 'Creating project directory...',
        error: null,
        warnings: [...warnings],
        projectId: null,
      });
      logger.info('Checking project directory', { projectPath });

      const dirExists = await ipc.invoke('fs:directory-exists', projectPath);
      if (dirExists) {
        throw new Error(`Directory already exists: ${projectPath}`);
      }

      // Step 3 (40%): Scaffold project
      setState({
        status: 'scaffolding',
        progress: 40,
        currentStep: 'Scaffolding project...',
        error: null,
        warnings: [...warnings],
        projectId: null,
      });
      logger.info('Scaffolding project', { projectName: config.projectName });

      const scaffoldConfig: ScaffoldConfig = {
        projectName: config.projectName,
        projectPath,
        ecosystem: config.ecosystem,
        framework: config.framework,
        packageManager: config.packageManager,
        isMonorepo: config.projectType === 'monorepo',
        monorepoTool: config.monorepoTool,
        extras: {
          gitignore: config.extras.gitignore,
          editorconfig: config.extras.editorconfig,
          envFile: config.extras.envFile,
          readme: config.extras.readme,
          license: config.extras.license || undefined,
        },
      };

      const scaffoldResult = await ipc.invoke('project:scaffold', scaffoldConfig);
      if (!scaffoldResult.success) {
        throw new Error(`Scaffolding failed: ${scaffoldResult.message}`);
      }
      if (scaffoldResult.warnings.length > 0) {
        warnings.push(...scaffoldResult.warnings);
      }

      // Step 4 (55%): Scaffold database
      if (config.database.engine !== 'none') {
        setState({
          status: 'scaffolding_database',
          progress: 55,
          currentStep: 'Scaffolding database...',
          error: null,
          warnings: [...warnings],
          projectId: null,
        });
        logger.info('Scaffolding database', { engine: config.database.engine });

        const dbConfig: DatabaseScaffoldConfig = {
          projectPath,
          projectName: config.projectName,
          ecosystem: config.ecosystem,
          engine: config.database.engine,
          orm: config.database.orm,
          includeDocker: config.database.includeDocker,
          includeEnvVars: config.database.includeEnvVars,
          additionalEngines: config.database.additionalEngines,
        };

        const dbResult = await ipc.invoke('project:scaffold-database', dbConfig);
        if (!dbResult.success) {
          throw new Error(`Database scaffolding failed: ${dbResult.message}`);
        }
        if (dbResult.warnings.length > 0) {
          warnings.push(...dbResult.warnings);
        }
      }

      // Step 5 (65%): Apply GitHub config templates
      if (config.githubConfigSelections.length > 0) {
        setState({
          status: 'applying_github_config',
          progress: 65,
          currentStep: 'Applying GitHub config templates...',
          error: null,
          warnings: [...warnings],
          projectId: null,
        });
        logger.info('Applying GitHub config templates', {
          count: config.githubConfigSelections.length,
        });

        for (const sel of config.githubConfigSelections) {
          await ipc.invoke(
            'github-config:create-from-template',
            projectPath,
            sel.featureId,
            sel.templateId
          );
        }
      }

      // Step 6 (80%): Initialize git (init, checkout main, add, commit, checkout dev — no remote)
      setState({
        status: 'initializing_git',
        progress: 80,
        currentStep: 'Initializing git repository...',
        error: null,
        warnings: [...warnings],
        projectId: null,
      });
      logger.info('Initializing git repository', { projectPath });

      await ipc.invoke('project:initialize-git', projectPath);

      // Step 7 (90%): Create GitHub repo if requested
      let remoteUrl: string | undefined;
      if (config.createGitHubRepo) {
        setState({
          status: 'creating_github_repo',
          progress: 90,
          currentStep: 'Creating GitHub repository...',
          error: null,
          warnings: [...warnings],
          projectId: null,
        });
        logger.info('Creating GitHub repository', { name: config.projectName });

        const repo = await ipc.invoke('project:create-github-repo', config.projectName, {
          description: config.repoDescription,
          isPrivate: config.repoVisibility === 'private',
          autoInit: false,
        });

        remoteUrl = repo.url;

        // Add remote and push
        setState({
          status: 'pushing',
          progress: 93,
          currentStep: 'Pushing to GitHub...',
          error: null,
          warnings: [...warnings],
          projectId: null,
        });
        logger.info('Adding remote and pushing', { remoteUrl });

        await ipc.invoke('git:add-remote', projectPath, 'origin', repo.url);
        await ipc.invoke('git:push', projectPath, 'origin', 'main');
        await ipc.invoke('git:push', projectPath, 'origin', 'dev');
      }

      // Step 8 (100%): Save to DB
      setState({
        status: 'saving_to_db',
        progress: 97,
        currentStep: 'Saving project to database...',
        error: null,
        warnings: [...warnings],
        projectId: null,
      });
      logger.info('Saving project to database');

      const contributionData: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'> = {
        repositoryUrl: remoteUrl || projectPath,
        localPath: projectPath,
        branchName: 'dev',
        status: 'in_progress',
        type: 'project',
        isFork: false,
        remotesValid: !!remoteUrl,
        ecosystem: config.ecosystem,
        framework: config.framework,
        packageManager: config.packageManager,
        isMonorepo: config.projectType === 'monorepo',
        monorepoTool: config.monorepoTool,
        databaseEngine: config.database.engine !== 'none' ? config.database.engine : undefined,
        databaseOrm: config.database.orm,
      };

      const contribution = await ipc.invoke('contribution:create', contributionData);

      setState({
        status: 'complete',
        progress: 100,
        currentStep: 'Project created successfully!',
        error: null,
        warnings: [...warnings],
        projectId: contribution.id,
      });
      logger.info('Project creation complete', { projectId: contribution.id });

      return contribution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Project creation failed', { error: errorMessage });

      setState({
        status: 'error',
        progress: 0,
        currentStep: '',
        error: errorMessage,
        warnings: [...warnings],
        projectId: null,
      });

      throw error;
    }
  };

  const reset = () => {
    setState(initialState);
  };

  return { state, startCreation, reset, checkTools };
}
