# Work Order: Settings Page Test Suite

**ID:** WO-SETTINGS-TESTS-001
**Created:** 2026-01-29
**Priority:** HIGH
**Status:** PENDING
**Auditor:** JUNO (Quality Auditor)

---

## Objective

Create comprehensive test coverage for the Settings page frontend and backend components, including the Settings screen, SettingsForm component, useSettingsStore Zustand store, Theme provider, and all backend IPC handlers related to settings.

---

## Audit Summary

### Files Discovered

| Layer | File | Lines | Purpose |
|-------|------|-------|---------|
| **Screen** | `src/renderer/screens/SettingsScreen.tsx` | 28 | Main Settings page container |
| **Component** | `src/renderer/components/settings/SettingsForm.tsx` | 197 | Settings form with General, Appearance, GitHub sections |
| **Store** | `src/renderer/stores/useSettingsStore.ts` | 58 | Zustand store for settings state management |
| **Provider** | `src/renderer/providers/ThemeProvider.tsx` | 100 | Theme context provider with system detection |
| **IPC Channels** | `src/main/ipc/channels.ts` | Lines 121-127 | AppSettings type definition |
| **IPC Handlers** | `src/main/index.ts` | Lines 311-364 | settings:get and settings:update handlers |
| **Database** | `src/main/database/database.service.ts` | Lines 213-250 | getSetting, setSetting, getAllSettings |
| **Database Schema** | `src/main/database/schema.ts` | Lines 30-35 | settings table definition |
| **GitHub Service** | `src/main/services/github.service.ts` | Lines 99-103 | validateToken method |
| **GitHub GraphQL** | `src/main/services/github-graphql.service.ts` | Lines 166-191 | validateToken implementation |

### Key Dependencies

**Frontend:**
- React 19.2.3
- Zustand 5.0.10
- Radix UI (Select component)
- lucide-react (Check, Folder icons)

**Backend:**
- better-sqlite3 (database)
- Electron IPC (main/renderer communication)
- @octokit/graphql (token validation)

### Data Flow Analysis

```
User Action
    |
    v
SettingsScreen.tsx
    |-- fetchSettings() on mount
    |-- updateSettings() on save
    v
useSettingsStore.ts (Zustand)
    |-- ipc.invoke('settings:get')
    |-- ipc.invoke('settings:update', updates)
    v
IPC Client (src/renderer/ipc/client.ts)
    |
    v
Main Process Handlers (src/main/index.ts)
    |-- Lines 312-337: settings:get handler
    |-- Lines 339-364: settings:update handler
    v
DatabaseService (src/main/database/database.service.ts)
    |-- getSetting(key)
    |-- setSetting(key, value)
    |-- getAllSettings()
    v
SQLite Database (cola-records.db)
    |-- settings table (key, value, updated_at)
```

### Critical Paths Identified

1. **Settings Load Flow:** SettingsScreen mount -> fetchSettings -> IPC -> Database -> UI update
2. **Settings Save Flow:** User edits -> handleSave -> updateSettings -> IPC -> Database -> Confirmation
3. **GitHub Token Validation:** Token input -> handleValidateToken -> IPC -> GitHub API -> Status update
4. **Theme Change Flow:** Theme select -> handleSave -> updateSettings -> ThemeProvider.setTheme -> DOM class update
5. **Directory Selection Flow:** Browse button -> dialog:open-directory IPC -> Path update -> Save

---

## Components to Test

### Frontend Components

| Component | File Path | Test Priority | Complexity | Notes |
|-----------|-----------|---------------|------------|-------|
| SettingsScreen | `src/renderer/screens/SettingsScreen.tsx` | **HIGH** | Low | Container component, mounts and passes props |
| SettingsForm | `src/renderer/components/settings/SettingsForm.tsx` | **CRITICAL** | High | 197 lines, 3 sections, 4 handlers, form state |
| ThemeProvider | `src/renderer/providers/ThemeProvider.tsx` | **HIGH** | Medium | Context provider, localStorage, system detection |

### Backend Services

| Service | File Path | Test Priority | Methods to Test |
|---------|-----------|---------------|-----------------|
| DatabaseService | `src/main/database/database.service.ts` | **CRITICAL** | getSetting, setSetting, getAllSettings |
| GitHubService | `src/main/services/github.service.ts` | **HIGH** | validateToken |
| GitHubGraphQLService | `src/main/services/github-graphql.service.ts` | **HIGH** | validateToken |

### IPC Handlers

| Handler | Location | Test Priority | Description |
|---------|----------|---------------|-------------|
| settings:get | `src/main/index.ts:312-337` | **CRITICAL** | Gets all settings with defaults |
| settings:update | `src/main/index.ts:339-364` | **CRITICAL** | Updates settings, resets GitHub client |
| github:validate-token | `src/main/index.ts:375-377` | **HIGH** | Validates GitHub PAT |
| dialog:open-directory | `src/main/index.ts:390-396` | **MEDIUM** | Opens native directory picker |

