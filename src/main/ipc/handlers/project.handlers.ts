/**
 * Project IPC Handlers
 *
 * Registers handlers for: project:check-cli-tools, project:scaffold,
 * project:scaffold-database, project:get-orm-options,
 * project:create-github-repo, project:initialize-git,
 * project:validate-package-manager, project:install-tool
 */
import { handleIpc } from '../handlers';

export function setupProjectHandlers(): void {
  handleIpc('project:check-cli-tools', async (_event, ecosystem, isMonorepo, monorepoTool) => {
    const { cliDetectionService } = await import('../../services/cli-detection.service');
    return cliDetectionService.detectEcosystemTools(ecosystem, isMonorepo, monorepoTool);
  });

  handleIpc('project:validate-package-manager', async (_event, _ecosystem, packageManager) => {
    const { cliDetectionService } = await import('../../services/cli-detection.service');
    return cliDetectionService.detectTool(packageManager);
  });

  handleIpc('project:install-tool', async (_event, toolName) => {
    const { cliDetectionService } = await import('../../services/cli-detection.service');
    return cliDetectionService.installTool(toolName);
  });

  handleIpc('project:scaffold', async (_event, config) => {
    const { projectScaffoldService } = await import('../../services/project-scaffold.service');
    return projectScaffoldService.scaffold(config);
  });

  handleIpc('project:scaffold-database', async (_event, config) => {
    const { databaseScaffoldService } = await import('../../services/database-scaffold.service');
    return databaseScaffoldService.scaffoldDatabase(config);
  });

  handleIpc('project:get-orm-options', async (_event, ecosystem, engine) => {
    const { databaseScaffoldService } = await import('../../services/database-scaffold.service');
    return databaseScaffoldService.getORMOptions(ecosystem, engine);
  });

  handleIpc('project:create-github-repo', async (_event, name, options) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return gitHubRestService.createRepository(name, options);
  });

  handleIpc('project:initialize-git', async (_event, projectPath, remoteName, remoteUrl) => {
    const { gitService } = await import('../../services');
    await gitService.init(projectPath);
    await gitService.createBranch(projectPath, 'main');
    await gitService.add(projectPath, ['.']);
    await gitService.commit(projectPath, 'Initial commit');
    await gitService.createBranch(projectPath, 'dev');
    if (remoteUrl) {
      await gitService.addRemote(projectPath, remoteName || 'origin', remoteUrl);
      await gitService.push(projectPath, remoteName || 'origin', 'main');
      await gitService.push(projectPath, remoteName || 'origin', 'dev');
    }
  });
}
