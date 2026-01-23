/// Custom exceptions for Cola Records application
library;

/// Exception thrown when a network error occurs
class NetworkException implements Exception {
  final String message;

  NetworkException(this.message);

  @override
  String toString() => 'NetworkException: $message';
}

/// Exception thrown when GitHub API rate limit is exceeded
class RateLimitException implements Exception {
  final DateTime resetAt;

  RateLimitException(this.resetAt);

  @override
  String toString() =>
      'RateLimitException: Rate limit exceeded. Resets at $resetAt';
}

/// Exception thrown when authentication fails
class AuthException implements Exception {
  final String message;

  AuthException(this.message);

  @override
  String toString() => 'AuthException: $message';
}

/// Exception thrown when a repository is not found
class RepositoryNotFoundException implements Exception {
  final String owner;
  final String repo;

  RepositoryNotFoundException(this.owner, this.repo);

  @override
  String toString() =>
      'RepositoryNotFoundException: Repository $owner/$repo not found';
}

/// Exception thrown when accessing a private repository without permissions
class PrivateRepositoryException implements Exception {
  final String owner;
  final String repo;

  PrivateRepositoryException(this.owner, this.repo);

  @override
  String toString() =>
      'PrivateRepositoryException: Repository $owner/$repo is private';
}

/// Exception thrown when a cache operation fails
class CacheException implements Exception {
  final String message;

  CacheException(this.message);

  @override
  String toString() => 'CacheException: $message';
}

/// Exception thrown when secure storage operations fail
class StorageException implements Exception {
  final String message;

  StorageException(this.message);

  @override
  String toString() => 'StorageException: $message';
}

/// Exception thrown when API operations fail
class ApiException implements Exception {
  final String message;

  ApiException(this.message);

  @override
  String toString() => 'ApiException: $message';
}
