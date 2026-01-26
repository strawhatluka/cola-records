import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface TerminalSession {
  id: string;
  cwd: string;
  createdAt: Date;
  isActive: boolean;
}

interface TerminalStore {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;

  // Session management
  createSession: (cwd: string) => string;
  switchSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
  clearTerminal: (sessionId: string) => void;
  restartTerminal: (sessionId: string) => void;

  // Helpers
  getActiveSession: () => TerminalSession | null;
  getSession: (sessionId: string) => TerminalSession | null;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  createSession: (cwd: string) => {
    const sessionId = uuidv4();

    set((state) => {
      const newSessions = new Map(state.sessions);

      // Deactivate all existing sessions
      newSessions.forEach((s) => {
        s.isActive = false;
      });

      // Create new session as active
      const session: TerminalSession = {
        id: sessionId,
        cwd,
        createdAt: new Date(),
        isActive: true,
      };

      newSessions.set(sessionId, session);

      return {
        sessions: newSessions,
        activeSessionId: sessionId,
      };
    });

    // Spawn PTY process via IPC
    window.electronAPI.invoke('terminal:spawn', sessionId, cwd);

    return sessionId;
  },

  switchSession: (sessionId: string) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);

      // Deactivate all sessions
      newSessions.forEach((s) => {
        s.isActive = false;
      });

      // Activate target session
      const targetSession = newSessions.get(sessionId);
      if (targetSession) {
        targetSession.isActive = true;
      }

      return {
        sessions: newSessions,
        activeSessionId: sessionId,
      };
    });
  },

  closeSession: (sessionId: string) => {
    const { sessions } = get();
    const session = sessions.get(sessionId);

    if (!session) return;

    // Kill PTY process via IPC
    window.electronAPI.invoke('terminal:kill', sessionId);

    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);

      // If closing active session, switch to another one
      let newActiveId = state.activeSessionId;
      if (sessionId === state.activeSessionId) {
        const remainingSessions = Array.from(newSessions.values());
        if (remainingSessions.length > 0) {
          newActiveId = remainingSessions[0].id;
          remainingSessions[0].isActive = true;
        } else {
          newActiveId = null;
        }
      }

      return {
        sessions: newSessions,
        activeSessionId: newActiveId,
      };
    });
  },

  clearTerminal: (sessionId: string) => {
    // Send clear command (Ctrl+L equivalent)
    window.electronAPI.invoke('terminal:write', sessionId, '\x0c');
  },

  restartTerminal: (sessionId: string) => {
    const session = get().sessions.get(sessionId);
    if (!session) return;

    // Kill and respawn
    window.electronAPI.invoke('terminal:kill', sessionId);

    // Small delay to ensure cleanup, then respawn
    setTimeout(() => {
      window.electronAPI.invoke('terminal:spawn', sessionId, session.cwd);
    }, 100);
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    if (!activeSessionId) return null;
    return sessions.get(activeSessionId) || null;
  },

  getSession: (sessionId: string) => {
    return get().sessions.get(sessionId) || null;
  },
}));
