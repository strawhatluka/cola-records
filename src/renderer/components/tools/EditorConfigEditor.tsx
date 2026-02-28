/**
 * EditorConfigEditor
 *
 * Full-view section-based GUI editor for .editorconfig files.
 * Replaces the MaintenanceTool view when active. Each [glob] section
 * is displayed as a card with property controls (dropdowns, toggles,
 * number inputs). Supports root toggle, add/remove sections, Ctrl+S
 * save, dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  EditorConfigFile,
  EditorConfigSection,
  EditorConfigProperties,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface EditorConfigEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

const INDENT_STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '—' },
  { value: 'space', label: 'space' },
  { value: 'tab', label: 'tab' },
];

const EOL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '—' },
  { value: 'lf', label: 'lf' },
  { value: 'cr', label: 'cr' },
  { value: 'crlf', label: 'crlf' },
];

const CHARSET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '—' },
  { value: 'utf-8', label: 'utf-8' },
  { value: 'utf-8-bom', label: 'utf-8-bom' },
  { value: 'latin1', label: 'latin1' },
  { value: 'utf-16be', label: 'utf-16be' },
  { value: 'utf-16le', label: 'utf-16le' },
];

type BoolOption = 'true' | 'false' | '';

function boolToOption(val: boolean | undefined): BoolOption {
  if (val === true) return 'true';
  if (val === false) return 'false';
  return '';
}

function optionToBool(val: string): boolean | undefined {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
}

function deepEqual(a: EditorConfigFile, b: EditorConfigFile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function EditorConfigEditor({
  workingDirectory,
  ecosystem,
  onClose,
}: EditorConfigEditorProps) {
  const [config, setConfig] = useState<EditorConfigFile>({ root: true, sections: [] });
  const [savedConfig, setSavedConfig] = useState<EditorConfigFile>({ root: true, sections: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDirty = !deepEqual(config, savedConfig);

  // Load config on mount
  useEffect(() => {
    let cancelled = false;

    ipc
      .invoke('dev-tools:read-editorconfig', workingDirectory)
      .then((loaded) => {
        if (!cancelled) {
          setConfig(loaded);
          setSavedConfig(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workingDirectory]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus(null);

    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-editorconfig',
        workingDirectory,
        config
      );

      if (result.success) {
        setSavedConfig(structuredClone(config));
        setSaveStatus(result.message);
      } else {
        setSaveStatus(result.message);
      }
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [workingDirectory, config]);

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

  // ── Section mutations ──

  const updateSection = useCallback((index: number, updates: Partial<EditorConfigSection>) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
    setSaveStatus(null);
  }, []);

  const updateProperty = useCallback(
    (sectionIndex: number, key: keyof EditorConfigProperties, value: unknown) => {
      setConfig((prev) => ({
        ...prev,
        sections: prev.sections.map((s, i) => {
          if (i !== sectionIndex) return s;
          const props = { ...s.properties };
          if (value === undefined || value === '') {
            delete (props as Record<string, unknown>)[key];
          } else {
            (props as Record<string, unknown>)[key] = value;
          }
          return { ...s, properties: props };
        }),
      }));
      setSaveStatus(null);
    },
    []
  );

  const addSection = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, { glob: '', properties: {} }],
    }));
    setSaveStatus(null);
  }, []);

  const removeSection = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
    setSaveStatus(null);
  }, []);

  const addPreset = useCallback(async () => {
    try {
      const sections = await ipc.invoke('dev-tools:get-editorconfig-presets', ecosystem);
      setConfig((prev) => ({
        ...prev,
        sections: [...prev.sections, ...sections],
      }));
      setSaveStatus(null);
    } catch {
      setSaveStatus('Failed to load presets');
    }
  }, [ecosystem]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading .editorconfig...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header bar */}
      <div className="flex items-center border-b border-border px-3 min-h-[36px] gap-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground flex-1">Editor Config</h3>

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
      <div className="flex-1 overflow-auto p-3 styled-scroll">
        {/* Root toggle */}
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.root}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, root: e.target.checked }));
                setSaveStatus(null);
              }}
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">root = true</span>
          </label>
          <span className="text-[9px] text-muted-foreground/60">
            (stop searching parent directories)
          </span>
        </div>

        {/* Sections */}
        {config.sections.map((section, idx) => (
          <SectionCard
            key={idx}
            section={section}
            index={idx}
            onUpdateGlob={(glob) => updateSection(idx, { glob })}
            onUpdateProperty={(key, value) => updateProperty(idx, key, value)}
            onRemove={() => removeSection(idx)}
          />
        ))}

        {/* Add section buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={addSection}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded border border-border hover:bg-accent transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Section
          </button>
          {config.sections.length === 0 && (
            <button
              onClick={addPreset}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add Preset
            </button>
          )}
        </div>
      </div>

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
// Section Card sub-component
// ────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: EditorConfigSection;
  index: number;
  onUpdateGlob: (glob: string) => void;
  onUpdateProperty: (key: keyof EditorConfigProperties, value: unknown) => void;
  onRemove: () => void;
}

function SectionCard({
  section,
  index,
  onUpdateGlob,
  onUpdateProperty,
  onRemove,
}: SectionCardProps) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-background p-3">
      {/* Section header: glob input + remove button */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-muted-foreground font-mono">[</span>
        <input
          type="text"
          value={section.glob}
          onChange={(e) => onUpdateGlob(e.target.value)}
          placeholder="e.g. * or *.md or *.{js,ts}"
          className="flex-1 px-2 py-0.5 text-xs font-mono rounded border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid={`glob-input-${index}`}
        />
        <span className="text-[10px] text-muted-foreground font-mono">]</span>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-destructive/10 transition-colors"
          title="Remove section"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Property controls — 2-column grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {/* indent_style */}
        <PropertySelect
          label="indent_style"
          value={section.properties.indent_style ?? ''}
          options={INDENT_STYLE_OPTIONS}
          onChange={(v) => onUpdateProperty('indent_style', v || undefined)}
        />

        {/* indent_size */}
        <PropertyNumber
          label="indent_size"
          value={section.properties.indent_size}
          onChange={(v) => onUpdateProperty('indent_size', v)}
        />

        {/* tab_width */}
        <PropertyNumber
          label="tab_width"
          value={section.properties.tab_width}
          onChange={(v) => onUpdateProperty('tab_width', v)}
        />

        {/* end_of_line */}
        <PropertySelect
          label="end_of_line"
          value={section.properties.end_of_line ?? ''}
          options={EOL_OPTIONS}
          onChange={(v) => onUpdateProperty('end_of_line', v || undefined)}
        />

        {/* charset */}
        <PropertySelect
          label="charset"
          value={section.properties.charset ?? ''}
          options={CHARSET_OPTIONS}
          onChange={(v) => onUpdateProperty('charset', v || undefined)}
        />

        {/* trim_trailing_whitespace */}
        <PropertyToggle
          label="trim_trailing_whitespace"
          value={boolToOption(section.properties.trim_trailing_whitespace)}
          onChange={(v) => onUpdateProperty('trim_trailing_whitespace', optionToBool(v))}
        />

        {/* insert_final_newline */}
        <PropertyToggle
          label="insert_final_newline"
          value={boolToOption(section.properties.insert_final_newline)}
          onChange={(v) => onUpdateProperty('insert_final_newline', optionToBool(v))}
        />

        {/* max_line_length */}
        <PropertyMaxLineLength
          value={section.properties.max_line_length}
          onChange={(v) => onUpdateProperty('max_line_length', v)}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Property control sub-components
// ────────────────────────────────────────────────────────────

function PropertySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[130px] truncate font-mono">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={`prop-${label}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PropertyNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[130px] truncate font-mono">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : parseInt(val, 10));
        }}
        min={1}
        max={16}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-14"
        data-testid={`prop-${label}`}
      />
    </div>
  );
}

function PropertyToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BoolOption;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[130px] truncate font-mono">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={`prop-${label}`}
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

function PropertyMaxLineLength({
  value,
  onChange,
}: {
  value: number | 'off' | undefined;
  onChange: (value: number | 'off' | undefined) => void;
}) {
  const isOff = value === 'off';
  const displayValue = value === undefined ? '' : isOff ? '' : String(value);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[130px] truncate font-mono">
        max_line_length
      </span>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === '' ? undefined : parseInt(val, 10));
          }}
          disabled={isOff}
          min={1}
          className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-14 disabled:opacity-50"
          data-testid="prop-max_line_length"
        />
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isOff}
            onChange={(e) => onChange(e.target.checked ? 'off' : undefined)}
            className="rounded border-border"
          />
          <span className="text-[9px] text-muted-foreground">off</span>
        </label>
      </div>
    </div>
  );
}
