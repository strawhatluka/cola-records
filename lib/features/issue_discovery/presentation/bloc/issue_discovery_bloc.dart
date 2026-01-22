/// Issue discovery BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cola_records/core/error/exceptions.dart';
import '../../domain/usecases/search_good_first_issues.dart';
import 'issue_discovery_event.dart';
import 'issue_discovery_state.dart';

/// BLoC for managing issue discovery state
class IssueDiscoveryBloc extends Bloc<IssueEvent, IssueState> {
  final SearchGoodFirstIssues _searchUseCase;

  IssueDiscoveryBloc(this._searchUseCase) : super(IssueInitial()) {
    on<SearchIssuesRequested>(_onSearchRequested);
    on<LoadMoreIssuesRequested>(_onLoadMoreRequested);
  }

  Future<void> _onSearchRequested(
    SearchIssuesRequested event,
    Emitter<IssueState> emit,
  ) async {
    emit(IssueLoading());

    try {
      final result = await _searchUseCase.execute(event.params);

      result.when(
        success: (issues) => emit(IssueLoaded(issues)),
        failure: (error) => emit(IssueError(_formatErrorMessage(error))),
      );
    } catch (e) {
      emit(IssueError('Unexpected error occurred: $e'));
    }
  }

  Future<void> _onLoadMoreRequested(
    LoadMoreIssuesRequested event,
    Emitter<IssueState> emit,
  ) async {
    // For MVP, pagination can be simplified
    // Full implementation deferred to post-MVP
    emit(const IssueError('Pagination not yet implemented'));
  }

  String _formatErrorMessage(Exception error) {
    if (error is NetworkException) {
      return 'Network error. Please check your connection.';
    }
    if (error is RateLimitException) {
      final resetTime = error.resetAt;
      return 'GitHub rate limit exceeded. Try again after ${resetTime.hour}:${resetTime.minute.toString().padLeft(2, '0')}.';
    }
    if (error is AuthException) {
      return 'Authentication failed. Please log in again.';
    }
    return 'An error occurred. Please try again.';
  }
}
