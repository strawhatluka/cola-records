/**
 * LintEditor
 *
 * Full-view config editor for lint configuration. Replaces MaintenanceTool
 * when active. ESLint JSON mode: rich GUI with env, extends, rules, parser,
 * plugins, ignorePatterns. Generic mode: textarea. Supports Ctrl+S save,
 * dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  LinterInfo,
  LintConfig,
  ESLintConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface LintEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const LINTER_LABELS: Record<string, string> = {
  eslint: 'ESLint',
  ruff: 'Ruff',
  clippy: 'Clippy',
  'golangci-lint': 'golangci-lint',
  rubocop: 'RuboCop',
  phpstan: 'PHPStan',
  checkstyle: 'Checkstyle',
};

export function LintEditor({ workingDirectory, ecosystem, onClose }: LintEditorProps) {
  const [linterInfo, setLinterInfo] = useState<LinterInfo | null>(null);
  const [config, setConfig] = useState<ESLintConfig>({});
  const [savedConfig, setSavedConfig] = useState<ESLintConfig>({});
  const [genericText, setGenericText] = useState('');
  const [savedGenericText, setSavedGenericText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isRichMode = linterInfo?.linter === 'eslint';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info = await ipc.invoke('dev-tools:detect-linter', workingDirectory, ecosystem);
        if (cancelled) return;
        setLinterInfo(info);

        if (!info.configPath || !info.linter) {
          setLoading(false);
          return;
        }

        const loaded: LintConfig = await ipc.invoke(
          'dev-tools:read-lint-config',
          info.configPath,
          info.linter
        );
        if (cancelled) return;

        if (info.linter === 'eslint') {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          } else {
            setConfig(loaded.config as ESLintConfig);
            setSavedConfig(structuredClone(loaded.config as ESLintConfig));
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

  const isGenericMode = !isRichMode || (genericText !== '' && deepEqual(config, {}));

  const actuallyDirty = isGenericMode
    ? genericText !== savedGenericText
    : !deepEqual(config, savedConfig);

  const handleSave = useCallback(async () => {
    if (!linterInfo?.linter) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      let result: SetUpActionResult;

      if (!isGenericMode && isRichMode) {
        result = await ipc.invoke(
          'dev-tools:write-lint-config',
          workingDirectory,
          linterInfo.linter,
          config
        );
        if (result.success) {
          setSavedConfig(structuredClone(config));
        }
      } else {
        result = await ipc.invoke(
          'dev-tools:write-lint-config',
          workingDirectory,
          linterInfo.linter,
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
  }, [linterInfo, isRichMode, isGenericMode, config, genericText, workingDirectory]);

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

  const setConfigField = useCallback((key: keyof ESLintConfig, value: unknown) => {
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
        <p className="text-xs text-muted-foreground">Loading lint config...</p>
      </div>
    );
  }

  if (!linterInfo?.linter || !linterInfo.configPath) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Lint Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No lint config found. Create one from the Lint panel first.
        </p>
      </div>
    );
  }

  const linterLabel = LINTER_LABELS[linterInfo.linter] ?? linterInfo.linter;
  const title = `${linterLabel} Config`;

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
      {!isGenericMode && isRichMode ? (
        <RichESLintEditor config={config} onChange={setConfigField} />
      ) : (
        <GenericLintEditor
          text={genericText}
          onChange={(text) => {
            setGenericText(text);
            setSaveStatus(null);
          }}
          linter={linterInfo.linter}
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
// Rich GUI editor for ESLint JSON config
// ────────────────────────────────────────────────────────────

function RichESLintEditor({
  config,
  onChange,
}: {
  config: ESLintConfig;
  onChange: (key: keyof ESLintConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="space-y-4">
        {/* Environments */}
        <EnvSection
          env={config.env ?? {}}
          onChange={(env) => onChange('env', Object.keys(env).length > 0 ? env : undefined)}
        />

        {/* Extends */}
        <ListSection
          label="Extends"
          items={config.extends ?? []}
          onChange={(items) => onChange('extends', items.length > 0 ? items : undefined)}
          testId="lint-extends"
        />

        {/* Plugins */}
        <ListSection
          label="Plugins"
          items={config.plugins ?? []}
          onChange={(items) => onChange('plugins', items.length > 0 ? items : undefined)}
          testId="lint-plugins"
        />

        {/* Parser */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-foreground">Parser</span>
          <input
            type="text"
            value={config.parser ?? ''}
            onChange={(e) => onChange('parser', e.target.value || undefined)}
            placeholder="e.g. @typescript-eslint/parser"
            className="w-full px-2 py-1 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="lint-parser"
          />
        </div>

        {/* Ignore Patterns */}
        <ListSection
          label="Ignore Patterns"
          items={config.ignorePatterns ?? []}
          onChange={(items) => onChange('ignorePatterns', items.length > 0 ? items : undefined)}
          testId="lint-ignorePatterns"
        />

        {/* Rules */}
        <RulesSection
          rules={config.rules ?? {}}
          onChange={(rules) => onChange('rules', Object.keys(rules).length > 0 ? rules : undefined)}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Environment toggles
// ────────────────────────────────────────────────────────────

const COMMON_ENVS = ['browser', 'node', 'es2021', 'es2022', 'jest', 'mocha', 'commonjs'];

function EnvSection({
  env,
  onChange,
}: {
  env: Record<string, boolean>;
  onChange: (env: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-foreground">Environments</span>
      <div className="grid grid-cols-2 gap-1">
        {COMMON_ENVS.map((key) => (
          <label
            key={key}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer"
          >
            <input
              type="checkbox"
              checked={env[key] === true}
              onChange={(e) => {
                const next = { ...env };
                if (e.target.checked) {
                  next[key] = true;
                } else {
                  delete next[key];
                }
                onChange(next);
              }}
              className="h-3 w-3 rounded border-border"
              data-testid={`lint-env-${key}`}
            />
            <span className="font-mono">{key}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// String list (extends, plugins, ignorePatterns)
// ────────────────────────────────────────────────────────────

function ListSection({
  label,
  items,
  onChange,
  testId,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  testId: string;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setNewItem('');
    }
  };

  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-foreground">{label}</span>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <span className="flex-1 px-2 py-0.5 text-[10px] font-mono bg-muted rounded truncate">
            {item}
          </span>
          <button
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title={`Remove ${item}`}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="flex-1 px-2 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid={testId}
        />
        <button
          onClick={handleAdd}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Add"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Rules key/value editor
// ────────────────────────────────────────────────────────────

const RULE_VALUES = ['off', 'warn', 'error'];

function RulesSection({
  rules,
  onChange,
}: {
  rules: Record<string, unknown>;
  onChange: (rules: Record<string, unknown>) => void;
}) {
  const [newRuleName, setNewRuleName] = useState('');

  const handleAddRule = () => {
    const trimmed = newRuleName.trim();
    if (trimmed && !(trimmed in rules)) {
      onChange({ ...rules, [trimmed]: 'warn' });
      setNewRuleName('');
    }
  };

  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-foreground">Rules</span>
      {Object.entries(rules).map(([name, value]) => {
        const strValue =
          typeof value === 'string'
            ? value
            : typeof value === 'number'
              ? (RULE_VALUES[value] ?? String(value))
              : JSON.stringify(value);

        return (
          <div key={name} className="flex items-center gap-1">
            <span className="w-1/2 px-2 py-0.5 text-[10px] font-mono bg-muted rounded truncate">
              {name}
            </span>
            <select
              value={RULE_VALUES.includes(strValue) ? strValue : ''}
              onChange={(e) => {
                const next = { ...rules };
                next[name] = e.target.value;
                onChange(next);
              }}
              className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid={`lint-rule-${name}`}
            >
              {!RULE_VALUES.includes(strValue) && <option value="">{strValue}</option>}
              <option value="off">off</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
            <button
              onClick={() => {
                const next = { ...rules };
                delete next[name];
                onChange(next);
              }}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title={`Remove ${name}`}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={newRuleName}
          onChange={(e) => setNewRuleName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddRule();
            }
          }}
          placeholder="Add rule..."
          className="flex-1 px-2 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="lint-add-rule"
        />
        <button
          onClick={handleAddRule}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Add rule"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Generic textarea editor
// ────────────────────────────────────────────────────────────

function GenericLintEditor({
  text,
  onChange,
  linter,
}: {
  text: string;
  onChange: (text: string) => void;
  linter: string;
}) {
  const hint =
    linter === 'eslint'
      ? 'JavaScript/TypeScript config file'
      : linter === 'ruff'
        ? 'TOML config file'
        : linter === 'rubocop'
          ? 'YAML config file'
          : linter === 'golangci-lint'
            ? 'YAML config file'
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
