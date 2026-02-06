# Work Order: Cola Records MVP

**Work Order ID:** WO-001
**Project:** Cola Records
**Type:** Feature Implementation
**Scale:** Medium
**Priority:** High
**Status:** 🟡 Planned
**Created:** 2026-01-22
**Trinity Version:** 2.1.0

---

## 📋 WORK ORDER SUMMARY

**Objective:** Build MVP desktop application for discovering GitHub good first issues and analyzing repository documentation quality.

**Deliverables:**
1. ✅ Flutter desktop application (Windows/macOS/Linux)
2. ✅ Good First Issue search with filters
3. ✅ Repository documentation quality scoring (0-100)
4. ✅ GitHub OAuth authentication
5. ✅ SQLite caching (24h TTL)
6. ✅ Simple dashboard UI (single screen)

**Timeline:** 10 working days (2 weeks)
**Estimated Effort:** 51 hours (43h tasks + 8h buffer)

---

## 🎯 ACCEPTANCE CRITERIA

### Functional Requirements

- [ ] **FR-1:** User can authenticate with GitHub OAuth device flow
- [ ] **FR-2:** User can search good first issues filtered by:
  - Language (dropdown: Dart, JavaScript, Python, etc.)
  - Minimum star count (input field)
- [ ] **FR-3:** Search results display:
  - Issue title + number
  - Repository name
  - Star count
  - Direct link to GitHub issue
- [ ] **FR-4:** User can analyze repository documentation by entering GitHub URL
- [ ] **FR-5:** Documentation score displays:
  - Total score (0-100)
  - Quality rating (Undocumented/Poor/Adequate/Well)
  - Breakdown by factor (README, CONTRIBUTING, docs/, etc.)
  - Missing documentation suggestions
- [ ] **FR-6:** Results are cached for 24 hours (reduces API calls)
- [ ] **FR-7:** Rate limit warnings appear at 80% GitHub quota usage

### Non-Functional Requirements

- [ ] **NFR-1:** Application startup time <2 seconds
- [ ] **NFR-2:** Issue search response time <3 seconds (first page)
- [ ] **NFR-3:** Repository analysis <5 seconds (average repo)
- [ ] **NFR-4:** Memory usage <500MB during active use
- [ ] **NFR-5:** Test coverage ≥70% (unit + widget tests)
- [ ] **NFR-6:** No crashes during normal operation
- [ ] **NFR-7:** User-friendly error messages (no stack traces in UI)

### Technical Requirements

- [ ] **TR-1:** Clean Architecture with 3 layers (domain, data, presentation)
- [ ] **TR-2:** BLoC pattern for state management
- [ ] **TR-3:** All functions ≤2 parameters (use value objects)
- [ ] **TR-4:** Function length <200 lines
- [ ] **TR-5:** Nesting depth ≤4 levels
- [ ] **TR-6:** All async functions wrapped in try-catch
- [ ] **TR-7:** GitHub tokens stored securely (flutter_secure_storage)

---

## 🏗️ IMPLEMENTATION PHASES

### Phase 1: Foundation Setup (Days 1-2)

**Duration:** 2 days (10 hours)

**Tasks:**

#### Task 1.1: Flutter Project Initialization
**Complexity:** 2/10 | **Time:** 30 minutes
- Create Flutter project with desktop support enabled
- Configure `pubspec.yaml` with dependencies:
  ```yaml
  dependencies:
    flutter_bloc: ^8.1.3
    dio: ^5.4.0
    graphql_flutter: ^5.1.2
    sqflite: ^2.3.0
    flutter_secure_storage: ^9.0.0
    cached_network_image: ^3.3.0
    equatable: ^2.0.5
    freezed: ^2.4.5

  dev_dependencies:
    bloc_test: ^9.1.5
    mocktail: ^1.0.1
    build_runner: ^2.4.6
  ```
