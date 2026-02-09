/**
 * TerminalService
 *
 * Manages pseudo-terminal (PTY) sessions for the embedded terminal tool.
 * Uses node-pty to spawn shell processes and provides IPC communication
 * with the renderer for terminal I/O.
 */

import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { ShellType, TerminalSession } from '../ipc/channels';

interface PtySession {
  pty: pty.IPty;
  shellType: ShellType;
}

class TerminalService {
  private sessions: Map<string, PtySession> = new Map();

  /**
   * Get the shell executable path based on shell type and platform.
   */
  private getShellPath(shellType: ShellType): string {
    if (process.platform === 'win32') {
      switch (shellType) {
        case 'git-bash': {
          // Common Git Bash locations
          const gitBashPaths = [
            'C:\\Program Files\\Git\\bin\\bash.exe',
            'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
            path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe'),
          ];
          for (const p of gitBashPaths) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              if (require('fs').existsSync(p)) {
                return p;
              }
            } catch {
              // Continue checking
            }
          }
          // Fall back to bash in PATH
          return 'bash.exe';
        }
        case 'powershell':
          return 'powershell.exe';
        case 'cmd':
        default:
          return 'cmd.exe';
      }
    } else if (process.platform === 'darwin') {
      return '/bin/zsh';
    } else {
      return '/bin/bash';
    }
  }

  /**
   * Get shell arguments based on shell type.
   */
  private getShellArgs(shellType: ShellType): string[] {
    if (process.platform === 'win32') {
      switch (shellType) {
        case 'git-bash':
          return ['--login', '-i'];
        case 'powershell':
          return ['-NoLogo'];
        case 'cmd':
        default:
          return [];
      }
    }
    return [];
  }

  /**
   * Spawn a new terminal session.
   */
  spawn(shellType: ShellType, workingDirectory: string): TerminalSession {
    const id = uuidv4();
    const shell = this.getShellPath(shellType);
    const args = this.getShellArgs(shellType);

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    // Store the session
    this.sessions.set(id, {
      pty: ptyProcess,
      shellType,
    });

    // Forward data to renderer
    ptyProcess.onData((data: string) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('terminal:data', id, data);
      }
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('terminal:exit', id, exitCode);
      }
      this.sessions.delete(id);
    });

    return { id, shellType };
  }

  /**
   * Write data to a terminal session.
   */
  write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (session) {
      session.pty.write(data);
    }
  }

  /**
   * Resize a terminal session.
   */
  resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  /**
   * Kill a terminal session.
   */
  kill(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(terminalId);
    }
  }

  /**
   * Kill all terminal sessions (for cleanup on app quit).
   */
  cleanup(): void {
    for (const [id, session] of this.sessions) {
      try {
        session.pty.kill();
      } catch {
        // Ignore errors during cleanup
      }
      this.sessions.delete(id);
    }
  }

  /**
   * Get the number of active sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

export const terminalService = new TerminalService();
