import { useState } from 'react';
import { ipc } from '../ipc/client';
import { useContributionsStore } from '../stores/useContributionsStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import type { GitHubIssue, Contribution } from '../../main/ipc/channels';
import { generateBranchName } from '../utils/branch-naming';

type WorkflowStatus =
  | 'idle'
  | 'forking'
  | 'cloning'
  | 'setting_up_remotes'
  | 'creating_branch'
  | 'complete'
  | 'error';

interface WorkflowState {
  status: WorkflowStatus;
  progress: number;
  error: string | null;
  contribution: Contribution | null;
}

export function useContributionWorkflow() {
  const [state, setState] = useState<WorkflowState>({
    status: 'idle',
    progress: 0,
    error: null,
    contribution: null,
  });

  const { createContribution } = useContributionsStore();
  const { defaultClonePath } = useSettingsStore();

  const startWorkflow = async (issue: GitHubIssue): Promise<Contribution> => {
    try {
      // Step 1: Fork repository (25% progress)
      setState({ status: 'forking', progress: 25, error: null, contribution: null });
      const fork = await ipc.invoke('github:fork-repository', issue.repository);

      // Step 2: Clone to local (50% progress)
      setState({ status: 'cloning', progress: 50, error: null, contribution: null });

      // Determine unique local path
      let localPath = `${defaultClonePath}/${fork?.name || 'repo'}`;
      let counter = 1;

      // Check if directory already exists, if so append a number
      while (await ipc.invoke('fs:directory-exists', localPath)) {
        localPath = `${defaultClonePath}/${fork?.name || 'repo'}-${counter}`;
        counter++;
      }

      await ipc.invoke('git:clone', fork?.url || '', localPath);

      // Step 3: Setup remotes (75% progress)
      setState({ status: 'setting_up_remotes', progress: 75, error: null, contribution: null });
      const originalRepoUrl = `https://github.com/${issue.repository}.git`;
      await ipc.invoke('git:add-remote', localPath, 'upstream', originalRepoUrl);

      // Step 4: Create feature branch (85% progress)
      setState({ status: 'creating_branch', progress: 85, error: null, contribution: null });
      const branchName = generateBranchName(issue);
      await ipc.invoke('git:create-branch', localPath, branchName);
      await ipc.invoke('git:checkout', localPath, branchName);

      // Step 5: Save to database (100% progress)
      const contribution = await createContribution({
        repositoryUrl: fork?.url || '',
        localPath,
        issueNumber: issue.number,
        issueTitle: issue.title,
        branchName,
        status: 'in_progress',
        upstreamUrl: originalRepoUrl,
        isFork: true,
        remotesValid: true, // We just set them up, so they're valid
      });

      setState({ status: 'complete', progress: 100, error: null, contribution });
      return contribution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState({ status: 'error', progress: 0, error: errorMessage, contribution: null });

      // Rollback: Clean up any partial state
      await rollback();
      throw error;
    }
  };

  const rollback = async () => {
    // TODO: Implement rollback logic
    // - Delete partially cloned repository
    // - Remove database entry if created
  };

  const reset = () => {
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      contribution: null,
    });
  };

  return { state, startWorkflow, reset };
}
