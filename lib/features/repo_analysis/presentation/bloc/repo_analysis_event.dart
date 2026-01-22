/// Repository analysis events
library;

import 'package:equatable/equatable.dart';
import '../../domain/value_objects/repo_params.dart';

/// Base class for repo analysis events
sealed class RepoAnalysisEvent extends Equatable {
  const RepoAnalysisEvent();

  @override
  List<Object?> get props => [];
}

/// Event to analyze a repository
class AnalyzeRepositoryRequested extends RepoAnalysisEvent {
  final RepoParams params;

  const AnalyzeRepositoryRequested(this.params);

  @override
  List<Object?> get props => [params];
}
