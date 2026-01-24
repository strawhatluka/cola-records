/// Git states
library;

import 'package:equatable/equatable.dart';

import '../../../domain/entities/git_status.dart';

/// Base state for git operations
abstract class GitState extends Equatable {
  const GitState();

  @override
  List<Object?> get props => [];
}

/// Initial state - no git status loaded
class GitInitial extends GitState {
  const GitInitial();
}

/// Loading git status
class GitLoading extends GitState {
  final String operation; // "status", "commit", "push", "pull", etc.

  const GitLoading(this.operation);

  @override
  List<Object?> get props => [operation];
}

/// Git status loaded successfully
class GitStatusLoaded extends GitState {
  final GitStatus status;
  final List<String> availableBranches;

  const GitStatusLoaded({
    required this.status,
    this.availableBranches = const [],
  });

  @override
  List<Object?> get props => [status, availableBranches];

  /// Create a copy with modified fields
  GitStatusLoaded copyWith({
    GitStatus? status,
    List<String>? availableBranches,
  }) {
    return GitStatusLoaded(
      status: status ?? this.status,
      availableBranches: availableBranches ?? this.availableBranches,
    );
  }
}

/// Git operation completed successfully
class GitOperationSuccess extends GitState {
  final String operation;
  final String message;
  final GitStatus? updatedStatus;

  const GitOperationSuccess({
    required this.operation,
    required this.message,
    this.updatedStatus,
  });

  @override
  List<Object?> get props => [operation, message, updatedStatus];
}

/// Git error occurred
class GitError extends GitState {
  final String operation;
  final String message;
  final GitStatus? currentStatus;

  const GitError({
    required this.operation,
    required this.message,
    this.currentStatus,
  });

  @override
  List<Object?> get props => [operation, message, currentStatus];
}

/// Loading diff for a file
class GitDiffLoading extends GitState {
  const GitDiffLoading();
}

/// Diff loaded successfully
class GitDiffLoaded extends GitState {
  final String diff;
  final String filePath;

  const GitDiffLoaded({
    required this.diff,
    required this.filePath,
  });

  @override
  List<Object?> get props => [diff, filePath];
}

/// Error loading diff
class GitDiffError extends GitState {
  final String message;
  final String filePath;

  const GitDiffError({
    required this.message,
    required this.filePath,
  });

  @override
  List<Object?> get props => [message, filePath];
}
