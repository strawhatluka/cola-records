/// GitHub GraphQL API client
library;

import 'package:cola_records/core/constants/api_constants.dart';
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

    return result.map((response) => response.data as Map<String, dynamic>);
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
                url
                createdAt
                repository {
                  name
                  owner {
                    login
                  }
                  stargazerCount
                }
              }
            }
          }
        }
      }
    ''';
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _tokenStorage.getToken();
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }
}