- Setup folder structure:
  ```
  lib/
  ├── core/
  ├── features/
  │   ├── issue_discovery/
  │   │   ├── data/
  │   │   ├── domain/
  │   │   └── presentation/
  │   └── repo_analysis/
  │       ├── data/
  │       ├── domain/
  │       └── presentation/
  └── main.dart
  ```
- **Dependencies:** None
- **BAS Gates:** Lint, Structure
- **Deliverable:** Buildable Flutter desktop project

---

#### Task 1.2: Core Architecture Setup
**Complexity:** 4/10 | **Time:** 1.5 hours
- Create `lib/core/error/` directory with custom exceptions:
  ```dart
  class NetworkException implements Exception {
    final String message;
    NetworkException(this.message);
  }

  class RateLimitException implements Exception {
    final DateTime resetAt;
    RateLimitException(this.resetAt);
  }

  class AuthException implements Exception {
    final String message;
    AuthException(this.message);
  }
  ```
- Implement `Result<T>` type in `lib/core/result/result.dart`:
  ```dart
  sealed class Result<T> {
    const Result();

    factory Result.success(T data) = Success<T>;
    factory Result.failure(Exception error) = Failure<T>;

    bool get isSuccess => this is Success<T>;
    bool get isFailure => this is Failure<T>;

    T? get data => isSuccess ? (this as Success<T>).data : null;
    Exception? get error => isFailure ? (this as Failure<T>).error : null;
  }

  class Success<T> extends Result<T> {
    final T data;
    const Success(this.data);
  }

  class Failure<T> extends Result<T> {
    final Exception error;
    const Failure(this.error);
  }
  ```
- Create `lib/core/constants/api_constants.dart`:
  ```dart
  class ApiConstants {
    static const String githubRestBaseUrl = 'https://api.github.com';
    static const String githubGraphQLUrl = 'https://api.github.com/graphql';
    static const int rateLimitWarningThreshold = 4000; // 80% of 5000
    static const int rateLimitBlockThreshold = 4750;   // 95% of 5000
  }
  ```
- **Dependencies:** [1.1]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Core utilities + Result type with tests

---

#### Task 1.3: GitHub REST API Client
**Complexity:** 5/10 | **Time:** 2 hours
- Create `lib/core/network/http_client.dart`:
  ```dart
  class RequestConfig {
    final String url;
    final Map<String, String> headers;
    final Duration timeout;

    RequestConfig({
      required this.url,
      this.headers = const {},
      this.timeout = const Duration(seconds: 30),
    });
  }

  class HttpClient {
    final Dio _dio;

    HttpClient(this._dio);

    Future<Response> get(RequestConfig config) async {
      try {
        final response = await _dio.get(
          config.url,
          options: Options(
            headers: config.headers,
            sendTimeout: config.timeout,
            receiveTimeout: config.timeout,
          ),
        );
        return Response.success(response.data);
      } on DioException catch (e) {
        throw _mapDioError(e);
      }
    }

    Exception _mapDioError(DioException e) {
      if (e.type == DioExceptionType.connectionTimeout) {
        return NetworkException('Connection timeout');
      }
      if (e.response?.statusCode == 403) {
        return RateLimitException(DateTime.now().add(Duration(hours: 1)));
      }
      return NetworkException(e.message ?? 'Unknown error');
    }
  }
  ```
- Create `lib/features/shared/data/github_rest_client.dart`:
  ```dart
  class GitHubRestClient extends HttpClient {
    final SecureTokenStorage _tokenStorage;

    GitHubRestClient(super.dio, this._tokenStorage);

    Future<Map<String, String>> _authHeaders() async {
      final token = await _tokenStorage.getToken();
      return {
        'Authorization': 'Bearer $token',
        'Accept': 'application/vnd.github.v3+json',
      };
    }

    Future<Response> checkRateLimit() async {
      final config = RequestConfig(
        url: '${ApiConstants.githubRestBaseUrl}/rate_limit',
        headers: await _authHeaders(),
      );
      return get(config);
    }
  }
  ```
- **Dependencies:** [1.2]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** HTTP client with rate limit checking + tests

