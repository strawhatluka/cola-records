# ORCHESTRATOR WORK ORDER #MIGRATE-003.3
## Type: IMPLEMENTATION
## Integrated Terminal Implementation

---

## MISSION OBJECTIVE

Implement integrated terminal using xterm.js and node-pty with multi-session support, terminal controls, and proper PTY process management. This is Phase 3 of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Create a fully functional integrated terminal that spawns platform-specific shells (bash/cmd/powershell), executes commands in the repository working directory, supports multiple terminal sessions, and provides a native terminal experience with xterm.js.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- TerminalService (to be implemented in main process using node-pty)

---

## IMPLEMENTATION SCOPE

### Components to Create
```yaml
src/main/services/:
  - terminal.service.ts     # PTY process management with node-pty

src/main/ipc/:
  - Update handlers.ts      # Add terminal IPC handlers

src/renderer/components/ide/terminal/:
  - TerminalPanel.tsx       # Terminal container with session tabs
  - XTermWrapper.tsx        # xterm.js integration wrapper
  - TerminalControls.tsx    # Clear, restart, new session buttons

src/renderer/stores/:
  - useTerminalStore.ts     # Terminal session state management
```

### Dependencies to Install
```bash
npm install node-pty
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-search
npm install @types/node-pty
```

### Terminal Features
- **node-pty**: Real PTY (pseudo-terminal) for native shell experience
- **xterm.js**: Terminal emulator in the browser
- **Multi-Session**: Support multiple terminal sessions with tabs
- **Platform Detection**: Spawn bash (Linux/Mac) or cmd.exe/PowerShell (Windows)
- **Working Directory**: Initialize terminal in repository directory
- **Terminal Controls**: Clear, restart, new session
- **Add-ons**: Fit (auto-resize), Web Links (clickable URLs), Search

---

## IMPLEMENTATION APPROACH

### Step 1: Terminal Service (node-pty) (3 hours)

**Install node-pty:**
```bash
npm install node-pty @types/node-pty
```

**Create TerminalService:**
```typescript
// src/main/services/terminal.service.ts
import * as pty from 'node-pty';
import { IPty } from 'node-pty';
import { BrowserWindow } from 'electron';

interface TerminalSession {
  id: string;
  pty: IPty;
  cwd: string;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  spawn(sessionId: string, cwd: string): void {
    // Detect platform-specific shell
    const shell = this.getDefaultShell();
    const args = this.getShellArgs();

    const ptyProcess = pty.spawn(shell, args, {
      cwd,
      cols: 80,
      rows: 24,
      env: process.env as any,
    });

    // Send output to renderer
    ptyProcess.onData((data) => {
      this.mainWindow.webContents.send('terminal:data', {
        sessionId,
        data,
      });
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      this.mainWindow.webContents.send('terminal:exit', {
        sessionId,
        exitCode,
      });
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, {
      id: sessionId,
      pty: ptyProcess,
      cwd,
    });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
    }
  }

  killAll(): void {
    for (const [sessionId] of this.sessions) {
      this.kill(sessionId);
    }
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  private getShellArgs(): string[] {
    // Some shells need specific args
    if (process.platform === 'win32') {
      return []; // cmd.exe doesn't need args
    }
    return []; // bash doesn't need args
  }
}
```

**Implementation Tasks:**
- [ ] Install node-pty dependency
- [ ] Create TerminalService class
- [ ] Implement spawn() method with platform detection
- [ ] Handle PTY data events → send to renderer
- [ ] Handle PTY exit events → cleanup session
- [ ] Implement write() for user input
- [ ] Implement resize() for terminal dimensions
- [ ] Implement kill() for session termination
- [ ] Test: Spawn PTY → verify shell starts

---

### Step 2: Terminal IPC Handlers (1 hour)

**Add IPC handlers:**
```typescript
// src/main/ipc/handlers.ts (add to existing handlers)
import { terminalService } from '../services';

// Terminal handlers
ipcMain.handle('terminal:spawn', async (_event, sessionId: string, cwd: string) => {
  terminalService.spawn(sessionId, cwd);
});

ipcMain.handle('terminal:write', async (_event, sessionId: string, data: string) => {
  terminalService.write(sessionId, data);
});

ipcMain.handle('terminal:resize', async (_event, sessionId: string, cols: number, rows: number) => {
  terminalService.resize(sessionId, cols, rows);
});

ipcMain.handle('terminal:kill', async (_event, sessionId: string) => {
  terminalService.kill(sessionId);
});

// Cleanup on app quit
app.on('before-quit', () => {
  terminalService.killAll();
});
```

