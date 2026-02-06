# ORCHESTRATOR WORK ORDER #MIGRATE-002
## Type: IMPLEMENTATION
## UI, Screens & GitHub Integration Migration

---

## MISSION OBJECTIVE

Migrate all user-facing screens and GitHub integration features from Flutter to Electron/React. This work order implements the complete UI layer including: Dashboard, Issue Discovery, Contributions Management, and Settings screens with full functionality.

**Implementation Goal:** Create all 4 main application screens with complete user workflows: issue search → contribute → clone → manage contributions → configure settings.

**Based On:** WO-MIGRATE-001 completion (Foundation & Core Services operational)

---

## IMPLEMENTATION SCOPE

### UI Components & Screens to Create
```yaml
src/renderer/:
  components/:
    ui/:                          # shadcn/ui primitives
      - Button.tsx
      - Card.tsx
      - Input.tsx
      - Select.tsx
      - Modal.tsx
      - Dialog.tsx
      - Dropdown.tsx
      - Checkbox.tsx
      - Tooltip.tsx
      - Badge.tsx

    layout/:
      - Layout.tsx                # Main app layout
      - Sidebar.tsx               # Collapsible navigation
      - AppBar.tsx                # Top app bar

    issues/:
      - SearchPanel.tsx           # Issue search filters
      - IssueList.tsx             # Virtualized issue list
      - IssueCard.tsx             # Issue preview card
      - IssueDetailModal.tsx      # Full issue view
      - RepositoryFileTree.tsx    # Repo preview tree

    contributions/:
      - ContributionList.tsx      # Contribution cards
      - ContributionCard.tsx      # Single contribution
      - StatusBadge.tsx           # Status indicator

    settings/:
      - SettingsForm.tsx          # Settings inputs

  screens/:
    - DashboardScreen.tsx         # Placeholder dashboard
    - IssueDiscoveryScreen.tsx    # Issue search & browse
    - ContributionsScreen.tsx     # Manage contributions
    - SettingsScreen.tsx          # App preferences

  lib/:
    - theme.ts                    # Material Design 3 theme
    - utils.ts                    # Helper functions
```

### Technologies to Install (Additional)
```json
{
  "dependencies": {
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tooltip": "^1.0.7",
    "react-window": "^1.8.10",
    "react-markdown": "^9.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.309.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  }
}
```

---

## IMPLEMENTATION APPROACH

### Phase 1: UI Foundation & Theming (6.5 hours estimated)

#### Step 1.1: Tailwind CSS + shadcn/ui Setup
- [ ] Install Tailwind CSS: `npm install -D tailwindcss postcss autoprefixer`
- [ ] Initialize Tailwind: `npx tailwindcss init -p`
- [ ] Configure tailwind.config.js with Material Design 3 colors:
  ```javascript
  module.exports = {
    darkMode: ['class'],
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        colors: {
          primary: '#7C4DFF',      // Deep purple
          secondary: '#40C4FF',    // Bright cyan
          tertiary: '#69F0AE',     // Bright green
          error: '#FF5252',        // Bright red
        }
      }
    }
  }
  ```
- [ ] Install shadcn/ui: `npx shadcn-ui@latest init`
- [ ] Add components: button, card, input, select, dialog, dropdown-menu, tooltip, badge
- [ ] Test: Render Button component → verify Tailwind styles applied

#### Step 1.2: Theme Provider & Dark Mode
- [ ] Create ThemeProvider component:
  ```typescript
  type Theme = 'light' | 'dark' | 'system';

  const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<Theme>('system');
    // Persist to useSettingsStore
    // Apply class to document.documentElement
  };
  ```
- [ ] Implement system theme detection
- [ ] Add theme toggle component
- [ ] Integrate with useSettingsStore
- [ ] Test: Toggle theme → verify colors change → persist across restart

#### Step 1.3: Main Layout & Navigation
- [ ] Create Layout component with sidebar + content area:
  ```typescript
  <Layout>
    <Sidebar collapsed={collapsed} onToggle={setCollapsed} />
    <main className="flex-1">
      <AppBar title={currentScreen} />
      {children}
    </main>
  </Layout>
  ```
- [ ] Implement collapsible Sidebar (70px → 250px):
  - Dashboard icon/label
  - Issues icon/label
  - Contributions icon/label
  - Settings icon/label
- [ ] Add AppBar with title
- [ ] Implement screen routing (state-based, no react-router yet)
- [ ] Test: Click nav items → screen switches → sidebar collapse/expand

---

### Phase 2: Issue Discovery Screen (5.5 hours estimated)

