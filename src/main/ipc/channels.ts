/**
 * IPC Channel Definitions
 *
 * This file defines all typed IPC channels for communication between
 * the main and renderer processes. Each channel is a function signature
 * that ensures type safety across the IPC boundary.
 */

// File System Types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
  gitStatus?: 'M' | 'A' | 'D' | 'C' | null;
  isGitIgnored?: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
}

// Git Types
export interface GitStatus {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
}

export interface GitFileStatus {
  path: string;
  index: string;
  working_dir: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

// Branch Comparison Types
export interface DiffFileSummary {
  file: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface BranchComparison {
  commits: GitCommit[];
  files: DiffFileSummary[];
  totalInsertions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  rawDiff: string;
}

// Reaction Types
export type ReactionContent = '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes';

export interface Reaction {
  id: number;
  content: ReactionContent;
  user: string;
}

// Sub-Issue Types
export interface SubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  url: string;
}

// GitHub Types
export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  repository: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  authorAvatarUrl?: string;
}

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  openIssues?: number;
  defaultBranch?: string;
}

// Contribution Types
export interface Contribution {
  id: string;
  repositoryUrl: string;
  localPath: string;
  issueNumber?: number;
  issueTitle?: string;
  branchName: string;
  status: 'in_progress' | 'ready' | 'submitted' | 'merged';
  createdAt: Date;
  updatedAt: Date;
  // Type discriminator: 'contribution' (default) or 'project'
  type?: 'project' | 'contribution';
  // PR tracking fields
  prUrl?: string;
  prNumber?: number;
  prStatus?: 'open' | 'closed' | 'merged';
  // Fork validation fields
  upstreamUrl?: string;
  isFork?: boolean;
  remotesValid?: boolean;
}

// Spotify Types
export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  durationMs: number;
}

export interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
  shuffleState: boolean;
  volumePercent: number;
  deviceName: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  images: { url: string; width: number; height: number }[];
}

// Discord Types
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  channels: DiscordChannel[];
}

export interface ForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emojiId: string | null;
  emojiName: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
  parentId: string | null;
  position: number;
  topic: string | null;
  availableTags: ForumTag[];
}

export interface DiscordThread {
  id: string;
  name: string;
  parentId: string;
  ownerId: string;
  messageCount: number;
  createdTimestamp: string | null;
  archiveTimestamp: string | null;
  archived: boolean;
  locked: boolean;
  lastMessageId: string | null;
  appliedTags: string[];
}

export interface DiscordDMChannel {
  id: string;
  type: number; // 1=DM, 3=group DM
  recipients: DiscordUser[];
  lastMessageId: string | null;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: DiscordUser;
  timestamp: string;
  editedTimestamp: string | null;
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions: DiscordReaction[];
  referencedMessage: DiscordMessage | null;
  mentionEveryone: boolean;
  mentions: DiscordUser[];
  pinned: boolean;
  type: number;
  stickerItems: DiscordStickerItem[];
  poll: DiscordPoll | null;
}

export interface DiscordStickerItem {
  id: string;
  name: string;
  formatType: number; // 1=PNG, 2=APNG, 3=LOTTIE, 4=GIF
}

export interface DiscordSticker {
  id: string;
  name: string;
  description: string | null;
  tags: string;
  formatType: number;
  packId: string | null;
  guildId: string | null;
}

export interface DiscordStickerPack {
  id: string;
  name: string;
  description: string;
  stickers: DiscordSticker[];
  bannerAssetId: string | null;
}

export interface DiscordPollAnswer {
  answerId: number;
  pollMedia: { text: string; emoji?: { id: string | null; name: string } };
}

export interface DiscordPoll {
  question: { text: string };
  answers: DiscordPollAnswer[];
  expiry: string | null;
  allowMultiselect: boolean;
  layoutType: number;
  results?: {
    isFinalized: boolean;
    answerCounts: { id: number; count: number; meVoted: boolean }[];
  };
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  proxyUrl: string;
  size: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}

