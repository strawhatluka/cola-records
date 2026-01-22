/// Repository analysis states
library;

import 'package:equatable/equatable.dart';
import '../../domain/entities/doc_score.dart';

/// Base class for repo analysis states
sealed class RepoAnalysisState extends Equatable {
  const RepoAnalysisState();

  @override
  List<Object?> get props => [];
}

/// Initial state before any analysis
class RepoAnalysisInitial extends RepoAnalysisState {}

/// Loading state during analysis
class RepoAnalysisLoading extends RepoAnalysisState {}

/// Successfully analyzed repository
class RepoAnalysisLoaded extends RepoAnalysisState {
  final DocScore score;

  const RepoAnalysisLoaded(this.score);

  @override
  List<Object?> get props => [score];
}

/// Error state
class RepoAnalysisError extends RepoAnalysisState {
  final String message;

  const RepoAnalysisError(this.message);

  @override
  List<Object?> get props => [message];
}
