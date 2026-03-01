/**
 * CoverageEditor
 *
 * Full-view config editor for coverage configuration. Replaces MaintenanceTool
 * when active. Vitest/Jest mode: rich GUI with provider, 4 thresholds, include,
 * exclude, reporters, reportsDirectory, all, cleanOnRerun. Generic mode: textarea.
 * Supports Ctrl+S save, dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  CoverageProviderInfo,
  CoverageConfig,
  VitestCoverageConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface CoverageEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const PROVIDER_OPTIONS = [
  { value: 'v8', label: 'v8' },
  { value: 'istanbul', label: 'istanbul' },
];

const REPORTER_OPTIONS = ['text', 'html', 'lcov', 'json', 'clover', 'text-summary', 'cobertura'];

export function CoverageEditor({ workingDirectory, ecosystem, onClose }: CoverageEditorProps) {
  const [providerInfo, setProviderInfo] = useState<CoverageProviderInfo | null>(null);
  const [config, setConfig] = useState<VitestCoverageConfig>({});
  const [savedConfig, setSavedConfig] = useState<VitestCoverageConfig>({});
  const [genericText, setGenericText] = useState('');
  const [savedGenericText, setSavedGenericText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isRichMode = providerInfo?.provider === 'v8' || providerInfo?.provider === 'istanbul';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info = await ipc.invoke('dev-tools:detect-coverage', workingDirectory, ecosystem);
        if (cancelled) return;
        setProviderInfo(info);

        if (!info.configPath || !info.provider) {
          setLoading(false);
          return;
        }

        const loaded: CoverageConfig = await ipc.invoke(
          'dev-tools:read-coverage-config',
          info.configPath,
          info.provider
        );
        if (cancelled) return;

        if (info.provider === 'v8' || info.provider === 'istanbul') {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          } else {
            setConfig(loaded.config as VitestCoverageConfig);
            setSavedConfig(structuredClone(loaded.config as VitestCoverageConfig));
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
    if (!providerInfo?.provider) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      let result: SetUpActionResult;

      if (!isGenericMode && isRichMode) {
        result = await ipc.invoke(
          'dev-tools:write-coverage-config',
          workingDirectory,
          providerInfo.provider,
          config
        );
        if (result.success) {
          setSavedConfig(structuredClone(config));
        }
      } else {
        result = await ipc.invoke(
          'dev-tools:write-coverage-config',
          workingDirectory,
          providerInfo.provider,
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
  }, [providerInfo, isRichMode, isGenericMode, config, genericText, workingDirectory]);

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

  const setProp = useCallback((key: keyof VitestCoverageConfig, value: unknown) => {
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
        <p className="text-xs text-muted-foreground">Loading coverage config...</p>
      </div>
    );
  }

  if (!providerInfo?.provider || !providerInfo.configPath) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Coverage Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No coverage config found. Create one from the Coverage panel first.
        </p>
      </div>
    );
  }

  const title =
    providerInfo.provider === 'v8'
      ? 'Vitest Coverage Config'
      : providerInfo.provider === 'istanbul'
        ? 'Jest Coverage Config'
        : 'Coverage Config';

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
        <RichCoverageEditor config={config} onChange={setProp} />
      ) : (
        <GenericEditor
          text={genericText}
          onChange={(text) => {
            setGenericText(text);
            setSaveStatus(null);
          }}
          provider={providerInfo.provider}
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
// Rich GUI editor (11 properties)
// ────────────────────────────────────────────────────────────

function RichCoverageEditor({
  config,
  onChange,
}: {
  config: VitestCoverageConfig;
  onChange: (key: keyof VitestCoverageConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <ConfigSelect
          label="provider"
          value={config.provider}
          options={PROVIDER_OPTIONS}
          onChange={(v) => onChange('provider', v || undefined)}
          testId="coverage-provider"
        />
        <ConfigToggle
          label="all"
          value={config.all}
          onChange={(v) => onChange('all', v)}
          testId="coverage-all"
        />
        <ConfigToggle
          label="cleanOnRerun"
          value={config.cleanOnRerun}
          onChange={(v) => onChange('cleanOnRerun', v)}
          testId="coverage-cleanOnRerun"
        />
        <ConfigText
          label="reportsDirectory"
          value={config.reportsDirectory}
          onChange={(v) => onChange('reportsDirectory', v || undefined)}
          testId="coverage-reportsDirectory"
        />
        <ConfigNumber
          label="statements"
          value={config.statements}
          onChange={(v) => onChange('statements', v)}
          min={0}
          max={100}
          testId="coverage-statements"
        />
        <ConfigNumber
          label="branches"
          value={config.branches}
          onChange={(v) => onChange('branches', v)}
          min={0}
          max={100}
          testId="coverage-branches"
        />
        <ConfigNumber
          label="functions"
          value={config.functions}
          onChange={(v) => onChange('functions', v)}
          min={0}
          max={100}
          testId="coverage-functions"
        />
        <ConfigNumber
          label="lines"
          value={config.lines}
          onChange={(v) => onChange('lines', v)}
          min={0}
          max={100}
          testId="coverage-lines"
        />
      </div>

      <div className="mt-4 space-y-3">
        <StringListEditor
          label="reporters"
          items={config.reporters ?? []}
          onChange={(items) => onChange('reporters', items.length > 0 ? items : undefined)}
          suggestions={REPORTER_OPTIONS}
          testId="coverage-reporters"
        />
        <StringListEditor
          label="include"
          items={config.include ?? []}
          onChange={(items) => onChange('include', items.length > 0 ? items : undefined)}
          testId="coverage-include"
        />
        <StringListEditor
          label="exclude"
          items={config.exclude ?? []}
          onChange={(items) => onChange('exclude', items.length > 0 ? items : undefined)}
          testId="coverage-exclude"
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

function ConfigText({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      />
    </div>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
  suggestions,
  testId,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  suggestions?: string[];
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

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const unusedSuggestions = suggestions?.filter((s) => !items.includes(s)) ?? [];

  return (
    <div data-testid={testId}>
      <span className="text-[9px] text-muted-foreground font-mono block mb-1">{label}</span>
      <div className="flex flex-wrap gap-1 mb-1">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground border border-border"
          >
            {item}
            <button
              onClick={() => handleRemove(i)}
              className="p-0 hover:text-foreground transition-colors"
              title={`Remove ${item}`}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
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
          placeholder={`Add ${label}...`}
          list={unusedSuggestions.length > 0 ? `${testId}-suggestions` : undefined}
          className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid={`${testId}-input`}
        />
        {unusedSuggestions.length > 0 && (
          <datalist id={`${testId}-suggestions`}>
            {unusedSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="p-0.5 rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={`Add ${label}`}
          data-testid={`${testId}-add`}
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

function GenericEditor({
  text,
  onChange,
  provider,
}: {
  text: string;
  onChange: (text: string) => void;
  provider: string;
}) {
  const hint =
    provider === 'v8' || provider === 'istanbul'
      ? 'JavaScript/TypeScript config file'
      : provider === 'coverage-py'
        ? 'INI format (.coveragerc)'
        : provider === 'nyc'
          ? 'nyc config (JSON/YAML)'
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
