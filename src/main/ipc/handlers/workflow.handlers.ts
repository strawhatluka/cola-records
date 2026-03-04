/**
 * Workflow IPC Handlers
 *
 * Registers handlers for: workflow:*, version:*, cli:* channels.
 * Delegates to workflowService, versionService, cliScannerService.
 */
import { handleIpc } from '../handlers';
import { workflowService } from '../../services/workflow.service';
import { versionService } from '../../services/version.service';
import { cliScannerService } from '../../services/cli-scanner.service';

export function setupWorkflowHandlers(): void {
  // Workflow — AI-powered generation
  handleIpc('workflow:generate-changelog', async (_event, repoPath, issueNumber, branchName) => {
    return await workflowService.generateChangelog(repoPath, issueNumber, branchName);
  });

  handleIpc('workflow:generate-readme-update', async (_event, repoPath) => {
    return await workflowService.generateReadmeUpdate(repoPath);
  });

  handleIpc('workflow:generate-docs-update', async (_event, repoPath) => {
    return await workflowService.generateDocsUpdate(repoPath);
  });

  handleIpc(
    'workflow:generate-commit-message',
    async (_event, repoPath, issueNumber, branchName) => {
      return await workflowService.generateCommitMessage(repoPath, issueNumber, branchName);
    }
  );

  handleIpc(
    'workflow:generate-pr-description',
    async (_event, repoPath, baseBranch, headBranch, issueNumber) => {
      return await workflowService.generatePRDescription(
        repoPath,
        baseBranch,
        headBranch,
        issueNumber
      );
    }
  );

  // Workflow — Apply operations
  handleIpc('workflow:apply-changelog', async (_event, repoPath, entry) => {
    await workflowService.applyChangelog(repoPath, entry);
  });

  handleIpc('workflow:apply-readme', async (_event, repoPath, content) => {
    await workflowService.applyReadme(repoPath, content);
  });

  handleIpc('workflow:apply-docs-update', async (_event, repoPath, update) => {
    await workflowService.applyDocsUpdate(repoPath, update);
  });

  // Version management
  handleIpc('workflow:detect-versions', async (_event, repoPath) => {
    return versionService.detectVersions(repoPath);
  });

  handleIpc('workflow:bump-version', async (_event, current, type) => {
    return versionService.bumpVersion(current, type);
  });

  handleIpc('workflow:update-version', async (_event, repoPath, newVersion, files) => {
    return versionService.updateVersion(repoPath, newVersion, files);
  });

  // CLI scanning
  handleIpc('workflow:scan-clis', async (_event, ecosystem) => {
    return cliScannerService.scanCLIs(ecosystem);
  });

  handleIpc('workflow:get-cli-help', async (_event, cliPath, subcommand) => {
    return await cliScannerService.getCLIHelp(cliPath, subcommand);
  });
}
