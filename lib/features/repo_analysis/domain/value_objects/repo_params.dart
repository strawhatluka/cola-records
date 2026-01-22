/// Repository parameters value object
library;

import 'package:equatable/equatable.dart';

/// Parameters for repository analysis
class RepoParams extends Equatable {
  final String owner;
  final String repo;

  const RepoParams({
    required this.owner,
    required this.repo,
  });

  /// Create from GitHub URL (https://github.com/owner/repo)
  factory RepoParams.fromUrl(String url) {
    final uri = Uri.parse(url);
    final segments = uri.pathSegments;

    if (segments.length < 2) {
      throw ArgumentError('Invalid GitHub URL: $url');
    }

    return RepoParams(
      owner: segments[0],
      repo: segments[1],
    );
  }

  @override
  List<Object?> get props => [owner, repo];

  @override
  String toString() => 'RepoParams(owner: $owner, repo: $repo)';
}
