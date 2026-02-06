# ORCHESTRATOR WORK ORDER #007
## Type: IMPLEMENTATION
## My Projects Screen

---

## MISSION OBJECTIVE

Add a "My Projects" screen to the application, positioned between Issues and Contributions in the sidebar navigation. The screen scans a configurable directory (default `~/Documents/My Projects/`) for git repositories and displays them identically to the Contributions screen — same cards, same badges (fork, remotes, PR status), same "Open Project" flow to DevelopmentScreen. Reuses the existing `Contribution` type with a new `type` column to distinguish projects from contributions.

**Implementation Goal:** Users can manage their personal git projects with the same tooling as contributions — fork detection, remote validation, PR status, and IDE access — from a dedicated "My Projects" screen.
**Based On:** User request — add My Projects nav item between Issues and Contributions with identical functionality to Contributions screen, scanning a separate configurable directory.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/database/schema.ts
    changes: Add migration v3 with type column
    risk: MEDIUM

  - path: src/main/ipc/channels.ts
    changes: Add type to Contribution, defaultProjectsPath to AppSettings, project:scan-directory channel
    risk: MEDIUM

  - path: src/main/database/database.service.ts
    changes: Handle type column in CRUD, add getContributionsByType()
    risk: MEDIUM

  - path: src/main/index.ts
    changes: Add project:scan-directory handler, update settings handlers
    risk: MEDIUM

  - path: src/renderer/App.tsx
    changes: Add projects routing, track ideOrigin for back-navigation
    risk: LOW

  - path: src/renderer/components/layout/Sidebar.tsx
    changes: Add 'projects' to Screen type, add nav item
    risk: LOW

  - path: src/renderer/components/layout/Layout.tsx
    changes: Add projects to screenTitles
    risk: LOW

Supporting_Files:
  - src/renderer/stores/useSettingsStore.ts - Add defaultProjectsPath state and action
  - src/renderer/components/settings/GeneralTab.tsx - Add projects directory picker
  - src/renderer/components/contributions/ContributionList.tsx - Add optional emptyMessage prop
```

### New Files
```yaml
New_Files:
  - src/renderer/stores/useProjectsStore.ts
  - src/renderer/screens/ProjectsScreen.tsx
```

### Changes Required

#### Change Set 1: Database Migration
**Files:** src/main/database/schema.ts
**Current State:** SCHEMA_VERSION = 2, no type column on contributions table
**Target State:** SCHEMA_VERSION = 3, type column added with default 'contribution'
**Implementation:**
```sql
-- Migration 3
ALTER TABLE contributions ADD COLUMN type TEXT NOT NULL DEFAULT 'contribution';
```

#### Change Set 2: Type Definitions
**Files:** src/main/ipc/channels.ts
**Current State:** Contribution has required issueNumber/issueTitle, no type field. AppSettings has no defaultProjectsPath.
**Target State:** Contribution has optional type, optional issueNumber/issueTitle. AppSettings includes defaultProjectsPath. IpcChannels includes project:scan-directory.
**Implementation:**
```typescript
// Contribution interface additions
type?: 'project' | 'contribution';
issueNumber?: number;  // was required
issueTitle?: string;   // was required

// AppSettings addition
defaultProjectsPath: string;

// IpcChannels addition
'project:scan-directory': (directoryPath: string) => Contribution[];
```

#### Change Set 3: Database Service
**Files:** src/main/database/database.service.ts
**Current State:** No type column handling
**Target State:** type column included in create/update/read, new getContributionsByType() method
**Implementation:**
```typescript
// createContribution: include type column
type: contribution.type || 'contribution'
issueNumber: contribution.issueNumber ?? 0
issueTitle: contribution.issueTitle ?? ''

// New method
getContributionsByType(type: 'project' | 'contribution'): Contribution[]
```

#### Change Set 4: IPC Handlers
**Files:** src/main/index.ts
**Current State:** No project:scan-directory handler. Settings don't include defaultProjectsPath.
**Target State:** project:scan-directory handler mirrors contribution:scan-directory but uses type='project'. Settings initialize and persist defaultProjectsPath (default: Documents/My Projects/).
**Implementation:**
- project:scan-directory: calls existing contributionScannerService.scanDirectory(), syncs with DB using type='project', matches existing entries by localPath + type
- settings:get: initialize defaultProjectsPath to Documents/My Projects/ if not set, create directory if missing
- settings:update: persist defaultProjectsPath

#### Change Set 5: Navigation
**Files:** src/renderer/components/layout/Sidebar.tsx, src/renderer/components/layout/Layout.tsx
**Current State:** Screen type has dashboard/issues/contributions/settings/ide. navItems has 4 entries.
**Target State:** Screen type includes 'projects'. navItems has 5 entries with My Projects between Issues and Contributions.
**Implementation:**
```typescript
// Sidebar.tsx - Screen type
export type Screen = 'dashboard' | 'issues' | 'projects' | 'contributions' | 'settings' | 'ide';

