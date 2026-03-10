/**
 * FormatEditor
 *
 * Full-view config editor for formatter configuration. Replaces MaintenanceTool
 * when active. Prettier mode: rich GUI with toggles, dropdowns, and number inputs
 * for all 12 Prettier properties. Generic mode: textarea for JSON/TOML content.
 * Supports Ctrl+S save, dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  FormatterInfo,
  FormatterConfig,
  PrettierConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface FormatEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

const FORMATTER_LABELS: Record<string, string> = {
  prettier: 'Prettier Config',
  ruff: 'Ruff Config',
  black: 'Black Config',
  rustfmt: 'rustfmt Config',
  rubocop: 'RuboCop Config',
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Prettier property definitions ──

const TRAILING_COMMA_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'es5', label: 'es5' },
  { value: 'all', label: 'all' },
];

const ARROW_PARENS_OPTIONS = [
  { value: 'avoid', label: 'avoid' },
  { value: 'always', label: 'always' },
];

const END_OF_LINE_OPTIONS = [
  { value: 'lf', label: 'lf' },
  { value: 'crlf', label: 'crlf' },
  { value: 'cr', label: 'cr' },
  { value: 'auto', label: 'auto' },
];

const QUOTE_PROPS_OPTIONS = [
  { value: 'as-needed', label: 'as-needed' },
  { value: 'consistent', label: 'consistent' },
  { value: 'preserve', label: 'preserve' },
];

const PROSE_WRAP_OPTIONS = [
  { value: 'always', label: 'always' },
  { value: 'never', label: 'never' },
  { value: 'preserve', label: 'preserve' },
];

export function FormatEditor({ workingDirectory, ecosystem, onClose }: FormatEditorProps) {
  const [formatterInfo, setFormatterInfo] = useState<FormatterInfo | null>(null);
  const [config, setConfig] = useState<PrettierConfig | Record<string, unknown>>({});
  const [savedConfig, setSavedConfig] = useState<PrettierConfig | Record<string, unknown>>({});
  const [genericText, setGenericText] = useState('');
  const [savedGenericText, setSavedGenericText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPrettier = formatterInfo?.formatter === 'prettier';
  const isDirty = isPrettier ? !deepEqual(config, savedConfig) : genericText !== savedGenericText;

  // Load config on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info = await ipc.invoke('dev-tools:detect-formatter', workingDirectory, ecosystem);
        if (cancelled) return;
        setFormatterInfo(info);

        if (!info.configPath || !info.formatter) {
          setLoading(false);
          return;
        }

        const loaded: FormatterConfig = await ipc.invoke(
          'dev-tools:read-format-config',
          info.configPath,
          info.formatter
        );
        if (cancelled) return;

        if (info.formatter === 'prettier') {
          setConfig(loaded.config);
          setSavedConfig(structuredClone(loaded.config));
        } else {
          // Generic mode: show raw text for TOML/YAML configs
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          } else {
            // Convert config object back to key=value lines
            const lines = Object.entries(loaded.config)
              .map(([k, v]) => {
                if (typeof v === 'string') return `${k} = "${v}"`;
                return `${k} = ${String(v)}`;
              })
              .join('\n');
            setGenericText(lines);
            setSavedGenericText(lines);
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

  const handleSave = useCallback(async () => {
    if (!formatterInfo?.formatter) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      let result: SetUpActionResult;

      if (isPrettier) {
        result = await ipc.invoke(
          'dev-tools:write-format-config',
          workingDirectory,
          formatterInfo.formatter,
          config
        );
        if (result.success) {
          setSavedConfig(structuredClone(config));
        }
      } else {
        // For generic mode, parse text back into config object
        // Write the raw text — the service handles serialization
        result = await ipc.invoke(
          'dev-tools:write-format-config',
          workingDirectory,
          formatterInfo.formatter,
          formatterInfo.formatter === 'ruff' || formatterInfo.formatter === 'rustfmt'
            ? parseTomlText(genericText)
            : { _raw: genericText }
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
  }, [formatterInfo, isPrettier, config, genericText, workingDirectory]);

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
    if (isDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    onClose();
  }, [handleSave, onClose]);

  // ── Prettier property updaters ──

  const setPrettierProp = useCallback((key: keyof PrettierConfig, value: unknown) => {
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

  // ── Render ──

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading formatter config...</p>
      </div>
    );
  }

  if (!formatterInfo?.formatter || !formatterInfo.configPath) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Format Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No formatter config found. Create one from the Format panel first.
        </p>
      </div>
    );
  }

  const title = FORMATTER_LABELS[formatterInfo.formatter] ?? 'Format Config';

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
          disabled={!isDirty || saving}
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
      {isPrettier ? (
        <PrettierEditor config={config as PrettierConfig} onChange={setPrettierProp} />
      ) : (
        <GenericEditor
          text={genericText}
          onChange={(text) => {
            setGenericText(text);
            setSaveStatus(null);
          }}
          formatter={formatterInfo.formatter}
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
// Prettier rich GUI editor
// ────────────────────────────────────────────────────────────

function PrettierEditor({
  config,
  onChange,
}: {
  config: PrettierConfig;
  onChange: (key: keyof PrettierConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {/* Toggle properties */}
        <PrettierToggle label="semi" value={config.semi} onChange={(v) => onChange('semi', v)} />
        <PrettierToggle
          label="singleQuote"
          value={config.singleQuote}
          onChange={(v) => onChange('singleQuote', v)}
        />
        <PrettierToggle
          label="useTabs"
          value={config.useTabs}
          onChange={(v) => onChange('useTabs', v)}
        />
        <PrettierToggle
          label="bracketSpacing"
          value={config.bracketSpacing}
          onChange={(v) => onChange('bracketSpacing', v)}
        />
        <PrettierToggle
          label="jsxSingleQuote"
          value={config.jsxSingleQuote}
          onChange={(v) => onChange('jsxSingleQuote', v)}
        />

        {/* Number properties */}
        <PrettierNumber
          label="printWidth"
          value={config.printWidth}
          onChange={(v) => onChange('printWidth', v)}
          min={40}
          max={300}
        />
        <PrettierNumber
          label="tabWidth"
          value={config.tabWidth}
          onChange={(v) => onChange('tabWidth', v)}
          min={1}
          max={16}
        />

        {/* Dropdown properties */}
        <PrettierSelect
          label="trailingComma"
          value={config.trailingComma}
          options={TRAILING_COMMA_OPTIONS}
          onChange={(v) => onChange('trailingComma', v || undefined)}
        />
        <PrettierSelect
          label="arrowParens"
          value={config.arrowParens}
          options={ARROW_PARENS_OPTIONS}
          onChange={(v) => onChange('arrowParens', v || undefined)}
        />
        <PrettierSelect
          label="endOfLine"
          value={config.endOfLine}
          options={END_OF_LINE_OPTIONS}
          onChange={(v) => onChange('endOfLine', v || undefined)}
        />
        <PrettierSelect
          label="quoteProps"
          value={config.quoteProps}
          options={QUOTE_PROPS_OPTIONS}
          onChange={(v) => onChange('quoteProps', v || undefined)}
        />
        <PrettierSelect
          label="proseWrap"
          value={config.proseWrap}
          options={PROSE_WRAP_OPTIONS}
          onChange={(v) => onChange('proseWrap', v || undefined)}
        />
      </div>
    </div>
  );
}

function PrettierToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
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
        data-testid={`prettier-${label}`}
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

function PrettierNumber({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
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
        data-testid={`prettier-${label}`}
      />
    </div>
  );
}

function PrettierSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={`prettier-${label}`}
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
  formatter,
}: {
  text: string;
  onChange: (text: string) => void;
  formatter: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hint =
    formatter === 'ruff' || formatter === 'rustfmt'
      ? 'TOML format: key = value'
      : formatter === 'rubocop'
        ? 'YAML format (read-only detection — save to overwrite)'
        : 'JSON format';

  return (
    <div className="flex-1 flex flex-col relative">
      <textarea
        ref={textareaRef}
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

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function parseTomlText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('[')) continue;
    const match = line.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value: unknown = match[2].trim();
      const strValue = value as string;
      if (strValue === 'true') value = true;
      else if (strValue === 'false') value = false;
      else if (/^\d+$/.test(strValue)) value = parseInt(strValue, 10);
      else if (strValue.startsWith('"') && strValue.endsWith('"')) {
        value = strValue.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}
