/// Repository analysis repository interface
library;

import 'package:cola_records/core/result/result.dart';
import '../entities/doc_score.dart';
import '../value_objects/repo_params.dart';

/// Repository for analyzing repository documentation
abstract class RepoAnalysisRepository {
  /// Analyze documentation quality of a repository
  Future<Result<DocScore>> analyzeDocumentation(RepoParams params);

  /// Fetch a specific file from repository
  Future<Result<String>> fetchFile(RepoParams params, String path);
}
