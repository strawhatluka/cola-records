# Work Order: Issues Discovery Page Test Coverage Implementation

**Work Order ID**: WO-ISSUES-TESTS-001
**Created**: 2026-01-28
**Status**: READY TO START
**Priority**: HIGH
**Assigned To**: TBD (Task execution team)
**Audit Conducted By**: JUNO (Quality Auditor)

---

## Executive Summary

**Current State**: The cola-records Issues Discovery page (GitHub issue search and filtering system) has **ZERO test coverage**. All tests were deleted (commit 830cf99).

**Risk Level**: HIGH
- Critical user flows (issue search, filtering, repository tree loading) are untested
- Complex GitHub API integration (GraphQL + REST) has no safety net
- Search state management (Zustand store) lacks validation tests
- Filter logic (language, labels, stars) is untested

**Audit Finding**: This work order implements comprehensive test coverage following Trinity Method testing principles (80% minimum coverage, TDD cycle, 60-30-10 test pyramid).

---

## 1. Component Inventory & Test Status

### Frontend Issues Discovery Components

| Component | Path | Lines | Complexity | Test Status | Risk |
|-----------|------|-------|------------|-------------|------|
| **IssueDiscoveryScreen** | `src/renderer/screens/IssueDiscoveryScreen.tsx` | 67 | Low | ❌ NO TESTS | Medium |
| **SearchPanel** | `src/renderer/components/issues/SearchPanel.tsx` | 151 | Medium | ❌ NO TESTS | **HIGH** |
| **IssueList** | `src/renderer/components/issues/IssueList.tsx` | 45 | Low | ❌ NO TESTS | Low |
| **IssueCard** | `src/renderer/components/issues/IssueCard.tsx` | 48 | Low | ❌ NO TESTS | Low |
| **IssueDetailModal** | `src/renderer/components/issues/IssueDetailModal.tsx` | 101 | Medium | ❌ NO TESTS | **HIGH** |
| **RepositoryFileTree** | `src/renderer/components/issues/RepositoryFileTree.tsx` | 160 | High | ❌ NO TESTS | **HIGH** |
| **useIssuesStore** | `src/renderer/stores/useIssuesStore.ts` | 52 | Medium | ❌ NO TESTS | **HIGH** |

### Backend Issues Services

| Service | Path | Lines | Complexity | Test Status | Risk |
|---------|------|-------|------------|-------------|------|
| **GitHubGraphQLService** | `src/main/services/github-graphql.service.ts` | 330 | Very High | ❌ NO TESTS | **CRITICAL** |
| **GitHubService (Issues)** | `src/main/services/github.service.ts` | 79 | Medium | ❌ NO TESTS | **CRITICAL** |
| **IPC Handlers (Issues)** | `src/main/index.ts` (github:search-issues) | ~20 | Low | ❌ NO TESTS | **HIGH** |

**Total Components**: 10
**Total Lines to Test**: ~1,000 lines
**Components with Tests**: 0/10 (0%)
**High/Critical Risk Components**: 7/10 (70%)

---

## 2. Critical User Flows (Must Be Tested)

### Flow 1: Issue Search & Filtering
**User Story**: User enters search query → Selects language filter → Sets minimum stars → Selects labels → Clicks search → App fetches issues from GitHub → Displays issue cards

**Components Involved**:
1. SearchPanel.tsx (UI controls)
2. useIssuesStore.searchIssues() (state management)
3. IPC channel: `github:search-issues`
4. GitHubService.searchIssues() (caching layer)
5. GitHubGraphQLService.searchIssues() (API call)
6. IssueList.tsx (display results)

**Test Scenarios**:
- ✅ Search with query only (no filters)
- ✅ Search with language filter (e.g., "JavaScript")
- ✅ Search with minimum stars filter (e.g., "100")
- ✅ Search with multiple labels selected
- ✅ Search with all filters combined
- ✅ Enter key triggers search in input field
- ✅ Clear filters resets to defaults
- ❌ Handles empty results gracefully
- ❌ Handles GraphQL API errors (rate limit, auth)
- ❌ Handles network timeout errors

**Risk**: **CRITICAL** - Core feature, GitHub API dependency, complex query building

---

### Flow 2: Issue Card Display & Interaction
**User Story**: User views issue cards → Sees issue title, repository, labels, creation date → Clicks card to view details

**Components Involved**:
1. IssueList.tsx (grid container)
2. IssueCard.tsx (individual card)
3. IssueDetailModal.tsx (modal dialog)

**Test Scenarios**:
- ✅ Displays issue title (with line-clamp-2)
- ✅ Displays repository name
- ✅ Displays first 3 labels with "+N more" badge
- ✅ Displays formatted creation date
- ✅ Shows loading skeletons when loading=true
- ✅ Shows empty state when no issues
- ✅ Clicking card opens detail modal
- ❌ Handles missing issue data gracefully
- ❌ Handles very long titles/labels

**Risk**: **MEDIUM** - Mostly presentation logic, but critical for UX

---

### Flow 3: Issue Detail Modal & Repository Tree
**User Story**: User clicks "Contribute" on issue → Modal shows issue details → Displays repository file tree → User can explore project structure → Clicks "Contribute to this Issue" to start workflow

**Components Involved**:
1. IssueDetailModal.tsx (modal UI)
2. RepositoryFileTree.tsx (tree component)
3. IPC channel: `github:get-repository-tree`
4. GitHubGraphQLService.getRepositoryTree() (API call)
5. ContributionWorkflowModal.tsx (triggered by "Contribute")

**Test Scenarios**:
- ✅ Modal opens when issue prop is set
- ✅ Displays issue title, repository, number
- ✅ Displays all labels with icons
- ✅ Displays created/updated dates
- ✅ Renders markdown issue body
- ✅ Loads repository file tree on mount
- ✅ Expands/collapses directory nodes
- ✅ Displays file sizes formatted
- ✅ Highlights directories vs files (icons)
- ✅ "View on GitHub" opens external URL
- ✅ "Contribute to this Issue" triggers workflow
- ❌ Handles tree loading errors (invalid branch, private repo)
- ❌ Handles missing issue body
- ❌ Shows loading state for tree

**Risk**: **HIGH** - Complex tree rendering, external API dependencies, modal state

---

### Flow 4: Search State Management
**User Story**: App maintains search state across component re-renders → Preserves search query, labels, loading state

**Components Involved**:
1. useIssuesStore.ts (Zustand store)
2. IPC client integration

**Test Scenarios**:
- ✅ searchIssues updates state (loading, issues, error)
- ✅ setSearchQuery updates query state
- ✅ setSelectedLabels updates labels state
- ✅ clearIssues resets to initial state
- ✅ Loading state true during IPC call
- ✅ Error state set when IPC fails
- ❌ Handles concurrent search requests (debouncing)
- ❌ Preserves state on screen navigation

**Risk**: **HIGH** - State management is central to all issues page operations

---

### Flow 5: GitHub API Integration & Caching
**User Story**: App searches issues via GitHub API → Results are cached → Subsequent searches use cache when appropriate

