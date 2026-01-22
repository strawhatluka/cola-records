/// Use case for analyzing repository documentation
library;

import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/result/result.dart';
import '../entities/doc_score.dart';
import '../repositories/repo_analysis_repository.dart';
import '../value_objects/repo_params.dart';

/// Use case for analyzing repository documentation quality
class AnalyzeRepositoryDocumentation {
  final RepoAnalysisRepository _repository;

  AnalyzeRepositoryDocumentation(this._repository);

  /// Execute documentation analysis
  Future<Result<DocScore>> execute(RepoParams params) async {
    try {
      return await _repository.analyzeDocumentation(params);
    } on RepositoryNotFoundException catch (e) {
      return Result.failure(e);
    } on PrivateRepositoryException catch (e) {
      return Result.failure(e);
    } on NetworkException catch (e) {
      return Result.failure(e);
    } catch (e) {
      return Result.failure(
        NetworkException('Unexpected error during analysis: $e'),
      );
    }
  }
}