### Stores

| Store | File Path | Test Priority | Actions to Test |
|-------|-----------|---------------|-----------------|
| useSettingsStore | `src/renderer/stores/useSettingsStore.ts` | **CRITICAL** | fetchSettings, updateSettings, setTheme, setDefaultClonePath, setAutoFetch |

---

## Test Tasks

### Phase 1: Unit Tests (Foundation)

#### Task 1.1: useSettingsStore Unit Tests
**File:** `tests/renderer/stores/useSettingsStore.test.ts`
**Priority:** CRITICAL
**Estimated Time:** 2 hours

**Test Cases:**
```typescript
describe('useSettingsStore', () => {
  // Initial State Tests
  it('should have correct default values')
  it('should start with loading: false and error: null')

  // fetchSettings Tests
  describe('fetchSettings', () => {
    it('should set loading to true when fetching')
    it('should update state with fetched settings')
    it('should set loading to false after successful fetch')
    it('should set error on fetch failure')
    it('should handle empty settings response')
  })

  // updateSettings Tests
  describe('updateSettings', () => {
    it('should set loading to true when updating')
    it('should update state with new settings')
    it('should set loading to false after successful update')
    it('should set error and throw on update failure')
    it('should handle partial updates')
  })

  // Convenience Action Tests
  describe('setTheme', () => {
    it('should call updateSettings with theme')
    it('should update theme in store state')
  })

  describe('setDefaultClonePath', () => {
    it('should call updateSettings with defaultClonePath')
    it('should update defaultClonePath in store state')
  })

  describe('setAutoFetch', () => {
    it('should call updateSettings with autoFetch')
    it('should update autoFetch in store state')
  })
})
```

#### Task 1.2: ThemeProvider Unit Tests
**File:** `tests/renderer/providers/ThemeProvider.test.tsx`
**Priority:** HIGH
**Estimated Time:** 2 hours

**Test Cases:**
```typescript
describe('ThemeProvider', () => {
  // Context Tests
  it('should provide default theme context values')
  it('should throw error when useTheme is used outside provider')

  // Theme State Tests
  describe('theme state', () => {
    it('should initialize with defaultTheme prop')
    it('should read initial theme from localStorage')
    it('should fall back to defaultTheme if localStorage is empty')
  })

  // setTheme Tests
  describe('setTheme', () => {
    it('should update theme state')
    it('should persist theme to localStorage')
    it('should apply light class to document root')
    it('should apply dark class to document root')
    it('should remove previous theme class when changing')
  })

  // System Theme Tests
  describe('system theme detection', () => {
    it('should detect system preference when theme is "system"')
    it('should apply dark theme when system prefers dark')
    it('should apply light theme when system prefers light')
    it('should update resolvedTheme based on system preference')
  })

  // System Theme Change Listener
  describe('system theme change listener', () => {
    it('should listen for system theme changes when theme is "system"')
    it('should update theme when system preference changes')
    it('should not listen when theme is explicitly set')
    it('should clean up listener on unmount')
  })
})
```

#### Task 1.3: DatabaseService Settings Unit Tests
**File:** `tests/main/database/database.service.test.ts` (add settings section)
**Priority:** CRITICAL
**Estimated Time:** 2 hours

**Test Cases:**
```typescript
describe('DatabaseService - Settings', () => {
  describe('getSetting', () => {
    it('should return null for non-existent key')
    it('should return stored value for existing key')
    it('should handle special characters in keys')
  })

  describe('setSetting', () => {
    it('should insert new setting')
    it('should update existing setting')
    it('should update updated_at timestamp')
    it('should handle empty string values')
    it('should handle JSON string values')
  })

  describe('getAllSettings', () => {
    it('should return empty object when no settings')
    it('should return all settings as key-value pairs')
    it('should handle multiple settings')
  })
})
```

---

### Phase 2: Integration Tests

#### Task 2.1: Settings IPC Handler Integration Tests
**File:** `tests/main/ipc/settings-handlers.test.ts`
**Priority:** CRITICAL
**Estimated Time:** 3 hours

**Test Cases:**
```typescript
describe('Settings IPC Handlers', () => {
  describe('settings:get', () => {
    it('should return default settings when none exist')
    it('should return saved settings from database')
    it('should create default clone path in Documents/Contributions')
    it('should handle missing githubToken')
    it('should parse autoFetch as boolean')
  })

  describe('settings:update', () => {
    it('should update githubToken in database')
    it('should reset GitHub GraphQL client when token changes')
    it('should update theme setting')
    it('should update defaultClonePath setting')
    it('should update autoFetch as string boolean')
    it('should return updated settings object')
    it('should handle partial updates')
  })
})
```

