# ORCHESTRATOR WORK ORDER #002
## Type: IMPLEMENTATION
## Settings Page Tabbed Navigation + Shell Alias Management

---

## MISSION OBJECTIVE

Redesign the Settings page from a single scrollable form into a tabbed interface with three tabs (General, API, Aliases), and add a new Alias management GUI that allows users to create, edit, and delete shell aliases persisted in SQLite. These aliases are injected into the code-server container's bashrc on each launch.

**Implementation Goal:** Tabbed settings UI with fully functional alias CRUD that integrates with the existing code-server Docker container terminal.
**Based On:** TRA plan from current session. Follows WO-001 (VS Code embed) which established the code-server infrastructure.

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: src/main/ipc/channels.ts
    changes: Add Alias type, add aliases field to AppSettings
    risk: LOW

  - path: src/main/index.ts
    changes: Update settings:get and settings:update IPC handlers for aliases JSON
    risk: LOW

  - path: src/renderer/stores/useSettingsStore.ts
    changes: Add aliases state, add alias CRUD actions
    risk: LOW

  - path: src/renderer/screens/SettingsScreen.tsx
    changes: Add tab navigation, render tab-specific content
    risk: MEDIUM

  - path: src/main/services/code-server.service.ts
    changes: Update createContainerBashrc() to read user aliases from DB
    risk: LOW

Supporting_Files:
  - src/renderer/components/settings/SettingsForm.tsx - DELETE after extraction
```

### Files to Create
```yaml
New_Files:
  - path: src/renderer/components/settings/GeneralTab.tsx
    purpose: Clone directory + Appearance/Theme settings (extracted from SettingsForm)
    risk: LOW

  - path: src/renderer/components/settings/APITab.tsx
    purpose: GitHub token management (extracted from SettingsForm)
    risk: LOW

  - path: src/renderer/components/settings/AliasesTab.tsx
    purpose: NEW - Shell alias CRUD interface
    risk: MEDIUM
```

### Changes Required

#### Change Set 1: Type Foundation
**Files:** `src/main/ipc/channels.ts`
**Current State:** AppSettings has `{ githubToken?, theme, defaultClonePath, autoFetch }`
**Target State:** Add `Alias` interface and `aliases` optional field to `AppSettings`
**Implementation:**
```typescript
// Add before AppSettings
export interface Alias {
  name: string;
  command: string;
}

// Add to AppSettings
export interface AppSettings {
  githubToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  autoFetch: boolean;
  aliases?: Alias[];  // NEW
}
```

#### Change Set 2: IPC Handlers
**Files:** `src/main/index.ts`
**Current State:** settings:get returns hardcoded fields; settings:update saves individual keys
**Target State:** Parse/stringify aliases JSON in both handlers
**Implementation:**
```typescript
// In settings:get handler — add to return object:
aliases: (() => {
  try { return JSON.parse(settings.aliases || '[]'); }
  catch { return []; }
})(),

// In settings:update handler — add:
if (updates.aliases !== undefined) {
  database.setSetting('aliases', JSON.stringify(updates.aliases));
}
// And include parsed aliases in the return object
```

#### Change Set 3: Zustand Store
**Files:** `src/renderer/stores/useSettingsStore.ts`
**Current State:** State extends AppSettings with loading/error/actions
**Target State:** Add aliases default, import Alias type
**Implementation:**
```typescript
// Default value:
aliases: [],

// No additional actions needed — updateSettings({ aliases: [...] }) handles it
```

#### Change Set 4: Tab Components (Extract + Create)
**Files:** `GeneralTab.tsx`, `APITab.tsx`, `AliasesTab.tsx`
**Current State:** All settings in single SettingsForm.tsx
**Target State:** Three independent tab components

**GeneralTab.tsx:** Extract SettingsForm lines 92-141 (General + Appearance cards) plus Save button. Props: `{ settings, onUpdate }`

**APITab.tsx:** Extract SettingsForm lines 143-187 (GitHub card). Token validates and saves on validate click. Props: `{ settings, onUpdate }`

**AliasesTab.tsx:** NEW component with:
- List of existing aliases as rows (name, command, edit/delete buttons)
- Add form at bottom (name input, command input, Add button)
- Inline edit mode (Save/Cancel)
- Validation: name non-empty, no spaces, no duplicates
- Immediate persistence: each add/edit/delete calls `onUpdate({ aliases: updatedList })`
- Info text: "Alias changes take effect on next Development session start"
- Props: `{ settings, onUpdate }`

#### Change Set 5: Settings Screen Redesign
**Files:** `src/renderer/screens/SettingsScreen.tsx`
**Current State:** Renders `<SettingsForm settings={...} onUpdate={...} />`
**Target State:** Tab navigation with conditional rendering
**Implementation:**
```typescript
// State
const [activeTab, setActiveTab] = useState<'general' | 'api' | 'aliases'>('general');