#### Step 2.1: Issue Discovery State Management
- [ ] Implement useIssuesStore actions:
  ```typescript
  interface IssuesStore {
    issues: Issue[];
    loading: boolean;
    error: string | null;
    filters: SearchFilters;
    selectedIssue: Issue | null;

    searchIssues: (filters: SearchFilters) => Promise<void>;
    loadMore: (cursor: string) => Promise<void>;
    selectIssue: (issue: Issue | null) => void;
    setFilters: (filters: Partial<SearchFilters>) => void;
  }
  ```
- [ ] Integrate with GitHub GraphQL IPC client
- [ ] Add cache layer (use CacheRepository from WO-001)
- [ ] Implement pagination (cursor-based)
- [ ] Test: Search issues → verify results → check cache

#### Step 2.2: Search Panel Component
- [ ] Create SearchPanel with filters:
  - Language selector (13 languages):
    ```typescript
    const languages = [
      'JavaScript', 'TypeScript', 'Python', 'Java',
      'Go', 'Rust', 'C++', 'C#', 'Ruby', 'PHP',
      'Swift', 'Kotlin', 'Dart'
    ];
    ```
  - Star count input (minimum stars)
  - Label checkboxes:
    - good-first-issue
    - beginner-friendly
    - help-wanted
    - documentation
- [ ] Implement debounced search (500ms)
- [ ] Add "Clear Filters" button
- [ ] Test: Select filters → verify API called with correct params

#### Step 2.3: Issue List & Cards
- [ ] Create IssueList with react-window virtualization:
  ```typescript
  <FixedSizeList
    height={600}
    itemCount={issues.length}
    itemSize={120}
    width="100%"
  >
    {({ index, style }) => <IssueCard issue={issues[index]} style={style} />}
  </FixedSizeList>
  ```
- [ ] Design IssueCard showing:
  - Issue title
  - Repository name + stars
  - Labels (colored badges)
  - Open/Closed status
  - "View Details" button
- [ ] Implement infinite scroll (load more on scroll to bottom)
- [ ] Test: Scroll through 100+ issues → verify smooth rendering

#### Step 2.4: Issue Detail Modal
- [ ] Create full-screen IssueDetailModal:
  ```typescript
  <Dialog open={!!selectedIssue} onOpenChange={() => selectIssue(null)}>
    <DialogContent className="max-w-4xl max-h-[90vh]">
      <IssueHeader />
      <IssueBody markdownContent={issue.body} />
      <RepositoryInfo />
      <RepositoryFileTree />
      <ContributeButton />
    </DialogContent>
  </Dialog>
  ```
- [ ] Render Markdown using react-markdown:
  - Sanitize HTML
  - Syntax highlighting for code blocks
  - Link handling
- [ ] Show repository metadata (stars, open issues/PRs)
- [ ] Display file tree preview (from GitHub GraphQL)
- [ ] Add "Contribute" button (triggers contribution workflow)
- [ ] Test: Click issue → modal opens → Markdown renders → file tree loads

---

### Phase 3: Contributions Screen & Workflow (10 hours estimated)

#### Step 3.1: Contribution State Management
- [ ] Implement useContributionsStore with state machine:
  ```typescript
  type ContributionStatus =
    | 'forking'
    | 'cloning'
    | 'setting_up_remotes'
    | 'ready'
    | 'in_progress'
    | 'pr_created'
    | 'merged';

  interface ContributionsStore {
    contributions: Contribution[];
    loading: boolean;

    createContribution: (issue: Issue) => Promise<void>;
    deleteContribution: (id: number) => Promise<void>;
    openInIDE: (contribution: Contribution) => void;
    openInExplorer: (contribution: Contribution) => void;
    refreshStatus: () => Promise<void>;
  }
  ```
- [ ] Integrate with DatabaseService (contributions table)
- [ ] Load contributions on app start
- [ ] Test: Add contribution to DB → refresh → verify appears in store

#### Step 3.2: Contribution Workflow Orchestration
- [ ] Implement multi-step workflow with error handling:
  ```typescript
  async createContribution(issue: Issue) {
    try {
      // Step 1: Fork repository
      setState({ status: 'forking' });
      const fork = await ipc.github.forkRepository(issue.repo.owner, issue.repo.name);

      // Step 2: Clone to local
      setState({ status: 'cloning' });
      const localPath = path.join(contributionsDir, issue.repo.name);
      await ipc.git.clone(fork.clone_url, localPath);

      // Step 3: Setup remotes
      setState({ status: 'setting_up_remotes' });
      await ipc.git.addRemote(localPath, 'upstream', issue.repo.url);

      // Step 4: Save to database
      await db.contributions.insert({ ...data, status: 'ready' });

      setState({ status: 'ready' });
    } catch (error) {
      // Rollback: delete partial clone, remove DB entry
      await rollback();
      throw error;
    }
  }
  ```
