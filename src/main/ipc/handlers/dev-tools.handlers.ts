/**
 * Dev Tools IPC Handlers
 *
 * Registers handlers for: code-server:*, terminal:*,
 * dev-scripts:*, updater:*, dev-tools:*
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { handleIpc } from '../handlers';
import { codeServerService } from '../../services/code-server.service';
import { terminalService } from '../../services/terminal.service';
import { database } from '../../database';
import { updaterService } from '../../services/updater.service';
import { projectDetectionService } from '../../services/project-detection.service';
import { diskUsageService } from '../../services/disk-usage.service';
import { envScannerService } from '../../services/env-scanner.service';
import { envFileService } from '../../services/env-file.service';
import { hooksService } from '../../services/hooks.service';
import { editorconfigService } from '../../services/editorconfig.service';
import { formatConfigService } from '../../services/format-config.service';
import { testConfigService } from '../../services/test-config.service';
import { coverageConfigService } from '../../services/coverage-config.service';

export function setupDevToolsHandlers(): void {
  // Code Server handlers
  handleIpc('code-server:start', async (_event, projectPath) => {
    return await codeServerService.start(projectPath);
  });

  handleIpc('code-server:stop', async () => {
    await codeServerService.stop();
  });

  handleIpc('code-server:status', async () => {
    return codeServerService.getStatus();
  });

  // Code Server Workspace Management handlers (Multi-Project Support)
  handleIpc('code-server:add-workspace', async (_event, projectPath) => {
    // Returns URL with ?folder= parameter pointing to the project
    return await codeServerService.addWorkspace(projectPath);
  });

  handleIpc('code-server:remove-workspace', async (_event, projectPath) => {
    const result = await codeServerService.removeWorkspace(projectPath);
    if (result.shouldStop) {
      await codeServerService.stop();
    }
    return result;
  });

  handleIpc('code-server:get-mounted-projects', async () => {
    return codeServerService.getMountedProjects();
  });

  handleIpc('code-server:get-stats', async () => {
    return await codeServerService.getContainerStats();
  });

  // Terminal handlers
  handleIpc('terminal:spawn', async (_event, shellType, workingDirectory) => {
    return terminalService.spawn(shellType, workingDirectory);
  });

  handleIpc('terminal:write', async (_event, terminalId, data) => {
    terminalService.write(terminalId, data);
  });

  handleIpc('terminal:resize', async (_event, terminalId, cols, rows) => {
    terminalService.resize(terminalId, cols, rows);
  });

  handleIpc('terminal:kill', async (_event, terminalId) => {
    terminalService.kill(terminalId);
  });

  handleIpc('terminal:get-buffer', async (_event, terminalId) => {
    return terminalService.getOutputBuffer(terminalId);
  });

  // Dev Scripts handlers
  handleIpc('dev-scripts:get-all', async (_event, projectPath) => {
    return database.getDevScripts(projectPath);
  });

  handleIpc('dev-scripts:save', async (_event, script) => {
    database.saveDevScript(script);
  });

  handleIpc('dev-scripts:delete', async (_event, id) => {
    database.deleteDevScript(id);
  });

  // Updater handlers
  handleIpc('updater:check', async () => {
    const info = await updaterService.checkForUpdates();
    if (!info) return null;
    return {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes:
        typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => `${n.version}: ${n.note}`).join('\n')
            : undefined,
    };
  });

  handleIpc('updater:download', async () => {
    await updaterService.downloadUpdate();
  });

  handleIpc('updater:install', async () => {
    updaterService.quitAndInstall();
  });

  handleIpc('updater:get-status', async () => {
    return updaterService.getStatus();
  });

  handleIpc('updater:get-version', async () => {
    return updaterService.getVersion();
  });

  // Dev Tools — Project Detection & Set Up handlers
  handleIpc('dev-tools:detect-project', async (_event, workingDirectory) => {
    return await projectDetectionService.detect(workingDirectory);
  });

  handleIpc('dev-tools:get-install-command', async (_event, workingDirectory) => {
    const info = await projectDetectionService.detect(workingDirectory);
    return projectDetectionService.getInstallCommand(info.packageManager);
  });

  handleIpc('dev-tools:get-typecheck-command', async (_event, workingDirectory) => {
    const info = await projectDetectionService.detect(workingDirectory);
    return projectDetectionService.getTypecheckCommand(info.ecosystem);
  });

  handleIpc('dev-tools:get-git-init-command', async () => {
    return projectDetectionService.getGitInitCommand();
  });

  handleIpc('dev-tools:get-hooks-command', async (_event, workingDirectory) => {
    const info = await projectDetectionService.detect(workingDirectory);
    return projectDetectionService.getHookInstallCommand(info.hookTool);
  });

  handleIpc('dev-tools:setup-env-file', async (_event, workingDirectory) => {
    const envPath = path.join(workingDirectory, '.env');
    const examplePath = path.join(workingDirectory, '.env.example');

    try {
      const envExists = await fs
        .access(envPath)
        .then(() => true)
        .catch(() => false);
      if (envExists) {
        return { success: false, message: '.env file already exists' };
      }

      const exampleExists = await fs
        .access(examplePath)
        .then(() => true)
        .catch(() => false);
      if (exampleExists) {
        await fs.copyFile(examplePath, envPath);
        return { success: true, message: 'Created .env from .env.example' };
      }

      await fs.writeFile(envPath, '# Environment Variables\n', 'utf-8');
      return { success: true, message: 'Created empty .env file' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Failed to create .env: ${msg}` };
    }
  });

  handleIpc('dev-tools:get-clean-targets', async (_event, workingDirectory) => {
    const info = await projectDetectionService.detect(workingDirectory);
    return await projectDetectionService.getCleanTargets(workingDirectory, info.ecosystem);
  });

  handleIpc('dev-tools:disk-usage', async (_event, workingDirectory) => {
    return await diskUsageService.scan(workingDirectory);
  });

  handleIpc('dev-tools:project-info', async (_event, workingDirectory) => {
    return await projectDetectionService.detect(workingDirectory);
  });

  // Dev Tools — Env File Management handlers
  handleIpc('dev-tools:scan-env-variables', async (_event, workingDirectory, ecosystem) => {
    return await envScannerService.scan(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:discover-env-files', async (_event, workingDirectory) => {
    return await envFileService.discoverEnvFiles(workingDirectory);
  });

  handleIpc('dev-tools:create-env-example', async (_event, workingDirectory, ecosystem) => {
    return await envFileService.createEnvExample(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:create-env-file', async (_event, workingDirectory, targetName) => {
    return await envFileService.createEnvFile(workingDirectory, targetName);
  });

  handleIpc('dev-tools:read-env-file', async (_event, filePath) => {
    return await envFileService.readEnvFile(filePath);
  });

  handleIpc('dev-tools:write-env-file', async (_event, filePath, content) => {
    return await envFileService.writeEnvFile(filePath, content);
  });

  handleIpc('dev-tools:sync-env-files', async (_event, workingDirectory, ecosystem) => {
    return await envFileService.syncEnvFiles(workingDirectory, ecosystem);
  });

  // Dev Tools — Hooks Management handlers
  handleIpc('dev-tools:detect-hooks', async (_event, workingDirectory, ecosystem) => {
    return await hooksService.detect(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:setup-hook-tool', async (_event, workingDirectory, tool, ecosystem) => {
    return await hooksService.setupHookTool(workingDirectory, tool, ecosystem);
  });

  handleIpc('dev-tools:get-hook-install-cmd', async (_event, tool) => {
    return hooksService.getInstallCommand(tool);
  });

  handleIpc('dev-tools:read-hooks-config', async (_event, workingDirectory, tool) => {
    return await hooksService.readConfig(workingDirectory, tool);
  });

  handleIpc('dev-tools:write-hooks-config', async (_event, workingDirectory, config) => {
    return await hooksService.writeConfig(workingDirectory, config);
  });

  handleIpc('dev-tools:setup-lint-staged', async (_event, workingDirectory, config) => {
    return await hooksService.setupLintStaged(workingDirectory, config);
  });

  handleIpc('dev-tools:get-hook-presets', async (_event, ecosystem, tool) => {
    return hooksService.getPresetActions(ecosystem, tool);
  });

  handleIpc('dev-tools:get-lint-staged-presets', async (_event, ecosystem) => {
    return hooksService.getLintStagedPresets(ecosystem);
  });

  // Dev Tools — EditorConfig Management handlers
  handleIpc('dev-tools:read-editorconfig', async (_event, workingDirectory) => {
    return await editorconfigService.readConfig(workingDirectory);
  });

  handleIpc('dev-tools:write-editorconfig', async (_event, workingDirectory, config) => {
    return await editorconfigService.writeConfig(workingDirectory, config);
  });

  handleIpc('dev-tools:create-editorconfig', async (_event, workingDirectory, ecosystem) => {
    return await editorconfigService.createDefault(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:delete-editorconfig', async (_event, workingDirectory) => {
    return await editorconfigService.deleteConfig(workingDirectory);
  });

  handleIpc('dev-tools:get-editorconfig-presets', async (_event, ecosystem) => {
    return editorconfigService.getPresets(ecosystem);
  });

  // Dev Tools — Format Config Management handlers
  handleIpc('dev-tools:detect-formatter', async (_event, workingDirectory, ecosystem) => {
    return await formatConfigService.detectFormatter(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:read-format-config', async (_event, configPath, formatter) => {
    return await formatConfigService.readConfig(configPath, formatter);
  });

  handleIpc(
    'dev-tools:write-format-config',
    async (_event, workingDirectory, formatter, config) => {
      return await formatConfigService.writeConfig(workingDirectory, formatter, config);
    }
  );

  handleIpc('dev-tools:get-format-presets', async (_event, ecosystem, formatter) => {
    return formatConfigService.getPresets(ecosystem, formatter);
  });

  handleIpc('dev-tools:create-format-ignore', async (_event, workingDirectory, formatter) => {
    return await formatConfigService.createIgnoreFile(workingDirectory, formatter);
  });

  handleIpc('dev-tools:read-format-ignore', async (_event, workingDirectory, formatter) => {
    return await formatConfigService.readIgnoreFile(workingDirectory, formatter);
  });

  handleIpc(
    'dev-tools:write-format-ignore',
    async (_event, workingDirectory, formatter, content) => {
      return await formatConfigService.writeIgnoreFile(workingDirectory, formatter, content);
    }
  );

  // Dev Tools — Test Config Management handlers
  handleIpc('dev-tools:detect-test-framework', async (_event, workingDirectory, ecosystem) => {
    return await testConfigService.detectTestFramework(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:read-test-config', async (_event, configPath, framework) => {
    return await testConfigService.readConfig(configPath, framework);
  });

  handleIpc('dev-tools:write-test-config', async (_event, workingDirectory, framework, config) => {
    return await testConfigService.writeConfig(workingDirectory, framework, config);
  });

  handleIpc('dev-tools:get-test-presets', async (_event, ecosystem, framework) => {
    return testConfigService.getPresets(ecosystem, framework);
  });

  // Dev Tools — Coverage Config Management handlers
  handleIpc('dev-tools:detect-coverage', async (_event, workingDirectory, ecosystem) => {
    return await coverageConfigService.detectCoverage(workingDirectory, ecosystem);
  });

  handleIpc('dev-tools:read-coverage-config', async (_event, configPath, provider) => {
    return await coverageConfigService.readConfig(configPath, provider);
  });

  handleIpc(
    'dev-tools:write-coverage-config',
    async (_event, workingDirectory, provider, config) => {
      return await coverageConfigService.writeConfig(workingDirectory, provider, config);
    }
  );

  handleIpc('dev-tools:get-coverage-presets', async (_event, ecosystem, provider) => {
    return coverageConfigService.getPresets(ecosystem, provider);
  });

  handleIpc('dev-tools:open-coverage-report', async (_event, reportPath) => {
    return await coverageConfigService.openReport(reportPath);
  });
}