**Update channels.ts:**
```typescript
// src/main/ipc/channels.ts (add terminal channels)
export interface IpcChannels {
  // ... existing channels ...

  // Terminal
  'terminal:spawn': (sessionId: string, cwd: string) => void;
  'terminal:write': (sessionId: string, data: string) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
  'terminal:kill': (sessionId: string) => void;
}
```

**Implementation Tasks:**
- [ ] Add terminal IPC handlers to handlers.ts
- [ ] Update IpcChannels interface in channels.ts
- [ ] Add cleanup on app quit
- [ ] Test: Invoke terminal:spawn → verify PTY spawns

---

### Step 3: Terminal State Management (1.5 hours)

**Create useTerminalStore:**
```typescript
// src/renderer/stores/useTerminalStore.ts
import { create } from 'zustand';

interface TerminalSession {
  id: string;
  cwd: string;
  createdAt: Date;
}

interface TerminalStore {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;

  // Actions
  createSession: (cwd: string) => string;
  switchSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
  clearTerminal: (sessionId: string) => void;
  restartTerminal: (sessionId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  createSession: (cwd: string) => {
    const sessionId = `terminal-${Date.now()}`;
    const session: TerminalSession = {
      id: sessionId,
      cwd,
      createdAt: new Date(),
    };

    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, session);
      return {
        sessions: newSessions,
        activeSessionId: sessionId,
      };
    });

    // Spawn PTY in main process
    ipc.invoke('terminal:spawn', sessionId, cwd);

    return sessionId;
  },

  switchSession: (sessionId: string) => {
    set({ activeSessionId: sessionId });
  },

  closeSession: (sessionId: string) => {
    // Kill PTY
    ipc.invoke('terminal:kill', sessionId);

    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);

      // Switch to another session if active was closed
      let newActiveId = state.activeSessionId;
      if (sessionId === state.activeSessionId) {
        newActiveId = newSessions.size > 0
          ? Array.from(newSessions.keys())[0]
          : null;
      }

      return {
        sessions: newSessions,
        activeSessionId: newActiveId,
      };
    });
  },

  clearTerminal: (sessionId: string) => {
    // Send clear command based on platform
    const clearCmd = process.platform === 'win32' ? 'cls\r' : 'clear\r';
    ipc.invoke('terminal:write', sessionId, clearCmd);
  },

  restartTerminal: (sessionId: string) => {
    const session = get().sessions.get(sessionId);
    if (session) {
      get().closeSession(sessionId);
      get().createSession(session.cwd);
    }
  },
}));
```

**Implementation Tasks:**
- [ ] Create useTerminalStore with Zustand
- [ ] Implement createSession() → spawns PTY
- [ ] Implement switchSession() → changes active tab
- [ ] Implement closeSession() → kills PTY and cleans up
- [ ] Implement clearTerminal() → sends clear command
- [ ] Implement restartTerminal() → kill and respawn
- [ ] Test: Create session → verify spawns → close → verify cleanup

---

### Step 4: xterm.js Integration (2 hours)

**Install xterm.js:**
```bash
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-search
```

**Create XTermWrapper:**
```typescript
// src/renderer/components/ide/terminal/XTermWrapper.tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';

interface XTermWrapperProps {
  sessionId: string;
  cwd: string;
}

export function XTermWrapper({ sessionId, cwd }: XTermWrapperProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal>();
  const fitAddonRef = useRef<FitAddon>();

  useEffect(() => {
    if (!termRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1E1E1E',
        foreground: '#D4D4D4',
        cursor: '#FFFFFF',
        selection: '#264F78',
      },
      scrollback: 1000,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    // Open terminal in DOM
    term.open(termRef.current);
    fitAddon.fit();

    // Handle user input
    term.onData((data) => {
      ipc.invoke('terminal:write', sessionId, data);
    });

    // Receive output from PTY
    const unsubscribe = ipc.on('terminal:data', (event: any) => {
      if (event.sessionId === sessionId) {
        term.write(event.data);
      }
    });

    // Handle terminal exit
    const unsubscribeExit = ipc.on('terminal:exit', (event: any) => {
      if (event.sessionId === sessionId) {
        term.write(`\r\n\r\nProcess exited with code ${event.exitCode}\r\n`);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      ipc.invoke('terminal:resize', sessionId, term.cols, term.rows);
    };

    window.addEventListener('resize', handleResize);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      unsubscribeExit();
      term.dispose();
    };
  }, [sessionId]);

  return <div ref={termRef} className="h-full w-full" />;
}
```

**Implementation Tasks:**
- [ ] Install xterm.js and addons
- [ ] Create XTermWrapper component
- [ ] Configure terminal theme (match VSCode dark theme)
- [ ] Load FitAddon for auto-resize
- [ ] Load WebLinksAddon for clickable URLs
- [ ] Load SearchAddon for text search
- [ ] Handle user input → send to PTY via IPC
- [ ] Handle PTY output → write to terminal
- [ ] Handle window resize → resize PTY
- [ ] Test: Type command → verify executes → see output