---

#### Task 1.4: Secure Token Storage
**Complexity:** 3/10 | **Time:** 1 hour
- Create `lib/core/storage/secure_token_storage.dart`:
  ```dart
  class TokenParams {
    final String token;
    final DateTime expiresAt;
    final List<String> scopes;

    TokenParams({
      required this.token,
      required this.expiresAt,
      required this.scopes,
    });
  }

  class SecureTokenStorage {
    final FlutterSecureStorage _storage;

    SecureTokenStorage(this._storage);

    Future<void> saveToken(TokenParams params) async {
      await _storage.write(
        key: 'github_token',
        value: params.token,
      );
      await _storage.write(
        key: 'github_token_expiry',
        value: params.expiresAt.toIso8601String(),
      );
    }

    Future<String?> getToken() async {
      final token = await _storage.read(key: 'github_token');
      final expiryStr = await _storage.read(key: 'github_token_expiry');

      if (token == null || expiryStr == null) return null;

      final expiry = DateTime.parse(expiryStr);
      if (DateTime.now().isAfter(expiry)) {
        await clearToken();
        return null;
      }

      return token;
    }

    Future<void> clearToken() async {
      await _storage.delete(key: 'github_token');
      await _storage.delete(key: 'github_token_expiry');
    }
  }
  ```
- **Dependencies:** [1.2]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Secure storage with expiry handling + tests

---

#### Task 1.5: GitHub OAuth Authentication
**Complexity:** 6/10 | **Time:** 3 hours
- Create `lib/features/auth/domain/auth_repository.dart`:
  ```dart
  abstract class AuthRepository {
    Future<Result<String>> authenticateDeviceFlow();
    Future<Result<void>> logout();
    Future<bool> isAuthenticated();
  }
  ```
- Implement `lib/features/auth/data/auth_repository_impl.dart`:
  ```dart
  class AuthRepositoryImpl implements AuthRepository {
    final GitHubRestClient _client;
    final SecureTokenStorage _storage;

    AuthRepositoryImpl(this._client, this._storage);

    @override
    Future<Result<String>> authenticateDeviceFlow() async {
      try {
        // Step 1: Request device code
        final deviceResponse = await _client.post(
          RequestConfig(
            url: 'https://github.com/login/device/code',
            headers: {'Accept': 'application/json'},
          ),
          body: {'client_id': 'YOUR_CLIENT_ID'},
        );

        final deviceCode = deviceResponse.data['device_code'];
        final userCode = deviceResponse.data['user_code'];
        final verificationUri = deviceResponse.data['verification_uri'];

        // Step 2: Show user code + poll for token
        // (Implementation details...)

        return Result.success(userCode);
      } catch (e) {
        return Result.failure(AuthException('Authentication failed'));
      }
    }
  }
  ```
- Create basic auth UI dialog in `lib/features/auth/presentation/auth_dialog.dart`
- **Dependencies:** [1.3, 1.4]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Working OAuth device flow + dialog UI

---

### Phase 2: Issue Discovery Feature (Days 3-5)

**Duration:** 3 days (14 hours)

**Tasks:**

#### Task 2.1: GitHub GraphQL Client
**Complexity:** 6/10 | **Time:** 2.5 hours
- Create `lib/features/shared/data/github_graphql_client.dart`:
  ```dart
  class GitHubGraphQLClient {
    final HttpClient _client;
    final SecureTokenStorage _tokenStorage;

    GitHubGraphQLClient(this._client, this._tokenStorage);

    Future<Response> query(String queryString, Map<String, dynamic> variables) async {
      final token = await _tokenStorage.getToken();
      final config = RequestConfig(
        url: ApiConstants.githubGraphQLUrl,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      return _client.post(config, body: {
        'query': queryString,
        'variables': variables,
      });
    }

    String buildIssueSearchQuery() {
      return '''
        query searchIssues(\$queryString: String!, \$first: Int!, \$after: String) {
          search(query: \$queryString, type: ISSUE, first: \$first, after: \$after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                ... on Issue {
                  id
                  number
                  title
                  url
                  createdAt
                  repository {
                    name
                    owner { login }
                    stargazerCount
                  }
                }
              }
            }
          }
        }
      ''';
    }
  }
  ```
