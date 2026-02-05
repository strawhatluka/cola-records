import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { handleIpc, removeAllIpcHandlers } from './ipc';
import { database } from './database';
import {
  fileSystemService,
  gitService,
  gitIgnoreService,
  gitHubService,
} from './services';
import { gitHubGraphQLService } from './services/github-graphql.service';
import { codeServerService } from './services/code-server.service';
import { spotifyService } from './services/spotify.service';
import { discordService } from './services/discord.service';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const setupIpcHandlers = () => {
  // Echo test handler
  handleIpc('echo', async (_event, message) => {
    return `Echo: ${message}`;
  });

  // File System handlers
  handleIpc('fs:read-directory', async (_event, dirPath) => {
    return await fileSystemService.readDirectory(dirPath);
  });

  handleIpc('fs:read-file', async (_event, filePath) => {
    return await fileSystemService.readFile(filePath);
  });

  handleIpc('fs:write-file', async (_event, filePath, content) => {
    await fileSystemService.writeFile(filePath, content);
  });

  handleIpc('fs:delete-file', async (_event, filePath) => {
    await fileSystemService.deleteFile(filePath);
  });

  handleIpc('fs:rename-file', async (_event, oldPath, newPath) => {
    await fileSystemService.moveFile(oldPath, newPath);
  });

  handleIpc('fs:reveal-in-explorer', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });

  handleIpc('fs:directory-exists', async (_event, dirPath) => {
    const fs = await import('fs');
    return fs.existsSync(dirPath);
  });

  handleIpc('fs:delete-directory', async (_event, dirPath) => {
    const fs = await import('fs');
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });

  // Git handlers
  handleIpc('git:status', async (_event, repoPath) => {
    return await gitService.getStatus(repoPath);
  });

  handleIpc('git:log', async (_event, repoPath, limit) => {
    return await gitService.getLog(repoPath, limit);
  });

  handleIpc('git:add', async (_event, repoPath, files) => {
    await gitService.add(repoPath, files);
  });

  handleIpc('git:commit', async (_event, repoPath, message) => {
    await gitService.commit(repoPath, message);
  });

  handleIpc('git:push', async (_event, repoPath, remote, branch) => {
    await gitService.push(repoPath, remote, branch);
  });

  handleIpc('git:pull', async (_event, repoPath, remote, branch) => {
    await gitService.pull(repoPath, remote, branch);
  });

  handleIpc('git:clone', async (_event, url, targetPath) => {
    await gitService.clone(url, targetPath);
  });

  handleIpc('git:checkout', async (_event, repoPath, branch) => {
    await gitService.checkout(repoPath, branch);
  });

  handleIpc('git:create-branch', async (_event, repoPath, branchName) => {
    await gitService.createBranch(repoPath, branchName);
  });

  handleIpc('git:get-branches', async (_event, repoPath) => {
    return await gitService.getBranches(repoPath);
  });

  handleIpc('git:get-current-branch', async (_event, repoPath) => {
    return await gitService.getCurrentBranch(repoPath);
  });

  handleIpc('git:compare-branches', async (_event, repoPath, base, head) => {
    return await gitService.compareBranches(repoPath, base, head);
  });

  // GitIgnore handlers
  handleIpc('gitignore:is-ignored', async (_event, repoPath, filePath) => {
    return await gitIgnoreService.isIgnored(repoPath, filePath);
  });

  handleIpc('gitignore:get-patterns', async (_event, repoPath) => {
    return await gitIgnoreService.getPatterns(repoPath);
  });

  // Contribution handlers
  handleIpc('contribution:create', async (_event, data) => {
    return database.createContribution(data);
  });

  handleIpc('contribution:get-all', async () => {
    return database.getAllContributions();
  });

  handleIpc('contribution:get-by-id', async (_event, id) => {
    return database.getContributionById(id);
  });

  handleIpc('contribution:update', async (_event, id, data) => {
    return database.updateContribution(id, data);
  });

  handleIpc('contribution:delete', async (_event, id) => {
    const contribution = database.getContributionById(id);
    if (contribution) {
          // Delete the repository directory from file system
      const fs = await import('fs');
      if (fs.existsSync(contribution.localPath)) {
        try {
          fs.rmSync(contribution.localPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch {
          // If immediate deletion fails, try with rimraf-style deletion
          const path = await import('path');
          const deleteRecursive = async (dirPath: string) => {
            if (!fs.existsSync(dirPath)) return;

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);
              if (entry.isDirectory()) {
                await deleteRecursive(fullPath);
              } else {
                // Remove read-only attribute on Windows
                try {
                  fs.chmodSync(fullPath, 0o666);
                } catch {}
                fs.unlinkSync(fullPath);
              }
            }
            fs.rmdirSync(dirPath);
          };

          await deleteRecursive(contribution.localPath);
        }
      }
    }
    database.deleteContribution(id);
  });

  handleIpc('contribution:scan-directory', async (_event, directoryPath) => {
    const { contributionScannerService } = await import('./services/contribution-scanner.service');
    const scanned = await contributionScannerService.scanDirectory(directoryPath);

    // Import scanned contributions into database
    const contributions: any[] = [];
    for (const scannedContribution of scanned) {
      // Check if contribution already exists in database
      const existing = database.getAllContributions().find(
        (c: any) => c.localPath === scannedContribution.localPath
      );

      if (existing) {
        // Update existing contribution with latest metadata and correct createdAt from directory
        const updated = database.updateContribution(existing.id, {
          isFork: scannedContribution.isFork,
          remotesValid: scannedContribution.remotesValid,
          upstreamUrl: scannedContribution.upstreamUrl,
          prUrl: scannedContribution.prUrl,
          prNumber: scannedContribution.prNumber,
          prStatus: scannedContribution.prStatus,
          createdAt: scannedContribution.createdAt,
        });
        contributions.push(updated);
      } else {
        // Create new contribution entry with directory creation date
        const created = database.createContribution({
          repositoryUrl: scannedContribution.repositoryUrl,
          localPath: scannedContribution.localPath,
          issueNumber: scannedContribution.issueNumber || 0,
          issueTitle: scannedContribution.issueTitle || 'Unknown Issue',
          branchName: scannedContribution.branchName,
          status: 'in_progress',
          isFork: scannedContribution.isFork,
          remotesValid: scannedContribution.remotesValid,
          upstreamUrl: scannedContribution.upstreamUrl,
          prUrl: scannedContribution.prUrl,
          prNumber: scannedContribution.prNumber,
          prStatus: scannedContribution.prStatus,
        }, scannedContribution.createdAt);
        contributions.push(created);
      }
    }

    return contributions;
  });

  handleIpc('contribution:sync-with-github', async (_event, contributionId) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    const contribution = database.getContributionById(contributionId);

    if (!contribution) {
      throw new Error(`Contribution not found: ${contributionId}`);
    }

    // Extract owner and repo from repository URL
    const match = contribution.repositoryUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
    if (!match) {
      throw new Error(`Invalid repository URL: ${contribution.repositoryUrl}`);
    }

    const [, owner, repo] = match;

    // Check for open PR with this branch
    const prStatus = await gitHubRestService.checkPRStatus(owner, repo, contribution.branchName);

    // Update contribution with PR details
    const updated = database.updateContribution(contributionId, {
      prUrl: prStatus?.url,
      prNumber: prStatus?.number,
      prStatus: prStatus?.status,
    });

    return updated;
  });

  // Project scanning handler (mirrors contribution:scan-directory with type='project')
  handleIpc('project:scan-directory', async (_event, directoryPath) => {
    const { contributionScannerService } = await import('./services/contribution-scanner.service');
    const scanned = await contributionScannerService.scanDirectory(directoryPath);

    const projects: any[] = [];
    const existingProjects = database.getContributionsByType('project');

    for (const scannedItem of scanned) {
      const existing = existingProjects.find(
        (c: any) => c.localPath === scannedItem.localPath
      );

      if (existing) {
        const updated = database.updateContribution(existing.id, {
          isFork: scannedItem.isFork,
          remotesValid: scannedItem.remotesValid,
          upstreamUrl: scannedItem.upstreamUrl,
          prUrl: scannedItem.prUrl,
          prNumber: scannedItem.prNumber,
          prStatus: scannedItem.prStatus,
          createdAt: scannedItem.createdAt,
        });
        projects.push(updated);
      } else {
        const created = database.createContribution({
          repositoryUrl: scannedItem.repositoryUrl,
          localPath: scannedItem.localPath,
          issueNumber: scannedItem.issueNumber || 0,
          issueTitle: scannedItem.issueTitle || '',
          branchName: scannedItem.branchName,
          status: 'in_progress',
          type: 'project',
          isFork: scannedItem.isFork,
          remotesValid: scannedItem.remotesValid,
          upstreamUrl: scannedItem.upstreamUrl,
          prUrl: scannedItem.prUrl,
          prNumber: scannedItem.prNumber,
          prStatus: scannedItem.prStatus,
        }, scannedItem.createdAt);
        projects.push(created);
      }
    }

    return projects;
  });

  // Settings handlers
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

    let aliases: import('./ipc/channels').Alias[] = [];
    try { aliases = JSON.parse(settings.aliases || '[]'); } catch { aliases = []; }

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
      gitHubGraphQLService.resetClient();
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
    if (updates.defaultProjectsPath !== undefined) {
      database.setSetting('defaultProjectsPath', updates.defaultProjectsPath);
    }
    if (updates.defaultProfessionalProjectsPath !== undefined) {
      database.setSetting('defaultProfessionalProjectsPath', updates.defaultProfessionalProjectsPath);
    }

    // Return updated settings
    const settings = database.getAllSettings();
    let aliases: import('./ipc/channels').Alias[] = [];
    try { aliases = JSON.parse(settings.aliases || '[]'); } catch { aliases = []; }

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
    };
  });

  // GitHub handlers
  handleIpc('github:get-authenticated-user', async () => {
    return await gitHubService.getAuthenticatedUser();
  });

  handleIpc('github:search-issues', async (_event, query, labels) => {
    return await gitHubService.searchIssues(query, labels);
  });

  handleIpc('github:get-repository', async (_event, owner, repo) => {
    return await gitHubService.getRepository(owner, repo);
  });

  handleIpc('github:validate-token', async (_event, token) => {
    return await gitHubService.validateToken(token);
  });
  // Additional GitHub handlers
  handleIpc("github:fork-repository", async (_event, repoFullName) => {
    const [owner, repo] = repoFullName.split("/");
    return await gitHubService.forkRepository(owner, repo);
  });

  // Git remote handlers
  handleIpc("git:add-remote", async (_event, repoPath, remoteName, url) => {
    await gitService.addRemote(repoPath, remoteName, url);
  });

  handleIpc("git:get-remotes", async (_event, repoPath) => {
    return await gitService.getRemotes(repoPath);
  });

  handleIpc("github:list-pull-requests", async (_event, owner, repo, state) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listPullRequests(owner, repo, { state: state || 'all' });
  });

  // PR Detail handlers (WO-004)
  handleIpc("github:get-pull-request", async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.getPullRequest(owner, repo, prNumber);
  });

  handleIpc("github:list-pr-comments", async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listPRComments(owner, repo, prNumber);
  });

  handleIpc("github:list-pr-reviews", async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listPRReviews(owner, repo, prNumber);
  });

  handleIpc("github:list-pr-review-comments", async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listPRReviewComments(owner, repo, prNumber);
  });

  handleIpc("github:create-pr-comment", async (_event, owner, repo, prNumber, body) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.createIssueComment(owner, repo, prNumber, body);
  });

  // Issue Detail handlers (WO-005)
  handleIpc("github:list-issues", async (_event, owner, repo, state) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listIssues(owner, repo, { state: state || 'open' });
  });

  handleIpc("github:get-issue", async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.getIssue(owner, repo, issueNumber);
  });

  handleIpc("github:list-issue-comments", async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listIssueComments(owner, repo, issueNumber);
  });

  handleIpc("github:create-issue-comment", async (_event, owner, repo, issueNumber, body) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.createIssueComment(owner, repo, issueNumber, body);
  });

  handleIpc("github:update-issue", async (_event, owner, repo, issueNumber, updates) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.updateIssue(owner, repo, issueNumber, updates);
  });

  handleIpc("github:create-issue", async (_event, owner, repo, title, body, labels) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.createIssue(owner, repo, title, body, labels);
  });

  handleIpc("github:create-pull-request", async (_event, owner, repo, title, head, base, body) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.createPullRequest(owner, repo, title, head, base, body);
  });

  // Reaction handlers
  handleIpc("github:list-issue-reactions", async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listIssueReactions(owner, repo, issueNumber);
  });

  handleIpc("github:add-issue-reaction", async (_event, owner, repo, issueNumber, content) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.addIssueReaction(owner, repo, issueNumber, content);
  });

  handleIpc("github:delete-issue-reaction", async (_event, owner, repo, issueNumber, reactionId) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.deleteIssueReaction(owner, repo, issueNumber, reactionId);
  });

  handleIpc("github:list-comment-reactions", async (_event, owner, repo, commentId) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listCommentReactions(owner, repo, commentId);
  });

  handleIpc("github:add-comment-reaction", async (_event, owner, repo, commentId, content) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.addCommentReaction(owner, repo, commentId, content);
  });

  handleIpc("github:delete-comment-reaction", async (_event, owner, repo, commentId, reactionId) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.deleteCommentReaction(owner, repo, commentId, reactionId);
  });

  // Sub-issue handlers
  handleIpc("github:list-sub-issues", async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.listSubIssues(owner, repo, issueNumber);
  });

  handleIpc("github:create-sub-issue", async (_event, owner, repo, parentIssueNumber, title, body, labels) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    return await gitHubRestService.createSubIssue(owner, repo, parentIssueNumber, title, body, labels);
  });

  handleIpc("github:add-existing-sub-issue", async (_event, owner, repo, parentIssueNumber, subIssueId) => {
    const { gitHubRestService } = await import('./services/github-rest.service');
    await gitHubRestService.addExistingSubIssue(owner, repo, parentIssueNumber, subIssueId);
  });

  // Dialog handlers
  handleIpc("dialog:open-directory", async () => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Shell handlers
  handleIpc("shell:execute", async (_event, command) => {
    const { shell } = await import("electron");
    await shell.openPath(command);
  });

  handleIpc("shell:open-external", async (_event, url) => {
    await shell.openExternal(url);
  });

  handleIpc("shell:launch-app", async (_event, appName) => {
    const { exec } = await import("child_process");
    const allowedApps: Record<string, string> = {
      chrome: 'start chrome',
      spotify: 'start spotify:',
      discord: 'start discord:',
    };
    const command = allowedApps[appName.toLowerCase()];
    if (command) {
      exec(command);
    }
  });

  handleIpc("github:get-repository-tree", async (_event, owner, repo, branch) => {
    return await gitHubService.getRepositoryTree(owner, repo, branch || "main");
  });

  // Spotify handlers
  handleIpc('spotify:is-connected', async () => {
    return await spotifyService.isConnected();
  });

  handleIpc('spotify:start-auth', async () => {
    await spotifyService.startAuthFlow();
  });

  handleIpc('spotify:disconnect', async () => {
    await spotifyService.disconnect();
  });

  handleIpc('spotify:get-playback-state', async () => {
    return await spotifyService.getPlaybackState();
  });

  handleIpc('spotify:play', async (_event, uri, contextUri) => {
    await spotifyService.play(uri, contextUri);
  });

  handleIpc('spotify:pause', async () => {
    await spotifyService.pause();
  });

  handleIpc('spotify:next', async () => {
    await spotifyService.next();
  });

  handleIpc('spotify:previous', async () => {
    await spotifyService.previous();
  });

  handleIpc('spotify:set-shuffle', async (_event, state) => {
    await spotifyService.setShuffle(state);
  });

  handleIpc('spotify:set-volume', async (_event, volumePercent) => {
    await spotifyService.setVolume(volumePercent);
  });

  handleIpc('spotify:get-playlists', async () => {
    return await spotifyService.getPlaylists();
  });

  handleIpc('spotify:play-playlist', async (_event, playlistUri) => {
    await spotifyService.playPlaylist(playlistUri);
  });

  handleIpc('spotify:search', async (_event, query) => {
    return await spotifyService.search(query);
  });

  handleIpc('spotify:add-to-queue', async (_event, trackUri) => {
    await spotifyService.addToQueue(trackUri);
  });

  handleIpc('spotify:save-track', async (_event, trackId) => {
    await spotifyService.saveTrack(trackId);
  });

  handleIpc('spotify:remove-track', async (_event, trackId) => {
    await spotifyService.removeTrack(trackId);
  });

  handleIpc('spotify:is-track-saved', async (_event, trackId) => {
    return await spotifyService.isTrackSaved(trackId);
  });

  handleIpc('spotify:seek', async (_event, positionMs) => {
    await spotifyService.seek(positionMs);
  });

  // Discord handlers
  handleIpc('discord:is-connected', async () => {
    return await discordService.isConnected();
  });

  handleIpc('discord:connect', async () => {
    return await discordService.connect();
  });

  handleIpc('discord:disconnect', async () => {
    await discordService.disconnect();
  });

  handleIpc('discord:get-user', async () => {
    return await discordService.getUser();
  });

  handleIpc('discord:get-guilds', async () => {
    return await discordService.getGuilds();
  });

  handleIpc('discord:get-guild-channels', async (_event, guildId) => {
    return await discordService.getGuildChannels(guildId);
  });

  handleIpc('discord:get-guild-emojis', async (_event, guildId) => {
    return await discordService.getGuildEmojis(guildId);
  });

  handleIpc('discord:get-dm-channels', async () => {
    return await discordService.getDMChannels();
  });

  handleIpc('discord:get-messages', async (_event, channelId, before, limit) => {
    return await discordService.getMessages(channelId, before, limit);
  });

  handleIpc('discord:send-message', async (_event, channelId, content, replyToId) => {
    return await discordService.sendMessage(channelId, content, replyToId);
  });

  handleIpc('discord:edit-message', async (_event, channelId, messageId, content) => {
    return await discordService.editMessage(channelId, messageId, content);
  });

  handleIpc('discord:delete-message', async (_event, channelId, messageId) => {
    await discordService.deleteMessage(channelId, messageId);
  });

  handleIpc('discord:add-reaction', async (_event, channelId, messageId, emoji) => {
    await discordService.addReaction(channelId, messageId, emoji);
  });

  handleIpc('discord:remove-reaction', async (_event, channelId, messageId, emoji) => {
    await discordService.removeReaction(channelId, messageId, emoji);
  });

  handleIpc('discord:get-channel', async (_event, channelId) => {
    return await discordService.getChannel(channelId);
  });

  handleIpc('discord:typing', async (_event, channelId) => {
    await discordService.triggerTyping(channelId);
  });

  handleIpc('discord:get-pinned-messages', async (_event, channelId) => {
    return await discordService.getPinnedMessages(channelId);
  });

  handleIpc('discord:create-dm', async (_event, userId) => {
    return await discordService.createDM(userId);
  });

  handleIpc('discord:send-message-with-attachments', async (_event, channelId, content, files, replyToId) => {
    return await discordService.sendMessageWithAttachments(channelId, content, files, replyToId);
  });

  handleIpc('discord:search-gifs', async (_event, query) => {
    return await discordService.searchGifs(query);
  });

  handleIpc('discord:trending-gifs', async () => {
    return await discordService.getTrendingGifs();
  });

  handleIpc('discord:get-sticker-packs', async () => {
    return await discordService.getStickerPacks();
  });

  handleIpc('discord:get-guild-stickers', async (_event, guildId) => {
    return await discordService.getGuildStickers(guildId);
  });

  handleIpc('discord:send-sticker', async (_event, channelId, stickerId) => {
    return await discordService.sendSticker(channelId, stickerId);
  });

  handleIpc('discord:create-poll', async (_event, channelId, question, answers, duration, allowMultiselect) => {
    return await discordService.createPoll(channelId, question, answers, duration, allowMultiselect);
  });

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

};

const initializeServices = async () => {
  // Initialize database
  await database.initialize();
};

const createWindow = () => {
  // Determine preload path based on environment
  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(process.cwd(), '.vite/build/preload.js');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: preloadPath,
    },
  });

  // Set main window reference

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  await initializeServices();
  setupIpcHandlers();
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked and no windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up code-server container, IPC handlers, and database before quit.
// Uses a shared cleanup function for both will-quit and process signals (Ctrl+C).
let cleanupDone = false;
async function cleanup(): Promise<void> {
  if (cleanupDone) return;
  cleanupDone = true;
  try {
    await codeServerService.stop();
  } catch {
    // Cleanup stop failure is non-critical
  }
  spotifyService.cleanup();
  discordService.cleanup();
  removeAllIpcHandlers();
  database.close();
}

app.on('will-quit', (e) => {
  if (cleanupDone) return; // Already cleaned up — let it quit
  e.preventDefault();
  cleanup().finally(() => app.quit());
});

// Handle Ctrl+C / SIGTERM so the container is stopped even when
// the app is killed from the terminal.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    cleanup().finally(() => process.exit(0));
  });
}

// Declare Vite environment variables for TypeScript
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
