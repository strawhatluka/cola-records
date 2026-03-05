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
  // Complete list of all channels from IpcChannels interface.
  // Grouped by domain to match handler module organisation.
  const channels: (keyof IpcChannels)[] = [
    // ── Echo ──
    'echo',
    // ── File System ──
    'fs:read-directory',
    'fs:read-file',
    'fs:write-file',
    'fs:delete-file',
    'fs:delete-directory',
    'fs:rename-file',
    'fs:reveal-in-explorer',
    'fs:directory-exists',
    // ── Git ──
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
    'git:delete-branch',
    'git:get-branch-info',
    'git:add-remote',
    'git:get-remotes',
    'git:diff',
    'git:diff-staged',
    'git:tag',
    'git:push-tags',
    // ── GitIgnore ──
    'gitignore:is-ignored',
    'gitignore:get-patterns',
    // ── GitHub ──
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
    'github:create-review-comment-reply',
    'github:list-review-comment-reactions',
    'github:add-review-comment-reaction',
    'github:delete-review-comment-reaction',
    'github:get-pr-review-threads',
    'github:resolve-review-thread',
    'github:unresolve-review-thread',
    'github:list-pr-commits',
    'github:list-pr-events',
    'github:list-issues',
    'github:get-issue',
    'github:add-assignees',
    'github:list-issue-comments',
    'github:create-issue-comment',
    'github:update-issue',
    'github:create-issue',
    'github:create-pull-request',
    'github:merge-pull-request',
    'github:close-pull-request',
    // ── GitHub Reactions ──
    'github:list-issue-reactions',
    'github:add-issue-reaction',
    'github:delete-issue-reaction',
    'github:list-comment-reactions',
    'github:add-comment-reaction',
    'github:delete-comment-reaction',
    // ── GitHub Sub-Issues ──
    'github:list-sub-issues',
    'github:create-sub-issue',
    'github:add-existing-sub-issue',
    // ── GitHub Actions ──
    'github:list-workflow-runs',
    'github:list-workflow-run-jobs',
    'github:get-job-logs',
    // ── GitHub Releases ──
    'github:list-releases',
    'github:get-release',
    'github:create-release',
    'github:update-release',
    'github:delete-release',
    'github:publish-release',
    // ── GitHub Search & User ──
    'github:search-issues-and-prs',
    'github:list-user-events',
    'github:list-user-repos',
    // ── GitHub PR Status ──
    'github:get-pr-check-status',
    // ── Contributions ──
    'contribution:create',
    'contribution:get-all',
    'contribution:get-by-id',
    'contribution:update',
    'contribution:delete',
    'contribution:scan-directory',
    'contribution:sync-with-github',
    // ── Projects ──
    'project:scan-directory',
    // ── Settings ──
    'settings:get',
    'settings:update',
    'settings:get-ssh-remotes',
    'settings:save-ssh-remotes',
    // ── Dialog ──
    'dialog:open-directory',
    // ── Shell ──
    'shell:execute',
    'shell:open-external',
    'shell:launch-app',
    // ── Documentation ──
    'docs:get-structure',
    // ── Spotify ──
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
    // ── Discord ──
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
    // ── Code Server ──
    'code-server:start',
    'code-server:stop',
    'code-server:status',
    'code-server:add-workspace',
    'code-server:remove-workspace',
    'code-server:get-mounted-projects',
    'code-server:get-stats',
    // ── Terminal ──
    'terminal:spawn',
    'terminal:write',
    'terminal:resize',
    'terminal:kill',
    // ── Dev Scripts ──
    'dev-scripts:get-all',
    'dev-scripts:save',
    'dev-scripts:delete',
    // ── Updater ──
    'updater:check',
    'updater:download',
    'updater:install',
    'updater:get-status',
    'updater:get-version',
    // ── Dev Tools ──
    'dev-tools:detect-project',
    'dev-tools:get-install-command',
    'dev-tools:get-typecheck-command',
    'dev-tools:get-git-init-command',
    'dev-tools:get-hooks-command',
    'dev-tools:setup-env-file',
    'dev-tools:get-clean-targets',
    'dev-tools:disk-usage',
    'dev-tools:project-info',
    'dev-tools:scan-env-variables',
    'dev-tools:discover-env-files',
    'dev-tools:create-env-example',
    'dev-tools:create-env-file',
    'dev-tools:read-env-file',
    'dev-tools:write-env-file',
    'dev-tools:sync-env-files',
    'dev-tools:detect-hooks',
    'dev-tools:setup-hook-tool',
    'dev-tools:get-hook-install-cmd',
    'dev-tools:read-hooks-config',
    'dev-tools:write-hooks-config',
    'dev-tools:setup-lint-staged',
    'dev-tools:get-hook-presets',
    'dev-tools:get-lint-staged-presets',
    'dev-tools:read-editorconfig',
    'dev-tools:write-editorconfig',
    'dev-tools:create-editorconfig',
    'dev-tools:delete-editorconfig',
    'dev-tools:get-editorconfig-presets',
    'dev-tools:detect-formatter',
    'dev-tools:read-format-config',
    'dev-tools:write-format-config',
    'dev-tools:get-format-presets',
    'dev-tools:create-format-ignore',
    'dev-tools:read-format-ignore',
    'dev-tools:write-format-ignore',
    'dev-tools:detect-test-framework',
    'dev-tools:read-test-config',
    'dev-tools:write-test-config',
    'dev-tools:get-test-presets',
    'dev-tools:detect-coverage',
    'dev-tools:read-coverage-config',
    'dev-tools:write-coverage-config',
    'dev-tools:get-coverage-presets',
    'dev-tools:open-coverage-report',
    'dev-tools:detect-build-tool',
    'dev-tools:read-build-config',
    'dev-tools:write-build-config',
    'dev-tools:get-build-presets',
    'dev-tools:detect-linter',
    'dev-tools:read-lint-config',
    'dev-tools:write-lint-config',
    'dev-tools:get-lint-presets',
    // ── AI ──
    'ai:complete',
    'ai:test-connection',
    'ai:get-config',
    // ── Workflow ──
    'workflow:generate-changelog',
    'workflow:generate-commit-message',
    'workflow:apply-changelog',
    'workflow:detect-versions',
    'workflow:bump-version',
    'workflow:update-version',
    'workflow:scan-clis',
    'workflow:get-cli-help',
    // ── Notifications ──
    'notification:add',
    'notification:get-all',
    'notification:mark-read',
    'notification:mark-all-read',
    'notification:dismiss',
    'notification:clear-all',
    'notification:get-preferences',
    'notification:update-preferences',
    'notification:get-unread-count',
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
