/// Implementation of repository analysis repository
library;

import 'dart:convert';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:cola_records/features/repo_analysis/domain/entities/doc_score.dart';
import 'package:cola_records/features/repo_analysis/domain/repositories/repo_analysis_repository.dart';
import 'package:cola_records/features/repo_analysis/domain/usecases/calculate_doc_score.dart';
import 'package:cola_records/features/repo_analysis/domain/value_objects/repo_params.dart';
import 'package:cola_records/features/shared/data/github_rest_client.dart';

/// Implementation of RepoAnalysisRepository
class RepoAnalysisRepositoryImpl implements RepoAnalysisRepository {
  final GitHubRestClient _restClient;
  final DocumentationScorer _scorer;

  RepoAnalysisRepositoryImpl(this._restClient, this._scorer);

  @override
  Future<Result<DocScore>> analyzeDocumentation(RepoParams params) async {
    try {
      // Fetch README
      final readmeResult = await _fetchReadme(params);
      bool hasReadme = false;
      int readmeLength = 0;
      bool hasHeaders = false;

      if (readmeResult.isSuccess) {
        hasReadme = true;
        final readme = readmeResult.data!;
        readmeLength = readme.length;
        hasHeaders = _scorer.hasHeaders(readme);
      }

      // Check for CONTRIBUTING.md
      final contributingResult = await fetchFile(params, 'CONTRIBUTING.md');
      final hasContributing = contributingResult.isSuccess;

      // Check for CODE_OF_CONDUCT.md
      final codeOfConductResult = await fetchFile(params, 'CODE_OF_CONDUCT.md');
      final hasCodeOfConduct = codeOfConductResult.isSuccess;

      // Check for docs/ directory
      final docsResult = await _checkDocsDirectory(params);
      final hasDocsDirectory = docsResult;

      // Check for issue templates
      final issueTemplatesResult = await _checkIssueTemplates(params);
      final hasIssueTemplates = issueTemplatesResult;

      // Calculate score
      final score = _scorer.calculateScore(
        hasReadme: hasReadme,
        readmeLength: readmeLength,
        hasReadmeHeaders: hasHeaders,
        hasContributing: hasContributing,
        hasDocsDirectory: hasDocsDirectory,
        hasCodeOfConduct: hasCodeOfConduct,
        hasIssueTemplates: hasIssueTemplates,
      );

      return Result.success(score);
    } catch (e) {
      return Result.failure(NetworkException('Failed to analyze repository: $e'));
    }
  }

  @override
  Future<Result<String>> fetchFile(RepoParams params, String path) async {
    try {
      final result = await _restClient.getRepoContents(
        owner: params.owner,
        repo: params.repo,
        path: path,
      );

      return result.when(
        success: (data) {
          final content = data['content'] as String?;
          if (content == null) {
            return Result.failure(NetworkException('File content not found'));
          }

          // Decode base64 content
          final decoded = utf8.decode(base64.decode(content));
          return Result.success(decoded);
        },
        failure: (error) => Result.failure(error),
      );
    } catch (e) {
      return Result.failure(NetworkException('Failed to fetch file: $e'));
    }
  }

  Future<Result<String>> _fetchReadme(RepoParams params) async {
    // Try README.md first, then README
    final readmeResult = await fetchFile(params, 'README.md');
    if (readmeResult.isSuccess) {
      return readmeResult;
    }

    return await fetchFile(params, 'README');
  }

  Future<bool> _checkDocsDirectory(RepoParams params) async {
    try {
      final result = await _restClient.getRepoContents(
        owner: params.owner,
        repo: params.repo,
        path: 'docs',
      );
      return result.isSuccess;
    } catch (e) {
      return false;
    }
  }

  Future<bool> _checkIssueTemplates(RepoParams params) async {
    try {
      final result = await _restClient.getRepoContents(
        owner: params.owner,
        repo: params.repo,
        path: '.github/ISSUE_TEMPLATE',
      );
      return result.isSuccess;
    } catch (e) {
      return false;
    }
  }
}
