/// Issue data models
library;

import '../../domain/entities/issue.dart';

/// Data model for Repository
class RepositoryModel {
  final String name;
  final String owner;
  final int stars;
  final int totalIssues;
  final int totalPullRequests;

  RepositoryModel({
    required this.name,
    required this.owner,
    required this.stars,
    required this.totalIssues,
    required this.totalPullRequests,
  });

  factory RepositoryModel.fromJson(Map<String, dynamic> json) {
    final issuesData = json['issues'] as Map<String, dynamic>?;
    final prData = json['pullRequests'] as Map<String, dynamic>?;

    return RepositoryModel(
      name: json['name'] as String? ?? 'Unknown',
      owner: (json['owner'] as Map<String, dynamic>?)? ['login'] as String? ?? 'Unknown',
      stars: json['stargazerCount'] as int? ?? 0,
      totalIssues: issuesData?['totalCount'] as int? ?? 0,
      totalPullRequests: prData?['totalCount'] as int? ?? 0,
    );
  }

  Repository toEntity() {
    return Repository(
      name: name,
      owner: owner,
      stars: stars,
      totalIssues: totalIssues,
      totalPullRequests: totalPullRequests,
    );
  }
}

/// Data model for Issue
class IssueModel {
  final String id;
  final int number;
  final String title;
  final String body;
  final String url;
  final String createdAt;
  final RepositoryModel repository;

  IssueModel({
    required this.id,
    required this.number,
    required this.title,
    required this.body,
    required this.url,
    required this.createdAt,
    required this.repository,
  });

  factory IssueModel.fromJson(Map<String, dynamic> json) {
    final repoJson = json['repository'] as Map<String, dynamic>?;
    return IssueModel(
      id: json['id'] as String? ?? '',
      number: json['number'] as int? ?? 0,
      title: json['title'] as String? ?? 'Untitled',
      body: json['body'] as String? ?? 'No description provided.',
      url: json['url'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      repository: repoJson != null
          ? RepositoryModel.fromJson(repoJson)
          : RepositoryModel(
              name: 'Unknown',
              owner: 'Unknown',
              stars: 0,
              totalIssues: 0,
              totalPullRequests: 0,
            ),
    );
  }

  Issue toEntity() {
    return Issue(
      id: id,
      number: number,
      title: title,
      body: body,
      url: url,
      createdAt: DateTime.parse(createdAt),
      repository: repository.toEntity(),
    );
  }
}
