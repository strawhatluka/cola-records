# ORCHESTRATOR WORK ORDER #002
## Type: IMPLEMENTATION
## Contributions Workflow Feature

---

## MISSION OBJECTIVE

Implement a complete contribution workflow system that enables users to fork GitHub repositories, clone them locally, and manage their open-source contributions directly from the Cola Records application.

**Implementation Goal:** Users can click "Contribute" on any issue, which automatically forks the repository, clones it to their local machine, sets up git remotes, and tracks the contribution in a dedicated Contributions dashboard.

**Based On:** TRA Planning Session - Contributions Feature Design (2026-01-23)

---

## IMPLEMENTATION SCOPE

### Files to Modify
```yaml
Critical_Files:
  - path: pubspec.yaml
    changes: Add dependencies (shared_preferences, file_picker, path, process_run)
    risk: LOW

  - path: lib/main.dart
    changes: Add Settings navigation tab, providers for Settings and Contributions
    risk: MEDIUM

  - path: lib/features/issue_discovery/presentation/widgets/issue_detail_modal.dart
    changes: Add pale yellow "Contribute" button between file tree and footer
    risk: LOW

  - path: lib/features/shared/data/github_graphql_client.dart
    changes: Add forkRepository() mutation
    risk: MEDIUM

New_Files_To_Create:
  # Settings Feature
  - lib/features/settings/domain/entities/app_settings.dart
  - lib/features/settings/data/models/settings_model.dart
  - lib/features/settings/data/repositories/settings_repository.dart
  - lib/features/settings/presentation/cubit/settings_cubit.dart
  - lib/features/settings/presentation/screens/settings_screen.dart

  # Contributions Domain
  - lib/features/contributions/domain/entities/contribution.dart
  - lib/features/contributions/domain/usecases/fork_repository.dart
  - lib/features/contributions/domain/usecases/clone_repository.dart
  - lib/features/contributions/domain/usecases/setup_git_remotes.dart
  - lib/features/contributions/domain/usecases/list_contributions.dart

  # Contributions Data
  - lib/features/contributions/data/models/contribution_model.dart
  - lib/features/contributions/data/repositories/contribution_repository_impl.dart
  - lib/features/contributions/data/services/git_service.dart

  # Contributions Presentation
  - lib/features/contributions/presentation/bloc/contribution_bloc.dart
  - lib/features/contributions/presentation/widgets/contribution_card.dart
  - lib/features/contributions/presentation/screens/contributions_screen.dart (UPDATE existing)
```

### Changes Required

#### Change Set 1: Dependencies & Configuration
**Files:** `pubspec.yaml`
**Current State:** Basic Flutter dependencies
**Target State:** Added settings storage, file picker, path utilities, and git process execution
**Implementation:**
```yaml
dependencies:
  shared_preferences: ^2.2.2  # Settings persistence
  file_picker: ^6.1.1         # Directory picker
  path: ^1.8.3                # Cross-platform paths
  process_run: ^0.14.0        # Git command execution
```

#### Change Set 2: Settings Infrastructure
**Files:** Settings domain, data, and presentation layers
**Current State:** No settings system
**Target State:** Complete settings feature with customizable contributions directory
**Implementation:**
- AppSettings entity with contributionsDirectory field
- Settings repository using shared_preferences
- Settings Cubit for state management
- Settings screen with directory picker

#### Change Set 3: Contribution Domain Logic
**Files:** Contributions domain layer
**Current State:** Empty contributions screen
**Target State:** Complete domain model with fork, clone, and remote setup use cases
**Implementation:**
- Contribution entity (repoName, owner, localPath, forkUrl, status, createdAt)
- ForkRepository use case (calls GitHub API)
- CloneRepository use case (executes git clone)
- SetupGitRemotes use case (configures origin and upstream)

#### Change Set 4: GitHub Fork API
**Files:** `github_graphql_client.dart`
**Current State:** Search and tree queries only
**Target State:** Fork repository mutation added
**Implementation:**
```dart
Future<Result<Map<String, dynamic>>> forkRepository({
  required String owner,
  required String name,
}) async {
  const mutation = '''
    mutation(\$owner: String!, \$name: String!) {
      createFork(input: {ownerId: \$owner, repositoryId: \$name}) {
        repository {
          name
          owner { login }
          url
          sshUrl
        }
      }
    }
  ''';
  return await mutate(mutationString: mutation, variables: {
    'owner': owner,
    'name': name,
  });
}
```

#### Change Set 5: Git Service Implementation
**Files:** `git_service.dart`
**Current State:** Does not exist
**Target State:** Secure git command execution with proper sanitization
**Implementation:**
- Path validation (prevent directory traversal)
- Process execution using process_run
- Clone, remote add, remote set-url operations
- Comprehensive error handling

#### Change Set 6: Contribution Workflow BLoC
**Files:** `contribution_bloc.dart`
**Current State:** Does not exist
**Target State:** Complete state management for contribution workflow
**Events:** StartContribution, ForkCompleted, CloneCompleted, RemotesConfigured
**States:** Initial, Forking, Cloning, SettingUpRemotes, Completed, Error

