# Work Order WO-001: Development IDE Screen

**Status:** 🟢 Ready for Implementation
**Priority:** P1 - High Priority
**Estimated Duration:** 10 days
**Created:** 2026-01-23
**Assigned To:** KIL (Task Executor)
**Design Reference:** ADR-001 Embedded IDE Architecture

---

## 1. Feature Specification

### Overview
Implement a fully functional embedded IDE screen that opens when clicking contribution cards. The IDE will provide file navigation, code editing, terminal access, and full git integration within the Cola Records application.

### Access Pattern
- **Entry Point:** Click on contribution card in Contributions screen
- **Exit Point:** Close button in AppBar returns to Contributions screen
- **Navigation:** NOT included in main navigation bar - accessible only via card click

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ AppBar: [Repo Name]              [Close Button]         │
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  File Tree   │  Code Editor                             │
│  (30%)       │  (70%)                                    │
│              │                                           │
│              ├──────────────────────────────────────────┤
│              │  Terminal                                 │
│              │  (resizable)                              │
└──────────────┴──────────────────────────────────────────┘
```

### Core Features
1. **File Tree Panel (Left 30%)**
   - Display directory structure of contribution
   - Expand/collapse folders
   - Click to open files
   - Visual indicators for git status
   - Show hidden files (toggle option)

2. **Code Editor (Right Top 70%)**
   - Syntax highlighting for all major languages
   - Line numbers
   - Manual save with Ctrl+S
   - Unsaved changes indicator
   - Support for viewing images, PDFs, binary files
   - Virtual scrolling for large files
   - Tab support for multiple open files

3. **Terminal Panel (Right Bottom, Resizable)**
   - System shell (cmd on Windows, bash on Mac/Linux)
   - Full terminal emulation
   - Run git commands
   - Execute build scripts
   - Resizable split with editor

4. **Git Integration**
   - Visual diff for changed files
   - Commit functionality with message input
   - Push/Pull operations
   - Branch management
   - Merge conflict resolution UI
   - Git status in file tree

---

## 2. Technical Requirements

### Package Dependencies
```yaml
dependencies:
  # Code Editor
  flutter_code_editor: ^0.3.0
  highlight: ^0.7.0
  flutter_highlight: ^0.7.0
  code_text_field: ^1.1.0

  # Terminal
  xterm: ^3.5.0
  flutter_pty: ^0.4.0

  # Git Integration
  git: ^2.3.0

  # UI Components
  flutter_treeview: ^1.0.7
  resizable_widget: ^1.0.5
  split_view: ^3.2.1

  # File Viewers
  extended_image: ^8.2.0
  syncfusion_flutter_pdfviewer: ^24.1.41
  file_picker: ^6.1.1
```

### State Management
- **Pattern:** BLoC pattern (consistent with existing codebase)
- **Blocs Required:**
  - `DevelopmentIdeBloc` - Main screen state
  - `FileTreeBloc` - File navigation state
  - `CodeEditorBloc` - Editor state and file management
  - `TerminalBloc` - Terminal session management
  - `GitBloc` - Git operations and status

### Data Flow
```
ContributionCard (tap)
  → Navigate to DevelopmentIdeScreen
    → Initialize with contribution.localPath
      → Load file tree
      → Initialize terminal in repo directory
      → Load git status
