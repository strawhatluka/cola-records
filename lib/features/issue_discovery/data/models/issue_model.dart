/// Issue data models
library;

import '../../domain/entities/issue.dart';

/// Data model for Repository
class RepositoryModel {
  final String name;
  final String owner;
  final int stars;

  RepositoryModel({
    required this.name,
    required this.owner,
    required this.stars,
  });

  factory RepositoryModel.fromJson(Map<String, dynamic> json) {
    return RepositoryModel(
      name: json['name'] as String,
      owner: (json['owner'] as Map<String, dynamic>)['login'] as String,
      stars: json['stargazerCount'] as int,
    );
  }

  Repository toEntity() {
    return Repository(
      name: name,
      owner: owner,
      stars: stars,
    );
  }
}

/// Data model for Issue
class IssueModel {
  final String id;
  final int number;
  final String title;
  final String url;
  final String createdAt;
  final RepositoryModel repository;

  IssueModel({
    required this.id,
    required this.number,
    required this.title,
    required this.url,
    required this.createdAt,
    required this.repository,
  });

  factory IssueModel.fromJson(Map<String, dynamic> json) {
    return IssueModel(
      id: json['id'] as String,
      number: json['number'] as int,
      title: json['title'] as String,
      url: json['url'] as String,
      createdAt: json['createdAt'] as String,
      repository: RepositoryModel.fromJson(json['repository'] as Map<String, dynamic>),
    );
  }

  Issue toEntity() {
    return Issue(
      id: id,
      number: number,
      title: title,
      url: url,
      createdAt: DateTime.parse(createdAt),
      repository: repository.toEntity(),
    );
  }
}