- [ ] Implement rollback for each step failure
- [ ] Show progress indicator during workflow
- [ ] Handle network failures gracefully
- [ ] Test: Contribute to real repo → verify fork/clone/remotes

#### Step 3.3: Contribution List Component
- [ ] Create ContributionList displaying cards
- [ ] Design ContributionCard showing:
  - Repository name
  - Status badge (colored by status)
  - Local path
  - Issue title (if applicable)
  - Actions:
    - "Open in IDE" button
    - "Open Folder" button (platform-specific shell)
    - "Delete" button (with confirmation)
- [ ] Implement status color coding:
  - forking/cloning/setting_up_remotes: yellow (in-progress)
  - ready: blue
  - in_progress: purple
  - pr_created: green
  - merged: dark green
- [ ] Test: Display 10 contributions → verify all statuses render correctly

#### Step 3.4: File System Integration
- [ ] Implement directory picker for contributions folder:
  ```typescript
  const selectDirectory = async () => {
    const result = await ipc.dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.filePaths[0]) {
      await settingsStore.setContributionsDirectory(result.filePaths[0]);
    }
  };
  ```
- [ ] Implement "Open in Explorer" (platform-specific):
  - Windows: `explorer.exe /select,"${path}"`
  - macOS: `open -R "${path}"`
  - Linux: `xdg-open "${path}"`
- [ ] Test: Click "Open Folder" → file explorer opens to path

---

### Phase 4: Settings Screen (5 hours estimated)

#### Step 4.1: Settings State Management
- [ ] Implement useSettingsStore with persistence:
  ```typescript
  interface SettingsStore {
    contributionsDirectory: string;
    themeMode: 'light' | 'dark' | 'system';
    githubToken: string | null;

    setContributionsDirectory: (path: string) => Promise<void>;
    setThemeMode: (mode: Theme) => void;
    setGithubToken: (token: string) => Promise<void>;
    validateToken: (token: string) => Promise<boolean>;
  }
  ```
- [ ] Use electron-store for persistence (non-sensitive settings)
- [ ] Use SecureStorageService for GitHub token
- [ ] Sync theme with ThemeProvider
- [ ] Test: Update setting → restart app → verify persisted

#### Step 4.2: Settings UI
- [ ] Create SettingsForm with sections:

  **General Section:**
  - Contributions directory path (read-only + "Change" button)
  - Directory picker dialog integration

  **Appearance Section:**
  - Theme selector (radio buttons: System, Light, Dark)
  - Live theme preview

  **GitHub Section:**
  - Token input (password type)
  - "Validate Token" button
  - Token validation status indicator
  - Scopes required notice: `public_repo, read:user`

- [ ] Add "Save" and "Reset" buttons
- [ ] Implement validation before save
- [ ] Show success/error notifications
- [ ] Test: Update all settings → save → verify applied

---

### Phase 5: Dashboard Screen (2 hours estimated)

#### Step 5.1: Dashboard Placeholder
- [ ] Create DashboardScreen with welcome message:
  ```typescript
  <div className="p-8">
    <h1>Welcome to Cola Records</h1>
    <p>Select a screen from the sidebar to get started.</p>

    <div className="grid grid-cols-2 gap-4 mt-8">
      <StatCard title="Active Contributions" value={contributions.length} />
      <StatCard title="Issues Viewed" value={issuesViewed} />
    </div>
  </div>
  ```
- [ ] Add placeholder widgets:
  - Recent contributions widget
  - GitHub stats widget (optional)
- [ ] Design extensible widget system for future
- [ ] Test: Navigate to dashboard → widgets display

---

### Phase 6: Testing & Polish (6 hours estimated)

#### Step 6.1: Component Testing
- [ ] Setup React Testing Library
- [ ] Write component tests for:
  - SearchPanel (filter interaction)
  - IssueCard (data display)
  - ContributionCard (action buttons)
  - SettingsForm (validation)
- [ ] Target: ≥80% component coverage

#### Step 6.2: Integration Testing
- [ ] Test complete workflows:
  - Issue search → filter → view details
  - Contribute → fork → clone → save
  - Settings → update → persist
- [ ] Test error states (network failures, invalid tokens)
- [ ] Test loading states (spinners, skeletons)

#### Step 6.3: UI Polish
- [ ] Add loading skeletons for async operations
- [ ] Implement toast notifications for user feedback
- [ ] Add keyboard shortcuts:
  - `Ctrl+K`: Focus search
  - `Esc`: Close modals
  - `Ctrl+,`: Open settings
- [ ] Ensure accessibility:
  - ARIA labels
  - Keyboard navigation
  - Focus management
