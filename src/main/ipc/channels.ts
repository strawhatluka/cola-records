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
}

// Contribution Types
export interface Contribution {
  id: string;
  repositoryUrl: string;
  localPath: string;
  issueNumber: number;
  issueTitle: string;
  branchName: string;
  status: 'in_progress' | 'ready' | 'submitted' | 'merged';
  createdAt: Date;
  updatedAt: Date;
}

// Settings Types
export interface AppSettings {
  githubToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  autoFetch: boolean;
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
  'fs:watch-directory': (path: string) => void;
  'fs:unwatch-directory': (path: string) => void;

  // Git Channels
  'git:status': (repoPath: string) => GitStatus;
  'git:log': (repoPath: string, limit?: number) => GitCommit[];
  'git:add': (repoPath: string, files: string[]) => void;
  'git:commit': (repoPath: string, message: string) => void;
  'git:push': (repoPath: string, remote?: string, branch?: string) => void;
  'git:pull': (repoPath: string, remote?: string, branch?: string) => void;
  'git:clone': (url: string, targetPath: string) => void;
  'git:checkout': (repoPath: string, branch: string) => void;
  'git:create-branch': (repoPath: string, branchName: string) => void;

  // GitHub Channels
  'github:search-issues': (query: string, labels: string[]) => GitHubIssue[];
  'github:get-repository': (owner: string, repo: string) => GitHubRepository;
  'github:validate-token': (token: string) => boolean;

  // Contribution Channels
  'contribution:create': (data: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'>) => Contribution;
  'contribution:get-all': () => Contribution[];
  'contribution:get-by-id': (id: string) => Contribution | null;
  'contribution:update': (id: string, data: Partial<Contribution>) => Contribution;
  'contribution:delete': (id: string) => void;

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

  // GitHub Additional Channels (added for WO-MIGRATE-002.1)
  'github:fork-repository': (repoFullName: string) => GitHubRepository;
  'github:get-repository-tree': (owner: string, repo: string, branch: string) => any;
  'git:add-remote': (repoPath: string, remoteName: string, url: string) => void;

}

/**
 * IPC Event Channels
 *
 * These are one-way events sent from main to renderer
 */
export interface IpcEvents {
  'fs:file-changed': (path: string) => void;
  'fs:file-added': (path: string) => void;
  'fs:file-deleted': (path: string) => void;
  'git:status-changed': (repoPath: string) => void;
}

