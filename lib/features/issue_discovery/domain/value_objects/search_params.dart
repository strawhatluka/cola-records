/// Search parameters value object
library;

import 'package:equatable/equatable.dart';

/// Parameters for searching GitHub issues
class SearchParams extends Equatable {
  final String? language;
  final int minStars;
  final int maxStars;
  final int page;
  final String? cursor;

  const SearchParams({
    this.language,
    this.minStars = 0,
    this.maxStars = 999999,
    this.page = 1,
    this.cursor,
  });

  /// Convert to GitHub search query string
  String toQueryString() {
    final parts = <String>[
      'label:"good first issue"',
      'is:open', // Only open issues
      'is:public', // Only public repositories
      'no:assignee', // Exclude issues already assigned to someone
      'archived:false', // Exclude archived repositories
    ];

    if (language != null && language!.isNotEmpty) {
      parts.add('language:$language');
    }

    if (minStars > 0) {
      parts.add('stars:>=$minStars');
    }

    if (maxStars < 999999) {
      parts.add('stars:<=$maxStars');
    }

    return parts.join(' ');
  }

  @override
  List<Object?> get props => [language, minStars, maxStars, page, cursor];

  @override
  String toString() =>
      'SearchParams(language: $language, stars: $minStars-$maxStars, page: $page)';
}
