/**
 * Code Server Service — Orchestration class
 *
 * Manages container lifecycle and delegates to domain modules
 * for path mapping, config sync, and Docker operations.
 */
import * as fs from 'fs';
import type { CodeServerConfig } from '../../ipc/channels';
import type {
  CodeServerStatus,
  CodeServerStartResult,
  CodeServerStats,
  WorkspaceBasePaths,
} from './types';
import { RESERVED_ENV_VARS } from './types';
import {
  findFreePort,
  getUserDataDir,
  getExtensionsDir,
  toDockerPath,
  loadWorkspaceBasePaths,
  getWorkspaceCategory,
  hostToContainerPath,
} from './path-mapper';
import {
  syncVSCodeSettings,
  createContainerGitConfig,
  createContainerBashrc,
  syncSSHConfig,
  getGitMounts,
  getBashrcMount,
  getClaudeMounts,
  getSSHMounts,
  getWorkspaceMounts,
} from './config-sync';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CodeServer');

import {
  dockerExec,
  getCodeServerConfig,
  getContainerName,
  checkDockerAvailable,
  waitForReady,
  getContainerStats,
  getContainerState,
  hasMultiMountConfiguration,
  getContainerPort,
  getContainerWorkspacePath,
  hasResourceConfigChanged,
  removeContainer,
  installExtensions,
  ensureImageExists,
  fixSSHPermissions,
} from './docker-ops';

class CodeServerService {
  private _containerName: string | null = null;
  private port: number | null = null;
  private running = false;
  private starting = false;
  private mountedProjects: Set<string> = new Set();
  private workspaceBasePaths: WorkspaceBasePaths | null = null;

  // ── Delegated Path Utilities ────────────────────────────────────

  findFreePort(): Promise<number> {
    return findFreePort();
  }

  getUserDataDir(): string {
    return getUserDataDir();
  }

  getExtensionsDir(): string {
    return getExtensionsDir();
  }

  toDockerPath(hostPath: string): string {
    return toDockerPath(hostPath);
  }

  getWorkspaceBasePaths(): WorkspaceBasePaths | null {
    return this.workspaceBasePaths;
  }

  getWorkspaceCategory(hostPath: string): 'contributions' | 'my-projects' | 'professional' | null {
    if (!this.workspaceBasePaths) {
      this.workspaceBasePaths = loadWorkspaceBasePaths();
    }
    return getWorkspaceCategory(hostPath, this.workspaceBasePaths);
  }

  hostToContainerPath(hostPath: string): string | null {
    if (!this.workspaceBasePaths) {
      this.workspaceBasePaths = loadWorkspaceBasePaths();
    }
    return hostToContainerPath(hostPath, this.workspaceBasePaths);
  }

  // ── Delegated Config Sync ──────────────────────────────────────

  syncVSCodeSettings(): void {
    syncVSCodeSettings();
  }

  createContainerGitConfig(): void {
    createContainerGitConfig();
  }

  createContainerBashrc(projectPath: string): void {
    createContainerBashrc(projectPath);
  }

  syncSSHConfig(): void {
    syncSSHConfig();
  }

  getGitMounts(): string[] {
    return getGitMounts();
  }

  getBashrcMount(): string[] {
    return getBashrcMount();
  }

  getClaudeMounts(): string[] {
    return getClaudeMounts();
  }

  getSSHMounts(): string[] {
    return getSSHMounts();
  }

  getWorkspaceMounts(): string[] {
    return getWorkspaceMounts();
  }

  // ── Delegated Docker Operations ────────────────────────────────

  async dockerExec(args: string[]): Promise<string> {
    return dockerExec(args);
  }

  async checkDockerAvailable(autoStart = true): Promise<void> {
    return checkDockerAvailable(autoStart);
  }

  async waitForReady(port: number, timeoutSeconds?: number): Promise<void> {
    return waitForReady(port, timeoutSeconds);
  }

