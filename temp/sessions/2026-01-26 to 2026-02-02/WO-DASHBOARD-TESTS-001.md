# Work Order: Dashboard Test Coverage Implementation

**Work Order ID**: WO-DASHBOARD-TESTS-001
**Created**: 2026-01-28
**Status**: READY TO START
**Priority**: HIGH
**Assigned To**: TBD (Task execution team)
**Audit Conducted By**: JUNO (Quality Auditor)

---

## Executive Summary

**Current State**: The cola-records dashboard (contributions management system) has **ZERO test coverage**. All tests were deleted (commit 830cf99: "All Tests Deleted in liue of manual testing and re-implementation of tests after").

**Risk Level**: HIGH
- Critical user flows (scanning, PR sync, workflow) are untested
- Complex state management (Zustand stores) has no safety net
- Database operations lack validation tests
- GitHub API integration is untested

**Audit Finding**: This work order implements comprehensive test coverage following Trinity Method testing principles (80% minimum coverage, TDD cycle, 60-30-10 test pyramid).

---

## 1. Component Inventory & Test Status

### Frontend Dashboard Components

| Component | Path | Lines | Complexity | Test Status | Risk |
|-----------|------|-------|------------|-------------|------|
| **ContributionsScreen** | `src/renderer/screens/ContributionsScreen.tsx` | 61 | Low | ❌ NO TESTS | Medium |
| **ContributionCard** | `src/renderer/components/contributions/ContributionCard.tsx` | 196 | High | ❌ NO TESTS | **HIGH** |
| **ContributionWorkflowModal** | `src/renderer/components/contributions/ContributionWorkflowModal.tsx` | 144 | High | ❌ NO TESTS | **HIGH** |
| **ContributionList** | `src/renderer/components/contributions/ContributionList.tsx` | 55 | Low | ❌ NO TESTS | Low |
| **StatusBadge** | `src/renderer/components/contributions/StatusBadge.tsx` | 32 | Low | ❌ NO TESTS | Low |
| **useContributionsStore** | `src/renderer/stores/useContributionsStore.ts` | 88 | Medium | ❌ NO TESTS | **HIGH** |
| **useContributionWorkflow** | `src/renderer/hooks/useContributionWorkflow.ts` | 109 | High | ❌ NO TESTS | **HIGH** |

### Backend Dashboard Services

| Service | Path | Lines | Complexity | Test Status | Risk |
|---------|------|-------|------------|-------------|------|
| **ContributionScannerService** | `src/main/services/contribution-scanner.service.ts` | 262 | Very High | ❌ NO TESTS | **CRITICAL** |
| **GitHubRestService** | `src/main/services/github-rest.service.ts` | 431 | Very High | ❌ NO TESTS | **CRITICAL** |
| **DatabaseService (Contributions)** | `src/main/database/database.service.ts` | 338 | High | ❌ NO TESTS | **CRITICAL** |
| **IPC Handlers (Contributions)** | `src/main/index.ts` (lines 235-320) | ~85 | High | ❌ NO TESTS | **HIGH** |

**Total Components**: 11
**Total Lines to Test**: ~1,800 lines
**Components with Tests**: 0/11 (0%)
**High/Critical Risk Components**: 8/11 (73%)

---

## 2. Critical User Flows (Must Be Tested)

### Flow 1: Directory Scanning & Auto-Import
**User Story**: User opens Contributions screen → App scans default clone path → Displays discovered git repositories

**Components Involved**:
1. ContributionsScreen.tsx (triggers scan)
2. IPC channel: `contribution:scan-directory`
3. ContributionScannerService.scanDirectory()
4. ContributionScannerService.scanRepository()
5. DatabaseService (create/update contributions)
6. useContributionsStore.setContributions()

**Test Scenarios**:
- ✅ Scans directory and finds git repositories
- ✅ Detects fork status (origin + upstream remotes)
- ✅ Validates remote configuration
- ✅ Extracts issue number from branch name
- ✅ Handles non-git directories gracefully
- ✅ Syncs with database (upsert logic)
- ❌ Handles missing directory
- ❌ Handles permission errors
- ❌ Handles corrupted git repositories

**Risk**: **CRITICAL** - Core feature that runs on every screen load

---

### Flow 2: PR Status Sync
**User Story**: User clicks "Sync" button on contribution card → App fetches PR status from GitHub → Updates card badges

**Components Involved**:
1. ContributionCard.tsx (handleSyncPRStatus)
2. IPC channel: `contribution:sync-with-github`
3. GitHubRestService.checkPRStatus()
4. GitHubRestService.listPullRequests()
5. DatabaseService.updateContribution()

**Test Scenarios**:
- ✅ Fetches open PR and updates status
- ✅ Fetches merged PR and updates status
- ✅ Fetches closed PR and updates status
- ✅ Handles no PR found (null return)
- ❌ Handles GitHub API rate limit
- ❌ Handles invalid token
- ❌ Handles network errors
- ❌ Shows user-friendly error messages

**Risk**: **HIGH** - External API dependency, rate limiting, auth

---

### Flow 3: Contribution Workflow (Fork → Clone → Setup)
**User Story**: User starts workflow from issue → App forks repo → Clones locally → Sets up remotes → Creates branch → Opens in IDE

**Components Involved**:
1. ContributionWorkflowModal.tsx (UI)
2. useContributionWorkflow.ts (orchestration)
3. GitHubRestService.forkRepository()
4. IPC channels: `git:clone`, `git:add-remote`, `git:create-branch`, `git:checkout`
5. DatabaseService.createContribution()
6. useContributionsStore.createContribution()

**Test Scenarios**:
- ✅ Complete workflow succeeds (happy path)
- ✅ Progress updates correctly (25% → 50% → 75% → 100%)
- ✅ Creates unique local paths (appends counter if exists)
- ✅ Sets up origin and upstream remotes
- ✅ Creates feature branch with issue number
- ❌ Rollback on fork failure
- ❌ Rollback on clone failure (Windows path issues)
- ❌ Rollback on git operation failure
- ❌ Cleanup partial state on error

**Risk**: **CRITICAL** - Complex multi-step operation, prone to partial failures

---

### Flow 4: Contribution Card Display
**User Story**: User views contribution cards → Sees status badges, PR info, branches, actions

**Components Involved**:
1. ContributionList.tsx (grid layout)
2. ContributionCard.tsx (individual card)
3. StatusBadge.tsx (status visualization)
4. IPC channel: `git:get-branches` (live data)

**Test Scenarios**:
- ✅ Displays in_progress status correctly
- ✅ Displays ready status correctly
- ✅ Displays submitted status (with PR number)
- ✅ Displays merged status
- ✅ Shows fork badge when isFork=true
- ✅ Shows remote validation badge
- ✅ Shows all branches (loads async)
- ✅ Highlights current branch
- ❌ Handles missing git repository
- ❌ Shows loading state for branches

**Risk**: **MEDIUM** - Mostly presentation logic, but complex conditional rendering

---

### Flow 5: Contribution CRUD Operations
**User Story**: User creates/reads/updates/deletes contributions via Zustand store

