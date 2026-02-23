/**
 * GitAskPassService
 *
 * Manages a GIT_ASKPASS helper script and token file so that Git operations
 * in the Tool Box Terminal (PTY) authenticate automatically using the app's
 * stored GitHub token. This is the same pattern VS Code uses.
 *
 * Flow:
 * 1. On app startup → write platform-specific askpass script + token file
 * 2. Terminal PTY spawn() includes GIT_ASKPASS env var pointing to the script
 * 3. When Git needs credentials, it runs the script which reads the token file
 * 4. On app quit → clean up all files
 *
 * Security:
 * - Token file has 0o600 permissions (owner read/write only)
 * - Script file has 0o755 permissions (owner rwx, others rx — needed for Git to execute)
 * - Script contains NO secrets — only reads from the token file
 * - Files stored in app.getPath('userData')/git-askpass/
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { database } from '../database';
import { env } from './environment.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('GitAskPass');

class GitAskPassService {
  private askpassDir: string = '';
  private scriptPath: string = '';
  private tokenPath: string = '';
  private initialized = false;

  /**
   * Initialize the askpass service: create directory, write script and token file.
   * Called once on app startup after database is initialized.
   */
  initialize(): void {
    try {
      this.askpassDir = path.join(app.getPath('userData'), 'git-askpass');
      this.tokenPath = path.join(this.askpassDir, 'git-token.txt');

      const isWindows = process.platform === 'win32';
      this.scriptPath = path.join(
        this.askpassDir,
        isWindows ? 'git-askpass.bat' : 'git-askpass.sh'
      );

      // Create directory
      if (!fs.existsSync(this.askpassDir)) {
        fs.mkdirSync(this.askpassDir, { recursive: true });
      }

      // Write platform-specific script
      this.writeScript();

      // Write token file from current settings
      const token = this.getCurrentToken();
      if (token) {
        this.writeTokenFile(token);
      }

      this.initialized = true;
      logger.info('Initialized askpass helper', this.askpassDir);
    } catch (error) {
      logger.warn('Failed to initialize askpass helper', error);
    }
  }

  /**
   * Get env vars to inject into PTY spawn.
   * Returns empty object if no token is configured or service not initialized.
   */
  getAskPassEnv(): Record<string, string> {
    if (!this.initialized || !fs.existsSync(this.tokenPath)) {
      return {};
    }

    return {
      GIT_ASKPASS: this.scriptPath,
      GIT_TERMINAL_PROMPT: '0',
    };
  }

  /**
   * Update the token file when settings change.
   * Pass null to remove the token file.
   */
  updateToken(token: string | null): void {
    if (!this.initialized) return;

    try {
      if (token) {
        this.writeTokenFile(token);
        logger.debug('Token file updated');
      } else {
        if (fs.existsSync(this.tokenPath)) {
          fs.unlinkSync(this.tokenPath);
          logger.debug('Token file removed');
        }
      }
    } catch (error) {
      logger.warn('Failed to update token file', error);
    }
  }

  /**
   * Remove all askpass files on app quit.
   */
  cleanup(): void {
    try {
      if (this.askpassDir && fs.existsSync(this.askpassDir)) {
        fs.rmSync(this.askpassDir, { recursive: true, force: true });
        logger.debug('Cleaned up askpass directory');
      }
    } catch (error) {
      logger.warn('Failed to clean up askpass directory', error);
    }
    this.initialized = false;
  }

  /**
   * Write the platform-specific GIT_ASKPASS script.
   * The script responds to Git's credential prompts:
   * - Username prompt → "x-access-token"
   * - Password prompt → reads token from file
   */
  private writeScript(): void {
    const isWindows = process.platform === 'win32';
    const tokenFilePath = this.tokenPath;

    const content = isWindows
      ? this.getWindowsScript(tokenFilePath)
      : this.getUnixScript(tokenFilePath);

    fs.writeFileSync(this.scriptPath, content, {
      mode: isWindows ? 0o755 : 0o755,
    });
  }

  private getWindowsScript(tokenFilePath: string): string {
    // Normalize to Windows backslashes for the batch file
    const winTokenPath = tokenFilePath.replace(/\//g, '\\');
    return [
      '@echo off',
      'setlocal',
      'echo %1 | findstr /i "username" >nul',
      'if %errorlevel% equ 0 (',
      '  echo x-access-token',
      '  exit /b 0',
      ')',
      `if exist "${winTokenPath}" (`,
      `  set /p TOKEN=<"${winTokenPath}"`,
      '  echo %TOKEN%',
      ') else (',
      '  echo.',
      ')',
      '',
    ].join('\r\n');
  }

  private getUnixScript(tokenFilePath: string): string {
    return [
      '#!/bin/sh',
      `case "$1" in`,
      '  *sername*)',
      '    echo "x-access-token"',
      '    ;;',
      '  *)',
      `    if [ -f "${tokenFilePath}" ]; then`,
      `      cat "${tokenFilePath}"`,
      '    fi',
      '    ;;',
      'esac',
      '',
    ].join('\n');
  }

  private writeTokenFile(token: string): void {
    fs.writeFileSync(this.tokenPath, token, { mode: 0o600 });
  }

  private getCurrentToken(): string | null {
    try {
      const settings = database.getAllSettings();
      return settings.githubToken || env.get('GITHUB_TOKEN') || null;
    } catch {
      return null;
    }
  }
}

export const gitAskPassService = new GitAskPassService();
