/**
 * TestEditor
 *
 * Full-view config editor for test framework configuration. Replaces MaintenanceTool
 * when active. Vitest mode: rich GUI with environment, globals, coverage provider,
 * coverage thresholds (4), and timeout. Jest mode: testEnvironment, collectCoverage,
 * coverageProvider. Generic mode: textarea for other configs.
 * Supports Ctrl+S save, dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  TestFrameworkInfo,
  TestFrameworkConfig,
  VitestConfig,
  JestConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface TestEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  vitest: 'Vitest Config',
  jest: 'Jest Config',
  mocha: 'Mocha Config',
  pytest: 'pytest Config',
  rspec: 'RSpec Config',
  phpunit: 'PHPUnit Config',
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Vitest property options ──

const ENVIRONMENT_OPTIONS = [
  { value: 'jsdom', label: 'jsdom' },
  { value: 'happy-dom', label: 'happy-dom' },
  { value: 'node', label: 'node' },
  { value: 'edge-runtime', label: 'edge-runtime' },
];

const COVERAGE_PROVIDER_OPTIONS = [
  { value: 'v8', label: 'v8' },
  { value: 'istanbul', label: 'istanbul' },
];

// ── Jest property options ──

const JEST_ENVIRONMENT_OPTIONS = [
  { value: 'jsdom', label: 'jsdom' },
  { value: 'node', label: 'node' },
];

const JEST_COVERAGE_PROVIDER_OPTIONS = [
  { value: 'v8', label: 'v8' },
  { value: 'babel', label: 'babel' },
];

export function TestEditor({ workingDirectory, ecosystem, onClose }: TestEditorProps) {
  const [frameworkInfo, setFrameworkInfo] = useState<TestFrameworkInfo | null>(null);
  const [config, setConfig] = useState<VitestConfig | JestConfig | Record<string, unknown>>({});
  const [savedConfig, setSavedConfig] = useState<
    VitestConfig | JestConfig | Record<string, unknown>
  >({});
  const [genericText, setGenericText] = useState('');
  const [savedGenericText, setSavedGenericText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVitest = frameworkInfo?.framework === 'vitest';
  const isJest = frameworkInfo?.framework === 'jest';
  const isRichMode = isVitest || isJest;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info = await ipc.invoke(
          'dev-tools:detect-test-framework',
          workingDirectory,
          ecosystem
        );
        if (cancelled) return;
        setFrameworkInfo(info);

        if (!info.configPath || !info.framework) {
          setLoading(false);
          return;
        }

        const loaded: TestFrameworkConfig = await ipc.invoke(
          'dev-tools:read-test-config',
          info.configPath,
          info.framework
        );
        if (cancelled) return;

        if (info.framework === 'vitest' || info.framework === 'jest') {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            // TS/JS config — fall back to generic editor
            setGenericText(raw);
            setSavedGenericText(raw);
            // Override rich mode by setting framework to a generic indicator
            setFrameworkInfo({ ...info, framework: info.framework });
          } else {
            setConfig(loaded.config);
            setSavedConfig(structuredClone(loaded.config));
          }
        } else {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          }
        }

        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workingDirectory, ecosystem]);

  // Check if loaded config was raw text (generic mode for TS/JS configs)
  const isGenericMode = !isRichMode || (genericText !== '' && deepEqual(config, {}));

  const actuallyDirty = isGenericMode
    ? genericText !== savedGenericText
    : !deepEqual(config, savedConfig);

  const handleSave = useCallback(async () => {
    if (!frameworkInfo?.framework) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      let result: SetUpActionResult;

      if (!isGenericMode && isRichMode) {
        result = await ipc.invoke(
          'dev-tools:write-test-config',
          workingDirectory,
          frameworkInfo.framework,
          config
        );
        if (result.success) {
          setSavedConfig(structuredClone(config));
        }
      } else {
        // Generic mode — write raw config
        result = await ipc.invoke(
          'dev-tools:write-test-config',
          workingDirectory,
          frameworkInfo.framework,
          { _raw: genericText }
        );
        if (result.success) {
          setSavedGenericText(genericText);
        }
      }

      setSaveStatus(result.message);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [frameworkInfo, isRichMode, isGenericMode, config, genericText, workingDirectory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleClose = useCallback(() => {
    if (actuallyDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  }, [actuallyDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    onClose();
  }, [handleSave, onClose]);

  const setVitestProp = useCallback((key: keyof VitestConfig, value: unknown) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete (next as Record<string, unknown>)[key];
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
    setSaveStatus(null);
  }, []);

  const setJestProp = useCallback((key: keyof JestConfig, value: unknown) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete (next as Record<string, unknown>)[key];
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
    setSaveStatus(null);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading test config...</p>
      </div>
    );
  }

  if (!frameworkInfo?.framework || !frameworkInfo.configPath) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Test Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No test config found. Create one from the Test panel first.
        </p>
      </div>
    );
  }

  const title = FRAMEWORK_LABELS[frameworkInfo.framework] ?? 'Test Config';

  return (
    <div ref={containerRef} className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header bar */}
      <div className="flex items-center border-b border-border px-3 min-h-[36px] gap-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground flex-1">{title}</h3>

        {saveStatus && (
          <span className="text-[10px] text-muted-foreground/70 mr-1">{saveStatus}</span>
        )}
        <button
          onClick={handleSave}
          disabled={!actuallyDirty || saving}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Save (Ctrl+S)"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Close editor"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Editor content */}
      {!isGenericMode && isVitest ? (
        <VitestEditor config={config as VitestConfig} onChange={setVitestProp} />
      ) : !isGenericMode && isJest ? (
        <JestEditor config={config as JestConfig} onChange={setJestProp} />
      ) : (
        <GenericEditor
          text={genericText}
          onChange={(text) => {
            setGenericText(text);
            setSaveStatus(null);
          }}
          framework={frameworkInfo.framework}
        />
      )}

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
            <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveAndClose}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save and close
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Vitest rich GUI editor (8 properties)
// ────────────────────────────────────────────────────────────

