/**
 * DevScriptsTool
 *
 * Script management panel for creating, editing, and deleting custom dev scripts.
 * Scripts appear as buttons in the Development screen header for quick execution.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Code,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Terminal,
  Layers,
} from 'lucide-react';
import { createLogger } from '../../../renderer/utils/logger';

const logger = createLogger('DevScripts');
import { Button } from '../ui/Button';
import { useDevScriptsStore, selectScriptsForProject } from '../../stores/useDevScriptsStore';
import type { DevScript, DevScriptTerminal } from '../../../main/ipc/channels';
import { cn } from '../../lib/utils';

interface DevScriptsToolProps {
  workingDirectory: string;
}

export function DevScriptsTool({ workingDirectory }: DevScriptsToolProps) {
  const {
    scripts: allScripts,
    loading,
    loadScripts,
    saveScript,
    deleteScript,
  } = useDevScriptsStore();
  const scripts = useMemo(
    () => selectScriptsForProject(allScripts, workingDirectory),
    [allScripts, workingDirectory]
  );

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<DevScript | null>(null);
  const [name, setName] = useState('');
  const [commands, setCommands] = useState<string[]>(['']);
  const [formError, setFormError] = useState<string | null>(null);

  // Multi-terminal mode state
  const [isMultiTerminalMode, setIsMultiTerminalMode] = useState(false);
  const [terminals, setTerminals] = useState<DevScriptTerminal[]>([]);
  const [expandedTerminals, setExpandedTerminals] = useState<Set<number>>(new Set([0]));

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load scripts on mount
  useEffect(() => {
    if (workingDirectory) {
      loadScripts(workingDirectory);
    }
  }, [workingDirectory, loadScripts]);

  const resetForm = useCallback(() => {
    setName('');
    setCommands(['']);
    setTerminals([]);
    setIsMultiTerminalMode(false);
    setExpandedTerminals(new Set([0]));
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

    // Check if script has terminals (multi-terminal mode)
    if (script.terminals && script.terminals.length > 0) {
      setIsMultiTerminalMode(true);
      setTerminals(script.terminals.map((t) => ({ ...t, commands: [...t.commands] })));
      setCommands(['']); // Reset single-mode commands
      setExpandedTerminals(new Set([0]));
    } else {
      setIsMultiTerminalMode(false);
      setTerminals([]);
      setCommands(script.commands.length > 0 ? script.commands : [script.command]);
    }

    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate name
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    // Check for duplicate names (excluding current if editing)
    const duplicate = scripts.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== editingScript?.id
    );
    if (duplicate) {
      setFormError('A script with this name already exists');
      return;
    }

    // Validate based on mode
    if (isMultiTerminalMode) {
      // Multi-terminal validation
      if (terminals.length === 0) {
        setFormError('At least one terminal is required');
        return;
      }

      // Validate each terminal
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

      // Check for duplicate terminal names
      const terminalNames = terminals.map((t) => t.name.trim().toLowerCase());
      const uniqueNames = new Set(terminalNames);
      if (uniqueNames.size !== terminalNames.length) {
        setFormError('Terminal names must be unique');
        return;
      }

      // Clean up terminals data
      const cleanTerminals = terminals.map((t) => ({
        name: t.name.trim(),
        commands: t.commands.map((c) => c.trim()).filter((c) => c.length > 0),
      }));

      try {
        const scriptData: DevScript = {
          id:
            editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectPath: workingDirectory,
          name: name.trim(),
          command: cleanTerminals[0].commands[0], // First command of first terminal for backwards compatibility
          commands: cleanTerminals[0].commands, // First terminal's commands for backwards compatibility
          terminals: cleanTerminals,
        };

        await saveScript(scriptData);
        resetForm();
      } catch (error) {
        setFormError(String(error));
      }
    } else {
      // Single-terminal validation
      const validCommands = commands.map((c) => c.trim()).filter((c) => c.length > 0);
      if (validCommands.length === 0) {
        setFormError('At least one command is required');
        return;
      }

      try {
        const scriptData: DevScript = {
          id:
            editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectPath: workingDirectory,
          name: name.trim(),
          command: validCommands[0], // First command for backwards compatibility
          commands: validCommands,
          terminals: undefined, // Explicitly set to undefined for single-terminal mode
        };

        await saveScript(scriptData);
        resetForm();
      } catch (error) {
        setFormError(String(error));
      }
    }
  }, [
    name,
    commands,
    terminals,
    isMultiTerminalMode,
    scripts,
    editingScript,
    workingDirectory,
    saveScript,
    resetForm,
  ]);

  const handleAddCommand = useCallback(() => {
    setCommands((prev) => [...prev, '']);
  }, []);

  const handleRemoveCommand = useCallback((index: number) => {
    setCommands((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleCommandChange = useCallback((index: number, value: string) => {
    setCommands((prev) => {
      const newCommands = [...prev];
      newCommands[index] = value;
      return newCommands;
    });
  }, []);

  // Multi-terminal handlers
  const handleAddTerminal = useCallback(() => {
    setTerminals((prev) => [...prev, { name: '', commands: [''] }]);
    // Expand the new terminal
    setExpandedTerminals((prev) => new Set([...prev, terminals.length]));
  }, [terminals.length]);

  const handleRemoveTerminal = useCallback((index: number) => {
    setTerminals((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    // Update expanded state
    setExpandedTerminals((prev) => {
      const newSet = new Set<number>();
      prev.forEach((i) => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  }, []);

  const handleTerminalNameChange = useCallback((index: number, value: string) => {
    setTerminals((prev) => {
      const newTerminals = [...prev];
      newTerminals[index] = { ...newTerminals[index], name: value };
      return newTerminals;
    });
  }, []);

  const handleTerminalCommandChange = useCallback(
    (terminalIndex: number, commandIndex: number, value: string) => {
      setTerminals((prev) => {
        const newTerminals = [...prev];
        const newCommands = [...newTerminals[terminalIndex].commands];
        newCommands[commandIndex] = value;
        newTerminals[terminalIndex] = { ...newTerminals[terminalIndex], commands: newCommands };
        return newTerminals;
      });
    },
    []
  );

  const handleAddTerminalCommand = useCallback((terminalIndex: number) => {
    setTerminals((prev) => {
      const newTerminals = [...prev];
      newTerminals[terminalIndex] = {
        ...newTerminals[terminalIndex],
        commands: [...newTerminals[terminalIndex].commands, ''],
      };
      return newTerminals;
    });
  }, []);

  const handleRemoveTerminalCommand = useCallback((terminalIndex: number, commandIndex: number) => {
    setTerminals((prev) => {
      const newTerminals = [...prev];
      const terminal = newTerminals[terminalIndex];
      if (terminal.commands.length <= 1) return prev;
      newTerminals[terminalIndex] = {
        ...terminal,
        commands: terminal.commands.filter((_, i) => i !== commandIndex),
      };
      return newTerminals;
    });
  }, []);

  const toggleTerminalExpanded = useCallback((index: number) => {
    setExpandedTerminals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleModeToggle = useCallback(
    (multiTerminal: boolean) => {
      setIsMultiTerminalMode(multiTerminal);
      if (multiTerminal && terminals.length === 0) {
        // Initialize with one terminal using current commands
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
        await deleteScript(id);
        setDeleteConfirmId(null);
      } catch (error) {
        logger.error('Failed to delete script:', error);
      }
    },
    [deleteScript]
  );

  const handleExecute = useCallback(
    (script: DevScript) => {
      // Dispatch custom event to trigger script execution in DevelopmentScreen
      window.dispatchEvent(
        new CustomEvent('execute-dev-script', {
          detail: { script, workingDirectory },
        })
      );
    },
    [workingDirectory]
  );

  if (loading && scripts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading scripts...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Dev Scripts</h3>
        <Button variant="ghost" size="sm" onClick={handleOpenAddForm} disabled={isFormOpen}>
          <Plus className="h-4 w-4 mr-1" />
          Add Script
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Add/Edit Form */}
        {isFormOpen && (
          <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="text-sm font-medium mb-3">
              {editingScript ? 'Edit Script' : 'New Script'}
            </h4>

            <div className="space-y-3">
              {/* Script Name */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Build, Test, Dev"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Mode Toggle */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeToggle(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors',
                      !isMultiTerminalMode
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:border-primary/50'
                    )}
                  >
                    <Terminal className="h-4 w-4" />
                    Single Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeToggle(true)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors',
                      isMultiTerminalMode
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:border-primary/50'
                    )}
                  >
                    <Layers className="h-4 w-4" />
                    Multi-Terminal
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isMultiTerminalMode
                    ? 'Launch multiple terminals in parallel (e.g., frontend + backend)'
                    : 'Run commands sequentially in a single terminal'}
                </p>
              </div>

              {/* Single Terminal Mode - Commands */}
              {!isMultiTerminalMode && (
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
                  {commands.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Commands will run sequentially in order.
                    </p>
                  )}
                </div>
              )}

              {/* Multi-Terminal Mode - Terminal Cards */}
              {isMultiTerminalMode && (
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
                        {/* Terminal Header */}
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
                            onChange={(e) =>
                              handleTerminalNameChange(terminalIndex, e.target.value)
                            }
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

                        {/* Terminal Commands (collapsible) */}
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

                  {terminals.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Click &ldquo;Add Terminal&rdquo; to create your first terminal
                    </p>
                  )}
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
        {scripts.length === 0 && !isFormOpen ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <Code className="h-12 w-12" />
            <div className="text-center">
              <p className="text-sm">No scripts yet</p>
              <p className="text-xs mt-1">
                Create custom scripts that appear as buttons in the header.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {scripts.map((script) => (
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
                    {script.terminals && script.terminals.length > 0 ? (
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
                    {script.terminals && script.terminals.length > 0
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
                        onClick={() => handleExecute(script)}
                        title="Run script"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}