**Components Involved**:
1. GitHubService.searchIssues() (caching layer)
2. GitHubGraphQLService.searchIssues() (GraphQL API)
3. DatabaseService (cache storage)

**Test Scenarios**:
- ✅ Builds correct GraphQL query with labels
- ✅ Parses GraphQL response to GitHubIssue format
- ✅ Caches results with correct cache key
- ✅ Returns cached results on subsequent call
- ✅ Respects skipCache flag
- ❌ Handles GraphQL errors (syntax, auth)
- ❌ Handles partial results (some issues fail)
- ❌ Cache expiration works correctly (24 hours)
- ❌ Rate limit detection and handling

**Risk**: **CRITICAL** - External API dependency, caching complexity, rate limiting

---

## 3. Risk Assessment Matrix

### Risk Categories

| Component | Complexity | External Deps | State Changes | User Impact | Overall Risk |
|-----------|------------|---------------|---------------|-------------|--------------|
| **GitHubGraphQLService** | Very High | GitHub GraphQL API | Low | High | **CRITICAL** |
| **GitHubService (Issues)** | Medium | Database, GraphQL | Medium | High | **CRITICAL** |
| **RepositoryFileTree** | High | GitHub API, IPC | Medium | Medium | **HIGH** |
| **IssueDetailModal** | Medium | IPC, Tree component | Low | High | **HIGH** |
| **SearchPanel** | Medium | None | Medium | High | **HIGH** |
| **useIssuesStore** | Medium | IPC | High | High | **HIGH** |
| **IssueDiscoveryScreen** | Low | Store | Low | Medium | **MEDIUM** |
| **IssueList** | Low | None | None | Low | **LOW** |
| **IssueCard** | Low | None | None | Low | **LOW** |

### Risk Scoring
- **CRITICAL (2 components)**: Must have 90%+ coverage, extensive edge case testing
- **HIGH (4 components)**: Must have 80%+ coverage, error handling tests
- **MEDIUM (1 component)**: Should have 70%+ coverage, happy path + errors
- **LOW (3 components)**: Can have 60%+ coverage, basic functionality tests

---

## 4. Test Implementation Plan

### Phase 1: Foundation (Unit Tests - 60%)

#### Task 1.1: IssueCard Component Tests
**File**: `tests/renderer/components/issues/IssueCard.test.tsx`
**Coverage Target**: 95%+
**Priority**: LOW (warm-up task)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueCard } from '@renderer/components/issues/IssueCard';
import type { GitHubIssue } from '@main/ipc/channels';

describe('IssueCard', () => {
  const mockIssue: GitHubIssue = {
    id: 'issue-1',
    number: 123,
    title: 'Fix: Dashboard loading issue',
    body: 'Issue description...',
    url: 'https://github.com/owner/repo/issues/123',
    repository: 'owner/repo',
    labels: ['bug', 'good first issue', 'help wanted', 'documentation'],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-20T15:30:00Z'),
  };

  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    mockOnViewDetails.mockClear();
  });

  test('should display issue title', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);
    expect(screen.getByText('Fix: Dashboard loading issue')).toBeInTheDocument();
  });

  test('should display repository name', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);
    expect(screen.getByText('owner/repo')).toBeInTheDocument();
  });

  test('should display first 3 labels', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('good first issue')).toBeInTheDocument();
    expect(screen.getByText('help wanted')).toBeInTheDocument();
  });

  test('should show "+N more" badge when more than 3 labels', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);
    expect(screen.getByText('+1')).toBeInTheDocument(); // 4 total labels - 3 shown = 1 more
  });

  test('should not show "+N more" badge when 3 or fewer labels', () => {
    const issueWith2Labels = { ...mockIssue, labels: ['bug', 'enhancement'] };
    render(<IssueCard issue={issueWith2Labels} onViewDetails={mockOnViewDetails} />);
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  test('should display formatted creation date', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);
    expect(screen.getByText(/Opened 1\/15\/2026/)).toBeInTheDocument();
  });

  test('should call onViewDetails when card is clicked', () => {
    render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);

    const card = screen.getByRole('button'); // Card should be clickable
    fireEvent.click(card);

    expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
  });

  test('should apply hover styles (cursor-pointer)', () => {
    const { container } = render(<IssueCard issue={mockIssue} onViewDetails={mockOnViewDetails} />);
    const card = container.querySelector('.cursor-pointer');
    expect(card).toBeInTheDocument();
  });

  test('should handle very long titles with line-clamp', () => {
    const longTitleIssue = {
      ...mockIssue,
      title: 'This is an extremely long issue title that should be truncated after two lines to ensure the UI remains clean and does not overflow the card container',
    };
    const { container } = render(<IssueCard issue={longTitleIssue} onViewDetails={mockOnViewDetails} />);
    const titleElement = container.querySelector('.line-clamp-2');
    expect(titleElement).toBeInTheDocument();
  });
});
```

**Acceptance Criteria**:
- [ ] All display elements tested (title, repo, labels, date)
- [ ] "+N more" badge logic tested
- [ ] Click interaction tested
- [ ] Styling/accessibility verified
- [ ] 95%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.2: IssueList Component Tests
**File**: `tests/renderer/components/issues/IssueList.test.tsx`
**Coverage Target**: 95%+
**Priority**: LOW

```typescript
import { render, screen } from '@testing-library/react';
import { IssueList } from '@renderer/components/issues/IssueList';
import type { GitHubIssue } from '@main/ipc/channels';

