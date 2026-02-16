import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { IpcChannels } from './channels';

/**
 * Type-safe IPC handler wrapper
 *
 * Registers an IPC handler with type safety for both parameters and return type
 */
export function handleIpc<K extends keyof IpcChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<IpcChannels[K]>
  ) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
): void {
  // Type assertion needed for Electron's generic handler signature
  ipcMain.handle(channel, handler as Parameters<typeof ipcMain.handle>[1]);
}

/**
 * Remove an IPC handler
 */
export function removeIpcHandler(channel: keyof IpcChannels): void {
  ipcMain.removeHandler(channel);
}

/**
 * Remove all IPC handlers
 */
export function removeAllIpcHandlers(): void {
  // Get all channels from IpcChannels interface
  const channels: (keyof IpcChannels)[] = [
    'echo',
    // File System
    'fs:read-directory',
    'fs:read-file',
    'fs:write-file',
    'fs:delete-file',
    'fs:delete-directory',
    'fs:rename-file',
    'fs:reveal-in-explorer',
    'fs:directory-exists',
    // Git
    'git:status',
    'git:log',
    'git:add',
    'git:commit',
    'git:get-branches',
    'git:get-remote-branches',
    'git:push',
    'git:pull',
    'git:clone',
    'git:checkout',
    'git:create-branch',
    'git:get-current-branch',
    'git:compare-branches',
    'git:add-remote',
    'git:get-remotes',
    // GitHub
    'github:get-authenticated-user',
    'github:search-issues',
    'github:get-repository',
    'github:validate-token',
    'github:fork-repository',
    'github:get-repository-tree',
    'github:list-pull-requests',
    'github:get-pull-request',
    'github:list-pr-comments',
    'github:list-pr-reviews',
    'github:list-pr-review-comments',
    'github:create-pr-comment',
    'github:list-issues',
    'github:get-issue',
    'github:list-issue-comments',
    'github:create-issue-comment',
    'github:update-issue',
    'github:create-issue',
    'github:create-pull-request',
    'github:merge-pull-request',
    'github:close-pull-request',
    // Reactions
    'github:list-issue-reactions',
    'github:add-issue-reaction',
    'github:delete-issue-reaction',
    'github:list-comment-reactions',
    'github:add-comment-reaction',
    'github:delete-comment-reaction',
    // Sub-Issues
    'github:list-sub-issues',
    'github:create-sub-issue',
    'github:add-existing-sub-issue',
    // Contributions
    'contribution:create',
    'contribution:get-all',
    'contribution:get-by-id',
    'contribution:update',
    'contribution:delete',
    'contribution:scan-directory',
    'contribution:sync-with-github',
    // Projects
    'project:scan-directory',
    // Settings
    'settings:get',
    'settings:update',
    // GitIgnore
    'gitignore:is-ignored',
    'gitignore:get-patterns',
    // Dialog
    'dialog:open-directory',
    // Shell
    'shell:execute',
    'shell:open-external',
    'shell:launch-app',
    // Spotify
    'spotify:is-connected',
    'spotify:start-auth',
    'spotify:disconnect',
    'spotify:get-playback-state',
    'spotify:play',
    'spotify:pause',
    'spotify:next',
    'spotify:previous',
    'spotify:set-shuffle',
    'spotify:set-volume',
    'spotify:get-playlists',
    'spotify:play-playlist',
    'spotify:search',
    'spotify:add-to-queue',
    'spotify:save-track',
    'spotify:remove-track',
    'spotify:is-track-saved',
    'spotify:seek',
    // Discord
    'discord:is-connected',
    'discord:connect',
    'discord:disconnect',
    'discord:get-user',
    'discord:get-guilds',
    'discord:get-guild-channels',
    'discord:get-guild-emojis',
    'discord:get-dm-channels',
    'discord:get-messages',
    'discord:send-message',
    'discord:edit-message',
    'discord:delete-message',
    'discord:add-reaction',
    'discord:remove-reaction',
    'discord:get-channel',
    'discord:typing',
    'discord:get-pinned-messages',
    'discord:create-dm',
    'discord:send-message-with-attachments',
    'discord:search-gifs',
    'discord:trending-gifs',
    'discord:get-sticker-packs',
    'discord:get-guild-stickers',
    'discord:send-sticker',
    'discord:create-poll',
    'discord:get-forum-threads',
    'discord:get-thread-messages',
    'discord:send-thread-message',
    'discord:create-forum-thread',
    // Documentation
    'docs:get-structure',
    // Code Server
    'code-server:start',
    'code-server:stop',
    'code-server:status',
    // Updater
    'updater:check',
    'updater:download',
    'updater:install',
    'updater:get-status',
    'updater:get-version',
  ];

  channels.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}

/**
 * Send event to all renderer windows
 */
export function sendToRenderer(
  window: Electron.BrowserWindow,
  channel: string,
  ...args: unknown[]
): void {
  window.webContents.send(channel, ...args);
}
