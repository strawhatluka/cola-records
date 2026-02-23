import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import electronSquirrelStartup from 'electron-squirrel-startup';
import { removeAllIpcHandlers } from './ipc';
import { setupIpcHandlers } from './ipc/handlers/index';
import { database } from './database';
import { codeServerService } from './services/code-server.service';
import { terminalService } from './services/terminal.service';
import { spotifyService } from './services/spotify.service';
import { discordService } from './services/discord.service';
import { scannerPool } from './workers/scanner-pool';
import { updaterService } from './services/updater.service';
import { gitAskPassService } from './services/git-askpass.service';

// Use separate user data directory in development to avoid cache conflicts with production
if (!app.isPackaged) {
  const devUserData = app.getPath('userData') + '-dev';
  app.setPath('userData', devUserData);
}

// GPU acceleration flags (must be set before app.ready)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (electronSquirrelStartup) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

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

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Open external links in the user's default browser
  // Intercept navigation attempts to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation to the app's own URLs (dev server or file://)
    const appUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL || 'file://';
    if (!url.startsWith(appUrl) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Initialize auto-updater (only runs in production)
  updaterService.initialize(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Redirect external links from ALL webContents (including code-server webview)
// to the user's default browser instead of opening Electron windows
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  await initializeServices();
  gitAskPassService.initialize();
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
  terminalService.cleanup();
  gitAskPassService.cleanup();
  spotifyService.cleanup();
  discordService.cleanup();
  scannerPool.terminate();
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
