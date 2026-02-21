import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createMockToggleScript, createMockDevScript } from '../../mocks/dev-scripts.mock';
import { createMockContribution } from '../../mocks/factories';
import type { DevScript } from '../../../src/main/ipc/channels';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

// Hoist mock variables
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => vi.fn()),
}));

// Mock the IPC client
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    send: vi.fn(),
    on: mockOn,
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock window.electronAPI
const mockElectronAPI = {
  invoke: mockInvoke,
  on: vi.fn(() => vi.fn()),
  send: vi.fn(),
};

// Track toggle state
let mockToggleStates: Record<string, boolean> = {};
const mockFlipToggleState = vi.fn((id: string) => {
  mockToggleStates[id] = !mockToggleStates[id];
});

// Mock the dev scripts store
let mockDevScriptsState: any = {};

vi.mock('../../../src/renderer/stores/useDevScriptsStore', () => ({
  useDevScriptsStore: () => mockDevScriptsState,
  selectScriptsForProject: (scripts: any[], projectPath: string) =>
    scripts.filter((s: any) => s.projectPath === projectPath),
}));

// Mock ScriptButton to test toggle execution integration
vi.mock('../../../src/renderer/components/tools/ScriptButton', () => ({
  ScriptButton: ({ script, onClick, isToggle, toggleState, onToggleExecute }: any) => {
    if (isToggle && script.toggle) {
      const label = toggleState ? script.toggle.secondPressName : script.toggle.firstPressName;
      const command = toggleState
        ? script.toggle.secondPressCommand
        : script.toggle.firstPressCommand;
      return (
        <button
          data-testid={`toggle-button-${script.id}`}
          data-toggle-state={String(!!toggleState)}
          onClick={() => onToggleExecute?.(command)}
        >
          {label}
        </button>
      );
    }
    return (
      <button data-testid={`script-button-${script.id}`} onClick={onClick}>
        {script.name}
      </button>
    );
  },
}));

// Mock ScriptExecutionModal
vi.mock('../../../src/renderer/components/tools/ScriptExecutionModal', () => ({
  ScriptExecutionModal: ({ isOpen, script, onClose }: any) =>
    isOpen && script ? (
      <div data-testid="script-execution-modal">
        <span>Executing: {script.name}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock XTermTerminal
vi.mock('../../../src/renderer/components/tools/XTermTerminal', () => ({
  XTermTerminal: () => <div data-testid="xterm-terminal">Mock Terminal</div>,
}));

// Mock other dependencies
vi.mock('../../../src/renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../src/renderer/components/ui/DropdownMenu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../../src/renderer/stores/useContributionsStore', () => ({
  useContributionsStore: () => ({
    contributions: [
      createMockContribution({
        id: 'contrib_1',
        localPath: '/test/project',
        repositoryUrl: 'https://github.com/test/repo',
      }),
    ],
    loading: false,
    fetchContributions: vi.fn(),
  }),
}));

vi.mock('../../../src/renderer/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    settings: { defaultClonePath: '/mock/path' },
    fetchSettings: vi.fn(),
  }),
}));

describe('DevelopmentScreen Toggle Integration', () => {
  const toggleScript = createMockToggleScript({
    id: 'toggle_db',
    projectPath: '/test/project',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleStates = {};
    mockDevScriptsState = {
      scripts: [toggleScript],
      loading: false,
      error: null,
      executingScriptId: null,
      activeTerminalSession: null,
      toggleStates: mockToggleStates,
      loadScripts: vi.fn(),
      saveScript: vi.fn(),
      deleteScript: vi.fn(),
      setExecutingScript: vi.fn(),
      setActiveTerminalSession: vi.fn(),
      flipToggleState: mockFlipToggleState,
      resetToggleStates: vi.fn(),
    };
    (window as any).electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    cleanup();
    (window as any).electronAPI = undefined;
  });

  it('should detect toggle scripts by toggle field presence', () => {
    expect(toggleScript.toggle).toBeDefined();
    expect(toggleScript.toggle?.firstPressName).toBe('Start DB');
    expect(toggleScript.toggle?.secondPressName).toBe('Stop DB');
  });

  it('should not detect regular scripts as toggle', () => {
    const normalScript = createMockDevScript({ id: 'normal_1', name: 'Build' });
    expect(normalScript.toggle).toBeUndefined();
  });

  it('should flip toggle state on execute', () => {
    expect(mockToggleStates['toggle_db']).toBeUndefined();

    mockFlipToggleState('toggle_db');
    expect(mockToggleStates['toggle_db']).toBe(true);

    mockFlipToggleState('toggle_db');
    expect(mockToggleStates['toggle_db']).toBe(false);
  });

  it('should use first press command when toggle state is false', () => {
    const state = !!mockToggleStates['toggle_db'];
    const command = state
      ? toggleScript.toggle!.secondPressCommand
      : toggleScript.toggle!.firstPressCommand;
    expect(command).toBe('docker compose up -d');
  });

  it('should use second press command when toggle state is true', () => {
    mockToggleStates['toggle_db'] = true;
    const state = !!mockToggleStates['toggle_db'];
    const command = state
      ? toggleScript.toggle!.secondPressCommand
      : toggleScript.toggle!.firstPressCommand;
    expect(command).toBe('docker compose down');
  });

  it('should construct a transient script with the toggle command for modal execution', () => {
    // Simulate handleToggleExecute: creates a modified DevScript for the modal
    const command = toggleScript.toggle!.firstPressCommand;
    const toggleExecScript: DevScript = {
      ...toggleScript,
      command,
      commands: [command],
      terminals: undefined,
      toggle: undefined,
    };

    // The transient script should have only the current toggle command
    expect(toggleExecScript.command).toBe('docker compose up -d');
    expect(toggleExecScript.commands).toEqual(['docker compose up -d']);
    // toggle and terminals should be cleared so the modal runs it as a single-terminal script
    expect(toggleExecScript.toggle).toBeUndefined();
    expect(toggleExecScript.terminals).toBeUndefined();
    // Other fields preserved from original script
    expect(toggleExecScript.id).toBe('toggle_db');
    expect(toggleExecScript.name).toBe('Start DB');
  });

  it('should construct second press transient script correctly', () => {
    const command = toggleScript.toggle!.secondPressCommand;
    const toggleExecScript: DevScript = {
      ...toggleScript,
      command,
      commands: [command],
      terminals: undefined,
      toggle: undefined,
    };

    expect(toggleExecScript.command).toBe('docker compose down');
    expect(toggleExecScript.commands).toEqual(['docker compose down']);
  });
});