- **Dependencies:** [1.3]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** GraphQL client with query builder + tests

---

#### Task 2.2: Issue Domain Layer
**Complexity:** 3/10 | **Time:** 1 hour
- Create `lib/features/issue_discovery/domain/entities/issue.dart`:
  ```dart
  class Issue extends Equatable {
    final String id;
    final int number;
    final String title;
    final String url;
    final DateTime createdAt;
    final Repository repository;

    const Issue({
      required this.id,
      required this.number,
      required this.title,
      required this.url,
      required this.createdAt,
      required this.repository,
    });

    @override
    List<Object?> get props => [id, number, title, url, createdAt, repository];
  }

  class Repository extends Equatable {
    final String name;
    final String owner;
    final int stars;

    const Repository({
      required this.name,
      required this.owner,
      required this.stars,
    });

    @override
    List<Object?> get props => [name, owner, stars];
  }

  class IssueList extends Equatable {
    final List<Issue> issues;
    final bool hasNextPage;
    final String? nextCursor;

    const IssueList({
      required this.issues,
      required this.hasNextPage,
      this.nextCursor,
    });

    @override
    List<Object?> get props => [issues, hasNextPage, nextCursor];
  }
  ```
- Create `lib/features/issue_discovery/domain/value_objects/search_params.dart`:
  ```dart
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

    String toQueryString() {
      final parts = <String>['label:"good first issue"'];

      if (language != null) {
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
  }
  ```
- Create `lib/features/issue_discovery/domain/repositories/issue_repository.dart`:
  ```dart
  abstract class IssueRepository {
    Future<Result<IssueList>> searchIssues(SearchParams params);
    Future<Result<Issue>> getIssueDetails(String issueId);
  }
  ```
- **Dependencies:** None (can run parallel with 2.1)
- **BAS Gates:** Lint, Build, Test
- **Deliverable:** Domain entities + value objects + repository contract

---

#### Task 2.3: Issue Data Layer
**Complexity:** 5/10 | **Time:** 2 hours
- Create `lib/features/issue_discovery/data/models/issue_model.dart`:
  ```dart
  class IssueModel {
    final String id;
    final int number;
    final String title;
    final String url;
    final String createdAt;
    final RepositoryModel repository;

    IssueModel({
      required this.id,
      required this.number,
      required this.title,
      required this.url,
      required this.createdAt,
      required this.repository,
    });

    factory IssueModel.fromJson(Map<String, dynamic> json) {
      return IssueModel(
        id: json['id'],
        number: json['number'],
        title: json['title'],
        url: json['url'],
        createdAt: json['createdAt'],
        repository: RepositoryModel.fromJson(json['repository']),
      );
    }

    Issue toEntity() {
      return Issue(
        id: id,
        number: number,
        title: title,
        url: url,
        createdAt: DateTime.parse(createdAt),
        repository: repository.toEntity(),
      );
    }
  }
  ```
- Implement `lib/features/issue_discovery/data/repositories/issue_repository_impl.dart`:
  ```dart
  class IssueRepositoryImpl implements IssueRepository {
    final GitHubGraphQLClient _graphqlClient;

    IssueRepositoryImpl(this._graphqlClient);

    @override
    Future<Result<IssueList>> searchIssues(SearchParams params) async {
      try {
        final response = await _graphqlClient.query(
          _graphqlClient.buildIssueSearchQuery(),
          {
            'queryString': params.toQueryString(),
            'first': 30,
            'after': params.cursor,
          },
        );

        final edges = response.data['data']['search']['edges'] as List;
        final issues = edges
            .map((e) => IssueModel.fromJson(e['node']).toEntity())
            .toList();

        final pageInfo = response.data['data']['search']['pageInfo'];

        return Result.success(IssueList(
          issues: issues,
          hasNextPage: pageInfo['hasNextPage'],
          nextCursor: pageInfo['endCursor'],
        ));
      } on NetworkException catch (e) {
        return Result.failure(e);
      } catch (e) {
        return Result.failure(NetworkException('Failed to search issues'));
      }
    }

    @override
    Future<Result<Issue>> getIssueDetails(String issueId) async {
      // Implementation for fetching single issue details
      throw UnimplementedError();
    }
  }
  ```