---

### Step 5: Terminal Panel & Controls (1.5 hours)

**Create TerminalControls:**
```typescript
// src/renderer/components/ide/terminal/TerminalControls.tsx
interface TerminalControlsProps {
  sessionId: string;
}

export function TerminalControls({ sessionId }: TerminalControlsProps) {
  const { clearTerminal, restartTerminal } = useTerminalStore();

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b bg-background">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => clearTerminal(sessionId)}
        title="Clear terminal"
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => restartTerminal(sessionId)}
        title="Restart terminal"
      >
        <RotateCwIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Create TerminalPanel:**
```typescript
// src/renderer/components/ide/terminal/TerminalPanel.tsx
export function TerminalPanel({ repoPath }: { repoPath: string }) {
  const { sessions, activeSessionId, createSession, switchSession, closeSession } = useTerminalStore();

  useEffect(() => {
    // Create initial session if none exist
    if (sessions.size === 0 && repoPath) {
      createSession(repoPath);
    }
  }, [repoPath, sessions.size]);

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null;

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No terminal session</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session tabs (if multiple sessions) */}
      {sessions.size > 1 && (
        <div className="flex border-b">
          {Array.from(sessions.values()).map((session) => (
            <div
              key={session.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent",
                session.id === activeSessionId && "bg-accent"
              )}
              onClick={() => switchSession(session.id)}
            >
              <TerminalIcon className="h-4 w-4" />
              <span className="text-sm">Terminal</span>
              <button
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => createSession(repoPath)}
            title="New terminal"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Controls */}
      <TerminalControls sessionId={activeSession.id} />

      {/* Terminal */}
      <div className="flex-1">
        <XTermWrapper sessionId={activeSession.id} cwd={activeSession.cwd} />
      </div>
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create TerminalControls component
- [ ] Create TerminalPanel with session tabs
- [ ] Show multiple session tabs if >1 session
- [ ] Add "New Terminal" button
- [ ] Handle session switching
- [ ] Handle session closing
- [ ] Test: Create 3 sessions → switch between → close one

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `TERMINAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Components implemented
   - Features operational

2. **Component Architecture**
   - Terminal service flow (main ↔ renderer)
   - PTY process management
   - IPC communication diagram

3. **Feature Validation**
   - PTY spawns correctly (platform-specific shell)
   - Commands execute in working directory
   - Output displays in xterm.js
   - Multi-session support functional
   - Terminal controls work (clear, restart)

4. **Performance Benchmarks**
   - Terminal spawn time (target: <200ms)
   - Output streaming latency
   - Memory usage per session

5. **Test Results**
   - Component test coverage
   - Manual testing checklist
   - Platform testing (Windows, Mac, Linux)

### Evidence to Provide
- Screenshots of terminal running commands
- Video of multi-session switching
- Test coverage report

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `TERMINAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003.3-integrated-terminal.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003.3-integrated-terminal.md`
   - [ ] Completion report exists in: `trinity/reports/TERMINAL-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Terminal spawns platform-specific shell (bash/cmd/powershell)
- [ ] Commands execute in repository working directory
- [ ] Output displays correctly in xterm.js
- [ ] User input works (typing commands)
- [ ] Multi-session support functional (create, switch, close)
- [ ] Clear terminal button works
- [ ] Restart terminal button works
- [ ] Terminal resizes with panel resize
- [ ] Web links are clickable
- [ ] PTY processes cleaned up on close
- [ ] Component tests ≥80% coverage
- [ ] No TypeScript errors
- [ ] No memory leaks (PTY cleanup verified)

---

## CONSTRAINTS & GUIDELINES

### Do NOT:
- [ ] Buffer all terminal output in memory
- [ ] Block main thread with PTY operations
- [ ] Skip PTY cleanup on session close
- [ ] Hard-code shell paths

### DO:
- [ ] Stream terminal output (don't buffer)
- [ ] Detect platform for correct shell
- [ ] Clean up PTY processes on unmount
- [ ] Test on Windows AND Unix platforms
- [ ] Handle PTY exit gracefully
- [ ] Implement proper error boundaries

---

## ROLLBACK STRATEGY

If issues arise:
1. **PTY Not Spawning**: Check node-pty compilation for platform
2. **Output Not Displaying**: Verify IPC event listeners
3. **Memory Leaks**: Check PTY disposal on session close

---

**Estimated Time:** 7.5 hours
**Priority:** HIGH (Phase 3 of 6)
**Dependencies:** None (new service)
