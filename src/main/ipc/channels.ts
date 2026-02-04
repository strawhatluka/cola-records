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

// Settings Types
export interface Alias {
  name: string;
  command: string;
}

export interface AppSettings {
  githubToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  defaultProjectsPath: string;
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