```

---

## 3. Implementation Phases

### Phase 1: Screen Structure & Navigation (2 days)
**Tasks:**
- [ ] Create `development_ide_screen.dart` in `lib/features/development/presentation/screens/`
- [ ] Create domain entities: `EditorFile`, `GitStatus`, `TerminalSession`
- [ ] Set up navigation from `contribution_card.dart`
- [ ] Implement close button → return to contributions
- [ ] Create basic split-view layout (30/70)
- [ ] Add AppBar with repo name and close button

**Acceptance Criteria:**
- Clicking card navigates to IDE screen
- Close button returns to contributions
- Layout shows 30/70 split
- Repo name displays in AppBar
- Cola Records purple theme applied

**Tests:**
- Navigation integration tests
- Layout widget tests
- Theme application tests

---

### Phase 2: File Tree Panel (2 days)
**Tasks:**
- [ ] Create `file_tree_bloc.dart` and events/states
- [ ] Create `file_tree_panel.dart` widget
- [ ] Implement directory scanning and tree building
- [ ] Add expand/collapse functionality
- [ ] Add file/folder icons
- [ ] Implement file selection
- [ ] Add git status indicators (modified, untracked, etc.)
- [ ] Add toggle for hidden files

**Acceptance Criteria:**
- File tree displays contribution directory structure
- Folders can be expanded/collapsed
- Files can be selected (highlights selection)
- Git status shows visual indicators
- Hidden files can be toggled
- Performance acceptable for large repos (1000+ files)

**Tests:**
- Unit tests for file tree building logic
- Widget tests for tree rendering
- Integration tests for file selection
- Performance tests with large directories

---

### Phase 3: Code Editor (3 days)
**Tasks:**
- [ ] Create `code_editor_bloc.dart` and events/states
- [ ] Create `code_editor_panel.dart` widget
- [ ] Integrate syntax highlighting
- [ ] Implement file loading from tree selection
- [ ] Add line numbers
- [ ] Implement manual save (Ctrl+S)
- [ ] Add unsaved changes indicator
- [ ] Add tab support for multiple files
- [ ] Implement image viewer for image files
- [ ] Implement PDF viewer for PDF files
- [ ] Add "unsupported file type" view for binary files
- [ ] Implement virtual scrolling for large files

**Acceptance Criteria:**
- Files load when selected from tree
- Syntax highlighting works for common languages (Dart, JS, Python, etc.)
- Ctrl+S saves file to disk
- Unsaved indicator shows when file is modified
- Multiple files can be open in tabs
- Images display properly (PNG, JPG, GIF)
- PDFs can be viewed and scrolled
- Binary files show hex dump or "unsupported" message
- Large files (>10MB) load with virtual scrolling

**Tests:**
- Unit tests for file loading/saving
- Widget tests for editor rendering
- Integration tests for save functionality
- Tests for different file types (code, image, PDF, binary)
- Performance tests with large files (>1MB)

---

### Phase 4: Terminal Integration (2 days)
**Tasks:**
- [ ] Create `terminal_bloc.dart` and events/states
- [ ] Create `terminal_panel.dart` widget
- [ ] Integrate xterm terminal emulator
- [ ] Set up system shell (cmd/bash)
- [ ] Initialize terminal in repo directory
- [ ] Implement resizable split with editor
- [ ] Add terminal output handling
- [ ] Add command input handling
- [ ] Test git commands in terminal

**Acceptance Criteria:**
- Terminal opens with system shell
- Working directory is contribution repo path
- Terminal accepts input and shows output
- Git commands work (status, add, commit, push, pull)
- Split is resizable by dragging divider
- Terminal persists during session
- Terminal can be cleared

**Tests:**
- Unit tests for terminal initialization
- Integration tests for command execution
- Tests for git command execution
- Widget tests for terminal rendering
- Tests for resize functionality

---

### Phase 5: Git Integration UI (1 day)
**Tasks:**
- [ ] Create `git_bloc.dart` and events/states
- [ ] Create `git_panel.dart` widget (optional sidebar)
- [ ] Implement git status fetching
- [ ] Add visual diff viewer
- [ ] Create commit dialog with message input
- [ ] Implement push/pull operations
- [ ] Add branch display and switching
- [ ] Add git status indicators in file tree
- [ ] Handle merge conflicts (show warning, open in editor)

**Acceptance Criteria:**
- Git status updates in real-time
- Modified files show in file tree with indicators
- Diff can be viewed for changed files
- Commit dialog accepts message and creates commit
- Push/Pull operations work with loading indicators
- Current branch displayed in AppBar or status bar
- Branch switching works
- Merge conflicts detected and surfaced to user

**Tests:**
- Unit tests for git operations
- Integration tests for commit/push/pull
- Tests for branch switching
- Tests for merge conflict detection
- Mock git repository tests

---

### Phase 6: Polish & Testing (1 day)
**Tasks:**
- [ ] Add loading states for all operations
- [ ] Add error handling and user-friendly error messages
- [ ] Implement keyboard shortcuts (Ctrl+S, Ctrl+F, etc.)
- [ ] Add tooltips and help text
- [ ] Optimize performance (lazy loading, caching)
- [ ] Add accessibility labels
- [ ] Comprehensive integration testing
- [ ] User acceptance testing

**Acceptance Criteria:**
- All operations show loading indicators
- Errors display helpful messages
- Keyboard shortcuts work
- Performance is smooth (no lag)
- Screen is accessible
- All integration tests pass
- User can complete full workflow (open → edit → commit → push → close)

**Tests:**
- End-to-end workflow tests
- Performance benchmarks
- Accessibility tests
- Error handling tests

---

## 4. Acceptance Criteria

### Functional Requirements
- ✅ Click contribution card → opens IDE screen
- ✅ IDE opens in contribution's local directory
- ✅ File tree displays all files and folders
- ✅ Files can be opened and edited
- ✅ Ctrl+S saves changes to disk
- ✅ Terminal works with system shell
- ✅ Git commands can be executed
- ✅ Visual git status indicators present
- ✅ Commit, push, pull operations functional
- ✅ Images, PDFs, and binary files viewable
- ✅ Close button returns to contributions
- ✅ No file size limits (virtual scrolling for large files)

### Non-Functional Requirements
- ✅ Performance: File tree loads in <500ms for repos with <1000 files
- ✅ Performance: Editor opens files in <200ms
- ✅ Performance: Terminal responds to input in <50ms
- ✅ UI: Matches Cola Records purple theme
- ✅ UI: Layout is responsive and resizable
- ✅ Reliability: No crashes when opening large files (>10MB)
- ✅ Reliability: Git operations don't freeze UI
- ✅ Usability: All actions have loading states
- ✅ Usability: Errors are user-friendly

### Test Coverage
- ✅ Unit test coverage: >80%
- ✅ Widget test coverage: >70%
- ✅ Integration tests for all critical workflows
- ✅ All BAS (Quality Gate) checks pass

---

## 5. Dependencies & Risks

### Dependencies
- **Blocked By:** None
- **Blocks:** WO-002 Multiple Development Screens (future)
- **Related:** ADR-001 Embedded IDE Architecture

### External Dependencies
- Package availability: `flutter_code_editor`, `xterm`, `flutter_pty`
- Git installed on user's system
- System shell availability (cmd/bash)

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large file performance | Medium | Implement virtual scrolling, lazy loading |
| Terminal integration complexity | High | Use proven `xterm` package, extensive testing |
| Git operations blocking UI | Medium | Run git operations in isolates/background |
| Binary file handling | Low | Show hex dump or "unsupported" message |
| Memory usage with multiple files | Medium | Limit open tabs, dispose editor controllers |
| Platform-specific shell issues | Medium | Test on Windows/Mac/Linux, fallback handling |

### Mitigation Strategies
1. **Performance:** Profile regularly, optimize hot paths
2. **Testing:** Write tests first (TDD), comprehensive integration tests
3. **Error Handling:** Graceful degradation, user-friendly messages
4. **Memory:** Dispose resources properly, monitor memory usage
5. **Platform:** Test on all platforms, use platform-specific code when needed

---

## 6. Implementation Plan

### Timeline (10 days)
```
Days 1-2:  Phase 1 - Screen Structure & Navigation
Days 3-4:  Phase 2 - File Tree Panel
Days 5-7:  Phase 3 - Code Editor
Days 8-9:  Phase 4 - Terminal Integration
Day 10:    Phase 5 - Git Integration UI
Day 11:    Phase 6 - Polish & Testing (buffer)
```

### Daily Deliverables
- **End of Day 2:** IDE screen accessible, layout complete
- **End of Day 4:** File tree functional, files selectable
- **End of Day 7:** Editor working, files editable and saveable
- **End of Day 9:** Terminal functional, git commands working
- **End of Day 10:** Git UI complete, full workflow functional
- **End of Day 11:** All tests passing, ready for review

### Quality Gates (BAS)
Each phase must pass:
1. ✅ **Phase 1: Investigation** - Design approved (✅ Complete)
2. ✅ **Phase 2: Implementation** - TDD cycle, tests passing
3. ✅ **Phase 3: Testing** - Unit + Integration tests pass
4. ✅ **Phase 4: Performance** - Benchmarks meet targets
5. ✅ **Phase 5: Code Review** - DRA approval
6. ✅ **Phase 6: Documentation** - APO documentation complete

---

## 7. File Structure

### New Files to Create
```
lib/features/development/
├── domain/
│   ├── entities/
│   │   ├── editor_file.dart
│   │   ├── git_status.dart
│   │   └── terminal_session.dart
│   └── repositories/
│       ├── file_repository.dart
│       └── git_repository.dart
├── data/
│   ├── models/
│   │   ├── editor_file_model.dart
│   │   └── git_status_model.dart
│   ├── repositories/
│   │   ├── file_repository_impl.dart
│   │   └── git_repository_impl.dart
│   └── services/
│       ├── file_service.dart
│       └── git_service.dart
├── presentation/
│   ├── bloc/
│   │   ├── development_ide/
│   │   │   ├── development_ide_bloc.dart
│   │   │   ├── development_ide_event.dart
│   │   │   └── development_ide_state.dart
│   │   ├── file_tree/
│   │   │   ├── file_tree_bloc.dart
│   │   │   ├── file_tree_event.dart
│   │   │   └── file_tree_state.dart
│   │   ├── code_editor/
│   │   │   ├── code_editor_bloc.dart
│   │   │   ├── code_editor_event.dart
│   │   │   └── code_editor_state.dart
│   │   ├── terminal/
│   │   │   ├── terminal_bloc.dart
│   │   │   ├── terminal_event.dart
│   │   │   └── terminal_state.dart
│   │   └── git/
│   │       ├── git_bloc.dart
│   │       ├── git_event.dart
│   │       └── git_state.dart
│   ├── screens/
│   │   └── development_ide_screen.dart
│   └── widgets/
│       ├── file_tree_panel.dart
│       ├── code_editor_panel.dart
│       ├── terminal_panel.dart
│       ├── git_panel.dart
│       ├── image_viewer.dart
│       ├── pdf_viewer.dart
│       └── unsupported_file_viewer.dart
```

### Files to Modify
```
lib/features/contributions/presentation/widgets/contribution_card.dart
  - Add onTap navigation to DevelopmentIdeScreen

