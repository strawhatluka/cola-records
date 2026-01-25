import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { handleIpc, removeAllIpcHandlers } from './ipc';
import { database } from './database';
import {
  fileSystemService,
  fileWatcherService,
  gitService,
  gitIgnoreService,
  gitHubService,
} from './services';

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

  handleIpc('fs:watch-directory', async (_event, dirPath) => {
    fileWatcherService.watchDirectory(dirPath);
  });

  handleIpc('fs:unwatch-directory', async (_event, dirPath) => {
    await fileWatcherService.unwatchDirectory(dirPath);
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
    database.deleteContribution(id);
  });

  // Settings handlers
  handleIpc('settings:get', async () => {
    const settings = database.getAllSettings();
    return {
      githubToken: settings.githubToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: settings.defaultClonePath || '',
      autoFetch: settings.autoFetch === 'true',
    };
  });

  handleIpc('settings:update', async (_event, updates) => {
    // Save each setting to database
    if (updates.githubToken !== undefined) {
      database.setSetting('githubToken', updates.githubToken);
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

    // Return updated settings
    const settings = database.getAllSettings();
    return {
      githubToken: settings.githubToken,
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      defaultClonePath: settings.defaultClonePath || '',
      autoFetch: settings.autoFetch === 'true',
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

  // Shell handler
  handleIpc("shell:execute", async (_event, command) => {
    const { shell } = await import("electron");
    await shell.openPath(command);
  });
  handleIpc("github:get-repository-tree", async (_event, owner, repo, branch) => {
    return await gitHubService.getRepositoryTree(owner, repo, branch || "main");
  });

};

const initializeServices = async () => {
  // Initialize database
  await database.initialize();
  console.log('Database initialized');
};

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Set main window reference for file watcher
  fileWatcherService.setMainWindow(mainWindow);

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

// Clean up IPC handlers, file watchers, and database before quit
app.on('will-quit', async () => {
  removeAllIpcHandlers();
  await fileWatcherService.unwatchAll();
  database.close();
});

// Declare Vite environment variables for TypeScript
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
