/// Issue entity
library;

import 'package:equatable/equatable.dart';

/// Represents a GitHub repository
class Repository extends Equatable {
  final String name;
  final String owner;
  final int stars;

  const Repository({
    required this.name,
    required this.owner,
    required this.stars,
  });

  @override
  List<Object?> get props => [name, owner, stars];

  @override
  String toString() => 'Repository(name: $name, owner: $owner, stars: $stars)';
}

/// Represents a GitHub issue
class Issue extends Equatable {
  final String id;
  final int number;
  final String title;
  final String url;
  final DateTime createdAt;
  final Repository repository;

  const Issue({
    required this.id,
    required this.number,
    required this.title,
    required this.url,
    required this.createdAt,
    required this.repository,
  });

  @override
  List<Object?> get props => [id, number, title, url, createdAt, repository];

  @override
  String toString() => 'Issue(#$number: $title, repo: ${repository.owner}/${repository.name})';
}

/// List of issues with pagination info
class IssueList extends Equatable {
  final List<Issue> issues;
  final bool hasNextPage;
  final String? nextCursor;

  const IssueList({
    required this.issues,
    required this.hasNextPage,
    this.nextCursor,
  });

  @override
  List<Object?> get props => [issues, hasNextPage, nextCursor];

  @override
  String toString() => 'IssueList(count: ${issues.length}, hasNextPage: $hasNextPage)';
}
