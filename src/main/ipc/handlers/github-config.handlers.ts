/**
 * GitHub Config IPC Handlers
 *
 * Registers handlers for github-config:* channels.
 */
import { handleIpc } from '../handlers';
import { githubConfigService } from '../../services/github-config.service';

export function setupGitHubConfigHandlers(): void {
  handleIpc('github-config:scan', async (_event, workingDirectory) => {
    return await githubConfigService.scan(workingDirectory);
  });

  handleIpc('github-config:read-file', async (_event, workingDirectory, relativePath) => {
    return await githubConfigService.readFile(workingDirectory, relativePath);
  });

  handleIpc('github-config:write-file', async (_event, workingDirectory, relativePath, content) => {
    return await githubConfigService.writeFile(workingDirectory, relativePath, content);
  });

  handleIpc('github-config:delete-file', async (_event, workingDirectory, relativePath) => {
    return await githubConfigService.deleteFile(workingDirectory, relativePath);
  });

  handleIpc(
    'github-config:create-from-template',
    async (_event, workingDirectory, featureId, templateId) => {
      return await githubConfigService.createFromTemplate(workingDirectory, featureId, templateId);
    }
  );

  handleIpc('github-config:list-templates', async (_event, featureId) => {
    return githubConfigService.listTemplates(featureId);
  });

  handleIpc('github-config:list-issue-templates', async (_event, workingDirectory) => {
    return await githubConfigService.listIssueTemplates(workingDirectory);
  });
}