#### Task 2.2: GitHub Token Validation Integration Tests
**File:** `tests/main/services/github.service.test.ts` (extend existing)
**Priority:** HIGH
**Estimated Time:** 1.5 hours

**Test Cases:**
```typescript
describe('GitHubService - Token Validation', () => {
  describe('validateToken', () => {
    it('should return true for valid token')
    it('should return false for invalid token')
    it('should return false for expired token')
    it('should return false for token without required scopes')
    it('should handle network errors gracefully')
    it('should not cache validation results')
  })
})
```

---

### Phase 3: Component Tests

#### Task 3.1: SettingsForm Component Tests
**File:** `tests/renderer/components/settings/SettingsForm.test.tsx`
**Priority:** CRITICAL
**Estimated Time:** 4 hours

**Test Cases:**
```typescript
describe('SettingsForm', () => {
  // Rendering Tests
  describe('rendering', () => {
    it('should render General settings card')
    it('should render Appearance settings card')
    it('should render GitHub settings card')
    it('should render Save and Reset buttons')
    it('should display current settings values')
  })

  // General Settings Tests
  describe('General Settings', () => {
    it('should display current clone path')
    it('should have read-only clone path input')
    it('should call dialog:open-directory on Browse click')
    it('should update clone path after directory selection')
    it('should handle cancelled directory selection')
  })

  // Appearance Settings Tests
  describe('Appearance Settings', () => {
    it('should display current theme in select')
    it('should show Light, Dark, System options')
    it('should update local theme state on selection')
    it('should not save immediately on selection')
  })

  // GitHub Settings Tests
  describe('GitHub Settings', () => {
    it('should have password-masked token input')
    it('should have disabled Validate button when empty')
    it('should enable Validate button when token entered')
    it('should call github:validate-token on Validate click')
    it('should show loading state during validation')
    it('should show Valid button with check icon on success')
    it('should show error message on validation failure')
    it('should save token only after successful validation')
    it('should reset validation state when token changes')
  })

  // Save Flow Tests
  describe('Save Flow', () => {
    it('should call onUpdate with clonePath and theme on Save')
    it('should apply theme immediately via ThemeProvider')
    it('should show success alert on save')
    it('should show error alert on save failure')
  })

  // State Sync Tests
  describe('State Synchronization', () => {
    it('should sync local state when props change')
    it('should sync clonePath when settings.defaultClonePath changes')
    it('should sync theme when settings.theme changes')
  })
})
```

#### Task 3.2: SettingsScreen Component Tests
**File:** `tests/renderer/screens/SettingsScreen.test.tsx`
**Priority:** HIGH
**Estimated Time:** 1.5 hours

**Test Cases:**
```typescript
describe('SettingsScreen', () => {
  // Rendering Tests
  it('should render Settings heading')
  it('should render description text')
  it('should render SettingsForm component')

  // Lifecycle Tests
  describe('lifecycle', () => {
    it('should call fetchSettings on mount')
    it('should pass settings to SettingsForm')
    it('should pass updateSettings as onUpdate prop')
  })

  // Integration with Store
  describe('store integration', () => {
    it('should display loading state from store')
    it('should display error state from store')
    it('should update when store state changes')
  })
})
```

---

### Phase 4: End-to-End Flow Tests

#### Task 4.1: Settings Full Flow Tests
**File:** `tests/renderer/flows/settings-flow.test.tsx`
**Priority:** MEDIUM
**Estimated Time:** 2 hours

**Test Cases:**
```typescript
describe('Settings Full Flow', () => {
  describe('Initial Load Flow', () => {
    it('should load and display saved settings')
    it('should show default values when no settings saved')
  })

  describe('Theme Change Flow', () => {
    it('should change theme from light to dark')
    it('should persist theme change after save')
    it('should apply theme to document root')
  })

  describe('Clone Path Change Flow', () => {
    it('should update clone path via directory picker')
    it('should persist clone path after save')
  })

  describe('GitHub Token Flow', () => {
    it('should validate and save new token')
    it('should reject invalid token')
    it('should enable GitHub features after token saved')
  })
})
```

---

## Test File Structure

```
tests/
  main/
    database/
      database.service.test.ts (add settings section)
    ipc/
      settings-handlers.test.ts (NEW)
    services/
      github.service.test.ts (extend with validateToken)
      github-graphql.service.test.ts (extend with validateToken)
  renderer/
    components/
      settings/
        SettingsForm.test.tsx (NEW)
    providers/
      ThemeProvider.test.tsx (NEW)
    screens/
      SettingsScreen.test.tsx (NEW)
    stores/
      useSettingsStore.test.ts (NEW)
    flows/
      settings-flow.test.tsx (NEW)
```