**Components Involved**:
1. useContributionsStore.ts (state management)
2. IPC channels: `contribution:create`, `contribution:get-all`, `contribution:update`, `contribution:delete`
3. DatabaseService (all CRUD methods)

**Test Scenarios**:
- ✅ Create contribution and add to store
- ✅ Fetch all contributions on mount
- ✅ Update contribution (status change, PR info)
- ✅ Delete contribution and remove from store
- ✅ Handle IPC errors gracefully
- ❌ Optimistic updates (UI updates before IPC completes)
- ❌ Error recovery (retry logic)

**Risk**: **HIGH** - State management is central to all dashboard operations

---

## 3. Risk Assessment Matrix

### Risk Categories

| Component | Complexity | External Deps | State Changes | User Impact | Overall Risk |
|-----------|------------|---------------|---------------|-------------|--------------|
| **ContributionScannerService** | Very High | Git, FS, GitHub API | Medium | High | **CRITICAL** |
| **GitHubRestService** | Very High | GitHub REST API | Low | High | **CRITICAL** |
| **DatabaseService** | High | SQLite | High | High | **CRITICAL** |
| **useContributionWorkflow** | High | Multiple IPC calls | High | High | **HIGH** |
| **ContributionCard** | High | IPC, Git | Medium | Medium | **HIGH** |
| **useContributionsStore** | Medium | IPC | High | High | **HIGH** |
| **ContributionWorkflowModal** | Medium | Hook state | Medium | High | **HIGH** |
| **ContributionsScreen** | Low | Store | Low | Medium | **MEDIUM** |
| **ContributionList** | Low | None | None | Low | **LOW** |
| **StatusBadge** | Low | None | None | Low | **LOW** |

### Risk Scoring
- **CRITICAL (3 components)**: Must have 90%+ coverage, extensive edge case testing
- **HIGH (4 components)**: Must have 80%+ coverage, error handling tests
- **MEDIUM (1 component)**: Should have 70%+ coverage, happy path + errors
- **LOW (3 components)**: Can have 60%+ coverage, basic functionality tests

---

## 4. Test Implementation Plan

### Phase 1: Foundation (Unit Tests - 60%)

#### Task 1.1: StatusBadge Component Tests
**File**: `tests/renderer/components/contributions/StatusBadge.test.tsx`
**Coverage Target**: 100%
**Priority**: LOW (warm-up task)

```typescript
describe('StatusBadge', () => {
  test('should display "In Progress" for in_progress status', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('should display "Ready" for ready status', () => {
    render(<StatusBadge status="ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  test('should display "PR Created" for submitted status', () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText('PR Created')).toBeInTheDocument();
  });

  test('should display "Merged" for merged status', () => {
    render(<StatusBadge status="merged" />);
    expect(screen.getByText('Merged')).toBeInTheDocument();
  });

  test('should apply correct styling for each status', () => {
    const { rerender } = render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toHaveClass('bg-purple-500');

    rerender(<StatusBadge status="merged" />);
    expect(screen.getByText('Merged')).toHaveClass('bg-emerald-700');
  });
});
```

**Acceptance Criteria**:
- [ ] All 4 status types tested
- [ ] Styling verification for each status
- [ ] 100% coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.2: ContributionList Component Tests
**File**: `tests/renderer/components/contributions/ContributionList.test.tsx`
**Coverage Target**: 95%+
**Priority**: LOW

```typescript
describe('ContributionList', () => {
  const mockContributions = [
    {
      id: 'contrib-1',
      repositoryUrl: 'https://github.com/user/repo1.git',
      localPath: '/path/to/repo1',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      // ... other fields
    },
    // ... more mock contributions
  ];

  const mockCallbacks = {
    onDelete: jest.fn(),
    onOpenProject: jest.fn(),
  };

  test('should display loading skeletons when loading', () => {
    render(<ContributionList contributions={[]} loading={true} {...mockCallbacks} />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
  });

  test('should display empty state when no contributions', () => {
    render(<ContributionList contributions={[]} loading={false} {...mockCallbacks} />);
    expect(screen.getByText('No contributions yet')).toBeInTheDocument();
  });

  test('should render all contributions in grid layout', () => {
    render(<ContributionList contributions={mockContributions} loading={false} {...mockCallbacks} />);
    expect(screen.getAllByTestId('contribution-card')).toHaveLength(mockContributions.length);
  });

  test('should pass correct props to ContributionCard', () => {
    // Test that callbacks are properly passed through
  });
});
```

**Acceptance Criteria**:
- [ ] Loading state tested
- [ ] Empty state tested
- [ ] Grid rendering tested
- [ ] Prop passing verified
- [ ] 95%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.3: GitHubRestService Unit Tests
**File**: `tests/main/services/github-rest.service.test.ts`
**Coverage Target**: 80%+
**Priority**: CRITICAL

```typescript
import { GitHubRestService } from '@main/services/github-rest.service';
import { Octokit } from '@octokit/rest';

jest.mock('@octokit/rest');
jest.mock('@main/database');

describe('GitHubRestService', () => {
  let service: GitHubRestService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      repos: {
        get: jest.fn(),
        createFork: jest.fn(),
      },
      pulls: {
        list: jest.fn(),
      },
      // ... other mocked methods
    } as any;

    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);
    service = new GitHubRestService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forkRepository', () => {
    test('should fork repository and return repository data', async () => {
      mockOctokit.repos.createFork.mockResolvedValue({
        data: {
          id: 12345,
          name: 'forked-repo',
          full_name: 'user/forked-repo',
          clone_url: 'https://github.com/user/forked-repo.git',
          // ... other fields
        }
      });

      const result = await service.forkRepository('original-owner', 'repo');

      expect(mockOctokit.repos.createFork).toHaveBeenCalledWith({
        owner: 'original-owner',
        repo: 'repo',
      });
      expect(result).toEqual({
        id: '12345',
        name: 'forked-repo',
        fullName: 'user/forked-repo',
        url: 'https://github.com/user/forked-repo.git',
        // ... other fields
      });
    });

    test('should throw error when fork fails', async () => {
      mockOctokit.repos.createFork.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(service.forkRepository('owner', 'repo')).rejects.toThrow('Failed to fork');
    });
  });

  describe('checkPRStatus', () => {
    test('should return PR info when PR exists for branch', async () => {
      mockOctokit.pulls.list.mockResolvedValue({
        data: [
          {
            number: 42,
            html_url: 'https://github.com/owner/repo/pull/42',
            state: 'open',
            merged_at: null,
            head: { ref: 'fix-issue-123' },
          },
        ],
      });

      const result = await service.checkPRStatus('owner', 'repo', 'fix-issue-123');

      expect(result).toEqual({
        number: 42,
        url: 'https://github.com/owner/repo/pull/42',
        status: 'open',
      });
    });

    test('should return null when no PR found for branch', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [] });

      const result = await service.checkPRStatus('owner', 'repo', 'fix-issue-123');

      expect(result).toBeNull();
    });

    test('should detect merged PR correctly', async () => {
      mockOctokit.pulls.list.mockResolvedValue({
        data: [
          {
            number: 42,
            html_url: 'https://github.com/owner/repo/pull/42',
            state: 'closed',
            merged_at: '2026-01-15T10:30:00Z',
            head: { ref: 'fix-issue-123' },
          },
        ],
      });

      const result = await service.checkPRStatus('owner', 'repo', 'fix-issue-123');

      expect(result?.status).toBe('merged');
    });

    test('should handle API errors gracefully', async () => {
      mockOctokit.pulls.list.mockRejectedValue(new Error('Network error'));

      const result = await service.checkPRStatus('owner', 'repo', 'fix-issue-123');

      expect(result).toBeNull(); // Service returns null on error
    });
  });

  describe('getRepository', () => {
    test('should return repository info with fork parent', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          id: 12345,
          name: 'repo',
          full_name: 'user/repo',
          fork: true,
          parent: {
            id: 54321,
            name: 'original-repo',
            full_name: 'original-owner/original-repo',
            html_url: 'https://github.com/original-owner/original-repo',
          },
          // ... other fields
        },
      });

      const result = await service.getRepository('user', 'repo');

      expect(result.fork).toBe(true);
      expect(result.parent).toBeDefined();
      expect(result.parent?.full_name).toBe('original-owner/original-repo');
    });
  });

  // ... more tests for other methods
});
```