// Tab bar: horizontal buttons with border-b, active = border-b-2 border-primary
// Content: conditionally render GeneralTab, APITab, or AliasesTab
// Pass settings and onUpdate to active tab
```

#### Change Set 6: Bashrc Integration
**Files:** `src/main/services/code-server.service.ts`
**Current State:** `createContainerBashrc()` hardcodes 4 aliases (ll, gs, gd, gl)
**Target State:** Read user aliases from DB, merge with defaults (user overrides defaults)
**Implementation:**
```typescript
// In createContainerBashrc(), after the hardcoded default aliases:
// 1. Import database
// 2. Read: const aliasesJson = database.getSetting('aliases');
// 3. Parse: const userAliases = aliasesJson ? JSON.parse(aliasesJson) : [];
// 4. Build alias map: defaults first, then user aliases (overrides by name)
// 5. Generate alias lines from merged map
```

---

## IMPLEMENTATION APPROACH

### Step 1: Type Foundation (Task 1)
- [ ] Add `Alias` interface to `channels.ts`
- [ ] Add `aliases?: Alias[]` to `AppSettings`
- [ ] Verify no type errors in dependent files

### Step 2: Backend Wiring (Tasks 2-3, parallel)
- [ ] Update `settings:get` handler to parse aliases JSON from DB
- [ ] Update `settings:update` handler to stringify and save aliases
- [ ] Add `aliases: []` default to useSettingsStore
- [ ] Import Alias type in store

### Step 3: Tab Components (Tasks 4-5, parallel)
- [ ] Create `GeneralTab.tsx` — extract from SettingsForm
- [ ] Create `APITab.tsx` — extract from SettingsForm
- [ ] Verify each component works in isolation with same props

### Step 4: Alias CRUD Component (Task 6)
- [ ] Create `AliasesTab.tsx` with list display
- [ ] Add alias creation form (name + command inputs)
- [ ] Add inline edit mode
- [ ] Add delete with confirmation
- [ ] Add validation (no empty names, no spaces in name, no duplicates)
- [ ] Add info text about container restart requirement

### Step 5: Screen Assembly (Tasks 7-8)
- [ ] Redesign `SettingsScreen.tsx` with tab navigation
- [ ] Wire GeneralTab, APITab, AliasesTab as tab content
- [ ] Delete old `SettingsForm.tsx`

### Step 6: Bashrc Integration (Task 9, parallel with Step 3)
- [ ] Update `createContainerBashrc()` to read aliases from DB
- [ ] Merge user aliases with defaults (user wins on name conflict)
- [ ] Wrap JSON.parse in try/catch with [] fallback

### Step 7: Manual Verification (LUKA)
- [ ] Settings page shows 3 tabs (General, API, Aliases)
- [ ] General tab: clone dir browse + theme select + Save works
- [ ] API tab: token validate + save works
- [ ] Aliases tab: add alias → appears in list
- [ ] Aliases tab: edit alias → persists
- [ ] Aliases tab: delete alias → removed
- [ ] Open Development screen → open terminal → custom aliases available
- [ ] Default aliases (ll, gs, gd, gl) still work if not overridden

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `SETTINGS-TABS-ALIASES-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
**Location:** `trinity/sessions/`

### Required Sections
1. **Executive Summary** - What was implemented
2. **Changes Applied** - All files created/modified/deleted with descriptions
3. **Test Results** - Manual verification results
4. **UI Screenshots** - Each tab, alias CRUD flow
5. **Data Flow** - Settings → SQLite → bashrc pipeline
6. **Next Steps** - Known limitations, future improvements

### Evidence to Provide
- File diff statistics (X files changed, Y insertions, Z deletions)
- Screenshot of each settings tab
- Screenshot of alias CRUD workflow
- Terminal output showing user aliases in code-server container

