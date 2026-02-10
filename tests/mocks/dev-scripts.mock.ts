/**
 * Dev Scripts Test Mocks
 *
 * Provides mock data and helpers for testing Dev Scripts feature.
 * Follows existing factory pattern from factories.ts.
 */
import { vi } from 'vitest';
import type { DevScript } from '../../src/main/ipc/channels';

// ── DevScript Factory ──────────────────────────────────────────────

export function createMockDevScript(overrides?: Partial<DevScript>): DevScript {
  return {
    id: `script_${Date.now()}_test`,
    projectPath: '/mock/projects/test-project',
    name: 'Build',
    command: 'npm run build',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Pre-built Test Fixtures ──────────────────────────────────────────────

export const mockDevScripts = {
  build: createMockDevScript({
    id: 'script_build',
    name: 'Build',
    command: 'npm run build',
  }),
  test: createMockDevScript({
    id: 'script_test',
    name: 'Test',
    command: 'npm test',
  }),
  dev: createMockDevScript({
    id: 'script_dev',
    name: 'Dev',
    command: 'npm run dev',
  }),
  lint: createMockDevScript({
    id: 'script_lint',
    name: 'Lint',
    command: 'npm run lint',
  }),
};

export function createMockDevScriptsList(): DevScript[] {
  return [mockDevScripts.build, mockDevScripts.test, mockDevScripts.dev];
}

// ── Store Mock ──────────────────────────────────────────────

export interface MockDevScriptsStore {
  scripts: DevScript[];
  loading: boolean;
  error: string | null;
  loadScripts: ReturnType<typeof vi.fn>;
  saveScript: ReturnType<typeof vi.fn>;
  deleteScript: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
}

export function createMockDevScriptsStore(
  overrides?: Partial<MockDevScriptsStore>
): MockDevScriptsStore {
  return {
    scripts: [],
    loading: false,
    error: null,
    loadScripts: vi.fn(),
    saveScript: vi.fn(),
    deleteScript: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

// ── IPC Response Mocks ──────────────────────────────────────────────

export const mockDevScriptsIpcResponses = {
  'dev-scripts:get-all': [] as DevScript[],
  'dev-scripts:save': undefined,
  'dev-scripts:delete': undefined,
};

export function createMockDevScriptsIpcResponses(scripts: DevScript[] = []) {
  return {
    'dev-scripts:get-all': scripts,
    'dev-scripts:save': undefined,
    'dev-scripts:delete': undefined,
  };
}

// ── Terminal Session Mocks (for ScriptExecutionModal) ──────────────────────

export interface MockTerminalSession {
  id: string;
  shellType: 'git-bash' | 'powershell' | 'cmd';
}

export function createMockTerminalSession(
  overrides?: Partial<MockTerminalSession>
): MockTerminalSession {
  return {
    id: `terminal_${Date.now()}_test`,
    shellType: 'git-bash',
    ...overrides,
  };
}

// ── Database Row Mocks (for database tests) ──────────────────────

export interface MockDevScriptRow {
  id: string;
  project_path: string;
  name: string;
  command: string;
  created_at: string;
  updated_at: string;
}

export function createMockDevScriptRow(overrides?: Partial<MockDevScriptRow>): MockDevScriptRow {
  return {
    id: `script_${Date.now()}_test`,
    project_path: '/mock/projects/test-project',
    name: 'Build',
    command: 'npm run build',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function devScriptRowToDevScript(row: MockDevScriptRow): DevScript {
  return {
    id: row.id,
    projectPath: row.project_path,
    name: row.name,
    command: row.command,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Validation Helpers ──────────────────────────────────────────────

export function isValidDevScript(script: unknown): script is DevScript {
  if (!script || typeof script !== 'object') return false;
  const s = script as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.projectPath === 'string' &&
    typeof s.name === 'string' &&
    typeof s.command === 'string'
  );
}