  async getContainerStats(): Promise<CodeServerStats | null> {
    return getContainerStats();
  }

  async getContainerState(): Promise<'running' | 'stopped' | 'none'> {
    return getContainerState();
  }

  async hasMultiMountConfiguration(): Promise<boolean> {
    return hasMultiMountConfiguration();
  }

  async getContainerPort(): Promise<number | null> {
    return getContainerPort();
  }

  async getContainerWorkspacePath(): Promise<string | null> {
    return getContainerWorkspacePath();
  }

  async hasResourceConfigChanged(config: CodeServerConfig): Promise<boolean> {
    return hasResourceConfigChanged(config);
  }

  async removeContainer(): Promise<void> {
    return removeContainer();
  }

  async ensureImageExists(): Promise<void> {
    return ensureImageExists();
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  async start(projectPath: string): Promise<CodeServerStartResult> {
    if (this.starting) {
      while (this.starting) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (this.running && this.port) {
        const containerPath = this.hostToContainerPath(projectPath);
        const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
        return { port: this.port, url: `http://127.0.0.1:${this.port}/${folderParam}` };
      }
    }

    this.starting = true;

    try {
      const config = getCodeServerConfig();

      await checkDockerAvailable(config.autoStartDocker);
      await ensureImageExists();

      if (config.autoSyncHostSettings) {
        syncVSCodeSettings();
      }
      createContainerGitConfig();
      createContainerBashrc(projectPath);
      syncSSHConfig();

      const userDataDir = getUserDataDir();
      fs.mkdirSync(userDataDir, { recursive: true });

      let containerState = await getContainerState();
      let port: number;

      if (containerState !== 'none') {
        const hasMultiMount = await hasMultiMountConfiguration();
        if (!hasMultiMount) {
          logger.info(
            '[CodeServer] Existing container uses old mount config, recreating with multi-mount...'
          );
          await removeContainer();
          containerState = 'none';
        }
      }

      if (containerState !== 'none') {
        const configChanged = await hasResourceConfigChanged(config);
        if (configChanged) {
          logger.info(
            '[CodeServer] Resource config changed, recreating container with new settings...'
          );
          await removeContainer();
          containerState = 'none';
        }
      }

      if (containerState === 'running') {
        logger.info('[CodeServer] Container already running with multi-mount, reusing...');
        this.workspaceBasePaths = loadWorkspaceBasePaths();
        const existingPort = await getContainerPort();
        if (!existingPort) {
          throw new Error('Container is running but could not determine port');
        }
        port = existingPort;
      } else if (containerState === 'stopped') {
        logger.info('[CodeServer] Starting existing container with multi-mount...');
        this.workspaceBasePaths = loadWorkspaceBasePaths();
        await dockerExec(['start', getContainerName()]);
        const existingPort = await getContainerPort();
        if (!existingPort) {
          throw new Error('Container started but could not determine port');
        }
        port = existingPort;
      } else {
        logger.info('[CodeServer] Creating new container with workspace mounts...');
        port = await findFreePort();
        await this.createContainer(projectPath, port, userDataDir);
      }

      await waitForReady(port);
      await fixSSHPermissions();

      if (config.autoInstallExtensions.length > 0) {
        installExtensions(config.autoInstallExtensions).catch((err) => {
          logger.error('[CodeServer] Extension auto-install failed:', err);
        });
      }

      this._containerName = getContainerName();
      this.port = port;
      this.running = true;
      this.mountedProjects.add(projectPath);

      const containerPath = this.hostToContainerPath(projectPath);
      const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
      const url = `http://127.0.0.1:${port}/${folderParam}`;

      return { port, url };
    } finally {
      this.starting = false;
    }
  }

  private async createContainer(
    _projectPath: string,
    port: number,
    userDataDir: string
  ): Promise<void> {
    this.workspaceBasePaths = loadWorkspaceBasePaths();

    const config = getCodeServerConfig();
    const gitMts = getGitMounts();
    const workspaceMts = getWorkspaceMounts();

    const initialContainerPath = this.hostToContainerPath(_projectPath);
    const defaultWorkspace = initialContainerPath || '/config/workspaces';

    const resourceArgs: string[] = [];
    if (config.cpuLimit !== null) {
      resourceArgs.push('--cpus', String(config.cpuLimit));
    }
    if (config.memoryLimit !== null) {
      resourceArgs.push('--memory', config.memoryLimit);
    }

    const customEnvArgs: string[] = [];
    for (const envVar of config.customEnvVars) {
      if (!RESERVED_ENV_VARS.includes(envVar.key)) {
        customEnvArgs.push('-e', `${envVar.key}=${envVar.value}`);
      }
    }

    const args = [
      'run',
      '-d',
      '--name',
      getContainerName(),
      '-p',
      `127.0.0.1:${port}:8443`,
      '-t',
      `--shm-size=${config.shmSize}`,
      ...resourceArgs,
      '-v',
      `${toDockerPath(userDataDir)}:/config`,
      ...workspaceMts,
      ...gitMts,
      ...getBashrcMount(),
      ...getClaudeMounts(),
      ...getSSHMounts(),
      '-e',
      `PUID=${process.getuid?.() ?? 1000}`,
      '-e',
      `PGID=${process.getgid?.() ?? 1000}`,
      '-e',
      `TZ=${config.timezone}`,
      '-e',
      'PASSWORD=',
      '-e',
      `DEFAULT_WORKSPACE=${defaultWorkspace}`,
      '-e',
      'CLAUDE_CONFIG_DIR=/config/.claude',
      '-e',
      'GIT_CONFIG_GLOBAL=/config/gitconfig',
      ...customEnvArgs,
      'cola-code-server:latest',
    ];

    await dockerExec(args);
  }

  async stop(): Promise<void> {
    try {
      const state = await getContainerState();
      if (state === 'running') {
        logger.info('[CodeServer] Stopping container (preserving state)...');
        await dockerExec(['stop', '-t', '5', getContainerName()]);
      }
    } catch {
      // Container may not exist or already stopped
    }

    this._containerName = null;
    this.port = null;
    this.running = false;
    this.mountedProjects.clear();
  }

  getStatus(): CodeServerStatus {
    return {
      running: this.running,
      port: this.port,
      url: this.port ? `http://127.0.0.1:${this.port}` : null,
    };
  }

  // ── Multi-Project Workspace Management ─────────────────────────

  async addWorkspace(projectPath: string): Promise<string> {
    if (!this.running || !this.port) {
      throw new Error('Container is not running. Call start() first.');
    }

    if (!this.mountedProjects.has(projectPath)) {
      this.mountedProjects.add(projectPath);
      logger.info(
        `[CodeServer] Added workspace: ${projectPath} (${this.mountedProjects.size} projects)`
      );
    } else {
      logger.info(`[CodeServer] Workspace already tracked: ${projectPath}`);
    }

    const containerPath = this.hostToContainerPath(projectPath);
    const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
    return `http://127.0.0.1:${this.port}/${folderParam}`;
  }

  async removeWorkspace(projectPath: string): Promise<{ shouldStop: boolean }> {
    if (!this.mountedProjects.has(projectPath)) {
      logger.info(`[CodeServer] Workspace not found: ${projectPath}`);
      return { shouldStop: this.mountedProjects.size === 0 };
    }

    this.mountedProjects.delete(projectPath);
    logger.info(
      `[CodeServer] Removed workspace: ${projectPath} (${this.mountedProjects.size} remaining)`
    );

    return { shouldStop: this.mountedProjects.size === 0 };
  }

  getMountedProjects(): string[] {
    return Array.from(this.mountedProjects);
  }

  getContainerName(): string | null {
    return this._containerName;
  }
}

export type { CodeServerStats } from './types';
export const codeServerService = new CodeServerService();
