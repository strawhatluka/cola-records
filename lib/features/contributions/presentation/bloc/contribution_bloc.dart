/// Contribution workflow BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../domain/entities/contribution.dart';
import '../../../shared/data/github_graphql_client.dart';
import '../../data/services/git_service.dart';
import '../../../settings/data/repositories/settings_repository.dart';

/// BLoC for managing contribution workflow
class ContributionBloc extends Bloc<ContributionEvent, ContributionState> {
  final GitHubGraphQLClient _githubClient;
  final GitService _gitService;
  final SettingsRepository _settingsRepository;

  ContributionBloc({
    required GitHubGraphQLClient githubClient,
    required GitService gitService,
    required SettingsRepository settingsRepository,
  })  : _githubClient = githubClient,
        _gitService = gitService,
        _settingsRepository = settingsRepository,
        super(ContributionInitial()) {
    on<StartContributionEvent>(_onStartContribution);
    on<ForkCompletedEvent>(_onForkCompleted);
    on<CloneCompletedEvent>(_onCloneCompleted);
    on<RemotesConfiguredEvent>(_onRemotesConfigured);
    on<ContributionErrorEvent>(_onContributionError);
  }

  /// Start the contribution workflow
  Future<void> _onStartContribution(
    StartContributionEvent event,
    Emitter<ContributionState> emit,
  ) async {
    try {
      // Validate git is installed
      final gitInstalled = await _gitService.isGitInstalled();
      if (!gitInstalled) {
        emit(ContributionError(
          'Git is not installed on your system. Please install Git to contribute.',
        ));
        return;
      }

      // Get contributions directory from settings
      final settings = await _settingsRepository.loadSettings();
      if (settings.contributionsDirectory.isEmpty) {
        emit(ContributionError(
          'Contributions directory not configured. Please set it in Settings.',
        ));
        return;
      }

      emit(ContributionForking(
        owner: event.owner,
        repoName: event.repoName,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));

      // Step 1: Fork the repository
      final forkResult = await _githubClient.forkRepository(
        owner: event.owner,
        name: event.repoName,
      );

      if (forkResult.isFailure) {
        emit(ContributionError(
          'Failed to fork repository: ${forkResult.error?.toString() ?? "Unknown error"}',
        ));
        return;
      }

      final forkData = forkResult.data!;
      final forkedRepo = forkData['repository'] as Map<String, dynamic>?;

      if (forkedRepo == null) {
        emit(ContributionError('Invalid fork response'));
        return;
      }

      final forkOwner = forkedRepo['owner']?['login'] as String?;
      final forkUrl = forkedRepo['url'] as String?;
      final upstreamUrl = forkData['upstreamUrl'] as String?;

      if (forkOwner == null || forkUrl == null || upstreamUrl == null) {
        emit(ContributionError('Missing fork data'));
        return;
      }

      // Dispatch fork completed event
      add(ForkCompletedEvent(
        owner: event.owner,
        repoName: event.repoName,
        forkOwner: forkOwner,
        forkUrl: forkUrl,
        upstreamUrl: upstreamUrl,
        contributionsDirectory: settings.contributionsDirectory,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));
    } catch (e) {
      emit(ContributionError('Unexpected error: $e'));
    }
  }

  /// Handle fork completion
  Future<void> _onForkCompleted(
    ForkCompletedEvent event,
    Emitter<ContributionState> emit,
  ) async {
    try {
      emit(ContributionCloning(
        owner: event.owner,
        repoName: event.repoName,
        forkUrl: event.forkUrl,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));

      // Step 2: Clone the forked repository
      final repoPath = await _gitService.cloneRepository(
        repoUrl: event.forkUrl,
        targetDirectory: event.contributionsDirectory,
        repoName: event.repoName,
      );

      // Dispatch clone completed event
      add(CloneCompletedEvent(
        owner: event.owner,
        repoName: event.repoName,
        forkUrl: event.forkUrl,
        upstreamUrl: event.upstreamUrl,
        repoPath: repoPath,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));
    } catch (e) {
      emit(ContributionError('Failed to clone repository: $e'));
    }
  }

  /// Handle clone completion
  Future<void> _onCloneCompleted(
    CloneCompletedEvent event,
    Emitter<ContributionState> emit,
  ) async {
    try {
      emit(ContributionSettingUpRemotes(
        owner: event.owner,
        repoName: event.repoName,
        localPath: event.repoPath,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));

      // Step 3: Setup git remotes (origin = fork, upstream = original)
      await _gitService.setupForkRemotes(
        repoPath: event.repoPath,
        forkUrl: event.forkUrl,
        upstreamUrl: event.upstreamUrl,
      );

      // Get current branch
      final currentBranch = await _gitService.getCurrentBranch(event.repoPath);

      // Dispatch remotes configured event
      add(RemotesConfiguredEvent(
        owner: event.owner,
        repoName: event.repoName,
        forkUrl: event.forkUrl,
        upstreamUrl: event.upstreamUrl,
        repoPath: event.repoPath,
        currentBranch: currentBranch,
        issueNumber: event.issueNumber,
        issueTitle: event.issueTitle,
      ));
    } catch (e) {
      emit(ContributionError('Failed to setup git remotes: $e'));
    }
  }