export interface DiscordEmbed {
  title: string | null;
  description: string | null;
  url: string | null;
  color: number | null;
  type: string | null;
  thumbnail: { url: string; width: number; height: number } | null;
  image: { url: string; width: number; height: number } | null;
  video: { url: string; width: number; height: number } | null;
  author: { name: string; url: string | null; iconUrl: string | null } | null;
  footer: { text: string; iconUrl: string | null } | null;
  timestamp: string | null;
  provider: { name: string; url: string | null } | null;
  fields: { name: string; value: string; inline: boolean }[];
}

export interface DiscordReaction {
  emoji: { id: string | null; name: string };
  count: number;
  me: boolean;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  guildId: string;
}

// Settings Types
export interface Alias {
  name: string;
  command: string;
}

export interface AppSettings {
  githubToken?: string;
  spotifyClientId?: string;
  discordToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  defaultProjectsPath: string;
  defaultProfessionalProjectsPath: string;
  autoFetch: boolean;
  aliases?: Alias[];
}

/**
 * IPC Channels Interface
 *
 * Add new channels here with their type signatures.
 * Format: 'channel-name': (param1: Type1, param2: Type2) => ReturnType
 */
export interface IpcChannels {
  // Echo test channel
  'echo': (message: string) => string;

  // File System Channels
  'fs:read-directory': (path: string) => FileNode[];
  'fs:read-file': (path: string) => FileContent;
  'fs:write-file': (path: string, content: string) => void;
  'fs:delete-file': (path: string) => void;
  'fs:delete-directory': (path: string) => void;
  'fs:rename-file': (oldPath: string, newPath: string) => void;
  'fs:reveal-in-explorer': (path: string) => void;
  'fs:directory-exists': (path: string) => boolean;

  // Git Channels
  'git:status': (repoPath: string) => GitStatus;
  'git:log': (repoPath: string, limit?: number) => GitCommit[];
  'git:add': (repoPath: string, files: string[]) => void;
  'git:commit': (repoPath: string, message: string) => void;
  'git:get-branches': (repoPath: string) => string[];
  'git:push': (repoPath: string, remote?: string, branch?: string) => void;
  'git:pull': (repoPath: string, remote?: string, branch?: string) => void;
  'git:clone': (url: string, targetPath: string) => void;
  'git:checkout': (repoPath: string, branch: string) => void;
  'git:create-branch': (repoPath: string, branchName: string) => void;
  'git:get-current-branch': (repoPath: string) => string | null;
  'git:compare-branches': (repoPath: string, base: string, head: string) => BranchComparison;

  // GitHub Channels
  'github:get-authenticated-user': () => { login: string; name: string; email: string };
  'github:search-issues': (query: string, labels: string[]) => GitHubIssue[];
  'github:get-repository': (owner: string, repo: string) => GitHubRepository;
  'github:validate-token': (token: string) => boolean;