---

## AFTER COMPLETION

### CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report**
   - [ ] Implementation deliverable created in `trinity/sessions/`
   - [ ] Follow format: `SETTINGS-TABS-ALIASES-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] All deliverables include required sections listed above

**Step 2: MOVE THIS WORK ORDER FILE**
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-002-settings-tabbed-aliases.md trinity/sessions/
   ```

**Step 3: Verify File Locations**
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-002-settings-tabbed-aliases.md`
   - [ ] Completion report exists in: `trinity/sessions/SETTINGS-TABS-ALIASES-IMPLEMENTATION-COMPLETE-{TIMESTAMP}.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] Settings page displays 3 tabs: General, API, Aliases
- [ ] General tab preserves existing clone dir + theme functionality
- [ ] API tab preserves existing GitHub token validation flow
- [ ] Aliases tab supports add, edit, and delete operations
- [ ] Aliases persist in SQLite across app restarts
- [ ] User aliases appear in code-server container terminal
- [ ] Default aliases (ll, gs, gd, gl) remain unless overridden
- [ ] No regressions in existing settings functionality
- [ ] Old SettingsForm.tsx is deleted (replaced by 3 tab components)
- [ ] Implementation report submitted

---

## CONSTRAINTS & GUIDELINES

### CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations:

- [ ] **git add/commit/push/pull/merge/checkout/branch/tag/rebase/reset/revert/stash** - FORBIDDEN
- [ ] Only LUKA has permission for git operations
- [ ] Only LUKA runs `npm test`, `npm run build`, `npm install`

**CORRECT WORKFLOW:**
1. Make all local file changes as specified
2. Report completion to LUKA with summary of changes
3. LUKA will handle ALL git operations and dependency management

### Do NOT:
- [ ] Modify files outside the specified scope
- [ ] Install npm packages (no new dependencies needed)
- [ ] Change the SQLite schema (aliases stored as JSON in existing key-value table)
- [ ] Add a formal Tabs UI component library (use lightweight styled buttons)
- [ ] Over-engineer the alias validation (basic checks are sufficient)

### DO:
- [ ] Follow existing code patterns (Card, Input, Button components)
- [ ] Use lucide-react icons consistently (Plus, Trash2, Pencil, Save, X)
- [ ] Wrap all JSON.parse calls in try/catch with [] fallback
- [ ] Match the existing settings page visual style
- [ ] Keep each tab component self-contained with its own local state
- [ ] Log alias-related operations in code-server service for debugging

---

## ROLLBACK STRATEGY

If issues arise:
1. **Identify:** Settings page crashes, aliases not saving, bashrc generation fails
2. **Rollback:** Restore `SettingsForm.tsx` from git, revert `SettingsScreen.tsx`, remove 3 new tab files, revert channels.ts/index.ts/store changes
3. **Verify:** Settings page renders original form, save works, no type errors

**Critical Files Backup:** `SettingsForm.tsx` content preserved in git history. All other changes are additive or minor modifications.

---

## CONTEXT FROM TRA PLAN

**Source Plan:** TRA implementation plan from current session
**Predecessor:** WO-001 (VS Code embed) established:
- `code-server.service.ts` with `createContainerBashrc()` method
- Settings infrastructure (Zustand store, IPC channels, SQLite key-value)
- Docker container lifecycle management

**Key Design Decisions:**
- Aliases stored as JSON string under key `"aliases"` in existing settings table — zero schema migration
- Tab navigation built with styled buttons — no external library needed
- Each tab saves independently — General has Save button, API saves on validate, Aliases saves immediately on CRUD
- User aliases override defaults by name — defaults are ll, gs, gd, gl
- Alias changes require container restart — documented in UI with info text

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** STANDARD
**Completeness Required:** 100% - All specified changes must be implemented
**Risk Level:** LOW
**Risk Factors:**
- SettingsForm extraction could miss state or handler wiring
- JSON.parse of corrupted alias data could throw
- Alias names with shell special characters could break bashrc

**Mitigation:**
- Extract tab components one at a time, verify each independently
- All JSON.parse wrapped in try/catch with [] fallback
- Validate alias names: non-empty, no spaces, alphanumeric + hyphens only

---

**Remember:** Make changes systematically, test frequently, and maintain code quality throughout the implementation. Report all changes to LUKA for git operations.