function VitestEditor({
  config,
  onChange,
}: {
  config: VitestConfig;
  onChange: (key: keyof VitestConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <ConfigSelect
          label="environment"
          value={config.environment}
          options={ENVIRONMENT_OPTIONS}
          onChange={(v) => onChange('environment', v || undefined)}
          testId="vitest-environment"
        />
        <ConfigToggle
          label="globals"
          value={config.globals}
          onChange={(v) => onChange('globals', v)}
          testId="vitest-globals"
        />
        <ConfigSelect
          label="coverageProvider"
          value={config.coverageProvider}
          options={COVERAGE_PROVIDER_OPTIONS}
          onChange={(v) => onChange('coverageProvider', v || undefined)}
          testId="vitest-coverageProvider"
        />
        <ConfigNumber
          label="testTimeout"
          value={config.testTimeout}
          onChange={(v) => onChange('testTimeout', v)}
          min={100}
          max={60000}
          testId="vitest-testTimeout"
        />
        <ConfigNumber
          label="coverageStatements"
          value={config.coverageStatements}
          onChange={(v) => onChange('coverageStatements', v)}
          min={0}
          max={100}
          testId="vitest-coverageStatements"
        />
        <ConfigNumber
          label="coverageBranches"
          value={config.coverageBranches}
          onChange={(v) => onChange('coverageBranches', v)}
          min={0}
          max={100}
          testId="vitest-coverageBranches"
        />
        <ConfigNumber
          label="coverageFunctions"
          value={config.coverageFunctions}
          onChange={(v) => onChange('coverageFunctions', v)}
          min={0}
          max={100}
          testId="vitest-coverageFunctions"
        />
        <ConfigNumber
          label="coverageLines"
          value={config.coverageLines}
          onChange={(v) => onChange('coverageLines', v)}
          min={0}
          max={100}
          testId="vitest-coverageLines"
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Jest rich GUI editor (3 properties)
// ────────────────────────────────────────────────────────────

function JestEditor({
  config,
  onChange,
}: {
  config: JestConfig;
  onChange: (key: keyof JestConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <ConfigSelect
          label="testEnvironment"
          value={config.testEnvironment}
          options={JEST_ENVIRONMENT_OPTIONS}
          onChange={(v) => onChange('testEnvironment', v || undefined)}
          testId="jest-testEnvironment"
        />
        <ConfigToggle
          label="collectCoverage"
          value={config.collectCoverage}
          onChange={(v) => onChange('collectCoverage', v)}
          testId="jest-collectCoverage"
        />
        <ConfigSelect
          label="coverageProvider"
          value={config.coverageProvider}
          options={JEST_COVERAGE_PROVIDER_OPTIONS}
          onChange={(v) => onChange('coverageProvider', v || undefined)}
          testId="jest-coverageProvider"
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shared property controls
// ────────────────────────────────────────────────────────────

function ConfigToggle({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  testId: string;
}) {
  const selectValue = value === true ? 'true' : value === false ? 'false' : '';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'true' ? true : v === 'false' ? false : undefined);
        }}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

function ConfigNumber({
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : parseInt(val, 10));
        }}
        min={min}
        max={max}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-16"
        data-testid={testId}
      />
    </div>
  );
}

function ConfigSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Generic textarea editor
// ────────────────────────────────────────────────────────────

function GenericEditor({
  text,
  onChange,
  framework,
}: {
  text: string;
  onChange: (text: string) => void;
  framework: string;
}) {
  const hint =
    framework === 'vitest' || framework === 'jest'
      ? 'JavaScript/TypeScript config file (read-only detection — save to create JSON config)'
      : framework === 'pytest'
        ? 'INI/TOML format'
        : 'Config file content';

  return (
    <div className="flex-1 flex flex-col relative">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full p-3 bg-background text-foreground font-mono text-xs resize-none focus:outline-none styled-scroll"
        spellCheck={false}
      />
      <div className="px-3 py-1 border-t border-border shrink-0">
        <span className="text-[9px] text-muted-foreground/60">{hint}</span>
      </div>
    </div>
  );
}
