/// Issue repository interface
library;

import 'package:cola_records/core/result/result.dart';
import '../entities/issue.dart';
import '../value_objects/search_params.dart';

/// Repository for fetching GitHub issues
abstract class IssueRepository {
  /// Search for good first issues
  Future<Result<IssueList>> searchIssues(SearchParams params);

  /// Get details for a specific issue
  Future<Result<Issue>> getIssueDetails(String issueId);
}