- **Dependencies:** [2.1, 2.2]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Data layer with API mapping + error handling + tests

---

#### Task 2.4: Issue Use Case
**Complexity:** 4/10 | **Time:** 1.5 hours
- Create `lib/features/issue_discovery/domain/usecases/search_good_first_issues.dart`:
  ```dart
  class SearchGoodFirstIssues {
    final IssueRepository _repository;

    SearchGoodFirstIssues(this._repository);

    Future<Result<IssueList>> execute(SearchParams params) async {
      try {
        // Retry logic with exponential backoff
        int retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          final result = await _repository.searchIssues(params);

          if (result.isSuccess) {
            return result;
          }

          if (result.error is NetworkException) {
            retries++;
            await Future.delayed(Duration(seconds: 2 << retries)); // 2, 4, 8 seconds
          } else {
            return result; // Non-retryable error
          }
        }

        return Result.failure(
          NetworkException('Failed after $maxRetries retries'),
        );
      } catch (e) {
        return Result.failure(NetworkException('Unexpected error: $e'));
      }
    }
  }
  ```
- Write comprehensive unit tests:
  ```dart
  void main() {
    group('SearchGoodFirstIssues', () {
      late MockIssueRepository mockRepo;
      late SearchGoodFirstIssues useCase;

      setUp(() {
        mockRepo = MockIssueRepository();
        useCase = SearchGoodFirstIssues(mockRepo);
      });

      test('returns issues when repository succeeds', () async {
        // Test implementation...
      });

      test('retries on network error', () async {
        // Test retry logic...
      });

      test('does not retry on auth error', () async {
        // Test non-retryable errors...
      });
    });
  }
  ```
- **Dependencies:** [2.3]
- **BAS Gates:** Lint, Build, Test, Coverage (≥80%)
- **Deliverable:** Use case with retry logic + comprehensive tests

---

#### Task 2.5: Issue Discovery BLoC
**Complexity:** 5/10 | **Time:** 2 hours
- Create `lib/features/issue_discovery/presentation/bloc/issue_discovery_bloc.dart`:
  ```dart
  // Events
  sealed class IssueEvent extends Equatable {
    @override
    List<Object?> get props => [];
  }

  class SearchIssuesRequested extends IssueEvent {
    final SearchParams params;
    SearchIssuesRequested(this.params);

    @override
    List<Object?> get props => [params];
  }

  class LoadMoreIssuesRequested extends IssueEvent {
    final String cursor;
    LoadMoreIssuesRequested(this.cursor);

    @override
    List<Object?> get props => [cursor];
  }

  // States
  sealed class IssueState extends Equatable {
    @override
    List<Object?> get props => [];
  }

  class IssueInitial extends IssueState {}

  class IssueLoading extends IssueState {}

  class IssueLoaded extends IssueState {
    final IssueList issues;
    IssueLoaded(this.issues);

    @override
    List<Object?> get props => [issues];
  }

  class IssueError extends IssueState {
    final String message;
    IssueError(this.message);

    @override
    List<Object?> get props => [message];
  }

  // BLoC
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

        if (result.isSuccess) {
          emit(IssueLoaded(result.data!));
        } else {
          emit(IssueError(_formatErrorMessage(result.error!)));
        }
      } catch (e) {
        emit(IssueError('Unexpected error occurred'));
      }
    }

    Future<void> _onLoadMoreRequested(
      LoadMoreIssuesRequested event,
      Emitter<IssueState> emit,
    ) async {
      // Pagination implementation...
    }

    String _formatErrorMessage(Exception error) {
      if (error is NetworkException) {
        return 'Network error. Please check your connection.';
      }
      if (error is RateLimitException) {
        return 'GitHub rate limit exceeded. Try again later.';
      }
      if (error is AuthException) {
        return 'Authentication failed. Please log in again.';
      }
      return 'An error occurred. Please try again.';
    }
  }
  ```
