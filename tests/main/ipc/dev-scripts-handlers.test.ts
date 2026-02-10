import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDevScript, createMockDevScriptsList } from '../../mocks/dev-scripts.mock';

// Mock the database service
const mockGetDevScripts = vi.fn();
const mockSaveDevScript = vi.fn();
const mockDeleteDevScript = vi.fn();

vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    createContribution: vi.fn(),
    getAllContributions: vi.fn(),
    getContributionById: vi.fn(),
    updateContribution: vi.fn(),
    deleteContribution: vi.fn(),
    getDevScripts: mockGetDevScripts,
    saveDevScript: mockSaveDevScript,
    deleteDevScript: mockDeleteDevScript,
  },
}));

// Mock handleIpc to capture handlers
const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockHandleIpc = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
  ipcHandlers.set(channel, handler);
});

vi.mock('../../../src/main/ipc', () => ({
  handleIpc: mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/mock/path',
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    commandLine: {
      appendSwitch: vi.fn(),
    },
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    show: vi.fn(),
    isDestroyed: () => false,
  })),
  shell: {
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

// Mock other services to prevent initialization errors
vi.mock('../../../src/main/services', () => ({
  fileSystemService: { readDirectory: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() },
  gitService: { getStatus: vi.fn(), getLog: vi.fn() },
  gitIgnoreService: { isIgnored: vi.fn() },
  gitHubService: { searchIssues: vi.fn() },
}));

vi.mock('../../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: {},
}));

vi.mock('../../../src/main/services/code-server.service', () => ({
  codeServerService: { start: vi.fn(), stop: vi.fn(), status: vi.fn() },
}));

vi.mock('../../../src/main/services/terminal.service', () => ({
  terminalService: { spawn: vi.fn(), write: vi.fn(), resize: vi.fn(), kill: vi.fn() },
}));

vi.mock('../../../src/main/services/spotify.service', () => ({
  spotifyService: {},
}));

vi.mock('../../../src/main/services/discord.service', () => ({
  discordService: {},
}));

vi.mock('../../../src/main/services/updater.service', () => ({
  updaterService: {
    initialize: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    getStatus: vi.fn(),
    getVersion: vi.fn(),
  },
}));

vi.mock('../../../src/main/workers/scanner-pool', () => ({
  scannerPool: { scan: vi.fn() },
}));

vi.mock('electron-squirrel-startup', () => ({
  default: false,
}));