#### Change Set 7: UI Updates
**Files:** Modal, Contributions screen, Settings screen
**Current State:** Basic modal, empty contributions screen, no settings
**Target State:**
- Contribute button in modal (pale yellow, positioned between file tree and footer)
- Contributions dashboard showing all local contributions
- Settings screen with directory configuration

---

## IMPLEMENTATION APPROACH

### Phase 1: Foundation (Tasks 1.1, 1.2, 2.1)
**Parallelizable**

- [ ] Add dependencies to pubspec.yaml
- [ ] Run flutter pub get
- [ ] Create Settings feature structure (domain, data, presentation)
- [ ] Implement Settings storage with shared_preferences
- [ ] Create Contribution domain entities and interfaces
- [ ] Add Settings tab to navigation in main.dart

### Phase 2: Core Services (Tasks 2.2, 2.3)
**Sequential dependencies on Phase 1**

- [ ] Implement GitHub fork API mutation in GitHubGraphQLClient
- [ ] Create GitService for local git operations
- [ ] Implement security validations (path sanitization, command whitelisting)
- [ ] Write unit tests for fork API
- [ ] Write unit tests for GitService

### Phase 3: Use Cases & BLoC (Tasks 3.1, 3.2)
**Dependencies on Phase 2**

- [ ] Implement ForkRepository use case
- [ ] Implement CloneRepository use case
- [ ] Implement SetupGitRemotes use case
- [ ] Create ContributionBloc with complete state machine
- [ ] Add Contribute button to issue detail modal
- [ ] Wire up button to trigger ContributionBloc

### Phase 4: UI & Integration (Tasks 3.3, 4.1)
**Dependencies on Phase 3**

- [ ] Implement Contributions list screen (scan local directory)
- [ ] Create ContributionCard widget
- [ ] Add providers to main.dart (SettingsCubit, ContributionBloc)
- [ ] Inject dependencies (GitService, ContributionRepository)
- [ ] Test complete workflow end-to-end

### Phase 5: Error Handling & Polish (Task 4.2)
**Final polish**

- [ ] Handle missing git installation
- [ ] Handle network failures during fork/clone
- [ ] Handle insufficient disk space
- [ ] Handle permission errors
- [ ] Handle existing directory conflicts
- [ ] Add user-friendly error messages for all failure modes
- [ ] Implement loading indicators and progress feedback

---

## DELIVERABLE REQUIREMENTS

### Document Format
**Filename:** `CONTRIBUTIONS-WORKFLOW-IMPLEMENTATION-COMPLETE-2026-01-23.md`
**Location:** `trinity/reports/`

### Required Sections
1. **Executive Summary** - Contributions workflow fully implemented
2. **Changes Applied** - All files created/modified with diffs
3. **Test Results** - Manual testing of fork, clone, remote setup workflow
4. **Security Validation** - Confirmation of path sanitization and command validation
5. **User Flow Documentation** - Step-by-step user journey
6. **Next Steps** - Future enhancements (VS Code integration, branch management)

### Evidence to Provide
- File count: ~20 new files, 3 modified files
- Screenshots of: Contribute button, Settings screen, Contributions dashboard
- Test output showing successful fork, clone, and remote setup
- Error handling demonstration for common failure modes

---

## ✅ AFTER COMPLETION

### ⚠️ CRITICAL: Complete ALL Steps Below - NO EXCEPTIONS

**Step 1: Create Completion Report** ✅
   - [ ] Implementation deliverable created in `trinity/reports/`
   - [ ] Follow format: `CONTRIBUTIONS-WORKFLOW-IMPLEMENTATION-COMPLETE-2026-01-23.md`
   - [ ] All deliverables include required sections listed above

**Step 2: 🚨 MOVE THIS WORK ORDER FILE 🚨** ✅
   - [ ] **IMMEDIATELY** move this file from `trinity/work-orders/` to `trinity/sessions/`
   - [ ] **THIS STEP IS MANDATORY** - Work orders left in trinity/work-orders/ are considered incomplete

   **Execute this exact command:**
   ```bash
   mv trinity/work-orders/WO-002-contributions-workflow.md trinity/sessions/
   ```

**Step 3: Verify File Locations** ✅
   - [ ] This work order file NOW EXISTS in: `trinity/sessions/WO-002-contributions-workflow.md`
   - [ ] Completion report exists in: `trinity/reports/CONTRIBUTIONS-WORKFLOW-IMPLEMENTATION-COMPLETE-2026-01-23.md`
   - [ ] This work order NO LONGER EXISTS in: `trinity/work-orders/`

**Step 4: Session Cleanup (when entire session complete):**
   - [ ] When session is complete, run `/trinity-end`
   - [ ] trinity-end will archive ALL files from `trinity/sessions/` and `trinity/reports/`

**Archive Destination (via trinity-end):**
- Work order → `trinity/archive/work-orders/2026-01-23/`
- Completion report → `trinity/archive/reports/2026-01-23/`
- Session summary → `trinity/archive/sessions/2026-01-23/`

---

## SUCCESS CRITERIA

