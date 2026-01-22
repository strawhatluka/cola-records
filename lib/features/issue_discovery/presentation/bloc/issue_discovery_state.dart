/// Issue discovery states
library;

import 'package:equatable/equatable.dart';
import '../../domain/entities/issue.dart';

/// Base class for issue discovery states
sealed class IssueState extends Equatable {
  const IssueState();

  @override
  List<Object?> get props => [];
}

/// Initial state before any search
class IssueInitial extends IssueState {}

/// Loading state during search
class IssueLoading extends IssueState {}

/// Successfully loaded issues
class IssueLoaded extends IssueState {
  final IssueList issues;

  const IssueLoaded(this.issues);

  @override
  List<Object?> get props => [issues];
}

/// Error state
class IssueError extends IssueState {
  final String message;

  const IssueError(this.message);

  @override
  List<Object?> get props => [message];
}
