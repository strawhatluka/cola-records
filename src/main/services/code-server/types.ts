/**
 * Code Server — Types, interfaces, defaults, and constants
 */
import type { CodeServerConfig } from '../../ipc/channels';

export interface CodeServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
}

export interface CodeServerStartResult {
  port: number;
  url: string;
}

export interface WorkspaceBasePaths {
  contributions: string | null;
  myProjects: string | null;
  professional: string | null;
}

export interface CodeServerStats {
  cpuPercent: number;
  memUsage: string;
  memLimit: string;
  memPercent: number;
}

export const DEFAULT_CODE_SERVER_CONFIG: CodeServerConfig = {
  cpuLimit: null,
  memoryLimit: null,
  shmSize: '256m',
  autoStartDocker: true,
  healthCheckTimeout: 90,
  autoSyncHostSettings: true,
  gpuAcceleration: 'on',
  terminalScrollback: 1000,
  autoInstallExtensions: [],
  timezone: 'UTC',
  customEnvVars: [],
  containerName: 'cola-code-server',
};

export const RESERVED_ENV_VARS = [
  'PUID',
  'PGID',
  'TZ',
  'PASSWORD',
  'DEFAULT_WORKSPACE',
  'CLAUDE_CONFIG_DIR',
  'GIT_CONFIG_GLOBAL',
];

export const WORKSPACE_MOUNTS = {
  contributions: '/config/workspaces/contributions',
  'my-projects': '/config/workspaces/my-projects',
  professional: '/config/workspaces/professional',
} as const;
