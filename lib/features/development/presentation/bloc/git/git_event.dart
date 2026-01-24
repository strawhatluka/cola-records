/// Git events
library;

import 'package:equatable/equatable.dart';

/// Base event for git operations
abstract class GitEvent extends Equatable {
  const GitEvent();

  @override
  List<Object?> get props => [];
}

/// Fetch git status for repository
class FetchGitStatusEvent extends GitEvent {
  final String repositoryPath;

  const FetchGitStatusEvent(this.repositoryPath);

  @override
  List<Object?> get props => [repositoryPath];
}

/// Commit changes
class CommitChangesEvent extends GitEvent {
  final String repositoryPath;
  final String message;
  final List<String> filePaths; // Empty list means commit all

  const CommitChangesEvent({
    required this.repositoryPath,
    required this.message,
    this.filePaths = const [],
  });

  @override
  List<Object?> get props => [repositoryPath, message, filePaths];
}

/// Push to remote
class PushToRemoteEvent extends GitEvent {
  final String repositoryPath;

  const PushToRemoteEvent(this.repositoryPath);

  @override
  List<Object?> get props => [repositoryPath];
}

/// Pull from remote
class PullFromRemoteEvent extends GitEvent {
  final String repositoryPath;

  const PullFromRemoteEvent(this.repositoryPath);

  @override
  List<Object?> get props => [repositoryPath];
}

/// Fetch branches
class FetchBranchesEvent extends GitEvent {
  final String repositoryPath;

  const FetchBranchesEvent(this.repositoryPath);

  @override
  List<Object?> get props => [repositoryPath];
}

/// Switch branch
class SwitchBranchEvent extends GitEvent {
  final String repositoryPath;
  final String branchName;

  const SwitchBranchEvent({
    required this.repositoryPath,
    required this.branchName,
  });

  @override
  List<Object?> get props => [repositoryPath, branchName];
}

/// Create new branch
class CreateBranchEvent extends GitEvent {
  final String repositoryPath;
  final String branchName;
  final bool switchToBranch;

  const CreateBranchEvent({
    required this.repositoryPath,
    required this.branchName,
    this.switchToBranch = true,
  });

  @override
  List<Object?> get props => [repositoryPath, branchName, switchToBranch];
}

/// Stage files
class StageFilesEvent extends GitEvent {
  final String repositoryPath;
  final List<String> filePaths;

  const StageFilesEvent({
    required this.repositoryPath,
    required this.filePaths,
  });

  @override
  List<Object?> get props => [repositoryPath, filePaths];
}

/// Unstage files
class UnstageFilesEvent extends GitEvent {
  final String repositoryPath;
  final List<String> filePaths;

  const UnstageFilesEvent({
    required this.repositoryPath,
    required this.filePaths,
  });

  @override
  List<Object?> get props => [repositoryPath, filePaths];
}

/// Refresh git status (internal event)
class RefreshGitStatusEvent extends GitEvent {
  final String repositoryPath;

  const RefreshGitStatusEvent(this.repositoryPath);

  @override
  List<Object?> get props => [repositoryPath];
}

/// Fetch diff for a file
class FetchFileDiffEvent extends GitEvent {
  final String repositoryPath;
  final String filePath;

  const FetchFileDiffEvent({
    required this.repositoryPath,
    required this.filePath,
  });

  @override
  List<Object?> get props => [repositoryPath, filePath];
}
