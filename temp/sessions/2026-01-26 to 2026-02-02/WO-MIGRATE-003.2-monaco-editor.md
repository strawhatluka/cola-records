# ORCHESTRATOR WORK ORDER #MIGRATE-003.2
## Type: IMPLEMENTATION
## Code Editor (Monaco) Implementation

---

## MISSION OBJECTIVE

Implement Monaco code editor with multi-tab support, syntax highlighting, save functionality, and special viewers for images/PDFs. This is Phase 2 of the Development IDE Environment (WO-MIGRATE-003).

**Implementation Goal:** Create a fully functional code editor panel that supports multiple open files, syntax highlighting for all major languages, file modification tracking, keyboard shortcuts (Ctrl+S, Ctrl+W), and specialized viewers for non-text files.

**Based On:**
- WO-MIGRATE-003 (parent work order)
- WO-MIGRATE-003.1 complete (File tree provides file selection)
- FileSystemService (for file read/write operations)

---

## IMPLEMENTATION SCOPE

### Components to Create
```yaml
src/renderer/components/ide/editor/:
  - CodeEditorPanel.tsx     # Main editor container
  - EditorTabBar.tsx        # File tabs management
  - EditorTab.tsx           # Single tab component
  - MonacoEditor.tsx        # Monaco editor wrapper
  - ImageViewer.tsx         # PNG/JPG/GIF viewer
  - PdfViewer.tsx           # PDF document viewer
  - UnsupportedViewer.tsx   # Fallback for binary files

src/renderer/stores/:
  - useCodeEditorStore.ts   # Editor state management (Zustand)
```

### Dependencies to Install
```bash
npm install @monaco-editor/react monaco-editor
npm install react-pdf
npm install pdfjs-dist
```

### Editor Features
- **Monaco Editor**: Full VSCode editor experience
- **Multi-Tab Support**: Open multiple files simultaneously
- **Syntax Highlighting**: TypeScript, JavaScript, Python, Dart, JSON, Markdown, etc.
- **File Modification Tracking**: Dirty state indicators
- **Keyboard Shortcuts**: Ctrl+S (save), Ctrl+Shift+S (save all), Ctrl+W (close tab)
- **Special Viewers**: Images (PNG/JPG/GIF), PDFs, binary files
- **IntelliSense**: Code completion and error checking
- **Theme Support**: Light/dark mode matching app theme

---

## IMPLEMENTATION APPROACH

### Step 1: Code Editor State Management (2 hours)

**Create useCodeEditorStore:**
```typescript
// src/renderer/stores/useCodeEditorStore.ts
interface EditorFile {
  path: string;
  content: string;
  originalContent: string;
  isModified: boolean;
  extension: string;
  lastModified: Date;
  viewerType: 'monaco' | 'image' | 'pdf' | 'unsupported';
}

interface CodeEditorStore {
  openFiles: Map<string, EditorFile>;
  activeFilePath: string | null;
  modifiedFiles: Set<string>;

  // Actions
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  closeOtherFiles: (path: string) => void;
  switchToTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  reloadFile: (path: string) => Promise<void>;
  isModified: (path: string) => boolean;
}
```

**Implementation Tasks:**
- [ ] Create Zustand store with CodeEditorStore interface
- [ ] Implement openFile() - reads file via FileSystemService IPC
- [ ] Implement closeFile() - removes from openFiles Map
- [ ] Implement switchToTab() - updates activeFilePath
- [ ] Implement updateContent() - tracks modifications
- [ ] Implement saveFile() - writes via FileSystemService IPC
- [ ] Implement saveAllFiles() - iterates modified files
- [ ] Determine viewerType based on file extension
- [ ] Test: Open file → edit → verify isModified updates

---

### Step 2: Monaco Editor Integration (3 hours)

**Install Monaco Editor:**
```bash
npm install @monaco-editor/react monaco-editor
```

**Create MonacoEditor wrapper:**
```typescript
// src/renderer/components/ide/editor/MonacoEditor.tsx
import Editor from '@monaco-editor/react';

interface MonacoEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

export function MonacoEditor({ filePath, content, onChange }: MonacoEditorProps) {
  const extension = getExtension(filePath);
  const language = getLanguageFromExtension(extension);
  const { theme } = useTheme();

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={onChange}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      options={{
        minimap: { enabled: true },
        lineNumbers: 'on',
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: false,
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  );
}
```

**Language Mapping:**
```typescript
function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    dart: 'dart',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    // Add more as needed
  };
  return langMap[ext] || 'plaintext';
}
```

**Implementation Tasks:**
- [ ] Create MonacoEditor wrapper component
- [ ] Configure language support for 20+ file types
- [ ] Setup theme switching (light/dark)
- [ ] Configure editor options (minimap, line numbers, etc.)
- [ ] Handle onChange events
- [ ] Test: Open .ts file → verify syntax highlighting works