**Acceptance Criteria**:
- [ ] All critical methods tested (forkRepository, checkPRStatus, getRepository)
- [ ] Happy path tested for each method
- [ ] Error handling tested (API errors, rate limits)
- [ ] Mock setup verified (Octokit properly mocked)
- [ ] 80%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.4: DatabaseService (Contributions) Tests
**File**: `tests/main/database/database.service.test.ts`
**Coverage Target**: 85%+
**Priority**: CRITICAL

```typescript
import { DatabaseService } from '@main/database/database.service';
import Database from 'better-sqlite3';

jest.mock('better-sqlite3');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
}));

describe('DatabaseService - Contributions', () => {
  let service: DatabaseService;
  let mockDb: jest.Mocked<Database.Database>;

  beforeEach(async () => {
    mockDb = {
      prepare: jest.fn(),
      exec: jest.fn(),
      pragma: jest.fn(),
      close: jest.fn(),
    } as any;

    (Database as jest.Mock).mockImplementation(() => mockDb);

    service = new DatabaseService();
    await service.initialize();
  });

  afterEach(() => {
    service.close();
    jest.clearAllMocks();
  });

  describe('createContribution', () => {
    test('should insert contribution into database', () => {
      const mockStatement = {
        run: jest.fn(),
      };
      mockDb.prepare.mockReturnValue(mockStatement as any);

      const contributionData = {
        repositoryUrl: 'https://github.com/user/repo.git',
        localPath: '/path/to/repo',
        issueNumber: 123,
        issueTitle: 'Fix bug',
        branchName: 'fix-issue-123',
        status: 'in_progress' as const,
      };

      const result = service.createContribution(contributionData);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO contributions'));
      expect(mockStatement.run).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: expect.stringMatching(/^contrib_/),
        ...contributionData,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    test('should use provided createdAt timestamp', () => {
      const mockStatement = { run: jest.fn() };
      mockDb.prepare.mockReturnValue(mockStatement as any);

      const createdAt = new Date('2026-01-01T00:00:00Z');
      const contributionData = {
        repositoryUrl: 'https://github.com/user/repo.git',
        localPath: '/path/to/repo',
        issueNumber: 123,
        issueTitle: 'Fix bug',
        branchName: 'fix-issue-123',
        status: 'in_progress' as const,
      };

      const result = service.createContribution(contributionData, createdAt);

      expect(result.createdAt).toEqual(createdAt);
    });
  });

  describe('getAllContributions', () => {
    test('should return all contributions ordered by created_at DESC', () => {
      const mockRows = [
        {
          id: 'contrib-1',
          repository_url: 'https://github.com/user/repo1.git',
          local_path: '/path/to/repo1',
          issue_number: 123,
          issue_title: 'Fix bug 1',
          branch_name: 'fix-issue-123',
          status: 'in_progress',
          created_at: Date.now(),
          updated_at: Date.now(),
          pr_url: null,
          pr_number: null,
          pr_status: null,
          upstream_url: null,
          is_fork: 1,
          remotes_valid: 1,
        },
        // ... more rows
      ];

      const mockStatement = {
        all: jest.fn().mockReturnValue(mockRows),
      };
      mockDb.prepare.mockReturnValue(mockStatement as any);

      const result = service.getAllContributions();

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'));
      expect(result).toHaveLength(mockRows.length);
      expect(result[0]).toMatchObject({
        id: 'contrib-1',
        repositoryUrl: 'https://github.com/user/repo1.git',
        isFork: true,
        remotesValid: true,
      });
    });
  });

  describe('updateContribution', () => {
    test('should update contribution and return merged result', () => {
      const existingContribution = {
        id: 'contrib-1',
        repositoryUrl: 'https://github.com/user/repo.git',
        localPath: '/path/to/repo',
        issueNumber: 123,
        issueTitle: 'Fix bug',
        branchName: 'fix-issue-123',
        status: 'in_progress' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockGetStatement = {
        get: jest.fn().mockReturnValue({
          id: 'contrib-1',
          repository_url: 'https://github.com/user/repo.git',
          local_path: '/path/to/repo',
          issue_number: 123,
          issue_title: 'Fix bug',
          branch_name: 'fix-issue-123',
          status: 'in_progress',
          created_at: existingContribution.createdAt.getTime(),
          updated_at: existingContribution.updatedAt.getTime(),
          pr_url: null,
          pr_number: null,
          pr_status: null,
          upstream_url: null,
          is_fork: 1,
          remotes_valid: 1,
        }),
      };

      const mockUpdateStatement = {
        run: jest.fn(),
      };

      mockDb.prepare
        .mockReturnValueOnce(mockGetStatement as any) // First call for SELECT
        .mockReturnValueOnce(mockUpdateStatement as any); // Second call for UPDATE

      const updates = {
        status: 'submitted' as const,
        prUrl: 'https://github.com/user/repo/pull/42',
        prNumber: 42,
        prStatus: 'open' as const,
      };

      const result = service.updateContribution('contrib-1', updates);

      expect(mockUpdateStatement.run).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'contrib-1',
        status: 'submitted',
        prUrl: 'https://github.com/user/repo/pull/42',
        prNumber: 42,
        prStatus: 'open',
      });
    });

    test('should throw error when contribution not found', () => {
      const mockStatement = {
        get: jest.fn().mockReturnValue(null),
      };
      mockDb.prepare.mockReturnValue(mockStatement as any);

      expect(() => service.updateContribution('non-existent', { status: 'ready' }))
        .toThrow('Contribution with id non-existent not found');
    });
  });

  describe('deleteContribution', () => {
    test('should delete contribution from database', () => {
      const mockStatement = {
        run: jest.fn(),
      };
      mockDb.prepare.mockReturnValue(mockStatement as any);

      service.deleteContribution('contrib-1');

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM contributions WHERE id = ?');
      expect(mockStatement.run).toHaveBeenCalledWith('contrib-1');
    });
  });
});
```

