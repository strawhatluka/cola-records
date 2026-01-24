/// Git status entity
library;

import 'package:equatable/equatable.dart';

/// Git file status enum
enum GitFileStatus {
  /// File is untracked (not in git)
  untracked,

  /// File is modified
  modified,

  /// File is added/staged
  added,

  /// File is deleted
  deleted,

  /// File is renamed
  renamed,

  /// File is unchanged (clean)
  clean,

  /// File is in conflict (merge conflict)
  conflicted,
}

/// Extension for git file status display
extension GitFileStatusExtension on GitFileStatus {
  /// Get display color for status
  String get colorName {
    switch (this) {
      case GitFileStatus.untracked:
        return 'red';
      case GitFileStatus.modified:
        return 'orange';
      case GitFileStatus.added:
        return 'green';
      case GitFileStatus.deleted:
        return 'red';
      case GitFileStatus.renamed:
        return 'blue';
      case GitFileStatus.clean:
        return 'gray';
      case GitFileStatus.conflicted:
        return 'purple';
    }
  }

  /// Get short label for status
  String get shortLabel {
    switch (this) {
      case GitFileStatus.untracked:
        return 'U';
      case GitFileStatus.modified:
        return 'M';
      case GitFileStatus.added:
        return 'A';
      case GitFileStatus.deleted:
        return 'D';
      case GitFileStatus.renamed:
        return 'R';
      case GitFileStatus.clean:
        return '';
      case GitFileStatus.conflicted:
        return 'C';
    }
  }
}

/// Represents git status for a file or repository
class GitStatus extends Equatable {
  /// Current branch name
  final String currentBranch;

  /// Remote branch name (if tracking)
  final String? remoteBranch;

  /// Number of commits ahead of remote
  final int commitsAhead;

  /// Number of commits behind remote
  final int commitsBehind;

  /// Map of file paths to their git status
  final Map<String, GitFileStatus> fileStatuses;

  /// Whether the repository has uncommitted changes
  final bool hasUncommittedChanges;

  /// Whether the repository is in a merge conflict state
  final bool hasConflicts;

  const GitStatus({
    required this.currentBranch,
    this.remoteBranch,
    this.commitsAhead = 0,
    this.commitsBehind = 0,
    this.fileStatuses = const {},
    this.hasUncommittedChanges = false,
    this.hasConflicts = false,
  });

  /// Get status for a specific file
  GitFileStatus getFileStatus(String filePath) {
    return fileStatuses[filePath] ?? GitFileStatus.clean;
  }

  /// Get list of modified files
  List<String> get modifiedFiles {
    return fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.modified)
        .map((entry) => entry.key)
        .toList();
  }

  /// Get list of untracked files
  List<String> get untrackedFiles {
    return fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.untracked)
        .map((entry) => entry.key)
        .toList();
  }

  /// Get list of added files
  List<String> get addedFiles {
    return fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.added)
        .map((entry) => entry.key)
        .toList();
  }

  /// Get list of conflicted files
  List<String> get conflictedFiles {
    return fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.conflicted)
        .map((entry) => entry.key)
        .toList();
  }

  /// Check if repository is clean (no changes)
  bool get isClean => fileStatuses.isEmpty || fileStatuses.values.every((status) => status == GitFileStatus.clean);

  /// Check if repository needs push (ahead of remote)
  bool get needsPush => commitsAhead > 0;

  /// Check if repository needs pull (behind remote)
  bool get needsPull => commitsBehind > 0;

  /// Create empty git status
  factory GitStatus.empty() {
    return const GitStatus(
      currentBranch: '',
      fileStatuses: {},
    );
  }

  /// Create a copy with modified fields
  GitStatus copyWith({
    String? currentBranch,
    String? remoteBranch,
    int? commitsAhead,
    int? commitsBehind,
    Map<String, GitFileStatus>? fileStatuses,
    bool? hasUncommittedChanges,
    bool? hasConflicts,
  }) {
    return GitStatus(
      currentBranch: currentBranch ?? this.currentBranch,
      remoteBranch: remoteBranch ?? this.remoteBranch,
      commitsAhead: commitsAhead ?? this.commitsAhead,
      commitsBehind: commitsBehind ?? this.commitsBehind,
      fileStatuses: fileStatuses ?? this.fileStatuses,
      hasUncommittedChanges: hasUncommittedChanges ?? this.hasUncommittedChanges,
      hasConflicts: hasConflicts ?? this.hasConflicts,
    );
  }

  @override
  List<Object?> get props => [
        currentBranch,
        remoteBranch,
        commitsAhead,
        commitsBehind,
        fileStatuses,
        hasUncommittedChanges,
        hasConflicts,
      ];

  @override
  String toString() => 'GitStatus(branch: $currentBranch, ahead: $commitsAhead, behind: $commitsBehind, changes: ${fileStatuses.length})';
}
