/**
 * Dev Tools IPC Handlers
 *
 * Registers handlers for: code-server:*, terminal:*,
 * dev-scripts:*, updater:*
 */
import { handleIpc } from '../handlers';
import { codeServerService } from '../../services/code-server.service';
import { terminalService } from '../../services/terminal.service';
import { database } from '../../database';
import { updaterService } from '../../services/updater.service';

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
}