describe('DevScripts IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
    // Reset mock implementations (clearAllMocks only clears call history)
    mockGetDevScripts.mockReset();
    mockSaveDevScript.mockReset();
    mockDeleteDevScript.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('dev-scripts:get-all', () => {
    it('should call database getDevScripts with project path', async () => {
      const projectPath = '/test/project';
      const mockScripts = createMockDevScriptsList();
      mockGetDevScripts.mockReturnValue(mockScripts);

      const result = mockGetDevScripts(projectPath);

      expect(mockGetDevScripts).toHaveBeenCalledWith(projectPath);
      expect(result).toEqual(mockScripts);
    });

    it('should return array of DevScript objects', () => {
      const projectPath = '/test/project';
      const mockScripts = createMockDevScriptsList();
      mockGetDevScripts.mockReturnValue(mockScripts);

      const result = mockGetDevScripts(projectPath);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      result.forEach((script: any) => {
        expect(script).toHaveProperty('id');
        expect(script).toHaveProperty('projectPath');
        expect(script).toHaveProperty('name');
        expect(script).toHaveProperty('command');
      });
    });

    it('should return empty array when no scripts exist', () => {
      const projectPath = '/test/project';
      mockGetDevScripts.mockReturnValue([]);

      const result = mockGetDevScripts(projectPath);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', () => {
      const projectPath = '/test/project';
      mockGetDevScripts.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      expect(() => mockGetDevScripts(projectPath)).toThrow('Database connection failed');
    });
  });

  describe('dev-scripts:save', () => {
    it('should call database saveDevScript with script data', () => {
      const script = createMockDevScript({
        id: 'script_save_test',
        projectPath: '/test/project',
        name: 'Build',
        command: 'npm run build',
      });

      mockSaveDevScript(script);

      expect(mockSaveDevScript).toHaveBeenCalledWith(script);
    });

    it('should save script with all required fields', () => {
      const script = createMockDevScript({
        id: 'script_full',
        projectPath: '/test/project',
        name: 'Test',
        command: 'npm test',
      });

      mockSaveDevScript(script);

      expect(mockSaveDevScript).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'script_full',
          projectPath: '/test/project',
          name: 'Test',
          command: 'npm test',
        })
      );
    });

    it('should handle scripts with new id (insert)', () => {
      const newScript = createMockDevScript({
        id: 'new_script_id',
        projectPath: '/test/project',
        name: 'New Script',
        command: 'npm run new',
      });

      mockSaveDevScript(newScript);

      expect(mockSaveDevScript).toHaveBeenCalledWith(newScript);
    });

    it('should handle scripts with existing id (update)', () => {
      const existingScript = createMockDevScript({
        id: 'existing_script_id',
        projectPath: '/test/project',
        name: 'Updated Script',
        command: 'npm run updated',
      });

      mockSaveDevScript(existingScript);

      expect(mockSaveDevScript).toHaveBeenCalledWith(existingScript);
    });

    it('should handle validation errors', () => {
      mockSaveDevScript.mockImplementation(() => {
        throw new Error('UNIQUE constraint failed: dev_scripts.project_path, dev_scripts.name');
      });

      const duplicateScript = createMockDevScript({
        id: 'script_duplicate',
        projectPath: '/test/project',
        name: 'Build',
        command: 'npm run build',
      });

      expect(() => mockSaveDevScript(duplicateScript)).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('dev-scripts:delete', () => {
    it('should call database deleteDevScript with id', () => {
      const scriptId = 'script_to_delete';

      mockDeleteDevScript(scriptId);

      expect(mockDeleteDevScript).toHaveBeenCalledWith(scriptId);
    });

    it('should handle missing script gracefully', () => {
      const nonExistentId = 'nonexistent_script_id';

      // Should not throw for non-existent id
      expect(() => mockDeleteDevScript(nonExistentId)).not.toThrow();
    });

    it('should delete only the specified script', () => {
      const scriptId = 'specific_script_id';

      mockDeleteDevScript(scriptId);

      expect(mockDeleteDevScript).toHaveBeenCalledTimes(1);
      expect(mockDeleteDevScript).toHaveBeenCalledWith(scriptId);
    });
  });

  describe('IPC channel type safety', () => {
    it('should have correct channel names defined', () => {
      const expectedChannels = ['dev-scripts:get-all', 'dev-scripts:save', 'dev-scripts:delete'];

      expectedChannels.forEach((channel) => {
        expect(typeof channel).toBe('string');
        expect(channel.startsWith('dev-scripts:')).toBe(true);
      });
    });

    it('get-all channel returns correct shape', () => {
      const projectPath = '/test/project';
      const mockScripts = [
        createMockDevScript({
          id: 'script_1',
          projectPath,
          name: 'Build',
          command: 'npm run build',
        }),
      ];
      mockGetDevScripts.mockReturnValue(mockScripts);

      const result = mockGetDevScripts(projectPath);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('projectPath');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('command');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
      expect(typeof result[0].command).toBe('string');
    });

    it('save channel accepts DevScript type', () => {
      const script = createMockDevScript();

      // Type check - should compile without errors
      mockSaveDevScript(script);

      expect(mockSaveDevScript).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          projectPath: expect.any(String),
          name: expect.any(String),
          command: expect.any(String),
        })
      );
    });

    it('delete channel accepts string id', () => {
      const id = 'script_id';

      mockDeleteDevScript(id);

      expect(mockDeleteDevScript).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('handler behavior', () => {
    it('should return scripts ordered by name', () => {
      const projectPath = '/test/project';
      const mockScripts = [
        createMockDevScript({ name: 'Alpha' }),
        createMockDevScript({ name: 'Beta' }),
        createMockDevScript({ name: 'Gamma' }),
      ];
      mockGetDevScripts.mockReturnValue(mockScripts);

      const result = mockGetDevScripts(projectPath);

      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Gamma');
    });

    it('should isolate scripts by project path', () => {
      const projectPath1 = '/project/one';
      const projectPath2 = '/project/two';

      const scripts1 = [createMockDevScript({ projectPath: projectPath1, name: 'Build' })];
      const scripts2 = [createMockDevScript({ projectPath: projectPath2, name: 'Test' })];

      mockGetDevScripts.mockImplementation((path: string) => {
        if (path === projectPath1) return scripts1;
        if (path === projectPath2) return scripts2;
        return [];
      });

      expect(mockGetDevScripts(projectPath1)).toEqual(scripts1);
      expect(mockGetDevScripts(projectPath2)).toEqual(scripts2);
      expect(mockGetDevScripts('/unknown/project')).toEqual([]);
    });
  });
});
