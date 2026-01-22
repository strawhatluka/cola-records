/// Issue discovery events
library;

import 'package:equatable/equatable.dart';
import '../../domain/value_objects/search_params.dart';

/// Base class for issue discovery events
sealed class IssueEvent extends Equatable {
  const IssueEvent();

  @override
  List<Object?> get props => [];
}

/// Event to search for issues
class SearchIssuesRequested extends IssueEvent {
  final SearchParams params;

  const SearchIssuesRequested(this.params);

  @override
  List<Object?> get props => [params];
}

/// Event to load more issues (pagination)
class LoadMoreIssuesRequested extends IssueEvent {
  final String cursor;

  const LoadMoreIssuesRequested(this.cursor);

  @override
  List<Object?> get props => [cursor];
}
