import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';
import { ipc } from '@renderer/ipc/client';
import { toast } from 'sonner';

// Mock IPC
vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useCodeEditorStore', () => {
  const mockFileContent = '// Test file content\nconst x = 42;';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useCodeEditorStore());
    act(() => {
      result.current.openFiles = new Map();
      result.current.activeFilePath = null;
      result.current.modifiedFiles = new Set();
      result.current.loading = false;
    });
  });

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useCodeEditorStore());

      expect(result.current.openFiles).toEqual(new Map());
      expect(result.current.activeFilePath).toBeNull();
      expect(result.current.modifiedFiles).toEqual(new Set());
      expect(result.current.loading).toBe(false);
    });
  });

  describe('openFile', () => {
    it('should open a TypeScript file with monaco viewer', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
        const file = result.current.openFiles.get('/repo/test.ts');
        expect(file?.content).toBe(mockFileContent);
        expect(file?.viewerType).toBe('monaco');
        expect(file?.extension).toBe('ts');
        expect(result.current.activeFilePath).toBe('/repo/test.ts');
        expect(result.current.loading).toBe(false);
      });
    });

    it('should open an image file with image viewer', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue('');

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/image.png');
      });

      await waitFor(() => {
        const file = result.current.openFiles.get('/repo/image.png');
        expect(file?.viewerType).toBe('image');
        expect(file?.extension).toBe('png');
      });
    });

    it('should open a PDF file with pdf viewer', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue('');

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/document.pdf');
      });

      await waitFor(() => {
        const file = result.current.openFiles.get('/repo/document.pdf');
        expect(file?.viewerType).toBe('pdf');
        expect(file?.extension).toBe('pdf');
      });
    });

    it('should open unknown file with unsupported viewer', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue('');

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/file.exe');
      });

      await waitFor(() => {
        const file = result.current.openFiles.get('/repo/file.exe');
        expect(file?.viewerType).toBe('unsupported');
        expect(file?.extension).toBe('exe');
      });
    });

    it('should switch to already open file', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open file first time
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.size).toBe(1);
      });

      // Try to open same file again
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      // Should not create duplicate
      expect(result.current.openFiles.size).toBe(1);
      expect(result.current.activeFilePath).toBe('/repo/test.ts');
    });

    it('should handle file read errors', async () => {
      vi.mocked(ipc.invoke).mockRejectedValue(new Error('File not found'));

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/missing.ts');
      });

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to open file');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('closeFile', () => {
    it('should close a file without modifications', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      // Close file
      act(() => {
        result.current.closeFile('/repo/test.ts');
      });

      expect(result.current.openFiles.has('/repo/test.ts')).toBe(false);
      expect(result.current.activeFilePath).toBeNull();
    });

    it('should switch to next file after closing active file', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open two files
      await act(async () => {
        await result.current.openFile('/repo/file1.ts');
        await result.current.openFile('/repo/file2.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.size).toBe(2);
        expect(result.current.activeFilePath).toBe('/repo/file2.ts');
      });

      // Close active file
      act(() => {
        result.current.closeFile('/repo/file2.ts');
      });

      expect(result.current.openFiles.size).toBe(1);
      expect(result.current.activeFilePath).toBe('/repo/file1.ts');
    });
  });

  describe('closeAllFiles', () => {
    it('should close all files', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open multiple files
      await act(async () => {
        await result.current.openFile('/repo/file1.ts');
        await result.current.openFile('/repo/file2.ts');
        await result.current.openFile('/repo/file3.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.size).toBe(3);
      });

      // Close all
      act(() => {
        result.current.closeAllFiles();
      });

      expect(result.current.openFiles.size).toBe(0);
      expect(result.current.activeFilePath).toBeNull();
      expect(result.current.modifiedFiles.size).toBe(0);
    });
  });

  describe('closeOtherFiles', () => {
    it('should close all files except specified one', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open multiple files
      await act(async () => {
        await result.current.openFile('/repo/file1.ts');
        await result.current.openFile('/repo/file2.ts');
        await result.current.openFile('/repo/file3.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.size).toBe(3);
      });

      // Close others
      act(() => {
        result.current.closeOtherFiles('/repo/file2.ts');
      });

      expect(result.current.openFiles.size).toBe(1);
      expect(result.current.openFiles.has('/repo/file2.ts')).toBe(true);
      expect(result.current.activeFilePath).toBe('/repo/file2.ts');
    });
  });

  describe('switchToTab', () => {
    it('should switch active file', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open two files
      await act(async () => {
        await result.current.openFile('/repo/file1.ts');
        await result.current.openFile('/repo/file2.ts');
      });

      await waitFor(() => {
        expect(result.current.activeFilePath).toBe('/repo/file2.ts');
      });

      // Switch to first file
      act(() => {
        result.current.switchToTab('/repo/file1.ts');
      });

      expect(result.current.activeFilePath).toBe('/repo/file1.ts');
    });
  });

  describe('updateContent', () => {
    it('should update file content and mark as modified', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      // Update content
      const newContent = '// Modified content\nconst y = 100;';
      act(() => {
        result.current.updateContent('/repo/test.ts', newContent);
      });

      const file = result.current.openFiles.get('/repo/test.ts');
      expect(file?.content).toBe(newContent);
      expect(file?.isModified).toBe(true);
      expect(result.current.modifiedFiles.has('/repo/test.ts')).toBe(true);
    });

    it('should not mark as modified if content unchanged', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      // Update with same content
      act(() => {
        result.current.updateContent('/repo/test.ts', mockFileContent);
      });

      const file = result.current.openFiles.get('/repo/test.ts');
      expect(file?.isModified).toBe(false);
      expect(result.current.modifiedFiles.has('/repo/test.ts')).toBe(false);
    });
  });

  describe('saveFile', () => {
    it('should save modified file', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open and modify file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      const newContent = '// Modified';
      act(() => {
        result.current.updateContent('/repo/test.ts', newContent);
      });

      // Save file
      vi.mocked(ipc.invoke).mockResolvedValue(undefined);
      await act(async () => {
        await result.current.saveFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(vi.mocked(ipc.invoke)).toHaveBeenCalledWith('fs:write-file', '/repo/test.ts', newContent);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('File saved successfully');
        const file = result.current.openFiles.get('/repo/test.ts');
        expect(file?.isModified).toBe(false);
        expect(result.current.modifiedFiles.has('/repo/test.ts')).toBe(false);
      });
    });

    it('should handle save errors', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open and modify file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      act(() => {
        result.current.updateContent('/repo/test.ts', '// Modified');
      });

      // Fail to save
      vi.mocked(ipc.invoke).mockRejectedValue(new Error('Permission denied'));
      await act(async () => {
        await result.current.saveFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to save file');
      });
    });
  });

  describe('saveAllFiles', () => {
    it('should save all modified files', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open and modify multiple files
      await act(async () => {
        await result.current.openFile('/repo/file1.ts');
        await result.current.openFile('/repo/file2.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.size).toBe(2);
      });

      act(() => {
        result.current.updateContent('/repo/file1.ts', '// Modified 1');
        result.current.updateContent('/repo/file2.ts', '// Modified 2');
      });

      expect(result.current.modifiedFiles.size).toBe(2);

      // Save all
      vi.mocked(ipc.invoke).mockResolvedValue(undefined);
      await act(async () => {
        await result.current.saveAllFiles();
      });

      await waitFor(() => {
        expect(result.current.modifiedFiles.size).toBe(0);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('All files saved successfully');
      });
    });
  });

  describe('reloadFile', () => {
    it('should reload file content from disk', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      // Open file
      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      // Modify content
      act(() => {
        result.current.updateContent('/repo/test.ts', '// Local modification');
      });

      // Reload from disk
      const updatedContent = '// Updated from disk';
      vi.mocked(ipc.invoke).mockResolvedValue(updatedContent);
      await act(async () => {
        await result.current.reloadFile('/repo/test.ts');
      });

      await waitFor(() => {
        const file = result.current.openFiles.get('/repo/test.ts');
        expect(file?.content).toBe(updatedContent);
        expect(file?.isModified).toBe(false);
      });
    });
  });

  describe('isModified', () => {
    it('should return true for modified files', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      act(() => {
        result.current.updateContent('/repo/test.ts', '// Modified');
      });

      expect(result.current.isModified('/repo/test.ts')).toBe(true);
    });

    it('should return false for unmodified files', async () => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockFileContent);

      const { result } = renderHook(() => useCodeEditorStore());

      await act(async () => {
        await result.current.openFile('/repo/test.ts');
      });

      await waitFor(() => {
        expect(result.current.openFiles.has('/repo/test.ts')).toBe(true);
      });

      expect(result.current.isModified('/repo/test.ts')).toBe(false);
    });
  });
});
