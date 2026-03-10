/**
 * PackageConfigEditor
 *
 * Full-view editor for package configuration files. Replaces MaintenanceTool
 * view when active. Supports all ecosystems with a tiered approach:
 *   Tier 1 (node/php): Rich GUI with 4 tabs (General, Scripts, Dependencies, Advanced)
 *   Tier 2 (python/rust): Section-aware TOML editor with extracted fields
 *   Tier 3 (go/ruby/java): Structured text editor with section navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  Loader2,
  Plus,
  Trash2,
  Play,
  Search,
  ChevronDown,
  ChevronRight,
  FileJson,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  PackageManager,
  PackageConfigData,
  NpmSearchResult,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface PackageConfigEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  packageManager: PackageManager;
  onClose: () => void;
  onRunCommand: (command: string) => void;
}

type TabName = 'general' | 'scripts' | 'dependencies' | 'advanced';
type DepSection = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

const TABS: { name: TabName; label: string }[] = [
  { name: 'general', label: 'General' },
  { name: 'scripts', label: 'Scripts' },
  { name: 'dependencies', label: 'Dependencies' },
  { name: 'advanced', label: 'Advanced' },
];

const DEP_SECTIONS: { key: DepSection; label: string }[] = [
  { key: 'dependencies', label: 'dependencies' },
  { key: 'devDependencies', label: 'devDependencies' },
  { key: 'peerDependencies', label: 'peerDependencies' },
  { key: 'optionalDependencies', label: 'optionalDependencies' },
];

const COMMON_LICENSES = ['MIT', 'Apache-2.0', 'ISC', 'GPL-3.0', 'BSD-2-Clause', 'Unlicense'];
const COMMON_SCRIPT_NAMES = ['start', 'dev', 'build', 'test', 'lint', 'format', 'preview', 'clean'];
const TIER1_ECOSYSTEMS: Ecosystem[] = ['node', 'php'];

function getStr(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? v : '';
}

function getBool(obj: Record<string, unknown>, key: string): boolean {
  return obj[key] === true;
}

function getRecord(obj: Record<string, unknown>, key: string): Record<string, string> {
  const v = obj[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>;
  return {};
}

function getStringArray(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key];
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
  return [];
}

export function PackageConfigEditor({
  workingDirectory,
  ecosystem,
  onClose,
  onRunCommand,
}: PackageConfigEditorProps) {
  const [config, setConfig] = useState<PackageConfigData | null>(null);
  const [savedConfig, setSavedConfig] = useState<PackageConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('general');

  // Dependency search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NpmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // New script form state
  const [newScriptName, setNewScriptName] = useState('');
  const [newScriptCmd, setNewScriptCmd] = useState('');

  // New dep form state
  const [newDepName, setNewDepName] = useState('');
  const [newDepVersion, setNewDepVersion] = useState('');
  const [newDepSection, setNewDepSection] = useState<DepSection>('dependencies');

  // Keyword input state
  const [keywordInput, setKeywordInput] = useState('');

  // Collapsed dep sections
  const [collapsedSections, setCollapsedSections] = useState<Set<DepSection>>(new Set());

  // Tier 2/3 section nav state
  const [activeSection, setActiveSection] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const isTier1 = TIER1_ECOSYSTEMS.includes(ecosystem);
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  // Load config on mount
  useEffect(() => {
    let cancelled = false;

    ipc
      .invoke('dev-tools:read-package-config', workingDirectory, ecosystem)
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) {
          setConfig(loaded);
          setSavedConfig(structuredClone(loaded));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workingDirectory, ecosystem]);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-package-config',
        workingDirectory,
        ecosystem,
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
  }, [workingDirectory, ecosystem, config]);

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

  // ── Structured data helpers ──

  const structured = (config?.structured ?? {}) as Record<string, unknown>;

  const updateField = useCallback((key: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev || !prev.structured) return prev;
      const next = { ...prev, structured: { ...prev.structured, [key]: value } };
      if (value === undefined || value === '' || value === null) {
        delete (next.structured as Record<string, unknown>)[key];
      }
      return next;
    });
    setSaveStatus(null);
  }, []);

  const updateRaw = useCallback((raw: string) => {
    setConfig((prev) => (prev ? { ...prev, raw } : prev));
    setSaveStatus(null);
  }, []);

  // ── NPM search ──

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await ipc.invoke('dev-tools:search-npm-registry', query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // ── Dependency helpers ──

  const findDuplicateDep = useCallback(
    (name: string, excludeSection?: DepSection): DepSection | null => {
      for (const { key } of DEP_SECTIONS) {
        if (key === excludeSection) continue;
        const deps = getRecord(structured, key);
        if (name in deps) return key;
      }
      return null;
    },
    [structured]
  );

  const addDep = useCallback(
    (name: string, version: string, section: DepSection) => {
      const deps = { ...getRecord(structured, section) };
      deps[name] = version;
      updateField(section, deps);
    },
    [structured, updateField]
  );

  const removeDep = useCallback(
    (name: string, section: DepSection) => {
      const deps = { ...getRecord(structured, section) };
      delete deps[name];
      updateField(section, Object.keys(deps).length > 0 ? deps : undefined);
    },
    [structured, updateField]
  );

  const moveDep = useCallback(
    (name: string, from: DepSection, to: DepSection) => {
      const fromDeps = { ...getRecord(structured, from) };
      const version = fromDeps[name];
      if (!version) return;
      delete fromDeps[name];
      updateField(from, Object.keys(fromDeps).length > 0 ? fromDeps : undefined);
      addDep(name, version, to);
    },
    [structured, updateField, addDep]
  );

  // ── Script helpers ──

  const addScript = useCallback(
    (name: string, cmd: string) => {
      const scripts = { ...getRecord(structured, 'scripts') };
      scripts[name] = cmd;
      updateField('scripts', scripts);
    },
    [structured, updateField]
  );

  const removeScript = useCallback(
    (name: string) => {
      const scripts = { ...getRecord(structured, 'scripts') };
      delete scripts[name];
      updateField('scripts', Object.keys(scripts).length > 0 ? scripts : undefined);
    },
    [structured, updateField]
  );

  // ── Keyword helpers ──

  const addKeyword = useCallback(
    (kw: string) => {
      const keywords = [...getStringArray(structured, 'keywords')];
      if (!keywords.includes(kw)) {
        keywords.push(kw);
        updateField('keywords', keywords);
      }
    },
    [structured, updateField]
  );

  const removeKeyword = useCallback(
    (kw: string) => {
      const keywords = getStringArray(structured, 'keywords').filter((k) => k !== kw);
      updateField('keywords', keywords.length > 0 ? keywords : undefined);
    },
    [structured, updateField]
  );

  // ── Tier 2/3 section parsing ──

  const rawSections = (() => {
    if (!config?.raw) return [];
    const lines = config.raw.split('\n');
    const sections: { header: string; start: number; end: number }[] = [];
    let currentHeader = '';
    let currentStart = -1;

    lines.forEach((line, i) => {
      const match = line.match(/^\[([^\]]+)\]/);
      if (match) {
        if (currentStart >= 0)
          sections.push({ header: currentHeader, start: currentStart, end: i - 1 });
        currentHeader = match[1];
        currentStart = i;
      }
    });
    if (currentStart >= 0)
      sections.push({ header: currentHeader, start: currentStart, end: lines.length - 1 });
    if (sections.length === 0 && config.raw.trim()) {
      sections.push({ header: 'File', start: 0, end: lines.length - 1 });
    }
    return sections;
  })();

  // ── Loading state ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <FileJson className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No config file found</p>
        <button onClick={onClose} className="text-xs text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  // ── Render helpers ──

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2">
        <FileJson className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{config.fileName}</h3>
        {isDirty && <span className="h-2 w-2 rounded-full bg-orange-400" title="Unsaved changes" />}
      </div>
      <div className="flex items-center gap-2">
        {saveStatus && <span className="text-[10px] text-muted-foreground">{saveStatus}</span>}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  const renderClosePrompt = () => {
    if (!showClosePrompt) return null;
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background border border-border rounded-lg p-4 max-w-xs">
          <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowClosePrompt(false)}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent"
            >
              Close without saving
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-3 py-1.5 text-xs border border-primary bg-primary/10 text-primary rounded hover:bg-primary/20"
            >
              Save and close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // TIER 1: Rich GUI (node/php)
  // ═══════════════════════════════════════════════════

  if (isTier1 && config.structured) {
    const renderGeneralTab = () => (
      <div className="flex-1 space-y-3 p-4 overflow-y-auto styled-scroll">
        {/* name */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">
            name <span className="text-red-400">*</span>
          </span>
          <input
            type="text"
            value={getStr(structured, 'name')}
            onChange={(e) => updateField('name', e.target.value)}
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="my-package"
          />
        </label>

        {/* description */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">description</span>
          <textarea
            value={getStr(structured, 'description')}
            onChange={(e) => updateField('description', e.target.value || undefined)}
            rows={2}
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </label>

        {/* type */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">type</span>
          <select
            value={getStr(structured, 'type')}
            onChange={(e) => updateField('type', e.target.value || undefined)}
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">—</option>
            <option value="module">module</option>
            <option value="commonjs">commonjs</option>
          </select>
        </label>

        {/* main / types */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">main</span>
            <input
              type="text"
              value={getStr(structured, 'main')}
              onChange={(e) => updateField('main', e.target.value || undefined)}
              className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="index.js"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">types</span>
            <input
              type="text"
              value={getStr(structured, 'types')}
              onChange={(e) => updateField('types', e.target.value || undefined)}
              className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="index.d.ts"
            />
          </label>
        </div>

        {/* license */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">license</span>
          <select
            value={
              COMMON_LICENSES.includes(getStr(structured, 'license'))
                ? getStr(structured, 'license')
                : '__custom'
            }
            onChange={(e) => {
              if (e.target.value !== '__custom')
                updateField('license', e.target.value || undefined);
            }}
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">—</option>
            {COMMON_LICENSES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value="__custom">Custom...</option>
          </select>
          {!COMMON_LICENSES.includes(getStr(structured, 'license')) &&
            getStr(structured, 'license') && (
              <input
                type="text"
                value={getStr(structured, 'license')}
                onChange={(e) => updateField('license', e.target.value || undefined)}
                className="mt-1 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Custom license"
              />
            )}
        </label>

        {/* author — structured */}
        <fieldset className="border border-border rounded p-2">
          <legend className="text-[11px] font-medium text-muted-foreground px-1">author</legend>
          {typeof structured.author === 'object' && structured.author !== null ? (
            <div className="space-y-1.5">
              {['name', 'email', 'url'].map((field) => (
                <input
                  key={field}
                  type="text"
                  value={(structured.author as Record<string, string>)?.[field] ?? ''}
                  onChange={(e) => {
                    const author = { ...(structured.author as Record<string, string>) };
                    if (e.target.value) author[field] = e.target.value;
                    else delete author[field];
                    updateField('author', Object.keys(author).length > 0 ? author : undefined);
                  }}
                  placeholder={field}
                  className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={getStr(structured, 'author')}
              onChange={(e) => updateField('author', e.target.value || undefined)}
              placeholder="Name <email> (url)"
              className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </fieldset>

        {/* repository */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">repository</span>
          <input
            type="text"
            value={
              typeof structured.repository === 'string'
                ? (structured.repository as string)
                : ((structured.repository as Record<string, string>)?.url ?? '')
            }
            onChange={(e) => updateField('repository', e.target.value || undefined)}
            placeholder="https://github.com/user/repo"
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        {/* homepage */}
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">homepage</span>
          <input
            type="text"
            value={getStr(structured, 'homepage')}
            onChange={(e) => updateField('homepage', e.target.value || undefined)}
            placeholder="https://example.com"
            className="mt-0.5 w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        {/* keywords */}
        <div>
          <span className="text-[11px] font-medium text-muted-foreground">keywords</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {getStringArray(structured, 'keywords').map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full"
              >
                {kw}
                <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && keywordInput.trim()) {
                  e.preventDefault();
                  addKeyword(keywordInput.trim());
                  setKeywordInput('');
                }
              }}
              placeholder="Add keyword..."
              className="flex-1 min-w-[80px] px-1.5 py-0.5 text-[10px] bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* private toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">private</span>
          <button
            onClick={() => updateField('private', !getBool(structured, 'private') || undefined)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              getBool(structured, 'private') ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                getBool(structured, 'private') ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>
      </div>
    );

    const renderScriptsTab = () => {
      const scripts = getRecord(structured, 'scripts');
      const entries = Object.entries(scripts);

      return (
        <div className="flex-1 p-4 overflow-y-auto styled-scroll space-y-2">
          {entries.map(([name, cmd]) => (
            <div
              key={name}
              className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/20"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{name}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">{cmd}</p>
              </div>
              <button
                onClick={() => onRunCommand(cmd)}
                className="p-1 rounded hover:bg-accent"
                title={`Run "${name}"`}
              >
                <Play className="h-3 w-3 text-primary" />
              </button>
              <button
                onClick={() => removeScript(name)}
                className="p-1 rounded hover:bg-accent"
                title="Delete"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
              </button>
            </div>
          ))}

          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No scripts defined</p>
          )}

          {/* Add script form */}
          <div className="flex items-end gap-2 pt-2 border-t border-border">
            <div className="flex-1">
              <span className="text-[10px] text-muted-foreground">name</span>
              <input
                type="text"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                list="script-name-suggestions"
                placeholder="build"
                className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="script-name-suggestions">
                {COMMON_SCRIPT_NAMES.filter((n) => !(n in scripts)).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="flex-[2]">
              <span className="text-[10px] text-muted-foreground">command</span>
              <input
                type="text"
                value={newScriptCmd}
                onChange={(e) => setNewScriptCmd(e.target.value)}
                placeholder="tsc && node dist/index.js"
                className="w-full px-2 py-1 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newScriptName.trim() && newScriptCmd.trim()) {
                    addScript(newScriptName.trim(), newScriptCmd.trim());
                    setNewScriptName('');
                    setNewScriptCmd('');
                  }
                }}
              />
            </div>
            <button
              onClick={() => {
                if (newScriptName.trim() && newScriptCmd.trim()) {
                  addScript(newScriptName.trim(), newScriptCmd.trim());
                  setNewScriptName('');
                  setNewScriptCmd('');
                }
              }}
              disabled={!newScriptName.trim() || !newScriptCmd.trim()}
              className="px-2 py-1 text-xs border border-primary text-primary rounded hover:bg-primary/10 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    };

    const renderDepsTab = () => (
      <div className="flex-1 p-4 overflow-y-auto styled-scroll space-y-3">
        {/* Search bar */}
        <div className="relative">
          <div className="flex items-center gap-1 px-2 py-1.5 border border-border rounded bg-muted/40">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search npm registry..."
              className="flex-1 text-xs bg-transparent focus:outline-none"
            />
            {searching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto styled-scroll border border-border rounded bg-background shadow-lg">
              {searchResults.map((pkg) => (
                <button
                  key={pkg.name}
                  onClick={() => {
                    setNewDepName(pkg.name);
                    setNewDepVersion(`^${pkg.version}`);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-accent"
                >
                  <p className="text-xs font-medium text-foreground">{pkg.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    v{pkg.version} — {pkg.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add dep form */}
        <div className="flex items-end gap-2 pb-2 border-b border-border">
          <div className="flex-1">
            <span className="text-[10px] text-muted-foreground">package</span>
            <input
              type="text"
              value={newDepName}
              onChange={(e) => setNewDepName(e.target.value)}
              placeholder="package-name"
              className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="w-28">
            <span className="text-[10px] text-muted-foreground">version</span>
            <input
              type="text"
              value={newDepVersion}
              onChange={(e) => setNewDepVersion(e.target.value)}
              placeholder="^1.0.0"
              className="w-full px-2 py-1 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="w-36">
            <span className="text-[10px] text-muted-foreground">section</span>
            <select
              value={newDepSection}
              onChange={(e) => setNewDepSection(e.target.value as DepSection)}
              className="w-full px-2 py-1 text-xs bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DEP_SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (newDepName.trim() && newDepVersion.trim()) {
                const dup = findDuplicateDep(newDepName.trim());
                if (dup) {
                  setSaveStatus(`"${newDepName}" already in ${dup}`);
                  return;
                }
                addDep(newDepName.trim(), newDepVersion.trim(), newDepSection);
                setNewDepName('');
                setNewDepVersion('');
              }
            }}
            disabled={!newDepName.trim() || !newDepVersion.trim()}
            className="px-2 py-1 text-xs border border-primary text-primary rounded hover:bg-primary/10 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Dep sections */}
        {DEP_SECTIONS.map(({ key, label }) => {
          const deps = getRecord(structured, key);
          const entries = Object.entries(deps);
          const collapsed = collapsedSections.has(key);

          return (
            <div key={key}>
              <button
                onClick={() =>
                  setCollapsedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                className="flex items-center gap-1 w-full text-left"
              >
                {collapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-[11px] font-semibold text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">({entries.length})</span>
              </button>
              {!collapsed && (
                <div className="ml-4 mt-1 space-y-1">
                  {entries.map(([name, version]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-2 py-1 border border-border rounded text-xs"
                    >
                      <span className="font-medium text-foreground flex-1 truncate">{name}</span>
                      <span className="font-mono text-muted-foreground text-[10px] w-24 text-right truncate">
                        {version}
                      </span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) moveDep(name, key, e.target.value as DepSection);
                        }}
                        title="Move to..."
                        className="w-6 h-5 text-[10px] bg-transparent border-none opacity-50 hover:opacity-100 cursor-pointer"
                      >
                        <option value="">↔</option>
                        {DEP_SECTIONS.filter((s) => s.key !== key).map((s) => (
                          <option key={s.key} value={s.key}>
                            → {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeDep(name, key)}
                        className="p-0.5 rounded hover:bg-accent"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                  {entries.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No packages</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );

    const renderAdvancedTab = () => {
      const engines = getRecord(structured, 'engines');
      const files = getStringArray(structured, 'files');
      const workspaces = getStringArray(structured, 'workspaces');
      const browserslist = getStringArray(structured, 'browserslist');

      return (
        <div className="flex-1 p-4 overflow-y-auto styled-scroll space-y-4">
          {/* engines */}
          <fieldset className="border border-border rounded p-2">
            <legend className="text-[11px] font-medium text-muted-foreground px-1">engines</legend>
            <div className="space-y-1">
              {Object.entries(engines).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-xs font-medium w-16">{key}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      const eng = { ...engines };
                      if (e.target.value) eng[key] = e.target.value;
                      else delete eng[key];
                      updateField('engines', Object.keys(eng).length > 0 ? eng : undefined);
                    }}
                    className="flex-1 px-1.5 py-0.5 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => {
                      const eng = { ...engines };
                      delete eng[key];
                      updateField('engines', Object.keys(eng).length > 0 ? eng : undefined);
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const eng = { ...engines, '': '' };
                  updateField('engines', eng);
                }}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-2.5 w-2.5" /> Add engine
              </button>
            </div>
          </fieldset>

          {/* files */}
          <fieldset className="border border-border rounded p-2">
            <legend className="text-[11px] font-medium text-muted-foreground px-1">files</legend>
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={f}
                    onChange={(e) => {
                      const next = [...files];
                      next[i] = e.target.value;
                      updateField('files', next);
                    }}
                    className="flex-1 px-1.5 py-0.5 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => {
                      const next = files.filter((_, j) => j !== i);
                      updateField('files', next.length > 0 ? next : undefined);
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateField('files', [...files, ''])}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-2.5 w-2.5" /> Add file pattern
              </button>
            </div>
          </fieldset>

          {/* workspaces */}
          <fieldset className="border border-border rounded p-2">
            <legend className="text-[11px] font-medium text-muted-foreground px-1">
              workspaces
            </legend>
            <div className="space-y-1">
              {workspaces.map((w, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={w}
                    onChange={(e) => {
                      const next = [...workspaces];
                      next[i] = e.target.value;
                      updateField('workspaces', next);
                    }}
                    className="flex-1 px-1.5 py-0.5 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="packages/*"
                  />
                  <button
                    onClick={() => {
                      const next = workspaces.filter((_, j) => j !== i);
                      updateField('workspaces', next.length > 0 ? next : undefined);
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateField('workspaces', [...workspaces, ''])}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-2.5 w-2.5" /> Add workspace
              </button>
            </div>
          </fieldset>

          {/* browserslist */}
          <fieldset className="border border-border rounded p-2">
            <legend className="text-[11px] font-medium text-muted-foreground px-1">
              browserslist
            </legend>
            <div className="space-y-1">
              {browserslist.map((b, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => {
                      const next = [...browserslist];
                      next[i] = e.target.value;
                      updateField('browserslist', next);
                    }}
                    className="flex-1 px-1.5 py-0.5 text-xs font-mono bg-muted/40 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => {
                      const next = browserslist.filter((_, j) => j !== i);
                      updateField('browserslist', next.length > 0 ? next : undefined);
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateField('browserslist', [...browserslist, ''])}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-2.5 w-2.5" /> Add target
              </button>
            </div>
          </fieldset>

          {/* sideEffects toggle */}
          <div className="flex items-center justify-between p-2 border border-border rounded">
            <span className="text-[11px] font-medium text-muted-foreground">sideEffects</span>
            <button
              onClick={() => {
                const current = structured.sideEffects;
                if (current === false) updateField('sideEffects', true);
                else if (current === true) updateField('sideEffects', undefined);
                else updateField('sideEffects', false);
              }}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                structured.sideEffects === false
                  ? 'bg-red-400'
                  : structured.sideEffects === true
                    ? 'bg-green-400'
                    : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  structured.sideEffects === true
                    ? 'translate-x-4'
                    : structured.sideEffects === false
                      ? ''
                      : 'translate-x-2'
                }`}
              />
            </button>
          </div>

          {/* Raw JSON */}
          <details>
            <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground">
              Raw JSON
            </summary>
            <textarea
              value={JSON.stringify(structured, null, 2)}
              readOnly
              rows={12}
              className="mt-1 w-full px-2 py-1.5 text-[10px] font-mono bg-muted/40 border border-border rounded resize-y"
            />
          </details>
        </div>
      );
    };

    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className="flex flex-col h-full relative"
      >
        {renderHeader()}

        {/* Tab bar */}
        <div className="flex border-b border-border px-4 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.name
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'scripts' && renderScriptsTab()}
          {activeTab === 'dependencies' && renderDepsTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
        </div>

        {renderClosePrompt()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // TIER 2: Section-aware editor (python/rust TOML)
  // ═══════════════════════════════════════════════════

  if (ecosystem === 'python' || ecosystem === 'rust') {
    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className="flex flex-col h-full relative"
      >
        {renderHeader()}

        <div className="flex flex-1 overflow-hidden">
          {/* Section navigation */}
          {rawSections.length > 1 && (
            <div className="w-40 shrink-0 border-r border-border overflow-y-auto styled-scroll p-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Sections
              </p>
              {rawSections.map((sec, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSection(i)}
                  className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                    activeSection === i
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  [{sec.header}]
                </button>
              ))}
            </div>
          )}

          {/* Editor area */}
          <div className="flex-1 p-4 overflow-y-auto styled-scroll">
            <textarea
              value={config.raw}
              onChange={(e) => updateRaw(e.target.value)}
              className="w-full h-full min-h-[400px] px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary styled-scroll"
              spellCheck={false}
            />
          </div>
        </div>

        {renderClosePrompt()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // TIER 3: Structured text editor (go/ruby/java)
  // ═══════════════════════════════════════════════════

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="flex flex-col h-full relative"
    >
      {renderHeader()}

      <div className="flex flex-1 overflow-hidden">
        {/* Section navigation */}
        {rawSections.length > 1 && (
          <div className="w-40 shrink-0 border-r border-border overflow-y-auto styled-scroll p-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Sections
            </p>
            {rawSections.map((sec, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                  activeSection === i
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {sec.header}
              </button>
            ))}
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 p-4 overflow-y-auto styled-scroll">
          <textarea
            value={config.raw}
            onChange={(e) => updateRaw(e.target.value)}
            className="w-full h-full min-h-[400px] px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary styled-scroll"
            spellCheck={false}
          />
        </div>
      </div>

      {renderClosePrompt()}
    </div>
  );
}
