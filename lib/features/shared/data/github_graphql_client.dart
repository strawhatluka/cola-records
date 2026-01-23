/// GitHub GraphQL API client
library;

import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/network/http_client.dart';
import 'package:cola_records/core/network/request_config.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:cola_records/core/storage/secure_token_storage.dart';

/// Client for interacting with GitHub GraphQL API
class GitHubGraphQLClient {
  final HttpClient _httpClient;
  final SecureTokenStorage _tokenStorage;

  GitHubGraphQLClient(this._httpClient, this._tokenStorage);

  /// Execute a GraphQL query
  Future<Result<Map<String, dynamic>>> query({
    required String queryString,
    Map<String, dynamic> variables = const {},
  }) async {
    final config = RequestConfig(
      url: ApiConstants.githubGraphQLUrl,
      headers: await _authHeaders(),
    );

    final result = await _httpClient.post(
      config,
      body: {
        'query': queryString,
        'variables': variables,
      },
    );

    return result.when(
      success: (response) {
        final responseData = response.data as Map<String, dynamic>;

        // Check for GraphQL errors
        if (responseData.containsKey('errors')) {
          final errors = responseData['errors'] as List;
          final errorMessages = errors.map((e) => e['message'] as String).join(', ');
          return Failure(ApiException('GraphQL Error: $errorMessages'));
        }

        return Success(responseData);
      },
      failure: (error) => Failure(error),
    );
  }

  /// Build GraphQL query for searching issues
  String buildIssueSearchQuery() {
    return '''
      query searchIssues(\$queryString: String!, \$first: Int!, \$after: String) {
        search(query: \$queryString, type: ISSUE, first: \$first, after: \$after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              ... on Issue {
                id
                number
                title
                body
                url
                createdAt
                repository {
                  name
                  owner {
                    login
                  }
                  stargazerCount
                  issues(states: OPEN) {
                    totalCount
                  }
                  pullRequests(states: OPEN) {
                    totalCount
                  }
                }
              }
            }
          }
        }
      }
    ''';
  }

  /// Build GraphQL query for getting repository file tree
  String buildRepoTreeQuery() {
    return '''
      query getRepoTree(\$owner: String!, \$name: String!) {
        repository(owner: \$owner, name: \$name) {
          defaultBranchRef {
            target {
              ... on Commit {
                tree {
                  entries {
                    name
                    type
                    path
                  }
                }
              }
            }
          }
        }
      }
    ''';
  }

  /// Execute a GraphQL mutation
  Future<Result<Map<String, dynamic>>> mutate({
    required String mutationString,
    Map<String, dynamic> variables = const {},
  }) async {
    final config = RequestConfig(
      url: ApiConstants.githubGraphQLUrl,
      headers: await _authHeaders(),
    );

    final result = await _httpClient.post(
      config,
      body: {
        'query': mutationString,
        'variables': variables,
      },
    );

    return result.when(
      success: (response) {
        final responseData = response.data as Map<String, dynamic>;

        // Check for GraphQL errors
        if (responseData.containsKey('errors')) {
          final errors = responseData['errors'] as List;
          final errorMessages = errors.map((e) => e['message'] as String).join(', ');
          return Failure(ApiException('GraphQL Error: $errorMessages'));
        }

        return Success(responseData);
      },
      failure: (error) => Failure(error),
    );
  }

  /// Fork a repository using GitHub REST API
  /// Returns the forked repository details including name, owner, url, and sshUrl
  Future<Result<Map<String, dynamic>>> forkRepository({
    required String owner,
    required String name,
  }) async {
    // First, get the upstream URL using GraphQL
    const getRepoQuery = '''
      query getRepo(\$owner: String!, \$name: String!) {
        repository(owner: \$owner, name: \$name) {
          url
        }
      }
    ''';

    final repoResult = await query(
      queryString: getRepoQuery,
      variables: {
        'owner': owner,
        'name': name,
      },
    );

    // Handle repository query result
    if (repoResult.isFailure) {
      return Failure(repoResult.error!);
    }

    final repoData = repoResult.data!;
    final repository = repoData['data']?['repository'] as Map<String, dynamic>?;

    if (repository == null) {
      return Failure(
        ApiException('Repository not found: $owner/$name'),
      );
    }

    final upstreamUrl = repository['url'] as String;

    // Fork using REST API - REST API requires 'token' prefix instead of 'Bearer'
    final config = RequestConfig(
      url: 'https://api.github.com/repos/$owner/$name/forks',
      headers: await _authHeadersRest(),
    );

    final forkResult = await _httpClient.post(config, body: {});

    return forkResult.when(
      success: (response) {
        try {
          final forkData = response.data as Map<String, dynamic>;

          // Debug: Print the full response
          print('Fork API Response: $forkData');
          print('Status Code: ${response.statusCode}');

          // Extract fork details from REST API response
          final ownerData = forkData['owner'];
          final forkOwner = ownerData is Map ? ownerData['login'] as String? : null;
          final forkName = forkData['name'] as String?;
          final forkUrl = forkData['html_url'] as String?;
          final sshUrl = forkData['ssh_url'] as String?;

          print('Extracted - owner: $forkOwner, name: $forkName, url: $forkUrl, ssh: $sshUrl');

          if (forkOwner == null || forkName == null || forkUrl == null) {
            // Log the actual response for debugging
            return Failure(
              ApiException('Invalid fork response: owner=$forkOwner, name=$forkName, url=$forkUrl'),
            );
          }

          return Success({
            'owner': {'login': forkOwner},
            'name': forkName,
            'url': forkUrl,
            'sshUrl': sshUrl ?? '',
            'upstreamUrl': upstreamUrl,
            'originalOwner': owner,
            'originalName': name,
          });
        } catch (e) {
          return Failure(
            ApiException('Failed to parse fork response: $e'),
          );
        }
      },
      failure: (error) => Failure(error),
    );
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _tokenStorage.getToken();
    if (token == null || token.isEmpty) {
      throw AuthException('No GitHub token found. Please configure your token in .env.local');
    }
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  /// Get auth headers for GitHub REST API (uses 'token' prefix instead of 'Bearer')
  Future<Map<String, String>> _authHeadersRest() async {
    final token = await _tokenStorage.getToken();
    if (token == null || token.isEmpty) {
      throw AuthException('No GitHub token found. Please configure your token in .env.local');
    }
    return {
      'Authorization': 'token $token',
      'Content-Type': 'application/json',
    };
  }
}