---

## Mock Requirements

### IPC Mocks (for renderer tests)
```typescript
// Mock IPC client
vi.mock('../../ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(),
    platform: 'win32',
    isDevelopment: true,
  },
}));
```

### ThemeProvider Mock
```typescript
// Mock ThemeProvider for components that use useTheme
vi.mock('../../providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
  }),
  ThemeProvider: ({ children }: any) => children,
}));
```

### Electron Dialog Mock (for directory picker)
```typescript
// Mock Electron dialog
const mockDialog = {
  showOpenDialog: vi.fn().mockResolvedValue({
    canceled: false,
    filePaths: ['C:\\Users\\test\\Documents\\Contributions'],
  }),
};
```

### Database Mock (for main process tests)
```typescript
// Mock database for isolated testing
const mockDatabase = {
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getAllSettings: vi.fn().mockReturnValue({}),
};
```

---

## Coverage Targets

| Component/Service | Target Coverage | Priority |
|-------------------|-----------------|----------|
| useSettingsStore | 95% | CRITICAL |
| SettingsForm | 90% | CRITICAL |
| DatabaseService (settings methods) | 95% | CRITICAL |
| settings:get handler | 90% | CRITICAL |
| settings:update handler | 90% | CRITICAL |
| ThemeProvider | 85% | HIGH |
| SettingsScreen | 80% | HIGH |
| GitHubService.validateToken | 85% | HIGH |
| dialog:open-directory handler | 70% | MEDIUM |

**Overall Settings Module Target:** 88%

---

## Acceptance Criteria

1. **All test files created** as specified in Test File Structure
2. **All CRITICAL test cases implemented** and passing
3. **All HIGH priority test cases implemented** and passing
4. **Coverage thresholds met** for each component
5. **No regressions** in existing test suite
6. **Mocks properly isolated** - tests don't depend on real IPC or database
7. **Tests run in <30 seconds** total for settings suite
8. **CI/CD compatible** - tests work in headless environment

---

## Risk Assessment

### HIGH RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| IPC mocking complexity | Tests may not reflect real behavior | Use integration tests with real IPC for critical paths |
| Electron dialog testing | Native dialogs hard to test | Mock at IPC layer, verify IPC call made |
| Database state between tests | Tests may affect each other | Use beforeEach to reset database state |
| GitHub API rate limiting | Token validation tests may fail | Mock GitHub API, use real API only for E2E |

### MEDIUM RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| Theme system detection | Tests may behave differently on different OS | Mock matchMedia with configurable return value |
| localStorage in tests | State may persist between tests | Clear localStorage in beforeEach |
| Zustand store isolation | Store state may leak between tests | Reset store state in beforeEach |

### LOW RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| Radix UI Select testing | Component may be complex to test | Use Testing Library's getByRole for accessibility |
| Form state management | Multiple local states may conflict | Test each form section in isolation |

---

## Timeline

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|----------------|--------------|
| Phase 1 | Unit Tests | 6 hours | None |
| Phase 2 | Integration Tests | 4.5 hours | Phase 1 |
| Phase 3 | Component Tests | 5.5 hours | Phase 1, 2 |
| Phase 4 | E2E Flow Tests | 2 hours | Phase 1, 2, 3 |

**Total Estimated Time:** 18 hours

**Recommended Order:**
1. useSettingsStore.test.ts (foundation for other tests)
2. DatabaseService settings tests (backend foundation)
3. Settings IPC handler tests (integration layer)
4. ThemeProvider.test.tsx (required by component tests)
5. SettingsForm.test.tsx (main component)
6. SettingsScreen.test.tsx (container component)
7. settings-flow.test.tsx (full flow validation)

---

## Notes

1. **No existing tests for Settings** - This is a greenfield test suite
2. **Test patterns available** - See existing tests in `tests/renderer/components/issues/` for component test patterns
3. **Setup file exists** - `tests/setup.ts` has IPC mocks and jest-dom matchers
4. **Vitest configuration** - Tests go in `tests/` directory, coverage thresholds at 80%

---

## Appendix: Type Definitions

### AppSettings Interface
```typescript
// From src/main/ipc/channels.ts
export interface AppSettings {
  githubToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  autoFetch: boolean;
}
```

### Settings Store State
```typescript
// From src/renderer/stores/useSettingsStore.ts
interface SettingsState extends AppSettings {
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setDefaultClonePath: (path: string) => Promise<void>;
  setAutoFetch: (enabled: boolean) => Promise<void>;
}
```

### Theme Provider State
```typescript
// From src/renderer/providers/ThemeProvider.tsx
interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}
```

---

**Work Order Created By:** JUNO (Quality Auditor)
**Trinity Version:** 2.1.0
**Last Updated:** 2026-01-29
