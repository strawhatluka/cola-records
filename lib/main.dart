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
import 'features/shared/data/github_graphql_client.dart';

// Issue Discovery
import 'features/issue_discovery/data/repositories/issue_repository_impl.dart';
import 'features/issue_discovery/domain/usecases/search_good_first_issues.dart';
import 'features/issue_discovery/presentation/bloc/issue_discovery_bloc.dart';
import 'features/issue_discovery/presentation/screens/issue_discovery_screen.dart';

// Dashboard
import 'features/dashboard/presentation/screens/dashboard_screen.dart';

// Contributions
import 'features/contributions/presentation/screens/contributions_screen.dart';

// Core Widgets
import 'core/widgets/sidebar_navigation.dart';

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
  if (envToken != null && envToken.isNotEmpty) {
    final hasToken = await tokenStorage.hasValidToken();
    if (!hasToken) {
      // Save token from .env.local to secure storage
      await tokenStorage.saveToken(TokenParams(
        token: envToken,
        expiresAt: DateTime.now().add(const Duration(days: 365)),
        scopes: ['public_repo', 'read:user'],
      ));
    }
  }

  // GitHub clients
  final graphqlClient = GitHubGraphQLClient(httpClient, tokenStorage);

  // Issue Discovery
  final issueRepository = IssueRepositoryImpl(graphqlClient);
  final searchIssuesUseCase = SearchGoodFirstIssues(issueRepository);

  runApp(ColaRecordsApp(
    graphqlClient: graphqlClient,
    searchIssuesUseCase: searchIssuesUseCase,
  ));
}

class ColaRecordsApp extends StatelessWidget {
  final GitHubGraphQLClient graphqlClient;
  final SearchGoodFirstIssues searchIssuesUseCase;

  const ColaRecordsApp({
    required this.graphqlClient,
    required this.searchIssuesUseCase,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<GitHubGraphQLClient>.value(value: graphqlClient),
      ],
      child: BlocProvider(
        create: (_) => IssueDiscoveryBloc(searchIssuesUseCase),
        child: MaterialApp(
          title: 'Cola Records',
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
            useMaterial3: true,
          ),
          home: const MainScreen(),
        ),
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;

  final List<NavItem> _navItems = const [
    NavItem(label: 'Dashboard', icon: Icons.dashboard, index: 0),
    NavItem(label: 'Good First Issues', icon: Icons.search, index: 1),
    NavItem(label: 'Contributions', icon: Icons.code, index: 2),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cola Records'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Row(
        children: [
          SidebarNavigation(
            selectedIndex: _selectedIndex,
            onDestinationSelected: (index) {
              setState(() => _selectedIndex = index);
            },
            items: _navItems,
          ),
          Expanded(
            child: _selectedIndex == 0
                ? const DashboardScreen()
                : _selectedIndex == 1
                    ? const IssueDiscoveryScreen()
                    : const ContributionsScreen(),
          ),
        ],
      ),
    );
  }
}
