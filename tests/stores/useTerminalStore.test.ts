import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTerminalStore } from '@renderer/stores/useTerminalStore';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

describe('useTerminalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };

    // Reset store
    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
    });
  });

  afterEach(() => {
    // Clean up all sessions
    const { sessions } = useTerminalStore.getState();
    sessions.forEach((_, id) => {
      useTerminalStore.getState().closeSession(id);
    });
  });
  describe('createSession', () => {
    it('should create a new terminal session', () => {
      const { createSession } = useTerminalStore.getState();
      const sessionId = createSession('/test/path');

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const { sessions } = useTerminalStore.getState();
      expect(sessions.size).toBe(1);
      expect(sessions.has(sessionId)).toBe(true);
    });

    it('should spawn PTY process via IPC', () => {
      const { createSession } = useTerminalStore.getState();
      const sessionId = createSession('/test/path');

      expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', sessionId, '/test/path');
    });

    it('should set created session as active if it is the first', () => {
      const { createSession } = useTerminalStore.getState();
      const sessionId = createSession('/test/path');

      const { activeSessionId, sessions } = useTerminalStore.getState();
      expect(activeSessionId).toBe(sessionId);

      const session = sessions.get(sessionId);
      expect(session?.isActive).toBe(true);
    });

    it('should not change active session when creating additional sessions', () => {
      const { createSession } = useTerminalStore.getState();
      const firstSessionId = createSession('/test/path1');
      const secondSessionId = createSession('/test/path2');

      const { activeSessionId } = useTerminalStore.getState();
      expect(activeSessionId).toBe(firstSessionId);
      expect(activeSessionId).not.toBe(secondSessionId);
    });

    it('should store correct session properties', () => {
      const { createSession } = useTerminalStore.getState();
      const sessionId = createSession('/my/working/dir');

      const { sessions } = useTerminalStore.getState();
      const session = sessions.get(sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.cwd).toBe('/my/working/dir');
      expect(session?.createdAt).toBeInstanceOf(Date);
    });

    it('should create multiple sessions', () => {
      const { createSession } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const id2 = createSession('/path2');
      const id3 = createSession('/path3');

      const { sessions } = useTerminalStore.getState();
      expect(sessions.size).toBe(3);
      expect(sessions.has(id1)).toBe(true);
      expect(sessions.has(id2)).toBe(true);
      expect(sessions.has(id3)).toBe(true);
    });
  });

  describe('switchSession', () => {
    it('should switch to different session', () => {
      const { createSession, switchSession } = useTerminalStore.getState();

      createSession('/path1');
      const id2 = createSession('/path2');

      switchSession(id2);

      const { activeSessionId } = useTerminalStore.getState();
      expect(activeSessionId).toBe(id2);
    });

    it('should update isActive flags', () => {
      const { createSession, switchSession } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const id2 = createSession('/path2');

      switchSession(id2);

      const { sessions } = useTerminalStore.getState();
      expect(sessions.get(id1)?.isActive).toBe(false);
      expect(sessions.get(id2)?.isActive).toBe(true);
    });

    it('should do nothing if session does not exist', () => {
      const { createSession, switchSession } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const nonExistentId = 'non-existent-id';

      switchSession(nonExistentId);

      const { activeSessionId } = useTerminalStore.getState();
      expect(activeSessionId).toBe(id1); // Should remain unchanged
    });
  });

  describe('closeSession', () => {
    it('should remove session from store', () => {
      const { createSession, closeSession } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      expect(useTerminalStore.getState().sessions.size).toBe(1);

      closeSession(sessionId);
      expect(useTerminalStore.getState().sessions.size).toBe(0);
    });

    it('should kill PTY process via IPC', () => {
      const { createSession, closeSession } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      mockInvoke.mockClear();

      closeSession(sessionId);

      expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', sessionId);
    });

    it('should switch to another session if closing active session', () => {
      const { createSession, closeSession } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const id2 = createSession('/path2');

      // id1 is active by default (first created)
      expect(useTerminalStore.getState().activeSessionId).toBe(id1);

      closeSession(id1);

      const { activeSessionId } = useTerminalStore.getState();
      expect(activeSessionId).toBe(id2);
    });

    it('should set activeSessionId to null if closing last session', () => {
      const { createSession, closeSession } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      closeSession(sessionId);

      const { activeSessionId } = useTerminalStore.getState();
      expect(activeSessionId).toBeNull();
    });

    it('should do nothing if session does not exist', () => {
      const { createSession, closeSession } = useTerminalStore.getState();

      createSession('/path');
      const initialSize = useTerminalStore.getState().sessions.size;

      closeSession('non-existent-id');

      expect(useTerminalStore.getState().sessions.size).toBe(initialSize);
    });
  });

  describe('clearTerminal', () => {
    it('should send clear command via IPC', () => {
      const { createSession, clearTerminal } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      mockInvoke.mockClear();

      clearTerminal(sessionId);

      expect(mockInvoke).toHaveBeenCalledWith('terminal:write', sessionId, '\x0c');
    });

    it('should work for any session', () => {
      const { createSession, clearTerminal } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const id2 = createSession('/path2');

      mockInvoke.mockClear();
      clearTerminal(id1);
      expect(mockInvoke).toHaveBeenCalledWith('terminal:write', id1, '\x0c');

      mockInvoke.mockClear();
      clearTerminal(id2);
      expect(mockInvoke).toHaveBeenCalledWith('terminal:write', id2, '\x0c');
    });
  });

  describe('restartTerminal', () => {
    it('should kill and respawn terminal', async () => {
      vi.useFakeTimers();

      const { createSession, restartTerminal } = useTerminalStore.getState();
      const sessionId = createSession('/test/path');

      mockInvoke.mockClear();
      restartTerminal(sessionId);

      // Should immediately kill
      expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', sessionId);

      // Fast-forward timer
      vi.advanceTimersByTime(100);

      // Should respawn after delay
      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', sessionId, '/test/path');
      });

      vi.useRealTimers();
    });

    it('should do nothing if session does not exist', () => {
      const { restartTerminal } = useTerminalStore.getState();

      restartTerminal('non-existent-id');

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', () => {
      const { createSession, getActiveSession } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      const activeSession = getActiveSession();

      expect(activeSession).not.toBeNull();
      expect(activeSession?.id).toBe(sessionId);
    });

    it('should return null if no active session', () => {
      const { getActiveSession } = useTerminalStore.getState();

      const activeSession = getActiveSession();
      expect(activeSession).toBeNull();
    });

    it('should return correct session after switching', () => {
      const { createSession, switchSession, getActiveSession } = useTerminalStore.getState();

      createSession('/path1');
      const id2 = createSession('/path2');

      switchSession(id2);

      const activeSession = getActiveSession();
      expect(activeSession?.id).toBe(id2);
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const { createSession, getSession } = useTerminalStore.getState();

      const sessionId = createSession('/path');
      const session = getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null for non-existent session', () => {
      const { getSession } = useTerminalStore.getState();

      const session = getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('should work for any session (not just active)', () => {
      const { createSession, getSession } = useTerminalStore.getState();

      const id1 = createSession('/path1');
      const id2 = createSession('/path2');

      expect(getSession(id1)).not.toBeNull();
      expect(getSession(id2)).not.toBeNull();
    });
  });
});
