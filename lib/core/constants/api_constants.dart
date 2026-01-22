/// API constants for GitHub integration
library;

/// GitHub API constants
class ApiConstants {
  ApiConstants._(); // Private constructor to prevent instantiation

  /// GitHub REST API base URL
  static const String githubRestBaseUrl = 'https://api.github.com';

  /// GitHub GraphQL API URL
  static const String githubGraphQLUrl = 'https://api.github.com/graphql';

  /// GitHub OAuth device authorization URL
  static const String githubDeviceAuthUrl =
      'https://github.com/login/device/code';

  /// GitHub OAuth token URL
  static const String githubTokenUrl =
      'https://github.com/login/oauth/access_token';

  /// Rate limit warning threshold (80% of 5000)
  static const int rateLimitWarningThreshold = 4000;

  /// Rate limit block threshold (95% of 5000)
  static const int rateLimitBlockThreshold = 4750;

  /// Maximum rate limit per hour (authenticated)
  static const int maxRateLimit = 5000;

  /// Default request timeout in seconds
  static const int defaultTimeoutSeconds = 30;

  /// Cache time-to-live in hours
  static const int cacheTtlHours = 24;

  /// Number of items per page for paginated requests
  static const int itemsPerPage = 30;

  /// Maximum retry attempts for failed requests
  static const int maxRetries = 3;

  /// Initial retry delay in milliseconds
  static const int initialRetryDelayMs = 2000;

  /// GitHub API version header
  static const String apiVersionHeader = 'application/vnd.github.v3+json';

  /// Good first issue labels to search for
  static const List<String> goodFirstIssueLabels = [
    'good first issue',
    'good-first-issue',
    'beginner-friendly',
    'help wanted',
    'first-timers-only',
  ];

  /// Supported programming languages
  static const List<String> supportedLanguages = [
    'Dart',
    'JavaScript',
    'TypeScript',
    'Python',
    'Java',
    'Go',
    'Rust',
    'C++',
    'C#',
    'Ruby',
    'PHP',
    'Swift',
    'Kotlin',
  ];
}