- [ ] Test: Run axe-core accessibility audit

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `UI-SCREENS-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary**
   - Screens implemented (4 screens)
   - Components created (count)
   - User workflows operational

2. **Component Inventory**
   - UI primitives (shadcn/ui components)
   - Screen components
   - Shared components
   - Total component count

3. **Workflow Validation**
   - Issue discovery flow tested
   - Contribution workflow tested
   - Settings persistence tested
   - Screenshots of each screen

4. **Test Results**
   - Component test coverage
   - Integration test results
   - Accessibility audit results
   - Manual testing checklist

5. **UI/UX Notes**
   - Theme implementation details
   - Responsive design considerations
   - Known UI limitations

6. **Next Steps**
   - Ready for WO-MIGRATE-003 (Development IDE)
   - Integration points for IDE
   - Missing features (if any)

### Evidence to Provide
- Screenshots of all 4 screens
- Component test coverage report
- Accessibility audit results (axe-core)
- Video of complete user workflow (optional)

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `UI-SCREENS-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY**

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-MIGRATE-002-ui-screens-github-integration.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order NOW EXISTS in: `trinity/sessions/WO-MIGRATE-002-ui-screens-github-integration.md`
   - [ ] Completion report exists in: `trinity/reports/UI-SCREENS-IMPLEMENTATION-COMPLETE-[TIMESTAMP].md`

**Step 4: Ready for Next Phase:**
   - [ ] Inform user that WO-MIGRATE-002 is complete
   - [ ] WO-MIGRATE-003 can now begin (Development IDE)

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] All 4 screens functional (Dashboard, Issues, Contributions, Settings)
- [ ] Theme switching works (light/dark/system)
- [ ] Issue search returns results
- [ ] Contribution workflow completes (fork → clone → save)
- [ ] Settings persist across app restarts
- [ ] File system dialogs work (directory picker, open in explorer)
- [ ] All UI components render correctly
- [ ] Component tests ≥80% coverage
- [ ] Accessibility audit passes (no critical issues)
- [ ] No React warnings in console
- [ ] No TypeScript errors
- [ ] Responsive design works (min width: 1024px)

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**Git Operations Only Allowed On:**
- ✅ The NEW `cola-records-electron/` project
- ❌ The existing `cola-records/` Flutter project (LUKA only)

### Do NOT:
- [ ] Modify any files in the Flutter project
- [ ] Create inline styles (use Tailwind classes)
- [ ] Use `any` type in TypeScript
- [ ] Suppress accessibility warnings
- [ ] Hard-code colors (use theme tokens)
- [ ] Fetch data in components (use stores)

### DO:
- [ ] Use Tailwind utility classes
- [ ] Follow shadcn/ui component patterns
- [ ] Implement proper loading states
- [ ] Add error boundaries
- [ ] Handle edge cases (empty states, errors)
- [ ] Use semantic HTML
- [ ] Add ARIA labels for accessibility
- [ ] Test keyboard navigation

---

## ROLLBACK STRATEGY

If issues arise:

1. **Component Rendering Issues**
   - Check: React DevTools for errors
   - Check: Tailwind classes applied correctly
   - Check: shadcn/ui component props
   - Rollback: Revert to basic HTML structure

2. **State Management Issues**
   - Check: Zustand DevTools
   - Check: IPC calls resolving correctly
   - Test: State updates triggering re-renders
   - Rollback: Use local component state temporarily

3. **Theme Not Applying**
   - Check: Tailwind config loaded
   - Check: Dark mode class on document
   - Check: CSS variables defined
   - Rollback: Use inline color values temporarily

---

## CONTEXT FROM PREVIOUS WORK

**Prerequisite:** WO-MIGRATE-001 (Foundation & Core Services) MUST be complete
**Dependencies:**
- IPC clients for GitHub API
- Zustand stores initialized
- Database service operational
- Secure storage for GitHub token

**Migration Reference:**
- Issue Discovery: Matches Flutter `IssueDiscoveryBloc` behavior
- Contributions: Matches Flutter `ContributionBloc` state machine
- Settings: Matches Flutter `SettingsCubit` persistence

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The 35-hour estimate is for planning purposes only, NOT a deadline.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE (All 4 screens + full workflows)
**Completeness Required:** 100% - All screens must be fully functional
**Risk Level:** MEDIUM
**Risk Factors:**
- UI/UX must match Flutter design (user expectations)
- Contribution workflow is complex (multi-step state machine)
- Accessibility requirements (WCAG 2.1 AA)

**Mitigation:**
- Reference Flutter screenshots for design parity
- Test contribution workflow with real repositories
- Use axe-core for automated accessibility testing
- Implement error boundaries for graceful failures

---

**Remember:** This phase creates the user-facing application. Focus on usability, accessibility, and visual polish. The IDE (WO-MIGRATE-003) builds on this foundation.
