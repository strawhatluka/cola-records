/// Repository analysis BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cola_records/core/error/exceptions.dart';
import '../../domain/usecases/analyze_repository_documentation.dart';
import 'repo_analysis_event.dart';
import 'repo_analysis_state.dart';

/// BLoC for managing repository analysis state
class RepoAnalysisBloc extends Bloc<RepoAnalysisEvent, RepoAnalysisState> {
  final AnalyzeRepositoryDocumentation _analyzeUseCase;

  RepoAnalysisBloc(this._analyzeUseCase) : super(RepoAnalysisInitial()) {
    on<AnalyzeRepositoryRequested>(_onAnalyzeRequested);
  }

  Future<void> _onAnalyzeRequested(
    AnalyzeRepositoryRequested event,
    Emitter<RepoAnalysisState> emit,
  ) async {
    emit(RepoAnalysisLoading());

    try {
      final result = await _analyzeUseCase.execute(event.params);

      result.when(
        success: (score) => emit(RepoAnalysisLoaded(score)),
        failure: (error) => emit(RepoAnalysisError(_formatErrorMessage(error))),
      );
    } catch (e) {
      emit(RepoAnalysisError('Unexpected error occurred: $e'));
    }
  }

  String _formatErrorMessage(Exception error) {
    if (error is RepositoryNotFoundException) {
      return 'Repository not found. Please check the URL.';
    }
    if (error is PrivateRepositoryException) {
      return 'Cannot access private repository.';
    }
    if (error is NetworkException) {
      return 'Network error. Please check your connection.';
    }
    if (error is AuthException) {
      return 'Authentication failed. Please log in again.';
    }
    return 'An error occurred. Please try again.';
  }
}
