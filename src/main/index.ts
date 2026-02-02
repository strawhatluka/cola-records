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

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const setupIpcHandlers = () => {
  // Echo test handler
  handleIpc('echo', async (_event, message) => {
    console.log('Echo received:', message);
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
        } catch (error) {
          console.error('Failed to delete directory:', error);
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

    let aliases: import('./ipc/channels').Alias[] = [];
    try { aliases = JSON.parse(settings.aliases || '[]'); } catch { aliases = []; }

    return {
      githubToken: settings.githubToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: defaultClonePath,
      autoFetch: settings.autoFetch === 'true',
      aliases,
    };
  });

  handleIpc('settings:update', async (_event, updates) => {
    // Save each setting to database
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

    // Return updated settings
    const settings = database.getAllSettings();
    let aliases: import('./ipc/channels').Alias[] = [];
    try { aliases = JSON.parse(settings.aliases || '[]'); } catch { aliases = []; }

    return {
      githubToken: settings.githubToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: settings.defaultClonePath || '',
      autoFetch: settings.autoFetch === 'true',
      aliases,
    };
  });

  // GitHub handlers
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

  // Git remote handler
  handleIpc("git:add-remote", async (_event, repoPath, remoteName, url) => {
    await gitService.addRemote(repoPath, remoteName, url);
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

  handleIpc("github:get-repository-tree", async (_event, owner, repo, branch) => {
    return await gitHubService.getRepositoryTree(owner, repo, branch || "main");
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
  console.log('Database initialized');
};

const createWindow = () => {
  // Determine preload path based on environment
  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(process.cwd(), '.vite/build/preload.js');

  console.log('Preload path:', preloadPath);
  console.log('process.cwd():', process.cwd());
  console.log('app.isPackaged:', app.isPackaged);

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
  } catch (err) {
    console.error('[cleanup] Failed to stop code-server:', err);
  }
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
    console.log(`[cleanup] Received ${signal}`);
    cleanup().finally(() => process.exit(0));
  });
}

// Declare Vite environment variables for TypeScript
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
