import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

// Core
import 'core/network/http_client.dart';
import 'core/storage/secure_token_storage.dart';
import 'core/storage/cache_repository.dart';

// Shared
import 'features/shared/data/github_rest_client.dart';
import 'features/shared/data/github_graphql_client.dart';

// Issue Discovery
import 'features/issue_discovery/data/repositories/issue_repository_impl.dart';
import 'features/issue_discovery/domain/usecases/search_good_first_issues.dart';
import 'features/issue_discovery/presentation/bloc/issue_discovery_bloc.dart';
import 'features/issue_discovery/presentation/screens/issue_discovery_screen.dart';

// Repo Analysis
import 'features/repo_analysis/data/repositories/repo_analysis_repository_impl.dart';
import 'features/repo_analysis/domain/usecases/analyze_repository_documentation.dart';
import 'features/repo_analysis/domain/usecases/calculate_doc_score.dart';
import 'features/repo_analysis/presentation/bloc/repo_analysis_bloc.dart';
import 'features/repo_analysis/presentation/screens/repo_analysis_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables from .env.local
  try {
    await dotenv.load(fileName: ".env.local");
  } catch (e) {
    // If .env.local doesn't exist, continue without it
    // User can still manually set token via secure storage
    debugPrint('Note: .env.local not found. Create from .env.example to auto-load GitHub token.');
  }

  // Initialize dependencies
  final dio = Dio();
  final storage = const FlutterSecureStorage();
  final httpClient = HttpClient(dio);
  final tokenStorage = SecureTokenStorage(storage);
  final cacheRepository = CacheRepository();

  // Initialize cache
  await cacheRepository.initialize();

  // Auto-load GitHub token from .env.local if available
  final envToken = dotenv.maybeGet('GITHUB_TOKEN');
  debugPrint('Environment token present: ${envToken != null && envToken.isNotEmpty}');

  if (envToken != null && envToken.isNotEmpty) {
    final hasToken = await tokenStorage.hasValidToken();
    debugPrint('Existing valid token in storage: $hasToken');

    if (!hasToken) {
      // Save token from .env.local to secure storage
      try {
        await tokenStorage.saveToken(TokenParams(
          token: envToken,
          expiresAt: DateTime.now().add(const Duration(days: 365)),
          scopes: ['public_repo', 'read:user'],
        ));
        debugPrint('✓ GitHub token loaded from .env.local and saved to secure storage');

        // Verify it was saved
        final savedToken = await tokenStorage.getToken();
        debugPrint('Token verification: ${savedToken != null ? "SUCCESS" : "FAILED"}');
      } catch (e) {
        debugPrint('✗ Failed to save token to secure storage: $e');
      }
    } else {
      debugPrint('Using existing token from secure storage');
    }
  } else {
    debugPrint('⚠ No GitHub token found in .env.local');
  }

  // GitHub clients
  final restClient = GitHubRestClient(httpClient, tokenStorage);
  final graphqlClient = GitHubGraphQLClient(httpClient, tokenStorage);

  // Issue Discovery
  final issueRepository = IssueRepositoryImpl(graphqlClient);
  final searchIssuesUseCase = SearchGoodFirstIssues(issueRepository);

  // Repo Analysis
  final docScorer = DocumentationScorer();
  final repoAnalysisRepository = RepoAnalysisRepositoryImpl(restClient, docScorer);
  final analyzeRepoUseCase = AnalyzeRepositoryDocumentation(repoAnalysisRepository);

  runApp(ColaRecordsApp(
    searchIssuesUseCase: searchIssuesUseCase,
    analyzeRepoUseCase: analyzeRepoUseCase,
  ));
}

class ColaRecordsApp extends StatelessWidget {
  final SearchGoodFirstIssues searchIssuesUseCase;
  final AnalyzeRepositoryDocumentation analyzeRepoUseCase;

  const ColaRecordsApp({
    required this.searchIssuesUseCase,
    required this.analyzeRepoUseCase,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) => IssueDiscoveryBloc(searchIssuesUseCase),
        ),
        BlocProvider(
          create: (_) => RepoAnalysisBloc(analyzeRepoUseCase),
        ),
      ],
      child: MaterialApp(
        title: 'Cola Records',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          useMaterial3: true,
        ),
        home: const DashboardScreen(),
      ),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cola Records'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              // TODO: Open settings (authentication)
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: const [
          IssueDiscoveryScreen(),
          RepoAnalysisScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.search),
            label: 'Find Issues',
          ),
          NavigationDestination(
            icon: Icon(Icons.analytics),
            label: 'Analyze Repo',
          ),
        ],
      ),
    );
  }
}