- Write BLoC tests using `bloc_test`:
  ```dart
  void main() {
    blocTest<IssueDiscoveryBloc, IssueState>(
      'emits [IssueLoading, IssueLoaded] when search succeeds',
      build: () => IssueDiscoveryBloc(mockUseCase),
      act: (bloc) => bloc.add(SearchIssuesRequested(testParams)),
      expect: () => [
        IssueLoading(),
        IssueLoaded(testIssues),
      ],
    );
  }
  ```
- **Dependencies:** [2.4]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** BLoC with events/states + comprehensive tests

---

#### Task 2.6: Issue Search UI
**Complexity:** 6/10 | **Time:** 3 hours
- Create `lib/features/issue_discovery/presentation/widgets/search_panel.dart`:
  ```dart
  class SearchPanel extends StatefulWidget {
    final Function(SearchParams) onSearch;

    const SearchPanel({required this.onSearch, super.key});

    @override
    State<SearchPanel> createState() => _SearchPanelState();
  }

  class _SearchPanelState extends State<SearchPanel> {
    String? _selectedLanguage;
    int _minStars = 0;

    final _languages = ['Dart', 'JavaScript', 'Python', 'TypeScript', 'Go', 'Rust'];

    @override
    Widget build(BuildContext context) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Search Good First Issues', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedLanguage,
                      decoration: const InputDecoration(labelText: 'Language'),
                      items: _languages.map((lang) {
                        return DropdownMenuItem(value: lang, child: Text(lang));
                      }).toList(),
                      onChanged: (value) => setState(() => _selectedLanguage = value),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextFormField(
                      decoration: const InputDecoration(labelText: 'Min Stars'),
                      keyboardType: TextInputType.number,
                      onChanged: (value) => _minStars = int.tryParse(value) ?? 0,
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton(
                    onPressed: () {
                      widget.onSearch(SearchParams(
                        language: _selectedLanguage,
                        minStars: _minStars,
                      ));
                    },
                    child: const Text('Search'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }
  }
  ```
- Create `lib/features/issue_discovery/presentation/widgets/issue_list.dart`:
  ```dart
  class IssueList extends StatelessWidget {
    final List<Issue> issues;

    const IssueList({required this.issues, super.key});

    @override
    Widget build(BuildContext context) {
      return ListView.builder(
        itemCount: issues.length,
        itemBuilder: (context, index) {
          final issue = issues[index];
          return IssueCard(issue: issue);
        },
      );
    }
  }

  class IssueCard extends StatelessWidget {
    final Issue issue;

    const IssueCard({required this.issue, super.key});

    @override
    Widget build(BuildContext context) {
      return Card(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        child: ListTile(
          title: Text('${issue.title} #${issue.number}'),
          subtitle: Text(
            '${issue.repository.owner}/${issue.repository.name} · ${issue.repository.stars} ⭐',
          ),
          trailing: const Icon(Icons.open_in_new),
          onTap: () {
            // Open issue.url in browser
          },
        ),
      );
    }
  }
  ```
- Create main screen in `lib/features/issue_discovery/presentation/screens/issue_discovery_screen.dart`:
  ```dart
  class IssueDiscoveryScreen extends StatelessWidget {
    const IssueDiscoveryScreen({super.key});

    @override
    Widget build(BuildContext context) {
      return BlocBuilder<IssueDiscoveryBloc, IssueState>(
        builder: (context, state) {
          return Column(
            children: [
              SearchPanel(
                onSearch: (params) {
                  context.read<IssueDiscoveryBloc>().add(
                    SearchIssuesRequested(params),
                  );
                },
              ),
              Expanded(
                child: switch (state) {
                  IssueInitial() => const Center(child: Text('Enter search criteria')),
                  IssueLoading() => const Center(child: CircularProgressIndicator()),
                  IssueLoaded() => IssueList(issues: state.issues.issues),
                  IssueError() => Center(child: Text('Error: ${state.message}')),
                },
              ),
            ],
          );
        },
      );
    }
  }
  ```
