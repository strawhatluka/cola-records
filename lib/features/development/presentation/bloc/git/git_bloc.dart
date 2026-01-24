/// Git BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../data/services/git_service.dart';
import 'git_event.dart';
import 'git_state.dart';

/// BLoC for managing git operations
class GitBloc extends Bloc<GitEvent, GitState> {
  final GitService _gitService;

  GitBloc(this._gitService) : super(const GitInitial()) {
    on<FetchGitStatusEvent>(_onFetchGitStatus);
    on<FetchBranchesEvent>(_onFetchBranches);
    on<CommitChangesEvent>(_onCommitChanges);
    on<PushToRemoteEvent>(_onPushToRemote);
    on<PullFromRemoteEvent>(_onPullFromRemote);
    on<SwitchBranchEvent>(_onSwitchBranch);
    on<CreateBranchEvent>(_onCreateBranch);
    on<StageFilesEvent>(_onStageFiles);
    on<UnstageFilesEvent>(_onUnstageFiles);
    on<RefreshGitStatusEvent>(_onRefreshGitStatus);
    on<FetchFileDiffEvent>(_onFetchFileDiff);
  }

  /// Fetch git status
  Future<void> _onFetchGitStatus(
    FetchGitStatusEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('status'));

      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = await _gitService.getBranches(event.repositoryPath);

      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'status',
        message: e.toString(),
      ));
    }
  }

  /// Fetch branches
  Future<void> _onFetchBranches(
    FetchBranchesEvent event,
    Emitter<GitState> emit,
  ) async {
    if (state is! GitStatusLoaded) return;

    try {
      final currentState = state as GitStatusLoaded;
      final branches = await _gitService.getBranches(event.repositoryPath);

      emit(currentState.copyWith(availableBranches: branches));
    } catch (e) {
      // Keep current state, just log error
    }
  }

  /// Commit changes
  Future<void> _onCommitChanges(
    CommitChangesEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('commit'));

      await _gitService.commit(
        event.repositoryPath,
        event.message,
        event.filePaths,
      );

      // Refresh status after commit
      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = state is GitStatusLoaded
          ? (state as GitStatusLoaded).availableBranches
          : <String>[];

      emit(GitOperationSuccess(
        operation: 'commit',
        message: 'Changes committed successfully',
        updatedStatus: status,
      ));

      // Auto-transition back to loaded state
      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'commit',
        message: e.toString(),
      ));
    }
  }

  /// Push to remote
  Future<void> _onPushToRemote(
    PushToRemoteEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('push'));

      await _gitService.push(event.repositoryPath);

      // Refresh status after push
      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = state is GitStatusLoaded
          ? (state as GitStatusLoaded).availableBranches
          : <String>[];

      emit(GitOperationSuccess(
        operation: 'push',
        message: 'Pushed to remote successfully',
        updatedStatus: status,
      ));

      // Auto-transition back to loaded state
      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'push',
        message: e.toString(),
      ));
    }
  }

  /// Pull from remote
  Future<void> _onPullFromRemote(
    PullFromRemoteEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('pull'));

      await _gitService.pull(event.repositoryPath);

      // Refresh status after pull
      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = state is GitStatusLoaded
          ? (state as GitStatusLoaded).availableBranches
          : <String>[];

      emit(GitOperationSuccess(
        operation: 'pull',
        message: 'Pulled from remote successfully',
        updatedStatus: status,
      ));

      // Auto-transition back to loaded state
      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'pull',
        message: e.toString(),
      ));
    }
  }

  /// Switch branch
  Future<void> _onSwitchBranch(
    SwitchBranchEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('switch'));

      await _gitService.switchBranch(event.repositoryPath, event.branchName);

      // Refresh status after switching
      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = state is GitStatusLoaded
          ? (state as GitStatusLoaded).availableBranches
          : <String>[];

      emit(GitOperationSuccess(
        operation: 'switch',
        message: 'Switched to branch ${event.branchName}',
        updatedStatus: status,
      ));

      // Auto-transition back to loaded state
      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'switch',
        message: e.toString(),
      ));
    }
  }

  /// Create branch
  Future<void> _onCreateBranch(
    CreateBranchEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitLoading('create_branch'));

      await _gitService.createBranch(
        event.repositoryPath,
        event.branchName,
        event.switchToBranch,
      );

      // Refresh status and branches
      final status = await _gitService.getStatus(event.repositoryPath);
      final branches = await _gitService.getBranches(event.repositoryPath);

      emit(GitOperationSuccess(
        operation: 'create_branch',
        message: 'Created branch ${event.branchName}',
        updatedStatus: status,
      ));

      // Auto-transition back to loaded state
      emit(GitStatusLoaded(
        status: status,
        availableBranches: branches,
      ));
    } catch (e) {
      emit(GitError(
        operation: 'create_branch',
        message: e.toString(),
      ));
    }
  }

  /// Stage files
  Future<void> _onStageFiles(
    StageFilesEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      await _gitService.stageFiles(event.repositoryPath, event.filePaths);

      // Refresh status
      add(RefreshGitStatusEvent(event.repositoryPath));
    } catch (e) {
      emit(GitError(
        operation: 'stage',
        message: e.toString(),
      ));
    }
  }

  /// Unstage files
  Future<void> _onUnstageFiles(
    UnstageFilesEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      await _gitService.unstageFiles(event.repositoryPath, event.filePaths);

      // Refresh status
      add(RefreshGitStatusEvent(event.repositoryPath));
    } catch (e) {
      emit(GitError(
        operation: 'unstage',
        message: e.toString(),
      ));
    }
  }

  /// Refresh git status (internal)
  Future<void> _onRefreshGitStatus(
    RefreshGitStatusEvent event,
    Emitter<GitState> emit,
  ) async {
    if (state is! GitStatusLoaded) return;

    try {
      final status = await _gitService.getStatus(event.repositoryPath);
      final currentState = state as GitStatusLoaded;

      emit(currentState.copyWith(status: status));
    } catch (e) {
      // Keep current state, just log error
    }
  }

  /// Fetch diff for a file
  Future<void> _onFetchFileDiff(
    FetchFileDiffEvent event,
    Emitter<GitState> emit,
  ) async {
    try {
      emit(const GitDiffLoading());

      final diff = await _gitService.getDiff(
        event.repositoryPath,
        event.filePath,
      );

      emit(GitDiffLoaded(
        diff: diff,
        filePath: event.filePath,
      ));
    } catch (e) {
      emit(GitDiffError(
        message: e.toString(),
        filePath: event.filePath,
      ));
    }
  }
}