**Acceptance Criteria**:
- [ ] All CRUD operations tested
- [ ] Database mocking setup correctly
- [ ] Row transformation tested (snake_case → camelCase)
- [ ] Error cases tested (not found, etc.)
- [ ] 85%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.5: ContributionScannerService Tests
**File**: `tests/main/services/contribution-scanner.service.test.ts`
**Coverage Target**: 80%+
**Priority**: CRITICAL

```typescript
import { ContributionScannerService } from '@main/services/contribution-scanner.service';
import { gitHubRestService } from '@main/services/github-rest.service';
import { simpleGit } from 'simple-git';
import * as fs from 'fs';

jest.mock('simple-git');
jest.mock('@main/services/github-rest.service');
jest.mock('fs');

describe('ContributionScannerService', () => {
  let service: ContributionScannerService;
  let mockGit: any;

  beforeEach(() => {
    service = new ContributionScannerService();

    mockGit = {
      checkIsRepo: jest.fn(),
      revparse: jest.fn(),
      getRemotes: jest.fn(),
    };

    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanDirectory', () => {
    test('should scan directory and find git repositories', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo1', isDirectory: () => true },
        { name: 'repo2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ]);

      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.revparse.mockResolvedValue('main');
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo1.git' } },
      ]);

      (gitHubRestService.getRepository as jest.Mock).mockResolvedValue({
        fork: false,
      });

      const result = await service.scanDirectory('/path/to/contributions');

      expect(result).toHaveLength(2); // Only directories
      expect(result[0]).toMatchObject({
        localPath: expect.stringContaining('repo1'),
        branchName: 'main',
        isFork: false,
      });
    });

    test('should return empty array when directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.scanDirectory('/non/existent/path');

      expect(result).toEqual([]);
    });

    test('should skip non-git directories', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'not-a-repo', isDirectory: () => true },
      ]);

      mockGit.checkIsRepo.mockResolvedValue(false);

      const result = await service.scanDirectory('/path/to/contributions');

      // Should still add to contributions (as per current implementation)
      expect(result).toHaveLength(1);
      expect(result[0].repositoryUrl).toContain('not-a-repo');
    });
  });

  describe('scanRepository', () => {
    test('should detect fork status correctly', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.revparse.mockResolvedValue('fix-issue-123');
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/forked-repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/original/repo.git' } },
      ]);

      (gitHubRestService.getRepository as jest.Mock).mockResolvedValue({
        fork: true,
        parent: {
          full_name: 'original/repo',
        },
      });

      (fs.statSync as jest.Mock).mockReturnValue({
        birthtime: new Date('2026-01-15T10:00:00Z'),
      });

      const result = await service.scanRepository('/path/to/repo');

      expect(result).toMatchObject({
        isFork: true,
        remotesValid: true,
        remotes: {
          origin: 'https://github.com/user/forked-repo.git',
          upstream: 'https://github.com/original/repo.git',
        },
      });
    });

    test('should extract issue number from branch name', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.revparse.mockResolvedValue('fix-issue-456');
      mockGit.getRemotes.mockResolvedValue([]);

      (fs.statSync as jest.Mock).mockReturnValue({
        birthtime: new Date(),
      });

      const result = await service.scanRepository('/path/to/repo');

      expect(result?.issueNumber).toBe(456);
    });

    test('should check PR status when remotes are configured', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.revparse.mockResolvedValue('fix-issue-123');
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/original/repo.git' } },
      ]);

      (gitHubRestService.getRepository as jest.Mock).mockResolvedValue({
        fork: true,
        parent: { full_name: 'original/repo' },
      });

      (gitHubRestService.checkPRStatus as jest.Mock).mockResolvedValue({
        number: 42,
        url: 'https://github.com/original/repo/pull/42',
        status: 'open',
      });

      (fs.statSync as jest.Mock).mockReturnValue({
        birthtime: new Date(),
      });

      const result = await service.scanRepository('/path/to/repo');

      expect(gitHubRestService.checkPRStatus).toHaveBeenCalledWith('original', 'repo', 'fix-issue-123');
      expect(result).toMatchObject({
        prNumber: 42,
        prStatus: 'open',
      });
    });

    test('should handle git errors gracefully', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Not a git repository'));

      const result = await service.scanRepository('/path/to/non-repo');

      expect(result).toBeNull();
    });
  });

  describe('validateRemotes', () => {
    test('should return invalid when no origin', async () => {
      const result = await (service as any).validateRemotes('', '');

      expect(result).toEqual({
        isFork: false,
        remotesValid: false,
      });
    });

    test('should return valid non-fork when only origin exists', async () => {
      const result = await (service as any).validateRemotes('https://github.com/user/repo.git', '');

      expect(result).toEqual({
        isFork: false,
        remotesValid: true,
      });
    });

    test('should validate fork relationship via GitHub API', async () => {
      (gitHubRestService.getRepository as jest.Mock).mockResolvedValue({
        fork: true,
        parent: {
          full_name: 'original/repo',
        },
      });

      const result = await (service as any).validateRemotes(
        'https://github.com/user/forked-repo.git',
        'https://github.com/original/repo.git'
      );

      expect(result).toEqual({
        isFork: true,
        remotesValid: true,
      });
    });
  });

  describe('extractRepoInfo', () => {
    test('should extract owner and repo from HTTPS URL', () => {
      const result = (service as any).extractRepoInfo('https://github.com/owner/repo.git');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
      });
    });

    test('should extract owner and repo from SSH URL', () => {
      const result = (service as any).extractRepoInfo('git@github.com:owner/repo.git');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
      });
    });

    test('should return null for invalid URL', () => {
      const result = (service as any).extractRepoInfo('not-a-valid-url');

      expect(result).toBeNull();
    });
  });
});
```

**Acceptance Criteria**:
- [ ] scanDirectory tested (happy path + edge cases)
- [ ] scanRepository tested (fork detection, PR status, issue extraction)
- [ ] validateRemotes tested (all scenarios)
- [ ] extractRepoInfo tested (HTTPS, SSH, invalid)
- [ ] Error handling tested
- [ ] 80%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 2: Integration Tests (30%)

#### Task 2.1: Contribution Workflow Integration Tests
**File**: `tests/integration/contribution-workflow.test.ts`
**Coverage Target**: 75%+
**Priority**: HIGH

