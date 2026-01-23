/// Implementation of issue repository
library;

import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:cola_records/features/issue_discovery/domain/entities/issue.dart';
import 'package:cola_records/features/issue_discovery/domain/repositories/issue_repository.dart';
import 'package:cola_records/features/issue_discovery/domain/value_objects/search_params.dart';
import 'package:cola_records/features/shared/data/github_graphql_client.dart';
import 'package:flutter/foundation.dart';

import '../models/issue_model.dart';

/// Implementation of IssueRepository using GitHub GraphQL API
class IssueRepositoryImpl implements IssueRepository {
  final GitHubGraphQLClient _graphqlClient;

  IssueRepositoryImpl(this._graphqlClient);

  @override
  Future<Result<IssueList>> searchIssues(SearchParams params) async {
    try {
      final result = await _graphqlClient.query(
        queryString: _graphqlClient.buildIssueSearchQuery(),
        variables: {
          'queryString': params.toQueryString(),
          'first': ApiConstants.itemsPerPage,
          'after': params.cursor,
        },
      );

      return result.when(
        success: (data) {
          try {
            debugPrint('📊 Parsing issue data...');
            final searchData = data['data']['search'] as Map<String, dynamic>;
            final edges = searchData['edges'] as List<dynamic>;
            final pageInfo = searchData['pageInfo'] as Map<String, dynamic>;

            debugPrint('Found ${edges.length} issues');

            final issues = edges
                .map((edge) {
                  final node = edge['node'] as Map<String, dynamic>;
                  return IssueModel.fromJson(node).toEntity();
                })
                .toList();

            debugPrint('✓ Successfully parsed ${issues.length} issues');

            return Result.success(IssueList(
              issues: issues,
              hasNextPage: pageInfo['hasNextPage'] as bool,
              nextCursor: pageInfo['endCursor'] as String?,
            ));
          } catch (e, stackTrace) {
            debugPrint('✗ Failed to parse issue data: $e');
            debugPrint('Stack trace: $stackTrace');
            return Result.failure(
              NetworkException('Failed to parse issue data: $e'),
            );
          }
        },
        failure: (error) {
          debugPrint('✗ GraphQL query failed: $error');
          return Result.failure(error);
        },
      );
    } catch (e) {
      return Result.failure(NetworkException('Failed to search issues: $e'));
    }
  }

  @override
  Future<Result<Issue>> getIssueDetails(String issueId) async {
    // For MVP, this can return a simplified implementation
    // Full implementation deferred to post-MVP
    return Result.failure(
      NetworkException('getIssueDetails not yet implemented'),
    );
  }
}