describe('IssueList', () => {
  const mockIssues: GitHubIssue[] = [
    {
      id: 'issue-1',
      number: 123,
      title: 'Fix bug 1',
      body: '',
      url: 'https://github.com/owner/repo1/issues/123',
      repository: 'owner/repo1',
      labels: ['bug'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'issue-2',
      number: 456,
      title: 'Fix bug 2',
      body: '',
      url: 'https://github.com/owner/repo2/issues/456',
      repository: 'owner/repo2',
      labels: ['enhancement'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockOnIssueSelect = vi.fn();

  beforeEach(() => {
    mockOnIssueSelect.mockClear();
  });

  test('should display loading skeletons when loading', () => {
    render(<IssueList issues={[]} onIssueSelect={mockOnIssueSelect} loading={true} />);

    // Should show 4 skeleton placeholders
    const skeletons = screen.getAllByRole('status'); // Skeleton components should have role="status"
    expect(skeletons).toHaveLength(4);
  });

  test('should display empty state when no issues and not loading', () => {
    render(<IssueList issues={[]} onIssueSelect={mockOnIssueSelect} loading={false} />);

    expect(screen.getByText('No issues found. Try adjusting your filters.')).toBeInTheDocument();
  });

  test('should render all issue cards when issues present', () => {
    render(<IssueList issues={mockIssues} onIssueSelect={mockOnIssueSelect} loading={false} />);

    expect(screen.getByText('Fix bug 1')).toBeInTheDocument();
    expect(screen.getByText('Fix bug 2')).toBeInTheDocument();
  });

  test('should render issues in scrollable container', () => {
    const { container } = render(<IssueList issues={mockIssues} onIssueSelect={mockOnIssueSelect} loading={false} />);

    const scrollContainer = container.querySelector('.overflow-auto');
    expect(scrollContainer).toBeInTheDocument();
  });

  test('should pass onIssueSelect callback to each IssueCard', () => {
    render(<IssueList issues={mockIssues} onIssueSelect={mockOnIssueSelect} loading={false} />);

    const firstCard = screen.getByText('Fix bug 1').closest('div[role="button"]');
    fireEvent.click(firstCard!);

    expect(mockOnIssueSelect).toHaveBeenCalledWith(mockIssues[0]);
  });
});
```

**Acceptance Criteria**:
- [ ] Loading state tested (skeletons)
- [ ] Empty state tested
- [ ] Issue rendering tested
- [ ] Scroll container verified
- [ ] Callback passing tested
- [ ] 95%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.3: SearchPanel Component Tests
**File**: `tests/renderer/components/issues/SearchPanel.test.tsx`
**Coverage Target**: 85%+
**Priority**: HIGH

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchPanel } from '@renderer/components/issues/SearchPanel';

describe('SearchPanel', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  test('should render all filter controls', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Minimum Stars')).toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();
  });

  test('should have "good first issue" label selected by default', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    const checkbox = screen.getByLabelText('good first issue');
    expect(checkbox).toBeChecked();
  });

  test('should call onSearch with query when search button clicked', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    const input = screen.getByPlaceholderText('Search issues...');
    await user.type(input, 'react hooks');

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith('react hooks', ['good first issue']);
  });

  test('should call onSearch when Enter key pressed in input', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    const input = screen.getByPlaceholderText('Search issues...');
    await user.type(input, 'typescript{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('typescript', ['good first issue']);
  });

  test('should build query with language filter', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    // Select language dropdown
    const languageSelect = screen.getByRole('combobox', { name: /language/i });
    await user.click(languageSelect);
    await user.click(screen.getByText('JavaScript'));

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith(' language:JavaScript', ['good first issue']);
  });

  test('should build query with minimum stars filter', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    const starsInput = screen.getByPlaceholderText('e.g., 100');
    await user.type(starsInput, '500');

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith(' stars:>=500', ['good first issue']);
  });

  test('should build query with all filters combined', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    // Set search text
    const input = screen.getByPlaceholderText('Search issues...');
    await user.type(input, 'react');

    // Set language
    const languageSelect = screen.getByRole('combobox', { name: /language/i });
    await user.click(languageSelect);
    await user.click(screen.getByText('TypeScript'));

    // Set minimum stars
    const starsInput = screen.getByPlaceholderText('e.g., 100');
    await user.type(starsInput, '100');

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith('react language:TypeScript stars:>=100', ['good first issue']);
  });

  test('should toggle label checkboxes', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    // Uncheck "good first issue"
    const goodFirstIssueCheckbox = screen.getByLabelText('good first issue');
    await user.click(goodFirstIssueCheckbox);
    expect(goodFirstIssueCheckbox).not.toBeChecked();

    // Check "help wanted"
    const helpWantedCheckbox = screen.getByLabelText('help wanted');
    await user.click(helpWantedCheckbox);
    expect(helpWantedCheckbox).toBeChecked();

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith('', ['help wanted']);
  });

  test('should clear all filters when Clear button clicked', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    // Set some filters
    const input = screen.getByPlaceholderText('Search issues...');
    await user.type(input, 'test query');

    const starsInput = screen.getByPlaceholderText('e.g., 100');
    await user.type(starsInput, '200');

    // Click clear
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    fireEvent.click(clearButton);

    // Verify reset
    expect(input).toHaveValue('');
    expect(starsInput).toHaveValue('');
    expect(screen.getByLabelText('good first issue')).toBeChecked(); // Default label
  });

  test('should disable search button when loading', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={true} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();
  });

  test('should render all language options', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    const languageSelect = screen.getByRole('combobox', { name: /language/i });
    await user.click(languageSelect);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  test('should render all label options', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    expect(screen.getByLabelText('good first issue')).toBeInTheDocument();
    expect(screen.getByLabelText('beginner-friendly')).toBeInTheDocument();
    expect(screen.getByLabelText('help wanted')).toBeInTheDocument();
    expect(screen.getByLabelText('documentation')).toBeInTheDocument();
  });
});
```

**Acceptance Criteria**:
- [ ] All filter controls tested
- [ ] Query building tested (text, language, stars)
- [ ] Label toggling tested
- [ ] Clear filters tested
- [ ] Enter key search tested
- [ ] Loading state tested
- [ ] 85%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.4: GitHubGraphQLService Tests
**File**: `tests/main/services/github-graphql.service.test.ts`
**Coverage Target**: 80%+
**Priority**: CRITICAL

```typescript
import { GitHubGraphQLService } from '@main/services/github-graphql.service';
import { graphql } from '@octokit/graphql';
import { database } from '@main/database';
import { env } from '@main/services/environment.service';

vi.mock('@octokit/graphql');
vi.mock('@main/database');
vi.mock('@main/services/environment.service');

describe('GitHubGraphQLService', () => {
  let service: GitHubGraphQLService;
  let mockGraphQL: any;

  beforeEach(() => {
    // Mock database settings
    (database.getAllSettings as any).mockReturnValue({
      githubToken: 'test-token-123',
    });

    // Mock graphql client
    mockGraphQL = vi.fn();
    (graphql.defaults as any).mockReturnValue(mockGraphQL);

    service = new GitHubGraphQLService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchIssues', () => {
    test('should search issues with default labels', async () => {
      const mockResponse = {
        search: {
          issueCount: 2,
          edges: [
            {
              node: {
                id: 'issue-1',
                number: 123,
                title: 'Fix bug in dashboard',
                body: 'Description of bug...',
                url: 'https://github.com/owner/repo/issues/123',
                createdAt: '2026-01-15T10:00:00Z',
                updatedAt: '2026-01-20T15:30:00Z',
                labels: {
                  nodes: [
                    { name: 'bug' },
                    { name: 'good first issue' },
                  ],
                },
                repository: {
                  nameWithOwner: 'owner/repo',
                },
              },
            },
            {
              node: {
                id: 'issue-2',
                number: 456,
                title: 'Add feature X',
                body: '',
                url: 'https://github.com/owner/repo2/issues/456',
                createdAt: '2026-01-18T12:00:00Z',
                updatedAt: '2026-01-22T09:00:00Z',
                labels: {
                  nodes: [{ name: 'enhancement' }],
                },
                repository: {
                  nameWithOwner: 'owner/repo2',
                },
              },
            },
          ],
        },
      };

      mockGraphQL.mockResolvedValue(mockResponse);

      const result = await service.searchIssues('react hooks');

      expect(mockGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query searchIssues'),
        {
          searchQuery: 'react hooks label:"good first issue" is:issue is:open sort:updated-desc',
          first: 50,
        }
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'issue-1',
        number: 123,
        title: 'Fix bug in dashboard',
        repository: 'owner/repo',
        labels: ['bug', 'good first issue'],
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    test('should search issues with custom labels', async () => {
      mockGraphQL.mockResolvedValue({ search: { edges: [] } });

      await service.searchIssues('typescript', ['help wanted', 'documentation']);

      expect(mockGraphQL).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          searchQuery: 'typescript label:"help wanted" label:"documentation" is:issue is:open sort:updated-desc',
        })
      );
    });

    test('should search issues with multiple labels', async () => {
      mockGraphQL.mockResolvedValue({ search: { edges: [] } });

      await service.searchIssues('', ['good first issue', 'beginner-friendly']);

      expect(mockGraphQL).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          searchQuery: ' label:"good first issue" label:"beginner-friendly" is:issue is:open sort:updated-desc',
        })
      );
    });

    test('should handle empty issue body', async () => {
      const mockResponse = {
        search: {
          edges: [
            {
              node: {
                id: 'issue-1',
                number: 123,
                title: 'Issue without body',
                body: null,
                url: 'https://github.com/owner/repo/issues/123',
                createdAt: '2026-01-15T10:00:00Z',
                updatedAt: '2026-01-15T10:00:00Z',
                labels: { nodes: [] },
                repository: { nameWithOwner: 'owner/repo' },
              },
            },
          ],
        },
      };

      mockGraphQL.mockResolvedValue(mockResponse);

      const result = await service.searchIssues('test');

      expect(result[0].body).toBe('');
    });

    test('should throw error when GraphQL query fails', async () => {
      mockGraphQL.mockRejectedValue(new Error('GraphQL rate limit exceeded'));

      await expect(service.searchIssues('test')).rejects.toThrow('Failed to search GitHub issues');
    });

    test('should throw error when GitHub token not configured', async () => {
      (database.getAllSettings as any).mockReturnValue({});
      (env.get as any).mockReturnValue(undefined);

      const newService = new GitHubGraphQLService();

      await expect(newService.searchIssues('test')).rejects.toThrow('GitHub token not configured');
    });
  });

  describe('getRepositoryTree', () => {
    test('should fetch repository file tree for default branch', async () => {
      const mockResponse = {
        repository: {
          object: {
            entries: [
              { name: 'src', type: 'tree', mode: '040000', object: { entries: [] } },
              { name: 'README.md', type: 'blob', mode: '100644', object: { byteSize: 1234 } },
              { name: 'package.json', type: 'blob', mode: '100644', object: { byteSize: 567 } },
            ],
          },
        },
      };

      mockGraphQL.mockResolvedValue(mockResponse);

      const result = await service.getRepositoryTree('owner', 'repo', 'main');

      expect(mockGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($owner: String!, $repo: String!, $expression: String!)'),
        {
          owner: 'owner',
          repo: 'repo',
          expression: 'main:',
        }
      );

      expect(result).toEqual(mockResponse.repository.object.entries);
    });

    test('should fetch repository tree for custom branch', async () => {
      mockGraphQL.mockResolvedValue({ repository: { object: { entries: [] } } });

      await service.getRepositoryTree('owner', 'repo', 'develop');

      expect(mockGraphQL).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ expression: 'develop:' })
      );
    });

    test('should return empty array when repository not found', async () => {
      mockGraphQL.mockResolvedValue({ repository: null });

      const result = await service.getRepositoryTree('owner', 'nonexistent-repo');

      expect(result).toEqual([]);
    });

    test('should throw error when API call fails', async () => {
      mockGraphQL.mockRejectedValue(new Error('API error'));

      await expect(service.getRepositoryTree('owner', 'repo')).rejects.toThrow(
        'Failed to get repository tree'
      );
    });
  });

  describe('validateToken', () => {
    test('should return true for valid token', async () => {
      const mockClient = vi.fn().mockResolvedValue({
        viewer: { login: 'testuser' },
      });
      (graphql.defaults as any).mockReturnValue(mockClient);

      const result = await service.validateToken('valid-token-123');

      expect(result).toBe(true);
      expect(mockClient).toHaveBeenCalledWith(expect.stringContaining('viewer'));
    });

    test('should return false for invalid token', async () => {
      const mockClient = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      (graphql.defaults as any).mockReturnValue(mockClient);

      const result = await service.validateToken('invalid-token');

      expect(result).toBe(false);
    });
  });

  describe('resetClient', () => {
    test('should reset client instance', async () => {
      // Initial call creates client
      mockGraphQL.mockResolvedValue({ search: { edges: [] } });
      await service.searchIssues('test');

      // Reset client
      service.resetClient();

      // Next call should create new client
      await service.searchIssues('test2');

      expect(graphql.defaults).toHaveBeenCalledTimes(2); // Client created twice
    });
  });
});
```

**Acceptance Criteria**:
- [ ] searchIssues tested (query building, label handling, response parsing)
- [ ] getRepositoryTree tested (branch variants, error handling)
- [ ] validateToken tested (valid/invalid tokens)
- [ ] Token configuration tested
- [ ] Error handling tested (GraphQL errors, rate limits)
- [ ] 80%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 1.5: GitHubService (Issues) Tests
**File**: `tests/main/services/github.service.test.ts`
**Coverage Target**: 75%+
**Priority**: CRITICAL

```typescript
import { GitHubService } from '@main/services/github.service';
import { gitHubGraphQLService } from '@main/services/github-graphql.service';
import { database } from '@main/database';

vi.mock('@main/services/github-graphql.service');
vi.mock('@main/database');

describe('GitHubService - Issues', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.clearAllMocks();
  });

  describe('searchIssues', () => {
    const mockIssues = [
      {
        id: 'issue-1',
        number: 123,
        title: 'Fix bug',
        body: 'Description',
        url: 'https://github.com/owner/repo/issues/123',
        repository: 'owner/repo',
        labels: ['bug'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    test('should return cached issues when available', async () => {
      const cachedData = JSON.stringify(mockIssues);
      (database.getCacheValue as any).mockReturnValue(cachedData);

      const result = await service.searchIssues('react', ['good first issue']);

      expect(database.getCacheValue).toHaveBeenCalledWith('issues:react:good first issue');
      expect(gitHubGraphQLService.searchIssues).not.toHaveBeenCalled();
      expect(result).toEqual(mockIssues);
    });

    test('should fetch from API when cache miss', async () => {
      (database.getCacheValue as any).mockReturnValue(null);
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      const result = await service.searchIssues('vue', ['help wanted']);

      expect(database.getCacheValue).toHaveBeenCalledWith('issues:vue:help wanted');
      expect(gitHubGraphQLService.searchIssues).toHaveBeenCalledWith('vue', ['help wanted']);
      expect(database.setCacheValue).toHaveBeenCalledWith(
        'issues:vue:help wanted',
        JSON.stringify(mockIssues),
        expect.any(Number) // cacheTTL
      );
      expect(result).toEqual(mockIssues);
    });

    test('should skip cache when skipCache=true', async () => {
      (database.getCacheValue as any).mockReturnValue(JSON.stringify(mockIssues));
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      const result = await service.searchIssues('angular', ['good first issue'], true);

      expect(database.getCacheValue).not.toHaveBeenCalled();
      expect(gitHubGraphQLService.searchIssues).toHaveBeenCalled();
      expect(result).toEqual(mockIssues);
    });

    test('should handle cache parse errors gracefully', async () => {
      (database.getCacheValue as any).mockReturnValue('invalid-json{{{');
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      const result = await service.searchIssues('test', ['bug']);

      expect(gitHubGraphQLService.searchIssues).toHaveBeenCalled(); // Fallback to API
      expect(result).toEqual(mockIssues);
    });

    test('should build correct cache key with multiple labels', async () => {
      (database.getCacheValue as any).mockReturnValue(null);
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      await service.searchIssues('test', ['good first issue', 'help wanted', 'documentation']);

      expect(database.getCacheValue).toHaveBeenCalledWith(
        'issues:test:good first issue,help wanted,documentation'
      );
    });
  });

  describe('getRepositoryTree', () => {
    const mockTree = [
      { name: 'src', type: 'tree', mode: '040000' },
      { name: 'README.md', type: 'blob', mode: '100644' },
    ];

    test('should cache repository tree results', async () => {
      (database.getCacheValue as any).mockReturnValue(null);
      (gitHubGraphQLService.getRepositoryTree as any).mockResolvedValue(mockTree);

      const result = await service.getRepositoryTree('owner', 'repo', 'main');

      expect(database.setCacheValue).toHaveBeenCalledWith(
        'tree:owner:repo:main',
        JSON.stringify(mockTree),
        expect.any(Number)
      );
      expect(result).toEqual(mockTree);
    });

    test('should return cached tree when available', async () => {
      const cachedTree = JSON.stringify(mockTree);
      (database.getCacheValue as any).mockReturnValue(cachedTree);

      const result = await service.getRepositoryTree('owner', 'repo', 'develop');

      expect(gitHubGraphQLService.getRepositoryTree).not.toHaveBeenCalled();
      expect(result).toEqual(mockTree);
    });
  });

  describe('clearCache', () => {
    test('should call cleanupExpiredCache', () => {
      service.clearCache();
      expect(database.cleanupExpiredCache).toHaveBeenCalled();
    });
  });

  describe('setCacheEnabled', () => {
    test('should disable caching', async () => {
      const mockIssues = [{ id: 'issue-1' }];
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      service.setCacheEnabled(false);

      await service.searchIssues('test', []);

      expect(database.getCacheValue).not.toHaveBeenCalled();
      expect(database.setCacheValue).not.toHaveBeenCalled();
    });

    test('should enable caching', async () => {
      service.setCacheEnabled(true);
      const mockIssues = [{ id: 'issue-1' }];
      (database.getCacheValue as any).mockReturnValue(null);
      (gitHubGraphQLService.searchIssues as any).mockResolvedValue(mockIssues);

      await service.searchIssues('test', []);

      expect(database.setCacheValue).toHaveBeenCalled();
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Cache hit/miss tested
- [ ] skipCache flag tested
- [ ] Cache key generation tested
- [ ] Parse error handling tested
- [ ] Cache enable/disable tested
- [ ] 75%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 2: Integration Tests (30%)

#### Task 2.1: useIssuesStore Integration Tests
**File**: `tests/renderer/stores/useIssuesStore.test.ts`
**Coverage Target**: 85%+
**Priority**: HIGH

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIssuesStore } from '@renderer/stores/useIssuesStore';
import { ipc } from '@renderer/ipc/client';

vi.mock('@renderer/ipc/client');

describe('useIssuesStore', () => {
  beforeEach(() => {
    // Reset store state
    useIssuesStore.setState({
      issues: [],
      loading: false,
      error: null,
      searchQuery: '',
      selectedLabels: ['good first issue'],
    });

    (ipc.invoke as any).mockReset();
  });

  test('should have correct initial state', () => {
    const { result } = renderHook(() => useIssuesStore());

    expect(result.current.issues).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedLabels).toEqual(['good first issue']);
  });

  test('should search issues and update state', async () => {
    const mockIssues = [
      {
        id: 'issue-1',
        number: 123,
        title: 'Fix bug',
        body: '',
        url: 'https://github.com/owner/repo/issues/123',
        repository: 'owner/repo',
        labels: ['bug'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (ipc.invoke as any).mockResolvedValue(mockIssues);

    const { result } = renderHook(() => useIssuesStore());

    await act(async () => {
      await result.current.searchIssues('react', ['good first issue']);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(ipc.invoke).toHaveBeenCalledWith('github:search-issues', 'react', ['good first issue']);
    expect(result.current.issues).toEqual(mockIssues);
    expect(result.current.searchQuery).toBe('react');
    expect(result.current.selectedLabels).toEqual(['good first issue']);
    expect(result.current.error).toBeNull();
  });

  test('should set loading state during search', async () => {
    (ipc.invoke as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));

    const { result } = renderHook(() => useIssuesStore());

    act(() => {
      result.current.searchIssues('test', []);
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  test('should set error state when search fails', async () => {
    (ipc.invoke as any).mockRejectedValue(new Error('GitHub API error'));

    const { result } = renderHook(() => useIssuesStore());

    await act(async () => {
      await result.current.searchIssues('test', []);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Error: GitHub API error');
      expect(result.current.loading).toBe(false);
    });
  });

  test('should update search query', () => {
    const { result } = renderHook(() => useIssuesStore());

    act(() => {
      result.current.setSearchQuery('typescript hooks');
    });

    expect(result.current.searchQuery).toBe('typescript hooks');
  });

  test('should update selected labels', () => {
    const { result } = renderHook(() => useIssuesStore());

    act(() => {
      result.current.setSelectedLabels(['help wanted', 'documentation']);
    });

    expect(result.current.selectedLabels).toEqual(['help wanted', 'documentation']);
  });

  test('should clear issues and reset state', () => {
    const { result } = renderHook(() => useIssuesStore());

    // Set some state
    act(() => {
      result.current.setSearchQuery('test query');
      result.current.setSelectedLabels(['bug']);
    });

    // Clear
    act(() => {
      result.current.clearIssues();
    });

    expect(result.current.issues).toEqual([]);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedLabels).toEqual(['good first issue']);
  });

  test('should handle empty results', async () => {
    (ipc.invoke as any).mockResolvedValue([]);

    const { result } = renderHook(() => useIssuesStore());

    await act(async () => {
      await result.current.searchIssues('nonexistent', []);
    });

    expect(result.current.issues).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
```

**Acceptance Criteria**:
- [ ] All store actions tested
- [ ] IPC integration verified
- [ ] Loading states tested
- [ ] Error handling tested
- [ ] State updates tested
- [ ] 85%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 2.2: IssueDetailModal Integration Tests
**File**: `tests/renderer/components/issues/IssueDetailModal.test.tsx`
**Coverage Target**: 75%+
**Priority**: HIGH

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IssueDetailModal } from '@renderer/components/issues/IssueDetailModal';
import { ipc } from '@renderer/ipc/client';
import type { GitHubIssue } from '@main/ipc/channels';

vi.mock('@renderer/ipc/client');

describe('IssueDetailModal', () => {
  const mockIssue: GitHubIssue = {
    id: 'issue-1',
    number: 123,
    title: 'Fix: Dashboard loading issue',
    body: '## Description\n\nThe dashboard fails to load when...\n\n## Steps to reproduce\n1. Open app\n2. Click dashboard',
    url: 'https://github.com/owner/repo/issues/123',
    repository: 'owner/repo',
    labels: ['bug', 'good first issue', 'help wanted'],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-20T15:30:00Z'),
  };

  const mockOnClose = vi.fn();
  const mockOnContribute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should not render when issue is null', () => {
    const { container } = render(
      <IssueDetailModal issue={null} onClose={mockOnClose} onContribute={mockOnContribute} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('should render modal when issue is provided', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    expect(screen.getByText('Fix: Dashboard loading issue')).toBeInTheDocument();
    expect(screen.getByText('owner/repo • #123')).toBeInTheDocument();
  });

  test('should display all labels', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('good first issue')).toBeInTheDocument();
    expect(screen.getByText('help wanted')).toBeInTheDocument();
  });

  test('should display formatted dates', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    expect(screen.getByText(/Opened 1\/15\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Updated 1\/20\/2026/)).toBeInTheDocument();
  });

  test('should render markdown issue body', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    expect(screen.getByText('Description')).toBeInTheDocument(); // Markdown heading
    expect(screen.getByText(/The dashboard fails to load/)).toBeInTheDocument();
  });

  test('should display "No description provided" when body is empty', () => {
    const issueWithoutBody = { ...mockIssue, body: '' };
    render(<IssueDetailModal issue={issueWithoutBody} onClose={mockOnClose} onContribute={mockOnContribute} />);

    expect(screen.getByText('No description provided')).toBeInTheDocument();
  });

  test('should open external URL when "View on GitHub" clicked', async () => {
    (ipc.invoke as any).mockResolvedValue(undefined);

    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    const githubButton = screen.getByRole('button', { name: /view on github/i });
    fireEvent.click(githubButton);

    expect(ipc.invoke).toHaveBeenCalledWith('shell:open-external', mockIssue.url);
  });

  test('should call onContribute when "Contribute to this Issue" clicked', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    const contributeButton = screen.getByRole('button', { name: /contribute to this issue/i });
    fireEvent.click(contributeButton);

    expect(mockOnContribute).toHaveBeenCalledWith(mockIssue);
  });

  test('should not render "Contribute" button when onContribute not provided', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} />);

    expect(screen.queryByRole('button', { name: /contribute to this issue/i })).not.toBeInTheDocument();
  });

  test('should call onClose when modal is dismissed', () => {
    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    // Simulate dialog close (usually via X button or ESC key)
    // This depends on your Dialog component implementation
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should load repository file tree', async () => {
    const mockTree = [
      { name: 'src', type: 'tree', mode: '040000', object: { entries: [] } },
      { name: 'README.md', type: 'blob', mode: '100644', object: { byteSize: 1234 } },
    ];

    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    // Wait for tree to load
    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'main');
  });

  test('should show error when file tree fails to load', async () => {
    (ipc.invoke as any).mockRejectedValue(new Error('API error'));

    render(<IssueDetailModal issue={mockIssue} onClose={mockOnClose} onContribute={mockOnContribute} />);

    await waitFor(() => {
      expect(screen.getByText(/API error/)).toBeInTheDocument();
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Modal rendering tested (null issue, provided issue)
- [ ] Content display tested (labels, dates, markdown)
- [ ] Action buttons tested (GitHub, Contribute)
- [ ] Repository tree integration tested
- [ ] Error handling tested
- [ ] 75%+ coverage
- [ ] Tests pass (GREEN)

---

#### Task 2.3: RepositoryFileTree Integration Tests
**File**: `tests/renderer/components/issues/RepositoryFileTree.test.tsx`
**Coverage Target**: 70%+
**Priority**: HIGH

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepositoryFileTree } from '@renderer/components/issues/RepositoryFileTree';
import { ipc } from '@renderer/ipc/client';

vi.mock('@renderer/ipc/client');

describe('RepositoryFileTree', () => {
  const mockTree = [
    {
      name: 'src',
      type: 'tree',
      mode: '040000',
      object: {
        entries: [
          { name: 'index.ts', type: 'blob', mode: '100644', object: { byteSize: 567 } },
          { name: 'utils.ts', type: 'blob', mode: '100644', object: { byteSize: 234 } },
        ],
      },
    },
    {
      name: 'README.md',
      type: 'blob',
      mode: '100644',
      object: { byteSize: 1234 },
    },
    {
      name: 'package.json',
      type: 'blob',
      mode: '100644',
      object: { byteSize: 456 },
    },
  ];

  beforeEach(() => {
    (ipc.invoke as any).mockReset();
  });

  test('should fetch tree on mount', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" branch="main" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'main');
    });
  });

  test('should display loading skeletons while fetching', () => {
    (ipc.invoke as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<RepositoryFileTree repository="owner/repo" />);

    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test('should render file tree after loading', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });
  });

  test('should display file sizes formatted', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('1.21 KB')).toBeInTheDocument(); // README.md
      expect(screen.getByText('456 B')).toBeInTheDocument(); // package.json
    });
  });

  test('should expand directory when clicked', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Initially, child files should not be visible
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click to expand
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    // Child files should now be visible
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('utils.ts')).toBeInTheDocument();
    });
  });

  test('should collapse directory when clicked again', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(srcFolder);

    await waitFor(() => {
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });
  });

  test('should display folder icon when collapsed', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    const { container } = render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Check for Folder icon (not FolderOpen)
    const folderIcon = container.querySelector('svg.lucide-folder');
    expect(folderIcon).toBeInTheDocument();
  });

  test('should display folder-open icon when expanded', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    const { container } = render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand folder
    fireEvent.click(screen.getByText('src'));

    await waitFor(() => {
      const folderOpenIcon = container.querySelector('svg.lucide-folder-open');
      expect(folderOpenIcon).toBeInTheDocument();
    });
  });

  test('should display file icon for files', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    const { container } = render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    const fileIcon = container.querySelector('svg.lucide-file');
    expect(fileIcon).toBeInTheDocument();
  });

  test('should show error message when fetch fails', async () => {
    (ipc.invoke as any).mockRejectedValue(new Error('Repository not found'));

    render(<RepositoryFileTree repository="owner/nonexistent" />);

    await waitFor(() => {
      expect(screen.getByText(/Repository not found/)).toBeInTheDocument();
    });
  });

  test('should show empty state when tree is empty', async () => {
    (ipc.invoke as any).mockResolvedValue([]);

    render(<RepositoryFileTree repository="owner/empty-repo" />);

    await waitFor(() => {
      expect(screen.getByText('No files found')).toBeInTheDocument();
    });
  });

  test('should use default branch "main" when branch not specified', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'main');
    });
  });

  test('should use custom branch when specified', async () => {
    (ipc.invoke as any).mockResolvedValue(mockTree);

    render(<RepositoryFileTree repository="owner/repo" branch="develop" />);

    await waitFor(() => {
      expect(ipc.invoke).toHaveBeenCalledWith('github:get-repository-tree', 'owner', 'repo', 'develop');
    });
  });

  test('should format large file sizes correctly', async () => {
    const largeFileTree = [
      { name: 'large.bin', type: 'blob', mode: '100644', object: { byteSize: 5242880 } }, // 5 MB
    ];

    (ipc.invoke as any).mockResolvedValue(largeFileTree);

    render(<RepositoryFileTree repository="owner/repo" />);

    await waitFor(() => {
      expect(screen.getByText('5 MB')).toBeInTheDocument();
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Tree fetching tested
- [ ] Loading/error states tested
- [ ] Expand/collapse tested
- [ ] Icon rendering tested
- [ ] File size formatting tested
- [ ] Branch parameter tested
- [ ] 70%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 3: Component Tests (Remaining Frontend)

#### Task 3.1: IssueDiscoveryScreen Integration Tests
**File**: `tests/renderer/screens/IssueDiscoveryScreen.test.tsx`
**Coverage Target**: 75%+
**Priority**: MEDIUM

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IssueDiscoveryScreen } from '@renderer/screens/IssueDiscoveryScreen';
import { useIssuesStore } from '@renderer/stores/useIssuesStore';
import type { Contribution } from '@main/ipc/channels';

vi.mock('@renderer/stores/useIssuesStore');
vi.mock('@renderer/components/issues/SearchPanel');
vi.mock('@renderer/components/issues/IssueList');
vi.mock('@renderer/components/issues/IssueDetailModal');
vi.mock('@renderer/components/contributions/ContributionWorkflowModal');

describe('IssueDiscoveryScreen', () => {
  const mockSearchIssues = vi.fn();
  const mockOnOpenIDE = vi.fn();

  beforeEach(() => {
    (useIssuesStore as any).mockReturnValue({
      issues: [],
      loading: false,
      searchIssues: mockSearchIssues,
    });

    vi.clearAllMocks();
  });

  test('should render SearchPanel and IssueList', () => {
    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Verify layout structure
    expect(screen.getByTestId('search-panel')).toBeInTheDocument(); // Assumes SearchPanel has testId
    expect(screen.getByTestId('issue-list')).toBeInTheDocument(); // Assumes IssueList has testId
  });

  test('should call searchIssues when handleSearch invoked', () => {
    const { getByTestId } = render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Simulate search from SearchPanel
    const searchPanel = getByTestId('search-panel');
    const onSearch = searchPanel.props.onSearch;

    onSearch('react hooks', ['good first issue']);

    expect(mockSearchIssues).toHaveBeenCalledWith('react hooks', ['good first issue']);
  });

  test('should open IssueDetailModal when issue selected', () => {
    const mockIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test issue',
      // ... other fields
    };

    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Simulate issue selection from IssueList
    const issueList = screen.getByTestId('issue-list');
    const onIssueSelect = issueList.props.onIssueSelect;

    onIssueSelect(mockIssue);

    // Modal should now be open with selected issue
    const modal = screen.getByTestId('issue-detail-modal');
    expect(modal.props.issue).toEqual(mockIssue);
  });

  test('should open ContributionWorkflowModal when contribute clicked', () => {
    const mockIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test issue',
      // ... other fields
    };

    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Open detail modal
    const issueList = screen.getByTestId('issue-list');
    issueList.props.onIssueSelect(mockIssue);

    // Click contribute
    const detailModal = screen.getByTestId('issue-detail-modal');
    detailModal.props.onContribute(mockIssue);

    // Workflow modal should open
    const workflowModal = screen.getByTestId('contribution-workflow-modal');
    expect(workflowModal.props.issue).toEqual(mockIssue);
    expect(workflowModal.props.isOpen).toBe(true);
  });

  test('should close IssueDetailModal when contribute clicked', () => {
    const mockIssue = { id: 'issue-1', number: 123, title: 'Test' };

    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Open detail modal
    const issueList = screen.getByTestId('issue-list');
    issueList.props.onIssueSelect(mockIssue);

    // Click contribute
    const detailModal = screen.getByTestId('issue-detail-modal');
    detailModal.props.onContribute(mockIssue);

    // Detail modal should close
    expect(detailModal.props.issue).toBeNull();
  });

  test('should call onOpenIDE when workflow completes and Start Dev clicked', () => {
    const mockContribution: Contribution = {
      id: 'contrib-1',
      repositoryUrl: 'https://github.com/owner/repo.git',
      localPath: '/path/to/repo',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      issueNumber: 123,
      issueTitle: 'Fix bug',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Trigger workflow modal
    const workflowModal = screen.getByTestId('contribution-workflow-modal');
    workflowModal.props.onStartDev(mockContribution);

    expect(mockOnOpenIDE).toHaveBeenCalledWith(mockContribution);
  });

  test('should handle workflow completion without opening IDE', () => {
    const mockContribution: Contribution = {
      id: 'contrib-1',
      // ... fields
    };

    render(<IssueDiscoveryScreen onOpenIDE={mockOnOpenIDE} />);

    // Complete workflow without starting dev
    const workflowModal = screen.getByTestId('contribution-workflow-modal');
    workflowModal.props.onComplete(mockContribution);

    // Should log (currently just console.log, could be improved)
    // Verify modal closes
    expect(workflowModal.props.isOpen).toBe(false);
  });
});
```

**Acceptance Criteria**:
- [ ] Component layout tested
- [ ] Search flow tested
- [ ] Issue selection tested
- [ ] Modal interactions tested
- [ ] Workflow completion tested
- [ ] 75%+ coverage
- [ ] Tests pass (GREEN)

---

### Phase 4: End-to-End Tests (10%)

#### Task 4.1: E2E - Complete Issue Search Flow
**File**: `tests/e2e/issue-search-flow.e2e.test.ts`
**Coverage Target**: N/A (E2E tests don't contribute to coverage)
**Priority**: MEDIUM

```typescript
// Note: This requires Playwright or similar E2E framework
// Placeholder for E2E test structure

describe('E2E: Complete Issue Search Flow', () => {
  test('User can search issues, view details, and start contribution', async ({ page }) => {
    // 1. Navigate to Issues Discovery screen
    await page.goto('/issues');

    // 2. Enter search query
    await page.fill('[data-search-input]', 'react hooks');

    // 3. Select language filter
    await page.click('text=Language');
    await page.click('text=JavaScript');

    // 4. Click search
    await page.click('button:has-text("Search")');

    // 5. Wait for results
    await page.waitForSelector('[data-issue-card]');

    // 6. Verify issue cards displayed
    const issueCards = await page.$$('[data-issue-card]');
    expect(issueCards.length).toBeGreaterThan(0);

    // 7. Click first issue card
    await page.click('[data-issue-card]:first-child');

    // 8. Verify modal opens
    await page.waitForSelector('[role="dialog"]');

    // 9. Verify issue details displayed
    expect(await page.textContent('[role="dialog"]')).toContain('react hooks');

    // 10. Click "Contribute to this Issue"
    await page.click('button:has-text("Contribute to this Issue")');

    // 11. Verify workflow modal opens
    await page.waitForSelector('text=Forking repository');

    // 12. Wait for workflow completion
    await page.waitForSelector('text=Setup complete!', { timeout: 30000 });

    // 13. Verify "Start Dev" button appears
    expect(await page.isVisible('button:has-text("Start Dev")')).toBe(true);
  });

  test('User can filter issues by multiple labels', async ({ page }) => {
    // 1. Navigate to Issues Discovery
    await page.goto('/issues');

    // 2. Uncheck "good first issue"
    await page.uncheck('input[id="good first issue"]');

    // 3. Check "help wanted" and "documentation"
    await page.check('input[id="help wanted"]');
    await page.check('input[id="documentation"]');

    // 4. Click search
    await page.click('button:has-text("Search")');

    // 5. Verify IPC call made with correct labels
    // (This would require mocking IPC in E2E environment)
  });

  test('User can clear filters', async ({ page }) => {
    await page.goto('/issues');

    // Set some filters
    await page.fill('[data-search-input]', 'test query');
    await page.fill('input[placeholder="e.g., 100"]', '500');

    // Clear filters
    await page.click('button:has-text("Clear Filters")');

    // Verify reset
    expect(await page.inputValue('[data-search-input]')).toBe('');
    expect(await page.inputValue('input[placeholder="e.g., 100"]')).toBe('');
  });
});
```

**Acceptance Criteria**:
- [ ] E2E framework setup (Playwright)
- [ ] Critical flow tested end-to-end
- [ ] Visual verification (screenshots)
- [ ] Tests pass (GREEN)

---

## 5. Test Setup & Configuration

### Existing Setup
Tests already configured in `vitest.config.ts` with:
- ✅ React plugin enabled
- ✅ jsdom environment
- ✅ Setup file: `tests/setup.ts`
- ✅ Coverage thresholds: 80%
- ✅ Path aliases (@main, @renderer)

**No changes needed to vitest.config.ts**

### Additional Dependencies (if needed)
```bash
npm install -D @testing-library/user-event
```

---

## 6. BAS Quality Gate Integration

### Phase 4: Testing (BAS Quality Gate)
**Enforcement**: All tests must pass before commit

```bash
# Run all tests
npm run test

# Expected output:
# ✓ 45+ tests passed (Issues page only)
# ✗ 0 tests failed
```

### Phase 5: Coverage (BAS Quality Gate)
**Enforcement**: Coverage must be ≥80% before commit

```bash
# Run coverage check
npm run test:coverage

# Expected output (for Issues page files only):
# Coverage summary:
# Lines: 82%+ (≥80%) ✓
# Branches: 81%+ (≥80%) ✓
# Functions: 83%+ (≥80%) ✓
# Statements: 82%+ (≥80%) ✓
```

---

## 7. Acceptance Criteria (Overall)

### Must Have (Blocks Completion)
- [ ] All CRITICAL components have 80%+ test coverage
- [ ] All HIGH components have 80%+ test coverage
- [ ] Overall Issues page coverage ≥80%
- [ ] All tests pass (GREEN)
- [ ] Test pyramid balanced (60% unit, 30% integration, 10% E2E)
- [ ] TDD cycle followed for all new tests
- [ ] BAS quality gates pass

### Should Have (Recommended)
- [ ] All MEDIUM components have 70%+ test coverage
- [ ] All LOW components have 60%+ test coverage
- [ ] Error handling tested for all API calls
- [ ] Loading states tested for all async operations
- [ ] Edge cases tested (empty data, malformed data)

### Could Have (Nice to Have)
- [ ] Test coverage badges in README
- [ ] Performance benchmarks for search operations
- [ ] Visual regression tests for modal/tree rendering

---

## 8. Task Execution Order

**Recommended sequence** (follow TDD RED-GREEN-REFACTOR):

### Week 1: Foundation & Low-Risk Components
1. Task 1.1: IssueCard Tests (warm-up)
2. Task 1.2: IssueList Tests
3. Task 1.3: SearchPanel Tests (HIGH priority)

### Week 2: Backend Critical Path
4. Task 1.4: GitHubGraphQLService Tests (CRITICAL)
5. Task 1.5: GitHubService Tests (CRITICAL)

### Week 3: Integration & High-Risk Components
6. Task 2.1: useIssuesStore Integration Tests
7. Task 2.2: IssueDetailModal Integration Tests
8. Task 2.3: RepositoryFileTree Integration Tests

### Week 4: Screen Integration & E2E
9. Task 3.1: IssueDiscoveryScreen Tests
10. Task 4.1: E2E Tests
11. Coverage gap analysis
12. Refactoring untestable code

---

## 9. Success Metrics

**Quantitative**:
- Overall Issues page coverage: 80%+ (currently 0%)
- Tests passing: 100% (currently N/A)
- Test execution time: <20 seconds (unit + integration)
- CRITICAL components coverage: 90%+
- HIGH components coverage: 80%+

**Qualitative**:
- Confidence in refactoring (can modify search logic without fear)
- Faster debugging (tests pinpoint API failures)
- Regression prevention (filter changes don't break search)
- Documentation value (tests show how to use GitHub API services)

---

## 10. Risk Mitigation

**Risk 1**: GitHub API rate limiting during tests
**Mitigation**: Mock all GitHub API calls, use test fixtures for responses

**Risk 2**: Complex tree rendering logic is hard to test
**Mitigation**: Break down into smaller testable functions (parseTreeData, toggleNode, formatBytes)

**Risk 3**: Slow tests (GraphQL queries, tree loading)
**Mitigation**: Mock IPC calls, use in-memory cache for integration tests

**Risk 4**: Markdown rendering in IssueDetailModal
**Mitigation**: Test that markdown is rendered (check for heading elements), not exact HTML output

---

## 11. Resources

**Documentation**:
- Trinity Testing Principles: `trinity/knowledge-base/TESTING-PRINCIPLES.md`
- Vitest Documentation: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- Octokit GraphQL Mocking: https://github.com/octokit/graphql.js#mock

**Tools**:
- Vitest (test runner) ✅ Already installed
- React Testing Library ✅ Already installed
- jsdom (DOM environment) ✅ Already configured
- @testing-library/user-event (user interactions)

---

## 12. Sign-Off

**Prepared By**: JUNO (Quality Auditor)
**Date**: 2026-01-28
**Status**: READY FOR EXECUTION

**Next Steps**:
1. Assign tasks to implementation team (KIL, BAS)
2. Create sprint plan (3-4 weeks)
3. Begin with Task 1.1 (IssueCard Tests - warm-up)
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

**AUDIT SUMMARY**:
- **Components Audited**: 10 (7 frontend, 3 backend)
- **Lines of Code**: ~1,000
- **Critical Components**: 2 (GitHubGraphQLService, GitHubService)
- **High-Risk Components**: 4 (SearchPanel, IssueDetailModal, RepositoryFileTree, useIssuesStore)
- **Test Tasks Created**: 12 (9 unit/integration, 1 E2E, 2 setup)
- **Estimated Coverage After Completion**: 82%+

**END OF WORK ORDER**