- **Dependencies:** [2.5]
- **BAS Gates:** Lint, Build, Test (widget tests)
- **Deliverable:** Search panel + results list + loading/error states

---

### Phase 3: Repository Analysis Feature (Days 6-8)

**Duration:** 3 days (14 hours)

**Tasks:**

#### Task 3.1: Repo Analysis Domain Layer
**Complexity:** 3/10 | **Time:** 1 hour
- Create domain entities, value objects, and repository contract
- Similar structure to Task 2.2 (Issue Domain Layer)
- **Dependencies:** None (can run parallel with Phase 2)
- **BAS Gates:** Lint, Build, Test
- **Deliverable:** DocScore entity, RepoParams value object, repository interface

---

#### Task 3.2: Documentation Scoring Algorithm
**Complexity:** 7/10 | **Time:** 3 hours
- Implement multi-factor scoring algorithm (0-100 scale)
- README analysis (presence, length, headers)
- CONTRIBUTING.md detection
- docs/ directory checking
- **Dependencies:** [3.1]
- **BAS Gates:** Lint, Build, Test, Coverage (≥80%)
- **Deliverable:** Scoring algorithm with comprehensive tests

---

#### Task 3.3: Repo Analysis Data Layer
**Complexity:** 6/10 | **Time:** 2.5 hours
- Implement repository fetching via REST API
- File content parsing
- Error handling (404, private repos)
- **Dependencies:** [1.3, 3.2]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Data layer with API integration + tests

---

#### Task 3.4: Repo Analysis Use Case
**Complexity:** 4/10 | **Time:** 1.5 hours
- Similar structure to Task 2.4
- **Dependencies:** [3.3]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Use case with error handling + tests

---

#### Task 3.5: Repo Analysis BLoC
**Complexity:** 4/10 | **Time:** 1.5 hours
- Similar structure to Task 2.5
- **Dependencies:** [3.4]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** BLoC with events/states + tests

---

#### Task 3.6: Repo Analysis UI
**Complexity:** 5/10 | **Time:** 2.5 hours
- URL input panel
- DocScore display with breakdown
- Missing documentation suggestions
- **Dependencies:** [3.5]
- **BAS Gates:** Lint, Build, Test
- **Deliverable:** Analysis UI with score visualization

---

### Phase 4: Caching & Integration (Days 9-10)

**Duration:** 2 days (13 hours)

**Tasks:**

#### Task 4.1: SQLite Cache Implementation
**Complexity:** 5/10 | **Time:** 2 hours
- Setup sqflite database
- Create cache tables (issues, repos, metadata)
- Implement CacheRepository with TTL
- **Dependencies:** [1.2]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Working cache layer + tests

---

#### Task 4.2: Integrate Caching with Repositories
**Complexity:** 4/10 | **Time:** 1.5 hours
- Update IssueRepository to check cache first
- Update RepoAnalysisRepository to cache results
- Cache invalidation on errors
- **Dependencies:** [2.3, 3.3, 4.1]
- **BAS Gates:** Lint, Build, Test, Coverage
- **Deliverable:** Cached repositories + tests

---

#### Task 4.3: Dashboard UI Assembly
**Complexity:** 4/10 | **Time:** 2 hours
- Create main dashboard screen
- Integrate search panel + analysis panel
- Add top bar with authenticated user
- **Dependencies:** [2.6, 3.6]
- **BAS Gates:** Lint, Build
- **Deliverable:** Complete dashboard UI

---

