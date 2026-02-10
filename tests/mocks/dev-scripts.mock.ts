/**
 * Dev Scripts Test Mocks
 *
 * Provides mock data and helpers for testing Dev Scripts feature.
 * Follows existing factory pattern from factories.ts.
 */
import { vi } from 'vitest';
import type { DevScript, DevScriptTerminal } from '../../src/main/ipc/channels';

// ── DevScript Factory ──────────────────────────────────────────────

export function createMockDevScript(overrides?: Partial<DevScript>): DevScript {
  const command = overrides?.command ?? 'npm run build';
  const commands = overrides?.commands ?? [command];
  return {
    id: `script_${Date.now()}_test`,
    projectPath: '/mock/projects/test-project',
    name: 'Build',
    command,
    commands,
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
    commands: ['npm run build'],
  }),
  test: createMockDevScript({
    id: 'script_test',
    name: 'Test',
    command: 'npm test',
    commands: ['npm test'],
  }),
  dev: createMockDevScript({
    id: 'script_dev',
    name: 'Dev',
    command: 'npm run dev',
    commands: ['npm run dev'],
  }),
  lint: createMockDevScript({
    id: 'script_lint',
    name: 'Lint',
    command: 'npm run lint',
    commands: ['npm run lint'],
  }),
  // Multi-command script for testing sequential execution
  setup: createMockDevScript({
    id: 'script_setup',
    name: 'Setup',
    command: 'npm install',
    commands: ['npm install', 'npm run build', 'npm run dev'],
  }),
  // Multi-terminal script for testing parallel terminal execution
  fullStack: createMockDevScript({
    id: 'script_fullstack',
    name: 'Full Stack',
    command: 'npm run dev',
    commands: ['npm run dev'],
    terminals: [
      { name: 'Frontend', commands: ['npm run dev:frontend'] },
      { name: 'Backend', commands: ['npm run dev:backend'] },
    ],
  }),
  // Multi-terminal with multiple commands per terminal
  complexSetup: createMockDevScript({
    id: 'script_complex_setup',
    name: 'Complex Setup',
    command: 'npm install',
    commands: ['npm install'],
    terminals: [
      { name: 'Setup', commands: ['npm install', 'npm run migrate', 'npm run seed'] },
      { name: 'Frontend', commands: ['cd frontend', 'npm install', 'npm run dev'] },
      { name: 'Backend', commands: ['cd backend', 'npm install', 'npm run dev'] },
    ],
  }),
};

export function createMockDevScriptsList(): DevScript[] {
  return [mockDevScripts.build, mockDevScripts.test, mockDevScripts.dev];
}

export function createMockMultiTerminalScriptsList(): DevScript[] {
  return [mockDevScripts.fullStack, mockDevScripts.complexSetup];
}

// ── DevScriptTerminal Factory ──────────────────────────────────────────────

export function createMockDevScriptTerminal(
  overrides?: Partial<DevScriptTerminal>
): DevScriptTerminal {
  return {
    name: 'Terminal',
    commands: ['npm run start'],
    ...overrides,
  };
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
    commands: [row.command],
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
    typeof s.command === 'string' &&
    Array.isArray(s.commands)
  );
}
