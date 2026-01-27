import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilePath: string;
  onSaveAs: (newPath: string) => Promise<void>;
}

export function SaveAsDialog({ open, onOpenChange, currentFilePath, onSaveAs }: SaveAsDialogProps) {
  const [newPath, setNewPath] = useState(currentFilePath);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newPath.trim()) return;

    setIsSaving(true);
    try {
      await onSaveAs(newPath);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save As</DialogTitle>
          <DialogDescription>Enter a new file path to save a copy</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="save as"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