The implementation is complete when:
- [ ] User can click "Contribute" button on any issue modal
- [ ] Button triggers automatic fork of repository (GitHub API)
- [ ] Fork is cloned to local directory (Documents/Contributions/{repo-name})
- [ ] Git remotes are configured (origin = fork, upstream = original)
- [ ] Contributions dashboard lists all local contribution directories
- [ ] Settings page allows user to change default contributions directory
- [ ] Settings tab added to navigation
- [ ] All error scenarios handled gracefully with user feedback
- [ ] No command injection vulnerabilities (path validation enforced)
- [ ] Cross-platform compatibility (Windows, macOS, Linux)
- [ ] Implementation report submitted to `trinity/reports/`

---

## CONSTRAINTS & GUIDELINES

### ⚠️ CRITICAL RESTRICTIONS - GIT OPERATIONS FORBIDDEN

**ABSOLUTELY PROHIBITED - NO EXCEPTIONS:**
ALL team members are PERMANENTLY FORBIDDEN from performing ANY git operations on the Cola Records repository:

- [ ] **git add** - FORBIDDEN - Only LUKA has permission
- [ ] **git commit** - FORBIDDEN - Only LUKA has permission
- [ ] **git push** - FORBIDDEN - Only LUKA has permission

**NOTE:** This work order REQUIRES executing git commands on USER repositories (fork, clone, remote add). This is ALLOWED because:
- Git commands are executed on EXTERNAL repositories (user's forks)
- Git commands are run in USER-SELECTED directories (not project directory)
- Commands are executed via GitService with security validation
- NO git operations are performed on the Cola Records project repository itself

**CORRECT WORKFLOW:**
1. Make all local file changes to Cola Records codebase
2. Test git operations on EXTERNAL test repositories
3. Report completion to LUKA with summary of changes
4. LUKA will handle git operations for Cola Records repository (add, commit, push)

### Security Requirements
- [ ] ALL file paths MUST be validated before use
- [ ] NO shell execution - use Process with explicit argument lists
- [ ] Whitelist allowed git commands (clone, remote)
- [ ] Sanitize all user inputs (repository names, paths)
- [ ] Prevent directory traversal attacks (../, absolute paths)

### Do NOT:
- [ ] Execute arbitrary shell commands
- [ ] Trust user-provided paths without validation
- [ ] Use string interpolation for command construction
- [ ] Allow access outside contributions directory
- [ ] Perform git operations on Cola Records project repository

### DO:
- [ ] Use path package for all path operations
- [ ] Validate repository names match GitHub format (owner/repo)
- [ ] Use process_run for controlled command execution
- [ ] Provide clear error messages for all failure modes
- [ ] Test on multiple platforms (Windows is primary)
- [ ] Execute git commands on user's forked repositories only
- [ ] Report all Cola Records codebase changes to LUKA for git operations

---

## ROLLBACK STRATEGY

If critical issues arise:
1. **Identify Issue:** User reports contribution workflow failure
2. **Assess Impact:** Check if existing contributions are affected
3. **Rollback Steps:**
   - Disable Contribute button (comment out onClick handler)
   - Hide Settings tab from navigation
   - Revert to "Under Construction" contributions screen
4. **Verify Rollback:** Ensure app functions without contribution features
5. **Fix Forward:** Address root cause and re-enable features

**Critical Files Backup:** None required (new feature, no existing dependencies)

---

## CONTEXT FROM PLANNING

**Source Planning:** TRA Planning Session (2026-01-23)
**Key Requirements:**
1. Pale yellow "Contribute" button on issue modals
2. Fork repository via GitHub API
3. Clone fork to Documents/Contributions/{repo-name}
4. Setup git remotes (origin = fork, upstream = original)
5. Contributions dashboard showing local directories
6. Settings page for default directory configuration

**Expected Impact:**
- Streamlines open-source contribution workflow
- Reduces manual steps from ~10 to 1 (single button click)
- Provides centralized view of all contributions
- Enables future features (PR creation, branch management, code editing)

---

## SCOPE & RISK ASSESSMENT

## PACE AND COMPLETENESS NOTICE

**IMPORTANT:** There are NO time constraints on this work.
The 3.5 hour estimate is for planning purposes only, NOT a deadline.
Take as much time as needed to achieve 100% completion with precision.
Partial completion is unacceptable.
Quality and completeness are the ONLY metrics that matter.

**Implementation Scope:** COMPREHENSIVE
**Completeness Required:** 100% - All specified features must be implemented
**Risk Level:** MEDIUM-HIGH
**Risk Factors:**
- Git command execution (security risk)
- Cross-platform compatibility (Windows/macOS/Linux)
- Network operations (GitHub API, git clone)
- File system operations (directory creation, permissions)

**Mitigation:**
- Use process_run instead of raw Process for safety
- Validate ALL paths before file system operations
- Handle network failures gracefully with retry logic
- Test on Windows (primary platform)
- Implement comprehensive error handling
- Use path package for cross-platform paths

---

**Remember:** Security is paramount. Validate all inputs, sanitize all paths, and test thoroughly on the target platform (Windows). Report all Cola Records codebase changes to LUKA for git operations.
