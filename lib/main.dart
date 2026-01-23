import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
import 'features/contributions/presentation/bloc/contribution_bloc.dart';
import 'features/contributions/data/services/git_service.dart';
import 'features/contributions/data/repositories/contribution_repository_impl.dart';

// Settings
import 'features/settings/presentation/screens/settings_screen.dart';
import 'features/settings/presentation/cubit/settings_cubit.dart';
import 'features/settings/data/repositories/settings_repository.dart';

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

  // Settings
  final sharedPrefs = await SharedPreferences.getInstance();
  final settingsRepository = SettingsRepository(sharedPrefs);

  // Contributions
  final gitService = GitService();
  final contributionRepository = ContributionRepositoryImpl(sharedPrefs);

  runApp(ColaRecordsApp(
    graphqlClient: graphqlClient,
    searchIssuesUseCase: searchIssuesUseCase,
    settingsRepository: settingsRepository,
    gitService: gitService,
    contributionRepository: contributionRepository,
  ));
}

class ColaRecordsApp extends StatelessWidget {
  final GitHubGraphQLClient graphqlClient;
  final SearchGoodFirstIssues searchIssuesUseCase;
  final SettingsRepository settingsRepository;
  final GitService gitService;
  final ContributionRepositoryImpl contributionRepository;

  const ColaRecordsApp({
    required this.graphqlClient,
    required this.searchIssuesUseCase,
    required this.settingsRepository,
    required this.gitService,
    required this.contributionRepository,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<GitHubGraphQLClient>.value(value: graphqlClient),
        RepositoryProvider<SettingsRepository>.value(value: settingsRepository),
        RepositoryProvider<GitService>.value(value: gitService),
        RepositoryProvider<ContributionRepositoryImpl>.value(value: contributionRepository),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => IssueDiscoveryBloc(searchIssuesUseCase),
          ),
          BlocProvider(
            create: (_) => SettingsCubit(settingsRepository)..loadSettings(),
          ),
          BlocProvider(
            create: (_) => ContributionBloc(
              githubClient: graphqlClient,
              gitService: gitService,
              settingsRepository: settingsRepository,
            ),
          ),
        ],
        child: BlocBuilder<SettingsCubit, SettingsState>(
          builder: (context, state) {
            ThemeMode themeMode = ThemeMode.system;

            if (state is SettingsLoaded) {
              switch (state.settings.themeMode) {
                case 'light':
                  themeMode = ThemeMode.light;
                  break;
                case 'dark':
                  themeMode = ThemeMode.dark;
                  break;
                case 'system':
                default:
                  themeMode = ThemeMode.system;
                  break;
              }
            }

            return MaterialApp(
              title: 'Cola Records',
              theme: ThemeData(
                colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
                useMaterial3: true,
              ),
              darkTheme: ThemeData(
                colorScheme: ColorScheme.fromSeed(
                  seedColor: const Color(0xFF7C4DFF), // Deep glossy purple seed
                  brightness: Brightness.dark,
                ).copyWith(
                  primary: const Color(0xFF7C4DFF), // Deep glossy purple
                  secondary: const Color(0xFF40C4FF), // Bright glossy cyan
                  tertiary: const Color(0xFF69F0AE), // Bright glossy green
                  error: const Color(0xFFFF5252), // Bright glossy red
                  primaryContainer: const Color(0xFF6A3FD9), // Even deeper vibrant purple
                  secondaryContainer: const Color(0xFF00B0FF), // Deeper vibrant cyan
                  inversePrimary: const Color(0xFF9575CD), // Lighter purple for inverse
                ),
                appBarTheme: const AppBarTheme(
                  backgroundColor: Color(0xFF6A3FD9), // Deep glossy purple for app bar
                  foregroundColor: Colors.white,
                  elevation: 0,
                ),
                useMaterial3: true,
              ),
              themeMode: themeMode,
              home: const MainScreen(),
            );
          },
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
    NavItem(label: 'Settings', icon: Icons.settings, index: 3),
  ];

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cola Records'),
        backgroundColor: isDarkMode
            ? const Color(0xFF5E35B1)  // Dark glossy royal purple for dark mode
            : Theme.of(context).colorScheme.inversePrimary,
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
                    : _selectedIndex == 2
                        ? const ContributionsScreen()
                        : const SettingsScreen(),
          ),
        ],
      ),
    );
  }
}
