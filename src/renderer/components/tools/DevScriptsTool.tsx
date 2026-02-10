/**
 * DevScriptsTool
 *
 * Script management panel for creating, editing, and deleting custom dev scripts.
 * Scripts appear as buttons in the Development screen header for quick execution.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Play, Code } from 'lucide-react';
import { Button } from '../ui/Button';
import { useDevScriptsStore } from '../../stores/useDevScriptsStore';
import type { DevScript } from '../../../main/ipc/channels';
import { cn } from '../../lib/utils';

interface DevScriptsToolProps {
  workingDirectory: string;
}

export function DevScriptsTool({ workingDirectory }: DevScriptsToolProps) {
  const { scripts, loading, loadScripts, saveScript, deleteScript } = useDevScriptsStore();

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<DevScript | null>(null);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
    setCommand('');
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
    setCommand(script.command);
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!command.trim()) {
      setFormError('Command is required');
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

    try {
      const scriptData: DevScript = {
        id: editingScript?.id || `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectPath: workingDirectory,
        name: name.trim(),
        command: command.trim(),
      };

      await saveScript(scriptData);
      resetForm();
    } catch (error) {
      setFormError(String(error));
    }
  }, [name, command, scripts, editingScript, workingDirectory, saveScript, resetForm]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteScript(id);
        setDeleteConfirmId(null);
      } catch (error) {
        console.error('Failed to delete script:', error);
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

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Command</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., npm run build"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>

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
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                    {script.command}
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