// Sidebar.tsx - navItems (between Issues and Contributions)
{ id: 'projects', label: 'My Projects', icon: FolderGit2 },

// Layout.tsx - screenTitles
projects: 'My Projects',
```

#### Change Set 6: Projects Store + Screen
**Files:** src/renderer/stores/useProjectsStore.ts (NEW), src/renderer/screens/ProjectsScreen.tsx (NEW)
**Current State:** Don't exist
**Target State:** Zustand store for projects state. Screen component that scans defaultProjectsPath and renders ContributionList.
**Implementation:**
- Store mirrors useContributionsStore pattern: projects[], loading, error, setProjects, deleteProject
- Screen mirrors ContributionsScreen pattern: uses defaultProjectsPath, calls project:scan-directory, heading "My Projects"
- Screen passes custom emptyMessage to ContributionList

#### Change Set 7: App Routing
**Files:** src/renderer/App.tsx
**Current State:** handleOpenIDE hardcoded, onNavigateBack returns to 'contributions'
**Target State:** ideOrigin state tracks which screen launched the IDE. handleOpenIDE accepts origin screen. onNavigateBack uses ideOrigin.
**Implementation:**
```typescript
const [ideOrigin, setIdeOrigin] = useState<Screen>('contributions');

const handleOpenIDE = (contribution: Contribution, fromScreen?: Screen) => {
  setSelectedContribution(contribution);
  setIdeOrigin(fromScreen || 'contributions');
  setCurrentScreen('ide');
};

// In renderScreen:
case 'projects':
  return <ProjectsScreen onOpenIDE={(c) => handleOpenIDE(c, 'projects')} />;
case 'contributions':
  return <ContributionsScreen onOpenIDE={(c) => handleOpenIDE(c, 'contributions')} />;
case 'ide':
  onNavigateBack={() => setCurrentScreen(ideOrigin)}
```

#### Change Set 8: Settings
**Files:** src/renderer/stores/useSettingsStore.ts, src/renderer/components/settings/GeneralTab.tsx
**Current State:** No defaultProjectsPath in store or UI
**Target State:** Store has defaultProjectsPath state + setDefaultProjectsPath action. GeneralTab has second directory picker for projects.
**Implementation:**
- Store: add defaultProjectsPath: '' default, add setDefaultProjectsPath action
- GeneralTab: add local state, directory picker UI (same pattern as clone directory), include in handleSave

#### Change Set 9: ContributionList Empty State
**Files:** src/renderer/components/contributions/ContributionList.tsx
**Current State:** Hardcoded "No contributions yet" / "Start by finding an issue in the Issues tab"
**Target State:** Optional emptyMessage prop with defaults to current text. ProjectsScreen passes custom message.
**Implementation:**
```typescript
interface ContributionListProps {
  // ... existing props
  emptyMessage?: { title: string; subtitle: string };
}
// Default: { title: 'No contributions yet', subtitle: 'Start by finding an issue in the Issues tab' }
// ProjectsScreen passes: { title: 'No projects found', subtitle: 'Add git repositories to your projects directory' }
```

---

## IMPLEMENTATION APPROACH

### Step 1: Database Layer
- [ ] Add migration v3 to schema.ts (type column)
- [ ] Update Contribution interface in channels.ts (type, optional issue fields)
- [ ] Add defaultProjectsPath to AppSettings in channels.ts
- [ ] Add project:scan-directory to IpcChannels in channels.ts
- [ ] Update database.service.ts (type column in CRUD, getContributionsByType)

### Step 2: IPC Handlers
- [ ] Add project:scan-directory handler in index.ts
- [ ] Update settings:get handler for defaultProjectsPath initialization
- [ ] Update settings:update handler for defaultProjectsPath persistence

### Step 3: Navigation
- [ ] Add 'projects' to Screen type in Sidebar.tsx
- [ ] Add FolderGit2 import and My Projects nav item in Sidebar.tsx
- [ ] Add 'projects' to screenTitles in Layout.tsx

### Step 4: Frontend Components
- [ ] Create useProjectsStore.ts (Zustand store)
- [ ] Create ProjectsScreen.tsx (screen component)
- [ ] Add emptyMessage prop to ContributionList.tsx

### Step 5: App Wiring
- [ ] Import ProjectsScreen in App.tsx
- [ ] Add ideOrigin state for back-navigation tracking
- [ ] Update handleOpenIDE to accept and store origin screen
- [ ] Add 'projects' case to renderScreen()
- [ ] Update onNavigateBack to use ideOrigin

### Step 6: Settings
- [ ] Add defaultProjectsPath to useSettingsStore.ts
- [ ] Add projects directory picker to GeneralTab.tsx
- [ ] Include defaultProjectsPath in handleSave

### Step 7: Validation
- [ ] All existing tests still pass
- [ ] No TypeScript compilation errors
- [ ] Navigation works: sidebar → My Projects → Open Project → DevelopmentScreen → Back
- [ ] Settings directory picker works and persists
- [ ] Empty state shows correct message

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `MY-PROJECTS-SCREEN-IMPLEMENTATION-COMPLETE-2026-02-03.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - Detailed list with diffs
3. **Test Results** - Validation of changes
4. **Metrics** - Files changed, lines added
5. **Rollback Plan** - How to revert if needed
6. **Next Steps** - What to monitor or do next

