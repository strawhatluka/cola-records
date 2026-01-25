"use strict";
const electron = require("electron");
const path = require("path");
function handleIpc(channel, handler) {
  electron.ipcMain.handle(channel, handler);
}
function removeAllIpcHandlers() {
  const channels = [
    "echo",
    "fs:read-directory",
    "fs:read-file",
    "fs:write-file",
    "fs:delete-file",
    "fs:watch-directory",
    "fs:unwatch-directory",
    "git:status",
    "git:log",
    "git:add",
    "git:commit",
    "git:push",
    "git:pull",
    "git:clone",
    "git:checkout",
    "git:create-branch",
    "github:search-issues",
    "github:get-repository",
    "github:validate-token",
    "contribution:create",
    "contribution:get-all",
    "contribution:get-by-id",
    "contribution:update",
    "contribution:delete",
    "settings:get",
    "settings:update",
    "gitignore:is-ignored",
    "gitignore:get-patterns"
  ];
  channels.forEach((channel) => {
    electron.ipcMain.removeHandler(channel);
  });
}
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let mainWindow = null;
const setupIpcHandlers = () => {
  handleIpc("echo", async (_event, message) => {
    console.log("Echo received:", message);
    return `Echo: ${message}`;
  });
};
const createWindow = () => {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  {
    mainWindow.loadURL("http://localhost:5173");
  }
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};
electron.app.on("ready", () => {
  setupIpcHandlers();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.on("will-quit", () => {
  removeAllIpcHandlers();
});