  // Contribution Channels
  'contribution:create': (data: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'>) => Contribution;
  'contribution:get-all': () => Contribution[];
  'contribution:get-by-id': (id: string) => Contribution | null;
  'contribution:update': (id: string, data: Partial<Contribution>) => Contribution;
  'contribution:delete': (id: string) => void;
  'contribution:scan-directory': (directoryPath: string) => Contribution[];
  'contribution:sync-with-github': (contributionId: string) => Contribution;

  // Project Channels
  'project:scan-directory': (directoryPath: string) => Contribution[];

  // Settings Channels
  'settings:get': () => AppSettings;
  'settings:update': (settings: Partial<AppSettings>) => AppSettings;

  // GitIgnore Channels
  'gitignore:is-ignored': (repoPath: string, filePath: string) => boolean;
  'gitignore:get-patterns': (repoPath: string) => string[];
  // Dialog Channels (added for WO-MIGRATE-002.1)
  'dialog:open-directory': () => string | null;

  // Shell Channels (added for WO-MIGRATE-002.1)
  'shell:execute': (command: string) => void;
  'shell:open-external': (url: string) => void;
  'shell:launch-app': (appName: string) => void;

  // GitHub Additional Channels (added for WO-MIGRATE-002.1)
  'github:fork-repository': (repoFullName: string) => GitHubRepository;
  'github:get-repository-tree': (owner: string, repo: string, branch: string) => any;
  'git:add-remote': (repoPath: string, remoteName: string, url: string) => void;
  'git:get-remotes': (repoPath: string) => { name: string; fetchUrl: string; pushUrl: string }[];
  'github:list-pull-requests': (owner: string, repo: string, state?: 'open' | 'closed' | 'all') => {
    number: number;
    title: string;
    url: string;
    state: string;
    merged: boolean;
    createdAt: Date;
    updatedAt: Date;
    author: string;
    headBranch: string;
  }[];

  // PR Detail Channels (WO-004)
  'github:get-pull-request': (owner: string, repo: string, prNumber: number) => {
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    merged: boolean;
    createdAt: Date;
    updatedAt: Date;
    author: string;
  };
  'github:list-pr-comments': (owner: string, repo: string, prNumber: number) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  'github:list-pr-reviews': (owner: string, repo: string, prNumber: number) => {
    id: number;
    body: string;
    state: string;
    author: string;
    authorAvatarUrl: string;
    submittedAt: Date;
  }[];
  'github:list-pr-review-comments': (owner: string, repo: string, prNumber: number) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    path: string;
    line: number | null;
    createdAt: Date;
    inReplyToId: number | null;
  }[];
  'github:create-pr-comment': (owner: string, repo: string, prNumber: number, body: string) => void;