### Evidence to Provide
- File diff statistics
- Specific line numbers for critical changes
- List of all new/modified files

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `MY-PROJECTS-SCREEN-IMPLEMENTATION-COMPLETE-2026-02-03.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-007-my-projects-screen.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-007-my-projects-screen.md`
   - [ ] Completion report exists in: `trinity/reports/MY-PROJECTS-SCREEN-IMPLEMENTATION-COMPLETE-2026-02-03.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

   **If any verification fails, the work order is NOT complete. Fix immediately.**

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] "My Projects" appears in sidebar between Issues and Contributions
- [ ] Clicking My Projects scans the configured directory for git repos
- [ ] Cards display with fork badges, remote validation, PR status (same as Contributions)
- [ ] Clicking "Open Project" navigates to DevelopmentScreen
- [ ] "Stop & Back" in DevelopmentScreen returns to My Projects (not Contributions)
- [ ] Settings > General shows "Default Projects Directory" with Browse button
- [ ] Changing the projects directory and saving works correctly
- [ ] Empty state shows "No projects found" (not "No contributions yet")
- [ ] All existing tests still pass
- [ ] No TypeScript compilation errors
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations.
Only LUKA has permission for git add, commit, push, pull, merge, checkout, branch, tag, rebase, reset, revert, stash.

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Change functionality beyond the requirements
- [ ] Perform ANY git operations
- [ ] Run npm test, npm run build, npm install (LUKA only)
- [ ] Modify existing ContributionCard component (reuse as-is)
- [ ] Duplicate the scanner service (reuse existing)

### DO:
- [ ] Follow existing patterns exactly (ContributionsScreen, useContributionsStore)
- [ ] Use existing UI components (ContributionList, ContributionCard)
- [ ] Reuse the existing contributionScannerService
- [ ] Follow existing IPC handler pattern (dynamic imports)
- [ ] Follow existing settings pattern (defaultClonePath)

---

## ROLLBACK STRATEGY

If issues arise:
1. Revert migration in schema.ts (remove migration 3, reset SCHEMA_VERSION to 2)
2. Revert changes to channels.ts (restore required issueNumber/issueTitle, remove type/defaultProjectsPath)
3. Revert changes to database.service.ts (remove type handling, remove getContributionsByType)
4. Revert changes to index.ts (remove project:scan-directory handler, revert settings handlers)
5. Revert navigation changes in Sidebar.tsx, Layout.tsx, App.tsx
6. Delete new files: useProjectsStore.ts, ProjectsScreen.tsx
7. Revert settings changes in useSettingsStore.ts, GeneralTab.tsx
8. Revert ContributionList.tsx (remove emptyMessage prop)
9. Delete the SQLite database file to reset schema (user data loss — last resort)

**Note:** The migration adds a column with a default value, so existing data is safe. Rolling back code changes without rolling back the database is fine — the extra column is ignored.

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100%
**Risk Level:** MEDIUM
**Risk Factors:**
- Database migration must handle existing data gracefully (NOT NULL with DEFAULT mitigates this)
- Making issueNumber/issueTitle optional could affect existing code that assumes they're required
- Back-navigation tracking (ideOrigin) must not break existing Contributions → IDE flow

**Mitigation:**
- Migration uses DEFAULT 'contribution' so all existing rows are valid
- Use ?? operators for optional fields so existing code paths are unaffected
- ideOrigin defaults to 'contributions' so existing flow is preserved if fromScreen is not passed

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.
