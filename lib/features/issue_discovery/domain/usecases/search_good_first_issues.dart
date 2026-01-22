/// Use case for searching good first issues
library;

import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/result/result.dart';
import '../entities/issue.dart';
import '../repositories/issue_repository.dart';
import '../value_objects/search_params.dart';

/// Use case for searching good first issues with retry logic
class SearchGoodFirstIssues {
  final IssueRepository _repository;

  SearchGoodFirstIssues(this._repository);

  /// Execute search with exponential backoff retry
  Future<Result<IssueList>> execute(SearchParams params) async {
    int retries = 0;

    while (retries < ApiConstants.maxRetries) {
      try {
        final result = await _repository.searchIssues(params);

        if (result.isSuccess) {
          return result;
        }

        // Check if error is retryable
        if (result.error is NetworkException) {
          retries++;
          if (retries < ApiConstants.maxRetries) {
            // Exponential backoff: 2s, 4s, 8s
            final delayMs = ApiConstants.initialRetryDelayMs * (1 << retries);
            await Future.delayed(Duration(milliseconds: delayMs));
            continue;
          }
        }

        // Non-retryable error or max retries reached
        return result;
      } catch (e) {
        return Result.failure(
          NetworkException('Unexpected error during search: $e'),
        );
      }
    }

    return Result.failure(
      NetworkException('Failed after ${ApiConstants.maxRetries} retries'),
    );
  }
}