  // Issue Detail Channels (WO-005)
  'github:list-issues': (owner: string, repo: string, state?: 'open' | 'closed' | 'all') => {
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    labels: string[];
    createdAt: Date;
    updatedAt: Date;
    author: string;
    authorAvatarUrl: string;
  }[];
  'github:get-issue': (owner: string, repo: string, issueNumber: number) => {
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    labels: string[];
    createdAt: Date;
    updatedAt: Date;
    author: string;
    authorAvatarUrl: string;
  };
  'github:list-issue-comments': (owner: string, repo: string, issueNumber: number) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  'github:create-issue-comment': (owner: string, repo: string, issueNumber: number, body: string) => void;
  'github:update-issue': (owner: string, repo: string, issueNumber: number, updates: { state?: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' | 'reopened' }) => void;
  'github:create-issue': (owner: string, repo: string, title: string, body: string, labels?: string[]) => {
    number: number;
    url: string;
  };
  'github:create-pull-request': (owner: string, repo: string, title: string, head: string, base: string, body: string) => {
    number: number;
    url: string;
    state: string;
  };

  // Reaction Channels
  'github:list-issue-reactions': (owner: string, repo: string, issueNumber: number) => Reaction[];
  'github:add-issue-reaction': (owner: string, repo: string, issueNumber: number, content: ReactionContent) => Reaction;
  'github:delete-issue-reaction': (owner: string, repo: string, issueNumber: number, reactionId: number) => void;
  'github:list-comment-reactions': (owner: string, repo: string, commentId: number) => Reaction[];
  'github:add-comment-reaction': (owner: string, repo: string, commentId: number, content: ReactionContent) => Reaction;
  'github:delete-comment-reaction': (owner: string, repo: string, commentId: number, reactionId: number) => void;

  // Sub-Issue Channels
  'github:list-sub-issues': (owner: string, repo: string, issueNumber: number) => SubIssue[];
  'github:create-sub-issue': (owner: string, repo: string, parentIssueNumber: number, title: string, body: string, labels?: string[]) => { number: number; url: string };
  'github:add-existing-sub-issue': (owner: string, repo: string, parentIssueNumber: number, subIssueId: number) => void;

  // Spotify Channels
  'spotify:is-connected': () => boolean;
  'spotify:start-auth': () => void;
  'spotify:disconnect': () => void;
  'spotify:get-playback-state': () => SpotifyPlaybackState | null;
  'spotify:play': (uri?: string, contextUri?: string) => void;
  'spotify:pause': () => void;
  'spotify:next': () => void;
  'spotify:previous': () => void;
  'spotify:set-shuffle': (state: boolean) => void;
  'spotify:set-volume': (volumePercent: number) => void;
  'spotify:get-playlists': () => SpotifyPlaylist[];
  'spotify:play-playlist': (playlistUri: string) => void;
  'spotify:search': (query: string) => { tracks: SpotifyTrack[] };
  'spotify:add-to-queue': (trackUri: string) => void;
  'spotify:save-track': (trackId: string) => void;
  'spotify:remove-track': (trackId: string) => void;
  'spotify:is-track-saved': (trackId: string) => boolean;
  'spotify:seek': (positionMs: number) => void;

  // Discord Channels
  'discord:is-connected': () => boolean;
  'discord:connect': () => DiscordUser;
  'discord:disconnect': () => void;
  'discord:get-user': () => DiscordUser | null;
  'discord:get-guilds': () => DiscordGuild[];
  'discord:get-guild-channels': (guildId: string) => DiscordChannel[];
  'discord:get-guild-emojis': (guildId: string) => DiscordEmoji[];
  'discord:get-dm-channels': () => DiscordDMChannel[];
  'discord:get-messages': (channelId: string, before?: string, limit?: number) => DiscordMessage[];
  'discord:send-message': (channelId: string, content: string, replyToId?: string) => DiscordMessage;
  'discord:edit-message': (channelId: string, messageId: string, content: string) => DiscordMessage;
  'discord:delete-message': (channelId: string, messageId: string) => void;
  'discord:add-reaction': (channelId: string, messageId: string, emoji: string) => void;
  'discord:remove-reaction': (channelId: string, messageId: string, emoji: string) => void;
  'discord:get-channel': (channelId: string) => DiscordChannel;
  'discord:typing': (channelId: string) => void;
  'discord:get-pinned-messages': (channelId: string) => DiscordMessage[];
  'discord:create-dm': (userId: string) => DiscordDMChannel;
  'discord:send-message-with-attachments': (channelId: string, content: string, files: { name: string; data: Buffer; contentType: string }[], replyToId?: string) => DiscordMessage;
  'discord:search-gifs': (query: string) => { url: string; preview: string; width: number; height: number }[];
  'discord:trending-gifs': () => { url: string; preview: string; width: number; height: number }[];
  'discord:get-sticker-packs': () => DiscordStickerPack[];
  'discord:get-guild-stickers': (guildId: string) => DiscordSticker[];
  'discord:send-sticker': (channelId: string, stickerId: string) => DiscordMessage;
  'discord:create-poll': (channelId: string, question: string, answers: string[], duration: number, allowMultiselect: boolean) => DiscordMessage;
  'discord:get-forum-threads': (channelId: string, guildId: string, sortBy?: string, sortOrder?: string, tagIds?: string[], offset?: number) => { threads: DiscordThread[]; hasMore: boolean; totalResults: number };
  'discord:get-thread-messages': (threadId: string, before?: string, limit?: number) => DiscordMessage[];
  'discord:send-thread-message': (threadId: string, content: string) => DiscordMessage;
  'discord:create-forum-thread': (channelId: string, name: string, content: string, appliedTags?: string[]) => DiscordThread;

  // Code Server Channels
  'code-server:start': (projectPath: string) => { port: number; url: string };
  'code-server:stop': () => void;
  'code-server:status': () => { running: boolean; port: number | null; url: string | null };
}

/**
 * IPC Event Channels
 *
 * These are one-way events sent from main to renderer
 */
export interface IpcEvents {
  'git:status-changed': (repoPath: string) => void;
}

