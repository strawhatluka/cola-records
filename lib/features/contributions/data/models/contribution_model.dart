/// Contribution data model
library;

import '../../domain/entities/contribution.dart';

/// Data model for Contribution entity
class ContributionModel extends Contribution {
  const ContributionModel({
    required super.repoName,
    required super.owner,
    required super.localPath,
    required super.forkUrl,
    required super.upstreamUrl,
    required super.status,
    super.issueNumber,
    super.issueTitle,
    required super.createdAt,
    required super.lastUpdated,
    super.currentBranch,
  });

  /// Convert from JSON
  factory ContributionModel.fromJson(Map<String, dynamic> json) {
    return ContributionModel(
      repoName: json['repoName'] as String,
      owner: json['owner'] as String,
      localPath: json['localPath'] as String,
      forkUrl: json['forkUrl'] as String,
      upstreamUrl: json['upstreamUrl'] as String,
      status: ContributionStatus.values.firstWhere(
        (e) => e.name == json['status'] as String,
        orElse: () => ContributionStatus.ready,
      ),
      issueNumber: json['issueNumber'] as int?,
      issueTitle: json['issueTitle'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastUpdated: DateTime.parse(json['lastUpdated'] as String),
      currentBranch: json['currentBranch'] as String?,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'repoName': repoName,
      'owner': owner,
      'localPath': localPath,
      'forkUrl': forkUrl,
      'upstreamUrl': upstreamUrl,
      'status': status.name,
      'issueNumber': issueNumber,
      'issueTitle': issueTitle,
      'createdAt': createdAt.toIso8601String(),
      'lastUpdated': lastUpdated.toIso8601String(),
      'currentBranch': currentBranch,
    };
  }

  /// Convert from entity
  factory ContributionModel.fromEntity(Contribution contribution) {
    return ContributionModel(
      repoName: contribution.repoName,
      owner: contribution.owner,
      localPath: contribution.localPath,
      forkUrl: contribution.forkUrl,
      upstreamUrl: contribution.upstreamUrl,
      status: contribution.status,
      issueNumber: contribution.issueNumber,
      issueTitle: contribution.issueTitle,
      createdAt: contribution.createdAt,
      lastUpdated: contribution.lastUpdated,
      currentBranch: contribution.currentBranch,
    );
  }

  /// Convert to entity
  Contribution toEntity() {
    return Contribution(
      repoName: repoName,
      owner: owner,
      localPath: localPath,
      forkUrl: forkUrl,
      upstreamUrl: upstreamUrl,
      status: status,
      issueNumber: issueNumber,
      issueTitle: issueTitle,
      createdAt: createdAt,
      lastUpdated: lastUpdated,
      currentBranch: currentBranch,
    );
  }
}
