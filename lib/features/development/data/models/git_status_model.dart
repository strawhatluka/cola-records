/// Git status data model
library;

import '../../domain/entities/git_status.dart';

/// Data model for GitStatus with serialization support
class GitStatusModel extends GitStatus {
  const GitStatusModel({
    required super.currentBranch,
    super.remoteBranch,
    super.commitsAhead = 0,
    super.commitsBehind = 0,
    super.fileStatuses = const {},
  });

  /// Create from entity
  factory GitStatusModel.fromEntity(GitStatus entity) {
    return GitStatusModel(
      currentBranch: entity.currentBranch,
      remoteBranch: entity.remoteBranch,
      commitsAhead: entity.commitsAhead,
      commitsBehind: entity.commitsBehind,
      fileStatuses: entity.fileStatuses,
    );
  }

  /// Convert to entity
  GitStatus toEntity() {
    return GitStatus(
      currentBranch: currentBranch,
      remoteBranch: remoteBranch,
      commitsAhead: commitsAhead,
      commitsBehind: commitsBehind,
      fileStatuses: fileStatuses,
    );
  }

  /// Create from JSON
  factory GitStatusModel.fromJson(Map<String, dynamic> json) {
    final fileStatusesMap = (json['fileStatuses'] as Map<String, dynamic>?)?.map(
      (key, value) => MapEntry(
        key,
        GitFileStatus.values.firstWhere(
          (e) => e.toString() == value,
          orElse: () => GitFileStatus.clean,
        ),
      ),
    );

    return GitStatusModel(
      currentBranch: json['currentBranch'] as String,
      remoteBranch: json['remoteBranch'] as String?,
      commitsAhead: json['commitsAhead'] as int? ?? 0,
      commitsBehind: json['commitsBehind'] as int? ?? 0,
      fileStatuses: fileStatusesMap ?? {},
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'currentBranch': currentBranch,
      'remoteBranch': remoteBranch,
      'commitsAhead': commitsAhead,
      'commitsBehind': commitsBehind,
      'fileStatuses': fileStatuses.map(
        (key, value) => MapEntry(key, value.toString()),
      ),
    };
  }

  /// Copy with modifications
  @override
  GitStatusModel copyWith({
    String? currentBranch,
    String? remoteBranch,
    int? commitsAhead,
    int? commitsBehind,
    Map<String, GitFileStatus>? fileStatuses,
    bool? hasUncommittedChanges, // Ignored - computed property
    bool? hasConflicts, // Ignored - computed property
  }) {
    return GitStatusModel(
      currentBranch: currentBranch ?? this.currentBranch,
      remoteBranch: remoteBranch ?? this.remoteBranch,
      commitsAhead: commitsAhead ?? this.commitsAhead,
      commitsBehind: commitsBehind ?? this.commitsBehind,
      fileStatuses: fileStatuses ?? this.fileStatuses,
    );
  }
}
