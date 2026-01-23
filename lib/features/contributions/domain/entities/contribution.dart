/// Contribution domain entity
library;

import 'package:equatable/equatable.dart';

/// Represents a user's contribution to an open-source project
class Contribution extends Equatable {
  /// Repository name (without owner)
  final String repoName;

  /// Repository owner (username or organization)
  final String owner;

  /// Full repository name (owner/repo)
  String get fullRepoName => '$owner/$repoName';

  /// Local path where the forked repository is cloned
  final String localPath;

  /// URL of the user's fork
  final String forkUrl;

  /// Original repository URL (upstream)
  final String upstreamUrl;

  /// Current status of the contribution
  final ContributionStatus status;

  /// Issue number being addressed (if any)
  final int? issueNumber;

  /// Issue title
  final String? issueTitle;

  /// When this contribution was created
  final DateTime createdAt;

  /// Last time this contribution was updated
  final DateTime lastUpdated;

  /// Current branch name
  final String? currentBranch;

  const Contribution({
    required this.repoName,
    required this.owner,
    required this.localPath,
    required this.forkUrl,
    required this.upstreamUrl,
    required this.status,
    this.issueNumber,
    this.issueTitle,
    required this.createdAt,
    required this.lastUpdated,
    this.currentBranch,
  });

  /// Copy with method for immutability
  Contribution copyWith({
    String? repoName,
    String? owner,
    String? localPath,
    String? forkUrl,
    String? upstreamUrl,
    ContributionStatus? status,
    int? issueNumber,
    String? issueTitle,
    DateTime? createdAt,
    DateTime? lastUpdated,
    String? currentBranch,
  }) {
    return Contribution(
      repoName: repoName ?? this.repoName,
      owner: owner ?? this.owner,
      localPath: localPath ?? this.localPath,
      forkUrl: forkUrl ?? this.forkUrl,
      upstreamUrl: upstreamUrl ?? this.upstreamUrl,
      status: status ?? this.status,
      issueNumber: issueNumber ?? this.issueNumber,
      issueTitle: issueTitle ?? this.issueTitle,
      createdAt: createdAt ?? this.createdAt,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      currentBranch: currentBranch ?? this.currentBranch,
    );
  }

  @override
  List<Object?> get props => [
        repoName,
        owner,
        localPath,
        forkUrl,
        upstreamUrl,
        status,
        issueNumber,
        issueTitle,
        createdAt,
        lastUpdated,
        currentBranch,
      ];
}

/// Status of a contribution
enum ContributionStatus {
  /// Forking repository in progress
  forking,

  /// Cloning repository to local machine
  cloning,

  /// Setting up git remotes
  settingUpRemotes,

  /// Ready for work - repository is set up
  ready,

  /// Work in progress - user is making changes
  inProgress,

  /// Pull request created
  pullRequestCreated,

  /// Pull request merged
  merged,

  /// Error occurred during setup or workflow
  error;

  /// Display name for UI
  String get displayName {
    switch (this) {
      case ContributionStatus.forking:
        return 'Forking';
      case ContributionStatus.cloning:
        return 'Cloning';
      case ContributionStatus.settingUpRemotes:
        return 'Setting up remotes';
      case ContributionStatus.ready:
        return 'Ready';
      case ContributionStatus.inProgress:
        return 'In Progress';
      case ContributionStatus.pullRequestCreated:
        return 'PR Created';
      case ContributionStatus.merged:
        return 'Merged';
      case ContributionStatus.error:
        return 'Error';
    }
  }

  /// Color for UI badges
  String get colorName {
    switch (this) {
      case ContributionStatus.forking:
      case ContributionStatus.cloning:
      case ContributionStatus.settingUpRemotes:
        return 'blue';
      case ContributionStatus.ready:
        return 'green';
      case ContributionStatus.inProgress:
        return 'orange';
      case ContributionStatus.pullRequestCreated:
        return 'purple';
      case ContributionStatus.merged:
        return 'teal';
      case ContributionStatus.error:
        return 'red';
    }
  }
}