```typescript
import { useContributionWorkflow } from '@renderer/hooks/useContributionWorkflow';
import { renderHook, waitFor } from '@testing-library/react';
import { ipc } from '@renderer/ipc/client';

jest.mock('@renderer/ipc/client');
jest.mock('@renderer/stores/useContributionsStore');
jest.mock('@renderer/stores/useSettingsStore');

describe('Contribution Workflow Integration', () => {
  const mockIssue = {
    id: '1',
    number: 123,
    title: 'Fix bug in dashboard',
    repository: 'owner/repo',
    // ... other fields
  };

  beforeEach(() => {
    (ipc.invoke as jest.Mock).mockReset();
  });

  test('should complete full workflow successfully', async () => {
    // Mock IPC responses
    (ipc.invoke as jest.Mock)
      .mockResolvedValueOnce({ // github:fork-repository
        name: 'repo',
        url: 'https://github.com/user/repo.git',
      })
      .mockResolvedValueOnce(false) // fs:directory-exists (first check)
      .mockResolvedValueOnce(undefined) // git:clone
      .mockResolvedValueOnce(undefined) // git:add-remote
      .mockResolvedValueOnce(undefined) // git:create-branch
      .mockResolvedValueOnce(undefined); // git:checkout

    const { result } = renderHook(() => useContributionWorkflow());

    const workflowPromise = result.current.startWorkflow(mockIssue);

    // Assert progress updates
    await waitFor(() => expect(result.current.state.status).toBe('forking'));
    expect(result.current.state.progress).toBe(25);

    await waitFor(() => expect(result.current.state.status).toBe('cloning'));
    expect(result.current.state.progress).toBe(50);

    await waitFor(() => expect(result.current.state.status).toBe('setting_up_remotes'));
    expect(result.current.state.progress).toBe(75);

    await waitFor(() => expect(result.current.state.status).toBe('creating_branch'));
    expect(result.current.state.progress).toBe(85);

    await waitFor(() => expect(result.current.state.status).toBe('complete'));
    expect(result.current.state.progress).toBe(100);

    const contribution = await workflowPromise;

    expect(contribution).toMatchObject({
      branchName: 'fix-issue-123',
      status: 'in_progress',
      isFork: true,
      remotesValid: true,
    });
  });

  test('should handle directory collision by appending counter', async () => {
    (ipc.invoke as jest.Mock)
      .mockResolvedValueOnce({ name: 'repo', url: 'https://github.com/user/repo.git' })
      .mockResolvedValueOnce(true) // fs:directory-exists (/path/repo)
      .mockResolvedValueOnce(true) // fs:directory-exists (/path/repo-1)
      .mockResolvedValueOnce(false) // fs:directory-exists (/path/repo-2)
      .mockResolvedValueOnce(undefined) // git:clone
      .mockResolvedValueOnce(undefined) // git:add-remote
      .mockResolvedValueOnce(undefined) // git:create-branch
      .mockResolvedValueOnce(undefined); // git:checkout

    const { result } = renderHook(() => useContributionWorkflow());

    await result.current.startWorkflow(mockIssue);

    await waitFor(() => expect(result.current.state.status).toBe('complete'));

    expect(result.current.state.contribution?.localPath).toContain('repo-2');
  });

  test('should rollback and show error when fork fails', async () => {
    (ipc.invoke as jest.Mock).mockRejectedValueOnce(new Error('GitHub API rate limit exceeded'));

    const { result } = renderHook(() => useContributionWorkflow());

    await expect(result.current.startWorkflow(mockIssue)).rejects.toThrow();

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error).toContain('rate limit');
  });

  test('should rollback and show error when clone fails (Windows path issue)', async () => {
    (ipc.invoke as jest.Mock)
      .mockResolvedValueOnce({ name: 'repo', url: 'https://github.com/user/repo.git' })
      .mockResolvedValueOnce(false) // fs:directory-exists
      .mockRejectedValueOnce(new Error('fatal: invalid path "file .txt"')); // git:clone

    const { result } = renderHook(() => useContributionWorkflow());

    await expect(result.current.startWorkflow(mockIssue)).rejects.toThrow();

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error).toContain('invalid path');
  });
});
```

**Acceptance Criteria**:
- [ ] Full workflow tested (fork → clone → setup → branch)
- [ ] Progress state updates verified
- [ ] Directory collision handling tested
- [ ] Error rollback tested (fork failure, clone failure)
- [ ] 75%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 2.2: IPC Handlers Integration Tests
**File**: `tests/integration/ipc-contributions.test.ts`
**Coverage Target**: 70%+
**Priority**: HIGH

```typescript
import { database } from '@main/database';
import { contributionScannerService } from '@main/services/contribution-scanner.service';
import { gitHubRestService } from '@main/services/github-rest.service';

jest.mock('@main/database');
jest.mock('@main/services/contribution-scanner.service');
jest.mock('@main/services/github-rest.service');

describe('Contribution IPC Handlers Integration', () => {
  // Test IPC handlers with mocked services
  // Verify data flows correctly through the stack

  describe('contribution:scan-directory', () => {
    test('should scan directory and sync with database', async () => {
      const mockScanned = [
        {
          localPath: '/path/to/repo1',
          repositoryUrl: 'https://github.com/user/repo1.git',
          branchName: 'main',
          isFork: false,
          remotesValid: true,
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      (contributionScannerService.scanDirectory as jest.Mock).mockResolvedValue(mockScanned);
      (database.getAllContributions as jest.Mock).mockReturnValue([]);
      (database.createContribution as jest.Mock).mockImplementation((data, createdAt) => ({
        id: 'contrib-1',
        ...data,
        createdAt: createdAt || new Date(),
        updatedAt: new Date(),
      }));

      // Simulate IPC handler logic
      const handler = async (directoryPath: string) => {
        const scanned = await contributionScannerService.scanDirectory(directoryPath);
        const existing = database.getAllContributions();
        const contributions = [];

        for (const scannedContrib of scanned) {
          const existingContrib = existing.find(c => c.localPath === scannedContrib.localPath);

          if (!existingContrib) {
            const created = database.createContribution(
              {
                repositoryUrl: scannedContrib.repositoryUrl,
                localPath: scannedContrib.localPath,
                branchName: scannedContrib.branchName,
                status: 'in_progress',
                issueNumber: scannedContrib.issueNumber || 0,
                issueTitle: scannedContrib.issueTitle || '',
                isFork: scannedContrib.isFork,
                remotesValid: scannedContrib.remotesValid,
                upstreamUrl: scannedContrib.upstreamUrl,
                prUrl: scannedContrib.prUrl,
                prNumber: scannedContrib.prNumber,
                prStatus: scannedContrib.prStatus,
              },
              scannedContrib.createdAt
            );
            contributions.push(created);
          }
        }

        return contributions;
      };

      const result = await handler('/path/to/contributions');

      expect(contributionScannerService.scanDirectory).toHaveBeenCalledWith('/path/to/contributions');
      expect(database.createContribution).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].localPath).toBe('/path/to/repo1');
    });
  });

  describe('contribution:sync-with-github', () => {
    test('should sync PR status from GitHub and update database', async () => {
      const mockContribution = {
        id: 'contrib-1',
        repositoryUrl: 'https://github.com/user/repo.git',
        localPath: '/path/to/repo',
        branchName: 'fix-issue-123',
        upstreamUrl: 'https://github.com/original/repo.git',
        status: 'in_progress' as const,
        // ... other fields
      };

      (database.getContributionById as jest.Mock).mockReturnValue(mockContribution);
      (gitHubRestService.checkPRStatus as jest.Mock).mockResolvedValue({
        number: 42,
        url: 'https://github.com/original/repo/pull/42',
        status: 'open',
      });
      (database.updateContribution as jest.Mock).mockImplementation((id, updates) => ({
        ...mockContribution,
        ...updates,
      }));

      // Simulate IPC handler logic
      const handler = async (contributionId: string) => {
        const contribution = database.getContributionById(contributionId);
        if (!contribution) {
          throw new Error(`Contribution not found: ${contributionId}`);
        }

        if (!contribution.upstreamUrl) {
          throw new Error('Cannot sync: no upstream URL configured');
        }

        const upstreamMatch = contribution.upstreamUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
        if (!upstreamMatch) {
          throw new Error('Invalid upstream URL');
        }

        const [, owner, repo] = upstreamMatch;
        const prInfo = await gitHubRestService.checkPRStatus(owner, repo, contribution.branchName);

        if (prInfo) {
          return database.updateContribution(contribution.id, {
            prUrl: prInfo.url,
            prNumber: prInfo.number,
            prStatus: prInfo.status,
          });
        }

        return contribution;
      };

      const result = await handler('contrib-1');

      expect(gitHubRestService.checkPRStatus).toHaveBeenCalledWith('original', 'repo', 'fix-issue-123');
      expect(database.updateContribution).toHaveBeenCalledWith('contrib-1', {
        prUrl: 'https://github.com/original/repo/pull/42',
        prNumber: 42,
        prStatus: 'open',
      });
      expect(result.prNumber).toBe(42);
    });
  });
});
```