  /// Handle remotes configuration completion
  Future<void> _onRemotesConfigured(
    RemotesConfiguredEvent event,
    Emitter<ContributionState> emit,
  ) async {
    // Create contribution entity
    final contribution = Contribution(
      repoName: event.repoName,
      owner: event.owner,
      localPath: event.repoPath,
      forkUrl: event.forkUrl,
      upstreamUrl: event.upstreamUrl,
      status: ContributionStatus.ready,
      issueNumber: event.issueNumber,
      issueTitle: event.issueTitle,
      createdAt: DateTime.now(),
      lastUpdated: DateTime.now(),
      currentBranch: event.currentBranch,
    );

    emit(ContributionCompleted(contribution));
  }

  /// Handle contribution errors
  Future<void> _onContributionError(
    ContributionErrorEvent event,
    Emitter<ContributionState> emit,
  ) async {
    emit(ContributionError(event.message));
  }
}

// ============================================================================
// EVENTS
// ============================================================================

/// Base event for contribution workflow
abstract class ContributionEvent extends Equatable {
  const ContributionEvent();

  @override
  List<Object?> get props => [];
}

/// Event to start contribution workflow
class StartContributionEvent extends ContributionEvent {
  final String owner;
  final String repoName;
  final int issueNumber;
  final String issueTitle;

  const StartContributionEvent({
    required this.owner,
    required this.repoName,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [owner, repoName, issueNumber, issueTitle];
}

/// Event when fork is completed
class ForkCompletedEvent extends ContributionEvent {
  final String owner;
  final String repoName;
  final String forkOwner;
  final String forkUrl;
  final String upstreamUrl;
  final String contributionsDirectory;
  final int issueNumber;
  final String issueTitle;

  const ForkCompletedEvent({
    required this.owner,
    required this.repoName,
    required this.forkOwner,
    required this.forkUrl,
    required this.upstreamUrl,
    required this.contributionsDirectory,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [
        owner,
        repoName,
        forkOwner,
        forkUrl,
        upstreamUrl,
        contributionsDirectory,
        issueNumber,
        issueTitle,
      ];
}

/// Event when clone is completed
class CloneCompletedEvent extends ContributionEvent {
  final String owner;
  final String repoName;
  final String forkUrl;
  final String upstreamUrl;
  final String repoPath;
  final int issueNumber;
  final String issueTitle;

  const CloneCompletedEvent({
    required this.owner,
    required this.repoName,
    required this.forkUrl,
    required this.upstreamUrl,
    required this.repoPath,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [
        owner,
        repoName,
        forkUrl,
        upstreamUrl,
        repoPath,
        issueNumber,
        issueTitle,
      ];
}

/// Event when remotes are configured
class RemotesConfiguredEvent extends ContributionEvent {
  final String owner;
  final String repoName;
  final String forkUrl;
  final String upstreamUrl;
  final String repoPath;
  final String currentBranch;
  final int issueNumber;
  final String issueTitle;

  const RemotesConfiguredEvent({
    required this.owner,
    required this.repoName,
    required this.forkUrl,
    required this.upstreamUrl,
    required this.repoPath,
    required this.currentBranch,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [
        owner,
        repoName,
        forkUrl,
        upstreamUrl,
        repoPath,
        currentBranch,
        issueNumber,
        issueTitle,
      ];
}

/// Event for contribution errors
class ContributionErrorEvent extends ContributionEvent {
  final String message;

  const ContributionErrorEvent(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// STATES
// ============================================================================

/// Base state for contribution workflow
abstract class ContributionState extends Equatable {
  const ContributionState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class ContributionInitial extends ContributionState {}

/// Forking repository state
class ContributionForking extends ContributionState {
  final String owner;
  final String repoName;
  final int issueNumber;
  final String issueTitle;

  const ContributionForking({
    required this.owner,
    required this.repoName,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [owner, repoName, issueNumber, issueTitle];
}

/// Cloning repository state
class ContributionCloning extends ContributionState {
  final String owner;
  final String repoName;
  final String forkUrl;
  final int issueNumber;
  final String issueTitle;

  const ContributionCloning({
    required this.owner,
    required this.repoName,
    required this.forkUrl,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [owner, repoName, forkUrl, issueNumber, issueTitle];
}

/// Setting up git remotes state
class ContributionSettingUpRemotes extends ContributionState {
  final String owner;
  final String repoName;
  final String localPath;
  final int issueNumber;
  final String issueTitle;

  const ContributionSettingUpRemotes({
    required this.owner,
    required this.repoName,
    required this.localPath,
    required this.issueNumber,
    required this.issueTitle,
  });

  @override
  List<Object?> get props => [owner, repoName, localPath, issueNumber, issueTitle];
}

/// Contribution workflow completed
class ContributionCompleted extends ContributionState {
  final Contribution contribution;

  const ContributionCompleted(this.contribution);

  @override
  List<Object?> get props => [contribution];
}

/// Contribution workflow error
class ContributionError extends ContributionState {
  final String message;

  const ContributionError(this.message);

  @override
  List<Object?> get props => [message];
}
