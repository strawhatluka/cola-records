/**
 * CLIExplorer
 *
 * Full-view component (replaces MaintenanceTool via early return) for
 * browsing system CLI tools. Scans PATH on mount, groups by source,
 * expands to show --help output with subcommands and flags.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  TerminalSquare,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Search,
  Play,
  Copy,
  X,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { CLIGroup, CLIEntry, CLIHelpResult } from '../../../main/ipc/channels/types';

interface CLIExplorerProps {
  onClose: () => void;
  onRunCommand: (command: string) => void;
  ecosystem?: string;
}

export function CLIExplorer({ onClose, onRunCommand, ecosystem }: CLIExplorerProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CLIGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedCLI, setSelectedCLI] = useState<CLIEntry | null>(null);
  const [helpResult, setHelpResult] = useState<CLIHelpResult | null>(null);
  const [helpLoading, setHelpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Command builder state
  const [selectedSubcommand, setSelectedSubcommand] = useState<string | null>(null);
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
  const [subHelpResult, setSubHelpResult] = useState<CLIHelpResult | null>(null);
  const [subHelpLoading, setSubHelpLoading] = useState(false);
  const [editableCommand, setEditableCommand] = useState('');

  const scanCLIs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke('workflow:scan-clis', ecosystem);
      setGroups(result);
      if (result.length > 0) {
        setExpandedGroups(new Set([result[0].source]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan CLIs');
    } finally {
      setLoading(false);
    }
  }, [ecosystem]);

  useEffect(() => {
    scanCLIs();
  }, [scanCLIs]);

  const toggleGroup = (source: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const closeCLIPanel = () => {
    setSelectedCLI(null);
    setHelpResult(null);
    setSelectedSubcommand(null);
    setSelectedFlags(new Set());
    setSubHelpResult(null);
  };

  const handleSelectCLI = async (entry: CLIEntry) => {
    // Toggle: clicking the already-selected CLI closes the panel
    if (selectedCLI?.path === entry.path) {
      closeCLIPanel();
      return;
    }
    setSelectedCLI(entry);
    setHelpResult(null);
    setHelpLoading(true);
    setSelectedSubcommand(null);
    setSelectedFlags(new Set());
    setSubHelpResult(null);
    try {
      const result = await ipc.invoke('workflow:get-cli-help', entry.path);
      setHelpResult(result);
    } catch {
      setHelpResult(null);
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSelectSubcommand = async (subName: string) => {
    if (selectedSubcommand === subName) {
      setSelectedSubcommand(null);
      setSubHelpResult(null);
      setSelectedFlags(new Set());
      return;
    }
    setSelectedSubcommand(subName);
    setSelectedFlags(new Set());
    setSubHelpResult(null);
    setSubHelpLoading(true);
    try {
      if (selectedCLI) {
        const result = await ipc.invoke('workflow:get-cli-help', selectedCLI.path, subName);
        setSubHelpResult(result);
      }
    } catch {
      setSubHelpResult(null);
    } finally {
      setSubHelpLoading(false);
    }
  };

  const toggleFlag = (flag: string) => {
    setSelectedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  };

  // Build the composed command from selections
  const composedCommand = useMemo(() => {
    if (!selectedCLI) return '';
    const parts = [selectedCLI.name];
    if (selectedSubcommand) parts.push(selectedSubcommand);
    for (const flag of selectedFlags) {
      // Extract just the first flag token (e.g. "--verbose" from "--verbose, -v")
      const flagToken = flag.split(',')[0].trim();
      parts.push(flagToken);
    }
    return parts.join(' ');
  }, [selectedCLI, selectedSubcommand, selectedFlags]);

  // Sync editable command when composed command changes from selection
  useEffect(() => {
    setEditableCommand(composedCommand);
  }, [composedCommand]);

  // The flags to display: subcommand-specific if a subcommand is selected, otherwise top-level
  const activeFlags = useMemo(() => {
    if (selectedSubcommand && subHelpResult) return subHelpResult.flags;
    return helpResult?.flags ?? [];
  }, [selectedSubcommand, subHelpResult, helpResult]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((e) => e.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, searchQuery]);

  const totalCLIs = groups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <TerminalSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">CLI Explorer</h3>
        {!loading && (
          <span className="text-[10px] text-muted-foreground ml-auto">{totalCLIs} tools found</span>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tools..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto styled-scroll">
        {loading ? (
          <div className="flex items-center gap-2 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Scanning PATH for CLI tools...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-4 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            {searchQuery ? 'No matching tools found.' : 'No CLI tools detected.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.source);
              return (
                <div key={group.source}>
                  <button
                    onClick={() => toggleGroup(group.source)}
                    className="flex items-center gap-2 w-full px-4 py-2 hover:bg-accent/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs font-semibold text-foreground">{group.source}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({group.entries.length})
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="pb-1">
                      {group.entries.map((entry) => {
                        const isSelected = selectedCLI?.path === entry.path;
                        return (
                          <div key={entry.path}>
                            <button
                              onClick={() => handleSelectCLI(entry)}
                              className={`flex items-center gap-2 w-full px-6 py-1.5 text-left hover:bg-accent/30 transition-colors ${
                                isSelected ? 'bg-accent/40' : ''
                              }`}
                            >
                              <TerminalSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-foreground font-mono">
                                {entry.name}
                              </span>
                              {entry.version && (
                                <span className="text-[10px] text-muted-foreground">
                                  {entry.version}
                                </span>
                              )}
                            </button>

                            {/* Help detail panel with command builder */}
                            {isSelected && (
                              <div className="mx-6 mb-2 rounded border border-border bg-background overflow-hidden relative">
                                <button
                                  onClick={closeCLIPanel}
                                  className="absolute top-1 right-1 p-0.5 rounded hover:bg-accent transition-colors z-10"
                                  title="Close"
                                >
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                                {helpLoading ? (
                                  <div className="flex items-center gap-2 p-3">
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                      Loading help...
                                    </span>
                                  </div>
                                ) : helpResult ? (
                                  <div className="flex flex-col">
                                    {/* Description & usage header */}
                                    <div className="p-2 border-b border-border">
                                      {helpResult.description && (
                                        <p className="text-[10px] text-muted-foreground">
                                          {helpResult.description}
                                        </p>
                                      )}
                                      {helpResult.usage && (
                                        <div className="mt-1">
                                          <span className="text-[10px] font-semibold text-foreground">
                                            Usage:{' '}
                                          </span>
                                          <span className="text-[10px] font-mono text-muted-foreground">
                                            {helpResult.usage}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Subcommands table */}
                                    {helpResult.subcommands.length > 0 && (
                                      <div className="border-b border-border">
                                        <div className="px-2 py-1.5 bg-muted/30">
                                          <span className="text-[10px] font-semibold text-foreground">
                                            Subcommands ({helpResult.subcommands.length})
                                          </span>
                                        </div>
                                        <div className="max-h-40 overflow-auto styled-scroll">
                                          <table className="w-full">
                                            <tbody>
                                              {helpResult.subcommands.map((sub) => {
                                                const isActive = selectedSubcommand === sub.name;
                                                return (
                                                  <tr
                                                    key={sub.name}
                                                    onClick={() => handleSelectSubcommand(sub.name)}
                                                    className={`cursor-pointer transition-colors ${
                                                      isActive
                                                        ? 'bg-primary/15 text-primary'
                                                        : 'hover:bg-accent/30'
                                                    }`}
                                                  >
                                                    <td className="px-2 py-1 text-[10px] font-mono whitespace-nowrap w-[1%]">
                                                      {sub.name}
                                                    </td>
                                                    <td className="px-2 py-1 text-[10px] text-muted-foreground">
                                                      {sub.description}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Subcommand-specific loading indicator */}
                                    {subHelpLoading && (
                                      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground">
                                          Loading {selectedSubcommand} flags...
                                        </span>
                                      </div>
                                    )}

                                    {/* Flags table */}
                                    {activeFlags.length > 0 && (
                                      <div className="border-b border-border">
                                        <div className="px-2 py-1.5 bg-muted/30 flex items-baseline gap-3">
                                          <span className="text-[10px] font-semibold text-foreground shrink-0">
                                            Flags ({activeFlags.length})
                                            {selectedSubcommand && (
                                              <span className="font-normal text-muted-foreground">
                                                {' '}
                                                for {selectedSubcommand}
                                              </span>
                                            )}
                                          </span>
                                          {selectedSubcommand && subHelpResult?.usage && (
                                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                                              {subHelpResult.usage}
                                            </span>
                                          )}
                                        </div>
                                        <div className="max-h-40 overflow-auto styled-scroll">
                                          <table className="w-full">
                                            <tbody>
                                              {activeFlags.map((flag) => {
                                                const isActive = selectedFlags.has(flag.flag);
                                                return (
                                                  <tr
                                                    key={flag.flag}
                                                    onClick={() => toggleFlag(flag.flag)}
                                                    className={`cursor-pointer transition-colors ${
                                                      isActive
                                                        ? 'bg-primary/15 text-primary'
                                                        : 'hover:bg-accent/30'
                                                    }`}
                                                  >
                                                    <td className="px-2 py-1 text-[10px] font-mono whitespace-nowrap w-[1%]">
                                                      {flag.flag}
                                                    </td>
                                                    <td className="px-2 py-1 text-[10px] text-muted-foreground">
                                                      {flag.description}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Raw output fallback when no subcommands/flags parsed */}
                                    {helpResult.subcommands.length === 0 &&
                                      activeFlags.length === 0 &&
                                      helpResult.rawOutput && (
                                        <div className="border-b border-border">
                                          <div className="px-2 py-1.5 bg-muted/30">
                                            <span className="text-[10px] font-semibold text-foreground">
                                              Help Output
                                            </span>
                                          </div>
                                          <pre className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-auto styled-scroll">
                                            {helpResult.rawOutput}
                                          </pre>
                                        </div>
                                      )}

                                    {/* Editable command & run */}
                                    <div className="p-2 flex items-center gap-2">
                                      <div className="flex-1 flex items-center bg-muted/50 rounded px-2 py-1 text-foreground">
                                        <span className="text-[10px] font-mono text-muted-foreground mr-1 shrink-0">
                                          $
                                        </span>
                                        <input
                                          type="text"
                                          value={editableCommand}
                                          onChange={(e) => setEditableCommand(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editableCommand.trim()) {
                                              onRunCommand(editableCommand.trim());
                                            }
                                          }}
                                          className="flex-1 text-[10px] font-mono bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground min-w-0"
                                          placeholder="Enter command..."
                                        />
                                      </div>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(editableCommand)
                                        }
                                        className="p-1 rounded hover:bg-accent transition-colors shrink-0"
                                        title="Copy command"
                                      >
                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                      <button
                                        onClick={() => onRunCommand(editableCommand.trim())}
                                        disabled={!editableCommand.trim()}
                                        className="flex items-center gap-1 px-2 py-1.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                                      >
                                        <Play className="h-2.5 w-2.5" />
                                        Run
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="p-2 text-[10px] text-muted-foreground">
                                    No help available.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