---

### Step 3: Editor Tab Bar & Tabs (2 hours)

**Create EditorTabBar:**
```typescript
// src/renderer/components/ide/editor/EditorTabBar.tsx
export function EditorTabBar() {
  const { openFiles, activeFilePath, switchToTab, closeFile } = useCodeEditorStore();

  if (openFiles.size === 0) {
    return null;
  }

  return (
    <div className="flex overflow-x-auto border-b bg-background">
      {Array.from(openFiles.values()).map((file) => (
        <EditorTab
          key={file.path}
          file={file}
          isActive={file.path === activeFilePath}
          onClose={() => closeFile(file.path)}
          onClick={() => switchToTab(file.path)}
        />
      ))}
    </div>
  );
}
```

**Create EditorTab:**
```typescript
// src/renderer/components/ide/editor/EditorTab.tsx
interface EditorTabProps {
  file: EditorFile;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}

export function EditorTab({ file, isActive, onClose, onClick }: EditorTabProps) {
  const fileName = file.path.split('/').pop() || file.path;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-accent",
        isActive && "bg-accent"
      )}
      onClick={onClick}
    >
      <FileIcon extension={file.extension} type="file" className="h-4 w-4" />
      <span className="text-sm truncate max-w-[150px]">{fileName}</span>
      {file.isModified && (
        <div className="w-2 h-2 rounded-full bg-blue-500" title="Modified" />
      )}
      <button
        className="ml-2 hover:bg-accent-foreground/10 rounded p-1"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create EditorTabBar component
- [ ] Create EditorTab component
- [ ] Style active tab (highlighted background)
- [ ] Add modified indicator (blue dot)
- [ ] Implement close button with click handler
- [ ] Add horizontal scroll for many tabs
- [ ] Test: Open 10 files → switch tabs → close tabs

---

### Step 4: Code Editor Panel (1.5 hours)

**Create CodeEditorPanel:**
```typescript
// src/renderer/components/ide/editor/CodeEditorPanel.tsx
export function CodeEditorPanel() {
  const { openFiles, activeFilePath, updateContent, switchToTab } = useCodeEditorStore();

  const activeFile = activeFilePath ? openFiles.get(activeFilePath) : null;

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a file from the tree to open it</p>
      </div>
    );
  }

  const renderViewer = () => {
    switch (activeFile.viewerType) {
      case 'monaco':
        return (
          <MonacoEditor
            filePath={activeFile.path}
            content={activeFile.content}
            onChange={(value) => {
              if (value !== undefined) {
                updateContent(activeFile.path, value);
              }
            }}
          />
        );
      case 'image':
        return <ImageViewer filePath={activeFile.path} />;
      case 'pdf':
        return <PdfViewer filePath={activeFile.path} />;
      case 'unsupported':
        return <UnsupportedViewer filePath={activeFile.path} extension={activeFile.extension} />;
      default:
        return <div>Unknown viewer type</div>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <EditorTabBar />
      <div className="flex-1 overflow-hidden">
        {renderViewer()}
      </div>
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Create CodeEditorPanel container
- [ ] Route to correct viewer based on viewerType
- [ ] Show empty state when no files open
- [ ] Handle viewer switching when tab changes
- [ ] Test: Switch between different file types → verify correct viewer

---

### Step 5: Keyboard Shortcuts (1 hour)

**Implement Save Shortcuts:**
```typescript
// Inside CodeEditorPanel useEffect:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S: Save active file
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeFilePath) {
        saveFile(activeFilePath);
        toast.success('File saved');
      }
      return;
    }

    // Ctrl+Shift+S: Save all files
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveAllFiles();
      toast.success(`Saved ${modifiedFiles.size} files`);
      return;
    }

    // Ctrl+W: Close active tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      if (activeFilePath) {
        closeFile(activeFilePath);
      }
      return;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeFilePath, modifiedFiles]);
```

**Implementation Tasks:**
- [ ] Add global keyboard event listener
- [ ] Implement Ctrl+S (save current file)
- [ ] Implement Ctrl+Shift+S (save all files)
- [ ] Implement Ctrl+W (close tab)
- [ ] Show toast notifications on save
- [ ] Prevent browser default behavior
- [ ] Test: Press Ctrl+S → verify file saves

---

### Step 6: Special File Viewers (2.5 hours)

**Create ImageViewer:**
```typescript
// src/renderer/components/ide/editor/ImageViewer.tsx
export function ImageViewer({ filePath }: { filePath: string }) {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    // Read file as data URL
    ipc.invoke('filesystem:read-file-binary', filePath).then((buffer) => {
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    });

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [filePath]);

  return (
    <div className="flex items-center justify-center h-full bg-muted/20 p-8">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={filePath}
          className="max-w-full max-h-full object-contain"
        />
      ) : (
        <Skeleton className="w-64 h-64" />
      )}
    </div>
  );
}
```

**Create PdfViewer:**
```typescript
// src/renderer/components/ide/editor/PdfViewer.tsx
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

export function PdfViewer({ filePath }: { filePath: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b">
        <Button
          size="sm"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(pageNumber - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {pageNumber} of {numPages}
        </span>
        <Button
          size="sm"
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          Next
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Document
          file={filePath}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          <Page pageNumber={pageNumber} />
        </Document>
      </div>
    </div>
  );
}
```

**Create UnsupportedViewer:**
```typescript
// src/renderer/components/ide/editor/UnsupportedViewer.tsx
export function UnsupportedViewer({ filePath, extension }: Props) {
  const fileName = filePath.split('/').pop() || filePath;

  const handleOpenInDefault = () => {
    ipc.invoke('shell:open-path', filePath);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <FileIcon className="h-16 w-16 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-semibold">{fileName}</h3>
        <p className="text-sm text-muted-foreground">
          Cannot preview .{extension} files in the editor
        </p>
      </div>
      <Button onClick={handleOpenInDefault}>
        Open in Default Application
      </Button>
    </div>
  );
}
```

**Implementation Tasks:**
- [ ] Install react-pdf: `npm install react-pdf pdfjs-dist`
- [ ] Create ImageViewer with binary file loading
- [ ] Create PdfViewer with pagination
- [ ] Create UnsupportedViewer with "Open in Default App" button
- [ ] Add file type detection logic
- [ ] Handle loading states
- [ ] Test: Open PNG → PDF → .exe → verify correct viewer

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `MONACO-EDITOR-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Components implemented
   - Features operational
   - File types supported

2. **Component Architecture**
   - Editor state flow diagram
   - Monaco integration details
   - Viewer routing logic

3. **Feature Validation**
   - Monaco: Syntax highlighting working
   - Multi-tab: Tab switching functional
   - Save: Ctrl+S working, modified tracking accurate
   - Viewers: Images, PDFs, unsupported files display correctly
   - Keyboard shortcuts: All shortcuts working

4. **Performance Benchmarks**
   - Monaco load time
   - Large file handling (1MB+ files)
   - Tab switching latency

5. **Test Results**
   - Component test coverage
   - Manual testing checklist
   - Edge case handling

### Evidence to Provide
- Screenshots of Monaco editor with syntax highlighting
- Screenshots of image/PDF viewers
- Test coverage report

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `MONACO-EDITOR-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-003.2-monaco-editor.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order NOW EXISTS in: `trinity/sessions/WO-MIGRATE-003.2-monaco-editor.md`
   - [ ] Completion report exists in: `trinity/reports/MONACO-EDITOR-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Monaco Editor loads and displays code
- [ ] Syntax highlighting works for TypeScript, JavaScript, Python, Dart, JSON, Markdown
- [ ] Multi-tab editing functional (open, switch, close)
- [ ] Modified indicator (blue dot) appears on edited files
- [ ] Ctrl+S saves active file
- [ ] Ctrl+Shift+S saves all modified files
- [ ] Ctrl+W closes active tab
- [ ] Image viewer displays PNG/JPG/GIF files
- [ ] PDF viewer displays PDF documents with pagination
- [ ] Unsupported viewer shows for binary files
- [ ] Theme switching works (light/dark mode)
- [ ] IntelliSense/autocomplete functional
- [ ] Component tests ≥80% coverage
- [ ] No TypeScript errors

---

## CONSTRAINTS & GUIDELINES

### Do NOT:
- [ ] Load entire file content into memory for large files
- [ ] Block UI during file loading
- [ ] Skip dirty state tracking
- [ ] Hard-code file type detection

### DO:
- [ ] Lazy-load Monaco Editor models
- [ ] Implement proper Monaco model disposal on tab close
- [ ] Validate file size before loading (warn on >10MB)
- [ ] Use proper file extension to language mapping
- [ ] Test with large files (>1MB)
- [ ] Clean up event listeners on unmount

---

## ROLLBACK STRATEGY

If issues arise:
1. **Monaco Memory Leaks**: Check model disposal on tab close
2. **Large File Performance**: Add file size limit warnings
3. **PDF Rendering Issues**: Add error boundaries and fallback

---

**Estimated Time:** 10 hours
**Priority:** HIGH (Phase 2 of 6)
**Dependencies:** FileSystemService, WO-MIGRATE-003.1 (file tree for file selection)
