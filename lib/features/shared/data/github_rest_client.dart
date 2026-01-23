/// GitHub REST API client
library;

import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/network/http_client.dart';
import 'package:cola_records/core/network/request_config.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:cola_records/core/storage/secure_token_storage.dart';

/// Client for interacting with GitHub REST API
class GitHubRestClient {
  final HttpClient _httpClient;
  final SecureTokenStorage _tokenStorage;

  GitHubRestClient(this._httpClient, this._tokenStorage);

  /// Get authentication headers with token
  Future<Map<String, String>> _authHeaders() async {
    final token = await _tokenStorage.getToken();
    if (token == null || token.isEmpty) {
      throw AuthException('No GitHub token found. Please configure your token in .env.local');
    }
    return {
      'Authorization': 'Bearer $token',
      'Accept': ApiConstants.apiVersionHeader,
    };
  }

  /// Check GitHub API rate limit status
  Future<Result<Map<String, dynamic>>> checkRateLimit() async {
    final config = RequestConfig(
      url: '${ApiConstants.githubRestBaseUrl}/rate_limit',
      headers: await _authHeaders(),
    );

    final result = await _httpClient.get(config);

    return result.map((response) => response.data as Map<String, dynamic>);
  }

  /// Get repository contents (for README, CONTRIBUTING.md, etc.)
  Future<Result<Map<String, dynamic>>> getRepoContents({
    required String owner,
    required String repo,
    required String path,
  }) async {
    final config = RequestConfig(
      url:
          '${ApiConstants.githubRestBaseUrl}/repos/$owner/$repo/contents/$path',
      headers: await _authHeaders(),
    );

    final result = await _httpClient.get(config);

    return result.map((response) => response.data as Map<String, dynamic>);
  }

  /// Get repository information
  Future<Result<Map<String, dynamic>>> getRepository({
    required String owner,
    required String repo,
  }) async {
    final config = RequestConfig(
      url: '${ApiConstants.githubRestBaseUrl}/repos/$owner/$repo',
      headers: await _authHeaders(),
    );

    final result = await _httpClient.get(config);

    return result.map((response) => response.data as Map<String, dynamic>);
  }

  /// Get repository tree (to check for docs/ directory, etc.)
  Future<Result<Map<String, dynamic>>> getRepoTree({
    required String owner,
    required String repo,
    String ref = 'main',
  }) async {
    final config = RequestConfig(
      url:
          '${ApiConstants.githubRestBaseUrl}/repos/$owner/$repo/git/trees/$ref?recursive=1',
      headers: await _authHeaders(),
    );

    final result = await _httpClient.get(config);

    return result.map((response) => response.data as Map<String, dynamic>);
  }
}