pubspec.yaml
  - Add package dependencies
```

---

## 8. Testing Strategy

### Test Pyramid
```
        /\
       /E2E\        10% - Full workflow tests
      /------\
     /  Int   \     30% - Integration tests
    /----------\
   /   Unit     \   60% - Unit tests
  /--------------\
```

### Test Coverage Targets
- **Unit Tests:** 80%+ coverage
- **Widget Tests:** 70%+ coverage
- **Integration Tests:** All critical workflows
- **E2E Tests:** Full user journey (open → edit → commit → close)

### Key Test Scenarios
1. **File Tree Tests**
   - Load directory structure
   - Expand/collapse folders
   - Select files
   - Git status indicators
   - Hidden files toggle

2. **Editor Tests**
   - Load file content
   - Edit content
   - Save changes (Ctrl+S)
   - Unsaved indicator
   - Multiple tabs
   - Image/PDF viewing
   - Large file performance

3. **Terminal Tests**
   - Initialize shell
   - Execute commands
   - Git command execution
   - Output display
   - Error handling

4. **Git Tests**
   - Fetch status
   - View diff
   - Commit changes
   - Push/pull
   - Branch operations
   - Merge conflict detection

5. **Integration Tests**
   - Full edit-commit-push workflow
   - Multi-file editing
   - Terminal + git interaction
   - Error recovery

---

## 9. Documentation Requirements

### Code Documentation (APO)
- [ ] Inline comments for complex logic
- [ ] DartDoc for all public APIs
- [ ] README.md in `lib/features/development/`
- [ ] Architecture diagrams

### User Documentation
- [ ] Feature description in ARCHITECTURE.md
- [ ] Usage guide (how to use IDE)
- [ ] Keyboard shortcuts reference
- [ ] Troubleshooting guide

### Technical Documentation
- [ ] ADR-001 Embedded IDE Architecture (✅ Complete)
- [ ] Design decisions log
- [ ] Performance benchmarks
- [ ] Known limitations

---

## 10. Success Metrics

### User Experience
- User can complete full workflow without external tools
- No reported crashes or freezes
- Performance feels smooth (<100ms interaction latency)

### Code Quality
- All BAS quality gates pass
- No critical or high-severity bugs
- Test coverage targets met

### Technical Performance
- File tree loads: <500ms (repos <1000 files)
- File opens: <200ms
- Terminal response: <50ms
- Memory usage: <500MB (typical repo)
- Large file handling: No crashes (files >10MB)

---

## 11. Handoff Checklist

### For KIL (Task Executor)
- ✅ Work order reviewed and understood
- ✅ Design document (ADR-001) reviewed
- ✅ Package dependencies identified
- ✅ File structure planned
- ✅ Test strategy defined
- ✅ Ready to begin Phase 1

### For DRA (Code Reviewer)
- ✅ Review plan established
- ✅ Quality criteria defined
- ✅ ADR-001 compliance checkpoints identified

### For BAS (Quality Gate)
- ✅ Test coverage targets set
- ✅ Performance benchmarks defined
- ✅ Quality gate criteria established

### For APO (Documentation Specialist)
- ✅ Documentation requirements listed
- ✅ DartDoc standards defined

---

## 12. Notes & Considerations

### Design Decisions
- **Embedded vs External Editor:** Chose embedded for seamless UX (ADR-001)
- **System Shell vs Custom:** System shell for full compatibility
- **Manual Save:** Provides user control, matches IDE expectations
- **No File Limits:** Matches VS Code behavior, uses virtual scrolling

### Future Enhancements (Post-MVP)
- Multiple development screen instances (WO-002)
- Code search/replace across files
- Debugging integration
- Custom themes
- Extensions/plugins system

### Known Limitations
- Git operations require git installed on system
- Terminal requires system shell (cmd/bash)
- Some binary files may not display properly
- Performance may degrade with very large repos (>10k files)

---

## 13. Approval & Sign-off

**Work Order Created By:** Claude (ALY)
**Date:** 2026-01-23
**Design Reference:** ADR-001 Embedded IDE Architecture

**Approved By:**
- [ ] User (Product Owner)
- [ ] DRA (Code Reviewer) - Design compliance verified
- [ ] BAS (Quality Gate) - Test strategy approved

**Ready for Implementation:** ✅ YES

---

**Next Step:** Assign to KIL (Task Executor) to begin Phase 1 (Screen Structure & Navigation)

**Command:** `/trinity:kil-start WO-001 Phase-1`

---

*Work Order powered by Trinity Method v2.1.0*
*Investigation-first development approach*
