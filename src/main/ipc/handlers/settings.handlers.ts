/**
 * Settings IPC Handlers
 *
 * Registers handlers for: settings:*, settings:get-ssh-remotes,
 * settings:save-ssh-remotes
 */
import { app } from 'electron';
import path from 'path';
import { handleIpc } from '../handlers';
import { database } from '../../database';

export function setupSettingsHandlers(): void {
  handleIpc('settings:get', async () => {
    const settings = database.getAllSettings();

    // Set default clone path to Documents/Contributions if not set
    let defaultClonePath = settings.defaultClonePath;
    if (!defaultClonePath) {
      const documentsPath = app.getPath('documents');
      defaultClonePath = path.join(documentsPath, 'Contributions');

      // Create the directory if it doesn't exist
      const fs = await import('fs');
      if (!fs.existsSync(defaultClonePath)) {
        fs.mkdirSync(defaultClonePath, { recursive: true });
      }

      // Save it to database for next time
      database.setSetting('defaultClonePath', defaultClonePath);
    }

    // Set default projects path to Documents/My Projects if not set
    let defaultProjectsPath = settings.defaultProjectsPath;
    if (!defaultProjectsPath) {
      const documentsPath = app.getPath('documents');
      defaultProjectsPath = path.join(documentsPath, 'My Projects');

      // Create the directory if it doesn't exist
      const fs2 = await import('fs');
      if (!fs2.existsSync(defaultProjectsPath)) {
        fs2.mkdirSync(defaultProjectsPath, { recursive: true });
      }

      // Save it to database for next time
      database.setSetting('defaultProjectsPath', defaultProjectsPath);
    }

    // Set default professional projects path to Documents/Professional Projects if not set
    let defaultProfessionalProjectsPath = settings.defaultProfessionalProjectsPath;
    if (!defaultProfessionalProjectsPath) {
      const documentsPath3 = app.getPath('documents');
      defaultProfessionalProjectsPath = path.join(documentsPath3, 'Professional Projects');

      // Create the directory if it doesn't exist
      const fs3 = await import('fs');
      if (!fs3.existsSync(defaultProfessionalProjectsPath)) {
        fs3.mkdirSync(defaultProfessionalProjectsPath, { recursive: true });
      }

      // Save it to database for next time
      database.setSetting('defaultProfessionalProjectsPath', defaultProfessionalProjectsPath);
    }

    let aliases: import('../channels').Alias[] = [];
    try {
      aliases = JSON.parse(settings.aliases || '[]');
    } catch {
      aliases = [];
    }

    let bashProfile: import('../channels').BashProfileSettings | undefined;
    try {
      if (settings.bashProfile) {
        bashProfile = JSON.parse(settings.bashProfile);
      }
    } catch {
      bashProfile = undefined;
    }

    let codeServerConfig: import('../channels').CodeServerConfig | undefined;
    try {
      if (settings.codeServerConfig) {
        codeServerConfig = JSON.parse(settings.codeServerConfig);
      }
    } catch {
      codeServerConfig = undefined;
    }

    return {
      githubToken: settings.githubToken,
      spotifyClientId: settings.spotifyClientId,
      discordToken: settings.discordToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: defaultClonePath,
      defaultProjectsPath: defaultProjectsPath,
      defaultProfessionalProjectsPath: defaultProfessionalProjectsPath,
      autoFetch: settings.autoFetch === 'true',
      aliases,
      bashProfile,
      codeServerConfig,
    };
  });

  handleIpc('settings:update', async (_event, updates) => {
    // Save each setting to database
    if (updates.spotifyClientId !== undefined) {
      database.setSetting('spotifyClientId', updates.spotifyClientId || '');
    }
    if (updates.discordToken !== undefined) {
      database.setSetting('discordToken', updates.discordToken || '');
    }
    if (updates.githubToken !== undefined) {
      database.setSetting('githubToken', updates.githubToken);
      // Reset GitHub GraphQL client to use new token
      const { gitHubGraphQLService } = await import('../../services/github-graphql.service');
      gitHubGraphQLService.resetClient();
      // Sync token to ~/.git-credentials for code-server authentication
      const { gitService } = await import('../../services');
      gitService.syncTokenToGitCredentials(updates.githubToken || null);
      // Update askpass token file for terminal Git authentication
      const { gitAskPassService } = await import('../../services/git-askpass.service');
      gitAskPassService.updateToken(updates.githubToken || null);
    }
    if (updates.theme !== undefined) {
      database.setSetting('theme', updates.theme);
    }
    if (updates.defaultClonePath !== undefined) {
      database.setSetting('defaultClonePath', updates.defaultClonePath);
    }
    if (updates.autoFetch !== undefined) {
      database.setSetting('autoFetch', String(updates.autoFetch));
    }
    if (updates.aliases !== undefined) {
      database.setSetting('aliases', JSON.stringify(updates.aliases));
    }
    if (updates.bashProfile !== undefined) {
      database.setSetting('bashProfile', JSON.stringify(updates.bashProfile));
    }
    if (updates.defaultProjectsPath !== undefined) {
      database.setSetting('defaultProjectsPath', updates.defaultProjectsPath);
    }
    if (updates.defaultProfessionalProjectsPath !== undefined) {
      database.setSetting(
        'defaultProfessionalProjectsPath',
        updates.defaultProfessionalProjectsPath
      );
    }
    if (updates.codeServerConfig !== undefined) {
      database.setSetting('codeServerConfig', JSON.stringify(updates.codeServerConfig));
    }

    // Return updated settings
    const settings = database.getAllSettings();
    let aliases: import('../channels').Alias[] = [];
    try {
      aliases = JSON.parse(settings.aliases || '[]');
    } catch {
      aliases = [];
    }

    let bashProfile: import('../channels').BashProfileSettings | undefined;
    try {
      if (settings.bashProfile) {
        bashProfile = JSON.parse(settings.bashProfile);
      }
    } catch {
      bashProfile = undefined;
    }

    let codeServerConfig: import('../channels').CodeServerConfig | undefined;
    try {
      if (settings.codeServerConfig) {
        codeServerConfig = JSON.parse(settings.codeServerConfig);
      }
    } catch {
      codeServerConfig = undefined;
    }

    return {
      githubToken: settings.githubToken,
      spotifyClientId: settings.spotifyClientId,
      discordToken: settings.discordToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: settings.defaultClonePath || '',
      defaultProjectsPath: settings.defaultProjectsPath || '',
      defaultProfessionalProjectsPath: settings.defaultProfessionalProjectsPath || '',
      autoFetch: settings.autoFetch === 'true',
      aliases,
      bashProfile,
      codeServerConfig,
    };
  });

  // SSH Remotes handlers
  handleIpc('settings:get-ssh-remotes', async () => {
    const json = database.getSetting('sshRemotes');
    return json ? JSON.parse(json) : [];
  });

  handleIpc('settings:save-ssh-remotes', async (_event, remotes) => {
    database.setSetting('sshRemotes', JSON.stringify(remotes));
    // Generate SSH config file for container
    const { codeServerService } = await import('../../services/code-server.service');
    codeServerService.syncSSHConfig();
  });
}