#### Task 4.4: Error Handling & User Feedback
**Complexity:** 3/10 | **Time:** 1.5 hours
- User-friendly error messages
- Rate limit warnings (toast notifications)
- Loading indicators
- **Dependencies:** [4.3]
- **BAS Gates:** Lint, Build
- **Deliverable:** Polished error handling

---

#### Task 4.5: Integration Testing
**Complexity:** 5/10 | **Time:** 2 hours
- Test full flows (auth → search → display)
- Edge cases (no results, network errors)
- Performance testing
- **Dependencies:** [4.4]
- **BAS Gates:** Lint, Build, Test
- **Deliverable:** Passing integration tests

---

#### Task 4.6: Final Polish & Bug Fixes
**Complexity:** 4/10 | **Time:** 2 hours
- Fix identified bugs
- Performance optimization
- Update README.md with setup instructions
- **Dependencies:** [4.5]
- **BAS Gates:** Lint, Build, Test, Coverage, Final Review
- **Deliverable:** Production-ready MVP

---

## 🚦 BAS QUALITY GATES

### Gate Execution by Phase

**Phase 1 (Linting):**
- Auto-fix enabled
- Run: `dart fix --apply`
- Verify: No lint errors

**Phase 2 (Structure Validation):**
- Verify Clean Architecture layers
- Check dependency injection setup
- Confirm folder structure matches design

**Phase 3 (Build Validation):**
- Run: `flutter build windows --debug`
- Verify: No compilation errors
- Check: All imports resolve

**Phase 4 (Testing):**
- Run: `flutter test`
- Verify: All tests pass
- Check: No flaky tests

**Phase 5 (Coverage Check):**
- Run: `flutter test --coverage`
- Generate report: `genhtml coverage/lcov.info -o coverage/html`
- Verify: ≥70% total coverage

**Phase 6 (Final Review):**
- Code review checklist
- Performance verification
- Documentation completeness
- Security audit (token storage, API keys)

---

## 📊 SUCCESS METRICS

### Completion Criteria

**Functional:**
- [ ] All 7 functional requirements met (FR-1 through FR-7)
- [ ] All features working end-to-end
- [ ] No critical bugs

**Non-Functional:**
- [ ] Performance targets met (NFR-1 through NFR-4)
- [ ] Test coverage ≥70% (NFR-5)
- [ ] Zero crashes in testing (NFR-6)
- [ ] User-friendly errors (NFR-7)

**Technical:**
- [ ] All 7 technical requirements met (TR-1 through TR-7)
- [ ] Clean Architecture enforced
- [ ] All BAS quality gates passed
- [ ] README.md with setup instructions

---

## 🔄 HANDOFF TO KIL (Task Executor)

**Next Agent:** KIL (Task Executor)
**Starting Task:** 1.1 (Flutter Project Initialization)
**Methodology:** TDD with RED-GREEN-REFACTOR cycle

**KIL Instructions:**
1. Execute tasks sequentially per phase
2. Run BAS quality gates after each task
3. Write tests BEFORE implementation (TDD)
4. Commit after each completed task
5. Escalate blockers to TRA immediately

---

## 📝 WORK ORDER STATUS

**Current Status:** 🟡 Planned
**Next Status:** 🔵 In Progress (when KIL starts Task 1.1)
**Planned Completion:** 2026-02-05 (10 working days from 2026-01-22)

**Stop Point 2 (Final Review):** End of Task 4.6
**Final Approval:** User acceptance testing

---

**Work Order Created By:** TRA (Work Planner)
**Approved By:** Awaiting user approval
**Assigned To:** KIL (Task Executor)

---

## 📎 ATTACHMENTS

- [ROR Design Document](../sessions/2026-01-22-cola-records-design.md)
- [ADR-001: Clean Architecture + BLoC](../adrs/ADR-001-clean-architecture.md)
- [ADR-002: GitHub API Strategy](../adrs/ADR-002-github-api-strategy.md)
- [ADR-003: Documentation Scoring](../adrs/ADR-003-documentation-scoring.md)
