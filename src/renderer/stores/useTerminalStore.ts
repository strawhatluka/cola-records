import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ipc } from '../ipc/client';

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
      const isFirstSession = newSessions.size === 0;

      // Create new session - only set as active if it's the first session
      const session: TerminalSession = {
        id: sessionId,
        cwd,
        createdAt: new Date(),
        isActive: isFirstSession,
      };

      newSessions.set(sessionId, session);

      return {
        sessions: newSessions,
        activeSessionId: isFirstSession ? sessionId : state.activeSessionId,
      };
    });

    // Spawn PTY process via IPC
    ipc.invoke('terminal:spawn', sessionId, cwd);

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
    const { sessions, activeSessionId } = get();
    const session = sessions.get(sessionId);

    if (!session) return;

    // Kill PTY process via IPC
    ipc.invoke('terminal:kill', sessionId);

    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);

      // If closing active session, switch to another one
      let newActiveId = state.activeSessionId;
      if (sessionId === state.activeSessionId) {
        const remainingSessions = Array.from(newSessions.keys());
        if (remainingSessions.length > 0) {
          // Pick the session that is NOT the one being closed
          // Prefer the next session, or fall back to the previous one
          const sessionArray = Array.from(state.sessions.keys());
          const closedIndex = sessionArray.indexOf(sessionId);
          const nextIndex = closedIndex < sessionArray.length - 1 ? closedIndex + 1 : closedIndex - 1;
          newActiveId = sessionArray[nextIndex] !== sessionId ? sessionArray[nextIndex] : remainingSessions[0];

          const newActiveSession = newSessions.get(newActiveId);
          if (newActiveSession) {
            newActiveSession.isActive = true;
          }
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
    ipc.invoke('terminal:write', sessionId, '\x0c');
  },

  restartTerminal: (sessionId: string) => {
    const session = get().sessions.get(sessionId);
    if (!session) return;

    // Kill and respawn
    ipc.invoke('terminal:kill', sessionId);

    // Small delay to ensure cleanup, then respawn
    setTimeout(() => {
      ipc.invoke('terminal:spawn', sessionId, session.cwd);
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