**Acceptance Criteria**:
- [ ] contribution:scan-directory handler tested
- [ ] contribution:sync-with-github handler tested
- [ ] Database sync logic verified
- [ ] Error handling tested
- [ ] 70%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 3: Component Tests (Remaining Frontend)

#### Task 3.1: ContributionCard Component Tests
**File**: `tests/renderer/components/contributions/ContributionCard.test.tsx`
**Coverage Target**: 80%+
**Priority**: HIGH

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContributionCard } from '@renderer/components/contributions/ContributionCard';
import { ipc } from '@renderer/ipc/client';

jest.mock('@renderer/ipc/client');

describe('ContributionCard', () => {
  const mockContribution = {
    id: 'contrib-1',
    repositoryUrl: 'https://github.com/user/repo.git',
    localPath: '/path/to/repo',
    branchName: 'fix-issue-123',
    status: 'in_progress' as const,
    issueNumber: 123,
    issueTitle: 'Fix bug',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-20T15:30:00Z'),
    isFork: true,
    remotesValid: true,
    upstreamUrl: 'https://github.com/original/repo.git',
  };

  const mockCallbacks = {
    onDelete: jest.fn(),
    onOpenProject: jest.fn(),
  };

  beforeEach(() => {
    (ipc.invoke as jest.Mock).mockReset();
  });

  test('should display repository name and URL', () => {
    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    expect(screen.getByText('repo')).toBeInTheDocument();
    expect(screen.getByText('user/repo')).toBeInTheDocument();
  });

  test('should display status badge', () => {
    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('should display fork badge when isFork is true', () => {
    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    expect(screen.getByText('Fork')).toBeInTheDocument();
  });

  test('should display remotes valid badge', () => {
    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    expect(screen.getByText('Remotes Valid')).toBeInTheDocument();
  });

  test('should display PR status when available', () => {
    const contributionWithPR = {
      ...mockContribution,
      prNumber: 42,
      prStatus: 'open' as const,
    };

    render(<ContributionCard contribution={contributionWithPR} {...mockCallbacks} />);

    expect(screen.getByText(/PR #42 - open/)).toBeInTheDocument();
  });

  test('should load and display branches', async () => {
    (ipc.invoke as jest.Mock).mockResolvedValue(['main', 'fix-issue-123', 'feature-branch']);

    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('fix-issue-123')).toBeInTheDocument();
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });

    // Current branch should have different styling
    const currentBranch = screen.getByText('fix-issue-123');
    expect(currentBranch).toHaveClass('bg-primary');
  });

  test('should call onOpenProject when Open Project button clicked', () => {
    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    fireEvent.click(screen.getByText('Open Project'));

    expect(mockCallbacks.onOpenProject).toHaveBeenCalledWith(mockContribution);
  });

  test('should open external URL when View on GitHub clicked', async () => {
    (ipc.invoke as jest.Mock).mockResolvedValue(undefined);

    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    fireEvent.click(screen.getByText('View on GitHub'));

    expect(ipc.invoke).toHaveBeenCalledWith('shell:open-external', mockContribution.repositoryUrl);
  });

  test('should sync PR status when sync button clicked', async () => {
    (ipc.invoke as jest.Mock)
      .mockResolvedValueOnce(['fix-issue-123']) // git:get-branches
      .mockResolvedValueOnce(undefined); // contribution:sync-with-github

    const { rerender } = render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    const syncButton = screen.getByTitle('Sync PR status with GitHub');
    fireEvent.click(syncButton);

    // Should show loading state
    await waitFor(() => {
      expect(syncButton.querySelector('.animate-spin')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('contribution:sync-with-github', 'contrib-1');
    });
  });

  test('should show confirmation dialog before delete', () => {
    global.confirm = jest.fn().mockReturnValue(false);

    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    fireEvent.click(screen.getByTestId('delete-button')); // Assuming Trash2 icon has testId

    expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('repo'));
    expect(mockCallbacks.onDelete).not.toHaveBeenCalled();
  });

  test('should call onDelete when confirmed', () => {
    global.confirm = jest.fn().mockReturnValue(true);

    render(<ContributionCard contribution={mockContribution} {...mockCallbacks} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    expect(mockCallbacks.onDelete).toHaveBeenCalledWith('contrib-1');
  });
});
```

**Acceptance Criteria**:
- [ ] All badges displayed correctly
- [ ] Branch loading tested
- [ ] Button actions tested (open, sync, delete)
- [ ] PR sync flow tested
- [ ] Confirmation dialogs tested
- [ ] 80%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 3.2: ContributionWorkflowModal Component Tests
**File**: `tests/renderer/components/contributions/ContributionWorkflowModal.test.tsx`
**Coverage Target**: 75%+
**Priority**: HIGH

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { ContributionWorkflowModal } from '@renderer/components/contributions/ContributionWorkflowModal';
import { useContributionWorkflow } from '@renderer/hooks/useContributionWorkflow';

jest.mock('@renderer/hooks/useContributionWorkflow');

describe('ContributionWorkflowModal', () => {
  const mockIssue = {
    id: '1',
    number: 123,
    title: 'Fix bug in dashboard',
    repository: 'owner/repo',
    // ... other fields
  };

  const mockCallbacks = {
    onClose: jest.fn(),
    onComplete: jest.fn(),
    onStartDev: jest.fn(),
  };

  beforeEach(() => {
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'idle', progress: 0, error: null, contribution: null },
      startWorkflow: jest.fn(),
      reset: jest.fn(),
    });
  });

  test('should start workflow when modal opens', async () => {
    const mockStartWorkflow = jest.fn();
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'idle', progress: 0, error: null, contribution: null },
      startWorkflow: mockStartWorkflow,
      reset: jest.fn(),
    });

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        {...mockCallbacks}
      />
    );

    await waitFor(() => {
      expect(mockStartWorkflow).toHaveBeenCalledWith(mockIssue);
    });
  });

  test('should display forking status message', () => {
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'forking', progress: 25, error: null, contribution: null },
      startWorkflow: jest.fn(),
      reset: jest.fn(),
    });

    render(<ContributionWorkflowModal issue={mockIssue} isOpen={true} {...mockCallbacks} />);

    expect(screen.getByText('Forking repository to your GitHub account...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  test('should display cloning status message', () => {
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'cloning', progress: 50, error: null, contribution: null },
      startWorkflow: jest.fn(),
      reset: jest.fn(),
    });

    render(<ContributionWorkflowModal issue={mockIssue} isOpen={true} {...mockCallbacks} />);

    expect(screen.getByText('Cloning repository to local machine...')).toBeInTheDocument();
  });

  test('should display completion message with contribution details', () => {
    const mockContribution = {
      id: 'contrib-1',
      localPath: '/path/to/repo',
      branchName: 'fix-issue-123',
      // ... other fields
    };

    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'complete', progress: 100, error: null, contribution: mockContribution },
      startWorkflow: jest.fn(),
      reset: jest.fn(),
    });

    render(<ContributionWorkflowModal issue={mockIssue} isOpen={true} {...mockCallbacks} />);

    expect(screen.getByText('Setup complete! Repository is ready for development.')).toBeInTheDocument();
    expect(screen.getByText('/path/to/repo')).toBeInTheDocument();
    expect(screen.getByText('fix-issue-123')).toBeInTheDocument();
    expect(screen.getByText('Start Dev')).toBeInTheDocument();
  });

  test('should display helpful error message for Windows path issues', () => {
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'error', progress: 0, error: 'fatal: invalid path "file .txt"', contribution: null },
      startWorkflow: jest.fn(),
      reset: jest.fn(),
    });

    render(<ContributionWorkflowModal issue={mockIssue} isOpen={true} {...mockCallbacks} />);

    expect(screen.getByText(/Windows-incompatible paths/)).toBeInTheDocument();
  });

  test('should call onStartDev and close modal when Start Dev clicked', async () => {
    const mockContribution = {
      id: 'contrib-1',
      localPath: '/path/to/repo',
      // ... other fields
    };

    const mockReset = jest.fn();
    (useContributionWorkflow as jest.Mock).mockReturnValue({
      state: { status: 'complete', progress: 100, error: null, contribution: mockContribution },
      startWorkflow: jest.fn(),
      reset: mockReset,
    });

    render(<ContributionWorkflowModal issue={mockIssue} isOpen={true} {...mockCallbacks} />);

    fireEvent.click(screen.getByText('Start Dev'));

    expect(mockCallbacks.onComplete).toHaveBeenCalledWith(mockContribution);
    expect(mockCallbacks.onStartDev).toHaveBeenCalledWith(mockContribution);
    expect(mockReset).toHaveBeenCalled();
    expect(mockCallbacks.onClose).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria**:
- [ ] All workflow states display correctly
- [ ] Progress bar updates tested
- [ ] Error messages tested (including Windows path issues)
- [ ] Completion flow tested
- [ ] Modal close/reset tested
- [ ] 75%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 3.3: useContributionsStore Tests
**File**: `tests/renderer/stores/useContributionsStore.test.ts`
**Coverage Target**: 85%+
**Priority**: HIGH

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContributionsStore } from '@renderer/stores/useContributionsStore';
import { ipc } from '@renderer/ipc/client';

jest.mock('@renderer/ipc/client');

describe('useContributionsStore', () => {
  beforeEach(() => {
    // Reset store state
    useContributionsStore.setState({
      contributions: [],
      loading: false,
      error: null,
    });

    (ipc.invoke as jest.Mock).mockReset();
  });

  test('should set contributions', () => {
    const { result } = renderHook(() => useContributionsStore());

    const mockContributions = [
      { id: 'contrib-1', repositoryUrl: 'https://github.com/user/repo1.git' },
      { id: 'contrib-2', repositoryUrl: 'https://github.com/user/repo2.git' },
    ];

    act(() => {
      result.current.setContributions(mockContributions as any);
    });

    expect(result.current.contributions).toEqual(mockContributions);
  });

  test('should fetch all contributions from IPC', async () => {
    const mockContributions = [
      { id: 'contrib-1', repositoryUrl: 'https://github.com/user/repo1.git' },
    ];

    (ipc.invoke as jest.Mock).mockResolvedValue(mockContributions);

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.fetchContributions();
    });

    expect(ipc.invoke).toHaveBeenCalledWith('contribution:get-all');
    expect(result.current.contributions).toEqual(mockContributions);
    expect(result.current.loading).toBe(false);
  });

  test('should handle fetch error', async () => {
    (ipc.invoke as jest.Mock).mockRejectedValue(new Error('Database error'));

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.fetchContributions();
    });

    expect(result.current.error).toBe('Error: Database error');
    expect(result.current.loading).toBe(false);
  });

  test('should create contribution and add to store', async () => {
    const newContribution = {
      repositoryUrl: 'https://github.com/user/new-repo.git',
      localPath: '/path/to/new-repo',
      branchName: 'main',
      status: 'in_progress' as const,
      issueNumber: 123,
      issueTitle: 'Fix bug',
    };

    const createdContribution = {
      id: 'contrib-new',
      ...newContribution,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (ipc.invoke as jest.Mock).mockResolvedValue(createdContribution);

    const { result } = renderHook(() => useContributionsStore());

    let contribution;
    await act(async () => {
      contribution = await result.current.createContribution(newContribution);
    });

    expect(ipc.invoke).toHaveBeenCalledWith('contribution:create', newContribution);
    expect(result.current.contributions).toContainEqual(createdContribution);
    expect(contribution).toEqual(createdContribution);
  });

  test('should update contribution in store', async () => {
    const existingContribution = {
      id: 'contrib-1',
      repositoryUrl: 'https://github.com/user/repo.git',
      status: 'in_progress' as const,
    };

    useContributionsStore.setState({
      contributions: [existingContribution as any],
    });

    const updates = {
      status: 'submitted' as const,
      prNumber: 42,
    };

    const updatedContribution = {
      ...existingContribution,
      ...updates,
    };

    (ipc.invoke as jest.Mock).mockResolvedValue(updatedContribution);

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.updateContribution('contrib-1', updates);
    });

    expect(ipc.invoke).toHaveBeenCalledWith('contribution:update', 'contrib-1', updates);
    expect(result.current.contributions[0]).toEqual(updatedContribution);
  });

  test('should delete contribution from store', async () => {
    useContributionsStore.setState({
      contributions: [
        { id: 'contrib-1', repositoryUrl: 'https://github.com/user/repo1.git' },
        { id: 'contrib-2', repositoryUrl: 'https://github.com/user/repo2.git' },
      ] as any,
    });

    (ipc.invoke as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.deleteContribution('contrib-1');
    });

    expect(ipc.invoke).toHaveBeenCalledWith('contribution:delete', 'contrib-1');
    expect(result.current.contributions).toHaveLength(1);
    expect(result.current.contributions[0].id).toBe('contrib-2');
  });

  test('should get contribution by ID', () => {
    const contributions = [
      { id: 'contrib-1', repositoryUrl: 'https://github.com/user/repo1.git' },
      { id: 'contrib-2', repositoryUrl: 'https://github.com/user/repo2.git' },
    ];

    useContributionsStore.setState({ contributions: contributions as any });

    const { result } = renderHook(() => useContributionsStore());

    const contribution = result.current.getContributionById('contrib-1');

    expect(contribution).toEqual(contributions[0]);
  });

  test('should return undefined for non-existent ID', () => {
    const { result } = renderHook(() => useContributionsStore());

    const contribution = result.current.getContributionById('non-existent');

    expect(contribution).toBeUndefined();
  });
});
```

**Acceptance Criteria**:
- [ ] All CRUD operations tested
- [ ] IPC communication verified
- [ ] Error handling tested
- [ ] State updates tested
- [ ] 85%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 4: End-to-End Tests (10%)

#### Task 4.1: E2E - Complete Contribution Flow
**File**: `tests/e2e/contribution-flow.e2e.test.ts`
**Coverage Target**: N/A (E2E tests don't contribute to coverage)
**Priority**: MEDIUM

```typescript
// Note: This requires Playwright or similar E2E framework
// Placeholder for E2E test structure

describe('E2E: Complete Contribution Flow', () => {
  test('User can scan directory, sync PR, and manage contributions', async () => {
    // 1. Open app
    // 2. Navigate to Contributions screen
    // 3. App auto-scans default clone path
    // 4. Verify contribution cards appear
    // 5. Click sync button on a contribution
    // 6. Verify PR badge updates
    // 7. Click delete on a contribution
    // 8. Confirm deletion
    // 9. Verify contribution removed from list
  });
});
```

**Acceptance Criteria**:
- [ ] E2E framework setup (Playwright/Cypress)
- [ ] Critical flow tested end-to-end
- [ ] Visual verification (screenshots)
- [ ] Tests pass (GREEN)

---

## 5. Test Setup & Configuration

### Task 5.1: Test Setup File
**File**: `tests/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron IPC
global.window = global.window || {};
(global.window as any).electron = {
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

### Task 5.2: Update vitest.config.ts
**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/out/',
        '**/.vite/',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
    },
  },
});
```

---

## 6. BAS Quality Gate Integration

### Phase 4: Testing (BAS Quality Gate)
**Enforcement**: All tests must pass before commit

```bash
# Run all tests
npm run test

# Expected output:
# ✓ 87 tests passed
# ✗ 0 tests failed
```

### Phase 5: Coverage (BAS Quality Gate)
**Enforcement**: Coverage must be ≥80% before commit

```bash
# Run coverage check
npm run test:coverage

# Expected output:
# Coverage summary:
# Lines: 82.5% (≥80%) ✓
# Branches: 81.2% (≥80%) ✓
# Functions: 83.7% (≥80%) ✓
# Statements: 82.5% (≥80%) ✓
```

---

## 7. Acceptance Criteria (Overall)

### Must Have (Blocks Completion)
- [ ] All CRITICAL components have 80%+ test coverage
- [ ] All HIGH components have 80%+ test coverage
- [ ] Overall codebase coverage ≥80%
- [ ] All tests pass (GREEN)
- [ ] Test pyramid balanced (60% unit, 30% integration, 10% E2E)
- [ ] TDD cycle followed for all new tests
- [ ] BAS quality gates configured

### Should Have (Recommended)
- [ ] All MEDIUM components have 70%+ test coverage
- [ ] All LOW components have 60%+ test coverage
- [ ] Documentation: Testing guide added to trinity/knowledge-base/
- [ ] Pre-commit hook enforces test pass
- [ ] CI/CD integration (GitHub Actions)

### Could Have (Nice to Have)
- [ ] Test coverage badges in README
- [ ] Performance benchmarks for critical paths
- [ ] Visual regression tests for UI components

---

## 8. Task Execution Order

**Recommended sequence** (follow TDD RED-GREEN-REFACTOR):

### Week 1: Foundation
1. Task 5.1: Test Setup File
2. Task 5.2: Update vitest.config.ts
3. Task 1.1: StatusBadge Tests (warm-up)
4. Task 1.2: ContributionList Tests

### Week 2: Backend Critical Path
5. Task 1.3: GitHubRestService Tests (CRITICAL)
6. Task 1.4: DatabaseService Tests (CRITICAL)
7. Task 1.5: ContributionScannerService Tests (CRITICAL)

### Week 3: Integration
8. Task 2.1: Contribution Workflow Integration Tests
9. Task 2.2: IPC Handlers Integration Tests

### Week 4: Frontend Components
10. Task 3.1: ContributionCard Tests
11. Task 3.2: ContributionWorkflowModal Tests
12. Task 3.3: useContributionsStore Tests

### Week 5: E2E & Polish
13. Task 4.1: E2E Tests
14. Coverage gap analysis
15. Refactoring untestable code

---

## 9. Success Metrics

**Quantitative**:
- Overall coverage: 80%+ (currently 0%)
- Tests passing: 100% (currently N/A)
- Test execution time: <30 seconds (unit + integration)
- CRITICAL components coverage: 90%+
- HIGH components coverage: 80%+

**Qualitative**:
- Confidence in refactoring (can change code without fear)
- Faster debugging (tests pinpoint failures)
- Regression prevention (new features don't break old ones)
- Documentation value (tests serve as usage examples)

---

## 10. Risk Mitigation

**Risk 1**: Untestable code (tight coupling, side effects)
**Mitigation**: Refactor for testability (dependency injection, pure functions)

**Risk 2**: Slow tests (database, API calls)
**Mitigation**: Mock external dependencies, use in-memory database for integration tests

**Risk 3**: Flaky tests (timing issues, shared state)
**Mitigation**: Follow test independence principle, use waitFor for async operations

**Risk 4**: Low developer buy-in
**Mitigation**: Start with easy wins (StatusBadge, ContributionList), show value early

---

## 11. Resources

**Documentation**:
- Trinity Testing Principles: `trinity/knowledge-base/TESTING-PRINCIPLES.md`
- Vitest Documentation: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- Jest DOM Matchers: https://github.com/testing-library/jest-dom

**Tools**:
- Vitest (test runner)
- React Testing Library (component testing)
- happy-dom/jsdom (DOM environment)
- @vitest/coverage-v8 (coverage reporting)
- @vitest/ui (visual test runner)

---

## 12. Sign-Off

**Prepared By**: JUNO (Quality Auditor)
**Date**: 2026-01-28
**Status**: READY FOR EXECUTION

**Next Steps**:
1. Assign tasks to implementation team (KIL, BAS)
2. Create sprint plan (4-5 weeks)
3. Begin with Task 5.1 (Test Setup)
4. Follow TDD cycle: RED → GREEN → REFACTOR
5. Report weekly progress to ALY (CTO)

---

**TRINITY METHOD COMPLIANCE**:
- ✅ Investigation-first approach (comprehensive audit conducted)
- ✅ TDD cycle enforced (RED-GREEN-REFACTOR)
- ✅ Quality gates defined (BAS Phase 4 & 5)
- ✅ Atomic tasks with clear acceptance criteria
- ✅ Risk assessment completed
- ✅ Knowledge base reference (TESTING-PRINCIPLES.md)

**END OF WORK ORDER**
