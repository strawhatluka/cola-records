import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import * as os from 'os';

interface TerminalSession {
  id: string;
  ptyProcess: pty.IPty;
  cwd: string;
  shell: string;
  createdAt: Date;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  /**
   * Set the main browser window for sending IPC events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get the default shell for the current platform
   */
  private getDefaultShell(): { shell: string; args: string[] } {
    const platform = os.platform();

    if (platform === 'win32') {
      // Prefer PowerShell on Windows
      const pwsh = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

      try {
        const fs = require('fs');
        if (fs.existsSync(powershellPath)) {
          return { shell: powershellPath, args: ['-NoLogo'] };
        }
      } catch (error) {
        // Fall back to cmd if PowerShell check fails
      }

      return { shell: pwsh, args: [] };
    } else if (platform === 'darwin') {
      // macOS - use zsh (default since Catalina)
      return { shell: process.env.SHELL || '/bin/zsh', args: ['--login'] };
    } else {
      // Linux/Unix - use bash
      return { shell: process.env.SHELL || '/bin/bash', args: ['--login'] };
    }
  }

  /**
   * Spawn a new terminal session
   */
  spawn(sessionId: string, cwd: string): void {
    if (this.sessions.has(sessionId)) {
      console.warn(`Terminal session ${sessionId} already exists`);
      return;
    }

    const { shell, args } = this.getDefaultShell();

    try {
      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd || os.homedir(),
        env: process.env as { [key: string]: string },
      });

      // Store session
      this.sessions.set(sessionId, {
        id: sessionId,
        ptyProcess,
        cwd,
        shell,
        createdAt: new Date(),
      });

      // Handle data output from PTY
      ptyProcess.onData((data: string) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('terminal:data', {
            sessionId,
            data,
          });
        }
      });

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('terminal:exit', {
            sessionId,
            exitCode,
            signal,
          });
        }

        // Clean up session
        this.sessions.delete(sessionId);
      });

      console.log(`Terminal session ${sessionId} spawned with shell: ${shell}`);
    } catch (error) {
      console.error(`Failed to spawn terminal session ${sessionId}:`, error);

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal:error', {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Write data to a terminal session (user input)
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.warn(`Terminal session ${sessionId} not found`);
      return;
    }

    try {
      session.ptyProcess.write(data);
    } catch (error) {
      console.error(`Failed to write to terminal session ${sessionId}:`, error);
    }
  }

  /**
   * Resize a terminal session
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.warn(`Terminal session ${sessionId} not found`);
      return;
    }

    try {
      session.ptyProcess.resize(cols, rows);
    } catch (error) {
      console.error(`Failed to resize terminal session ${sessionId}:`, error);
    }
  }

  /**
   * Kill a specific terminal session
   */
  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.warn(`Terminal session ${sessionId} not found`);
      return;
    }

    try {
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);
      console.log(`Terminal session ${sessionId} killed`);
    } catch (error) {
      console.error(`Failed to kill terminal session ${sessionId}:`, error);
    }
  }

  /**
   * Kill all terminal sessions (cleanup on app quit)
   */
  killAll(): void {
    console.log(`Killing ${this.sessions.size} terminal sessions`);

    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        session.ptyProcess.kill();
      } catch (error) {
        console.error(`Failed to kill terminal session ${sessionId}:`, error);
      }
    }

    this.sessions.clear();
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
export const terminalService = new TerminalService();
