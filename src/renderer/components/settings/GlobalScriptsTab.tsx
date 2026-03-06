/**
 * GlobalScriptsTab
 *
 * Settings tab for managing Global Dev Scripts that are accessible by all projects.
 * Reuses the same form patterns as DevScriptsTool (Single, Multi-Terminal, Toggle modes).
 * Scripts are stored with projectPath = '__global__' sentinel value.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Terminal,
  Layers,
  Power,
  Globe,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useDevScriptsStore } from '../../stores/useDevScriptsStore';
import { GLOBAL_SCRIPTS_PATH } from '../../../main/ipc/channels/types';
import type { DevScript, DevScriptTerminal } from '../../../main/ipc/channels';
import { cn } from '../../lib/utils';

type ScriptMode = 'single' | 'multi' | 'toggle';

export function GlobalScriptsTab() {
  const { globalScripts, loading, loadGlobalScripts, saveGlobalScript, deleteGlobalScript } =
    useDevScriptsStore();

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<DevScript | null>(null);
  const [name, setName] = useState('');
  const [commands, setCommands] = useState<string[]>(['']);
  const [formError, setFormError] = useState<string | null>(null);
  const [scriptMode, setScriptMode] = useState<ScriptMode>('single');

  // Multi-terminal state
  const [terminals, setTerminals] = useState<DevScriptTerminal[]>([]);
  const [expandedTerminals, setExpandedTerminals] = useState<Set<number>>(new Set([0]));

  // Toggle state
  const [firstPressName, setFirstPressName] = useState('');
  const [firstPressCommand, setFirstPressCommand] = useState('');
  const [secondPressName, setSecondPressName] = useState('');
  const [secondPressCommand, setSecondPressCommand] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadGlobalScripts();
  }, [loadGlobalScripts]);

  const resetForm = useCallback(() => {
    setName('');
    setCommands(['']);
    setTerminals([]);
    setScriptMode('single');
    setExpandedTerminals(new Set([0]));
    setFirstPressName('');
    setFirstPressCommand('');
    setSecondPressName('');
    setSecondPressCommand('');
    setEditingScript(null);
    setFormError(null);
    setIsFormOpen(false);
  }, []);

  const handleOpenAddForm = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  const handleOpenEditForm = useCallback((script: DevScript) => {
    setEditingScript(script);
    setName(script.name);

    if (script.toggle) {
      setScriptMode('toggle');
      setFirstPressName(script.toggle.firstPressName);
      setFirstPressCommand(script.toggle.firstPressCommand);
      setSecondPressName(script.toggle.secondPressName);
      setSecondPressCommand(script.toggle.secondPressCommand);
      setCommands(['']);
      setTerminals([]);
    } else if (script.terminals && script.terminals.length > 0) {
      setScriptMode('multi');
      setTerminals(script.terminals.map((t) => ({ ...t, commands: [...t.commands] })));
      setCommands(['']);
      setExpandedTerminals(new Set([0]));
      setFirstPressName('');
      setFirstPressCommand('');
      setSecondPressName('');
      setSecondPressCommand('');
    } else {
      setScriptMode('single');
      setTerminals([]);
      setCommands(script.commands.length > 0 ? script.commands : [script.command]);
      setFirstPressName('');
      setFirstPressCommand('');
      setSecondPressName('');
      setSecondPressCommand('');
    }

    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (scriptMode === 'toggle') {
      if (!firstPressName.trim()) {
        setFormError('First press name is required');
        return;
      }
      if (!firstPressCommand.trim()) {
        setFormError('First press command is required');
        return;
      }
      if (!secondPressName.trim()) {
        setFormError('Second press name is required');
        return;
      }
      if (!secondPressCommand.trim()) {
        setFormError('Second press command is required');
        return;
      }

      const toggleName = firstPressName.trim();
      const duplicate = globalScripts.find(
        (s) => s.name.toLowerCase() === toggleName.toLowerCase() && s.id !== editingScript?.id
      );
      if (duplicate) {
        setFormError('A global script with this name already exists');
        return;
      }

      try {
        await saveGlobalScript({
          id:
            editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectPath: GLOBAL_SCRIPTS_PATH,
          name: toggleName,
          command: firstPressCommand.trim(),
          commands: [firstPressCommand.trim()],
          terminals: undefined,
          toggle: {
            firstPressName: firstPressName.trim(),
            firstPressCommand: firstPressCommand.trim(),
            secondPressName: secondPressName.trim(),
            secondPressCommand: secondPressCommand.trim(),
          },
        });
        resetForm();
      } catch (error) {
        setFormError(String(error));
      }
      return;
    }

    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    const duplicate = globalScripts.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== editingScript?.id
    );
    if (duplicate) {
      setFormError('A global script with this name already exists');
      return;
    }

    if (scriptMode === 'multi') {
      if (terminals.length === 0) {
        setFormError('At least one terminal is required');
        return;
      }
      for (let i = 0; i < terminals.length; i++) {
        const terminal = terminals[i];
        if (!terminal.name.trim()) {
          setFormError(`Terminal ${i + 1} needs a name`);
          return;
        }
        const validCmds = terminal.commands.filter((c) => c.trim().length > 0);
        if (validCmds.length === 0) {
          setFormError(`Terminal "${terminal.name}" needs at least one command`);
          return;
        }
      }
      const terminalNames = terminals.map((t) => t.name.trim().toLowerCase());
      if (new Set(terminalNames).size !== terminalNames.length) {
        setFormError('Terminal names must be unique');
        return;
      }

      const cleanTerminals = terminals.map((t) => ({
        name: t.name.trim(),
        commands: t.commands.map((c) => c.trim()).filter((c) => c.length > 0),
      }));

      try {
        await saveGlobalScript({
          id:
            editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectPath: GLOBAL_SCRIPTS_PATH,
          name: name.trim(),
          command: cleanTerminals[0].commands[0],
          commands: cleanTerminals[0].commands,
          terminals: cleanTerminals,
        });
        resetForm();
      } catch (error) {
        setFormError(String(error));
      }
    } else {
      const validCommands = commands.map((c) => c.trim()).filter((c) => c.length > 0);
      if (validCommands.length === 0) {
        setFormError('At least one command is required');
        return;
      }

      try {
        await saveGlobalScript({
          id:
            editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectPath: GLOBAL_SCRIPTS_PATH,
          name: name.trim(),
          command: validCommands[0],
          commands: validCommands,
          terminals: undefined,
        });
        resetForm();
      } catch (error) {
        setFormError(String(error));
      }
    }
  }, [
    name,
    commands,
    terminals,
    scriptMode,
    firstPressName,
    firstPressCommand,
    secondPressName,
    secondPressCommand,
    globalScripts,
    editingScript,
    saveGlobalScript,
    resetForm,
  ]);

  const handleAddCommand = useCallback(() => {
    setCommands((prev) => [...prev, '']);
  }, []);

  const handleRemoveCommand = useCallback((index: number) => {
    setCommands((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const handleCommandChange = useCallback((index: number, value: string) => {
    setCommands((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleAddTerminal = useCallback(() => {
    setTerminals((prev) => [...prev, { name: '', commands: [''] }]);
    setExpandedTerminals((prev) => new Set([...prev, terminals.length]));
  }, [terminals.length]);

  const handleRemoveTerminal = useCallback((index: number) => {
    setTerminals((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    setExpandedTerminals((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }, []);

  const handleTerminalNameChange = useCallback((index: number, value: string) => {
    setTerminals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  }, []);

  const handleTerminalCommandChange = useCallback(
    (terminalIndex: number, commandIndex: number, value: string) => {
      setTerminals((prev) => {
        const next = [...prev];
        const cmds = [...next[terminalIndex].commands];
        cmds[commandIndex] = value;
        next[terminalIndex] = { ...next[terminalIndex], commands: cmds };
        return next;
      });
    },
    []
  );

  const handleAddTerminalCommand = useCallback((terminalIndex: number) => {
    setTerminals((prev) => {
      const next = [...prev];
      next[terminalIndex] = {
        ...next[terminalIndex],
        commands: [...next[terminalIndex].commands, ''],
      };
      return next;
    });
  }, []);

  const handleRemoveTerminalCommand = useCallback((terminalIndex: number, commandIndex: number) => {
    setTerminals((prev) => {
      const next = [...prev];
      const terminal = next[terminalIndex];
      if (terminal.commands.length <= 1) return prev;
      next[terminalIndex] = {
        ...terminal,
        commands: terminal.commands.filter((_, i) => i !== commandIndex),
      };
      return next;
    });
  }, []);

  const toggleTerminalExpanded = useCallback((index: number) => {
    setExpandedTerminals((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleModeChange = useCallback(
    (mode: ScriptMode) => {
      setScriptMode(mode);
      if (mode === 'multi' && terminals.length === 0) {
        const validCommands = commands.filter((c) => c.trim().length > 0);
        setTerminals([
          { name: 'Terminal 1', commands: validCommands.length > 0 ? validCommands : [''] },
        ]);
        setExpandedTerminals(new Set([0]));
      }
    },
    [commands, terminals.length]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteGlobalScript(id);
        setDeleteConfirmId(null);
      } catch {
        // Error is set in store
      }
    },
    [deleteGlobalScript]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Global Dev Scripts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Scripts defined here are available in every project. They appear alongside
          project-specific scripts in the Development screen.
        </p>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleOpenAddForm} disabled={isFormOpen}>
          <Plus className="h-4 w-4 mr-1" />
          Add Global Script
        </Button>
      </div>

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="text-sm font-medium mb-3">
            {editingScript ? 'Edit Global Script' : 'New Global Script'}
          </h4>

          <div className="space-y-3">
            {/* Script Name (hidden in toggle mode) */}
            {scriptMode !== 'toggle' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Build, Test, Dev"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="global-script-name"
                />
              </div>
            )}

            {/* Mode Selector */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('single')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors',
                    scriptMode === 'single'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  )}
                >
                  <Terminal className="h-4 w-4" />
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('multi')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors',
                    scriptMode === 'multi'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  )}
                >
                  <Layers className="h-4 w-4" />
                  Multi
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('toggle')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors',
                    scriptMode === 'toggle'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  )}
                >
                  <Power className="h-4 w-4" />
                  Toggle
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {scriptMode === 'multi'
                  ? 'Launch multiple terminals in parallel (e.g., frontend + backend)'
                  : scriptMode === 'toggle'
                    ? 'Alternate between two commands (e.g., start / stop)'
                    : 'Run commands sequentially in a single terminal'}
              </p>
            </div>

            {/* Single Terminal Mode */}
            {scriptMode === 'single' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    Commands {commands.length > 1 && `(${commands.length})`}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCommand}
                    className="h-6 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Command
                  </Button>
                </div>
                <div className="space-y-2">
                  {commands.map((cmd, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex items-center text-muted-foreground text-xs w-5">
                        <GripVertical className="h-3 w-3" />
                      </div>
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => handleCommandChange(index, e.target.value)}
                        placeholder={index === 0 ? 'e.g., npm install' : 'e.g., npm run build'}
                        className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        data-testid={`global-script-command-${index}`}
                      />
                      {commands.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCommand(index)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Terminal Mode */}
            {scriptMode === 'multi' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">
                    Terminals {terminals.length > 0 && `(${terminals.length})`}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddTerminal}
                    className="h-6 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Terminal
                  </Button>
                </div>
                <div className="space-y-2">
                  {terminals.map((terminal, terminalIndex) => (
                    <div
                      key={terminalIndex}
                      className="border border-input rounded-md bg-background overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                        <button
                          type="button"
                          onClick={() => toggleTerminalExpanded(terminalIndex)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedTerminals.has(terminalIndex) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={terminal.name}
                          onChange={(e) => handleTerminalNameChange(terminalIndex, e.target.value)}
                          placeholder="Terminal name (e.g., Frontend)"
                          className="flex-1 px-2 py-1 text-sm bg-transparent border-none focus:outline-none"
                        />
                        <span className="text-xs text-muted-foreground">
                          {terminal.commands.filter((c) => c.trim()).length} cmd
                        </span>
                        {terminals.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveTerminal(terminalIndex)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {expandedTerminals.has(terminalIndex) && (
                        <div className="p-3 border-t border-input space-y-2">
                          {terminal.commands.map((cmd, cmdIndex) => (
                            <div key={cmdIndex} className="flex items-center gap-2">
                              <div className="flex items-center text-muted-foreground text-xs w-5">
                                <GripVertical className="h-3 w-3" />
                              </div>
                              <input
                                type="text"
                                value={cmd}
                                onChange={(e) =>
                                  handleTerminalCommandChange(
                                    terminalIndex,
                                    cmdIndex,
                                    e.target.value
                                  )
                                }
                                placeholder={
                                  cmdIndex === 0 ? 'e.g., npm run dev' : 'e.g., npm run watch'
                                }
                                className="flex-1 px-3 py-2 text-sm bg-muted/30 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                              />
                              {terminal.commands.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleRemoveTerminalCommand(terminalIndex, cmdIndex)
                                  }
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddTerminalCommand(terminalIndex)}
                            className="h-6 px-2 text-xs w-full justify-center"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Command
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Toggle Mode */}
            {scriptMode === 'toggle' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    First Press — Name
                  </label>
                  <input
                    type="text"
                    value={firstPressName}
                    onChange={(e) => setFirstPressName(e.target.value)}
                    placeholder="e.g., Start DB"
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="global-script-toggle-first-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    First Press — Command
                  </label>
                  <input
                    type="text"
                    value={firstPressCommand}
                    onChange={(e) => setFirstPressCommand(e.target.value)}
                    placeholder="e.g., docker compose up -d"
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    data-testid="global-script-toggle-first-cmd"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Second Press — Name
                  </label>
                  <input
                    type="text"
                    value={secondPressName}
                    onChange={(e) => setSecondPressName(e.target.value)}
                    placeholder="e.g., Stop DB"
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="global-script-toggle-second-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Second Press — Command
                  </label>
                  <input
                    type="text"
                    value={secondPressCommand}
                    onChange={(e) => setSecondPressCommand(e.target.value)}
                    placeholder="e.g., docker compose down"
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    data-testid="global-script-toggle-second-cmd"
                  />
                </div>
              </div>
            )}

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={loading}>
                {editingScript ? 'Save Changes' : 'Add Script'}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scripts List */}
      {globalScripts.length === 0 && !isFormOpen ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
          <Globe className="h-12 w-12" />
          <div className="text-center">
            <p className="text-sm">No global scripts yet</p>
            <p className="text-xs mt-1">
              Global scripts are available in every project&apos;s Development screen.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {globalScripts.map((script) => (
            <div
              key={script.id}
              className={cn(
                'group flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-colors',
                deleteConfirmId === script.id && 'border-destructive'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{script.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Global
                  </span>
                  {script.toggle ? (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Power className="h-3 w-3" />
                      Toggle
                    </span>
                  ) : script.terminals && script.terminals.length > 0 ? (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {script.terminals.length} terminals
                    </span>
                  ) : (
                    script.commands.length > 1 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {script.commands.length} commands
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                  {script.toggle
                    ? `${script.toggle.firstPressName} / ${script.toggle.secondPressName}`
                    : script.terminals && script.terminals.length > 0
                      ? script.terminals.map((t) => t.name).join(', ')
                      : script.commands.length > 1
                        ? script.commands.join(' && ')
                        : script.command}
                </p>
              </div>

              <div className="flex items-center gap-1 ml-2">
                {deleteConfirmId === script.id ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(script.id)}
                      className="text-xs"
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleOpenEditForm(script)}
                      title="Edit script"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(script.id)}
                      title="Delete script"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
