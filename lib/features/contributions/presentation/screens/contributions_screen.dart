/// Contributions screen
library;

import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/entities/contribution.dart';
import '../../data/repositories/contribution_repository_impl.dart';
import '../../../settings/data/repositories/settings_repository.dart';
import '../widgets/contribution_card.dart';

/// Main contributions screen showing user contributions
class ContributionsScreen extends StatefulWidget {
  const ContributionsScreen({super.key});

  @override
  State<ContributionsScreen> createState() => _ContributionsScreenState();
}

class _ContributionsScreenState extends State<ContributionsScreen> {
  List<Contribution> _contributions = [];
  bool _isLoading = true;
  String? _error;
  StreamSubscription<FileSystemEvent>? _watcher;
  String? _watchedDirectory;

  @override
  void initState() {
    super.initState();
    _loadContributions();
  }

  @override
  void dispose() {
    _watcher?.cancel();
    super.dispose();
  }

  Future<void> _loadContributions() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      // Get repositories
      final prefs = await SharedPreferences.getInstance();
      final repository = ContributionRepositoryImpl(prefs);
      final settingsRepository = SettingsRepository(prefs);

      // Get saved contributions
      final savedContributions = await repository.getAllContributions();

      // Get contributions directory
      final settings = await settingsRepository.loadSettings();
      final contributionsDir = settings.contributionsDirectory;

      // Set up file system watcher if directory changed
      if (_watchedDirectory != contributionsDir) {
        await _watcher?.cancel();
        _watchedDirectory = contributionsDir;

        final dir = Directory(contributionsDir);
        if (await dir.exists()) {
          _watcher = dir.watch(events: FileSystemEvent.all).listen(
            (event) {
              // Debounce: reload after a short delay to batch multiple events
              Future.delayed(const Duration(milliseconds: 500), () {
                if (mounted) {
                  _loadContributions();
                }
              });
            },
            onError: (error) {
              // Ignore watcher errors (directory deleted, etc.)
            },
          );
        }
      }

      // Scan directory for additional contributions
      final scannedContributions = await repository.scanDirectory(
        contributionsDir,
      );

      // Merge saved and scanned (prioritize saved)
      final allContributions = <Contribution>[];
      final seenPaths = <String>{};

      // Add saved contributions first
      for (final contribution in savedContributions) {
        allContributions.add(contribution);
        seenPaths.add(contribution.localPath);
      }

      // Add scanned contributions that aren't already saved
      for (final contribution in scannedContributions) {
        if (!seenPaths.contains(contribution.localPath)) {
          allContributions.add(contribution);
        }
      }

      // Sort by last updated (most recent first)
      allContributions.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));

      if (mounted) {
        setState(() {
          _contributions = allContributions;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load contributions: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _deleteContribution(Contribution contribution) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final repository = ContributionRepositoryImpl(prefs);

      await repository.deleteContribution(contribution.localPath);

      // Reload list
      await _loadContributions();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Contribution removed from list')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to remove contribution: $e')),
        );
      }
    }
  }

  Future<void> _openInExplorer(Contribution contribution) async {
    try {
      final directory = Directory(contribution.localPath);

      if (!await directory.exists()) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Directory no longer exists')),
          );
        }
        return;
      }

      // Open in file explorer
      if (Platform.isWindows) {
        await Process.run('explorer', [contribution.localPath]);
      } else if (Platform.isMacOS) {
        await Process.run('open', [contribution.localPath]);
      } else if (Platform.isLinux) {
        await Process.run('xdg-open', [contribution.localPath]);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to open directory: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              'Error',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadContributions,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_contributions.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inbox_outlined,
              size: 80,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 24),
            Text(
              'No Contributions Yet',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 16),
            Text(
              'Click "Contribute" on an issue to get started!',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.all(24.0),
          child: Row(
            children: [
              Text(
                'My Contributions',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(width: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_contributions.length}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: _loadContributions,
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh',
              ),
            ],
          ),
        ),

        // Contributions list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            itemCount: _contributions.length,
            itemBuilder: (context, index) {
              final contribution = _contributions[index];
              return ContributionCard(
                contribution: contribution,
                onDelete: () => _showDeleteConfirmation(contribution),
                onOpenInExplorer: () => _openInExplorer(contribution),
              );
            },
          ),
        ),
      ],
    );
  }

  void _showDeleteConfirmation(Contribution contribution) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Contribution'),
        content: Text(
          'Remove "${contribution.fullRepoName}" from the contributions list?\n\nThis will not delete the local repository.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              _deleteContribution(contribution);
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}
