/// Settings screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:file_picker/file_picker.dart';

import '../cubit/settings_cubit.dart';

/// Settings screen for configuring application preferences
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _pendingDirectory;
  String? _pendingThemeMode;
  bool _hasChanges = false;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SettingsCubit, SettingsState>(
      builder: (context, state) {
        if (state is SettingsInitial || state is SettingsLoading) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        if (state is SettingsError) {
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
                  'Error loading settings',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  state.message,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () {
                    context.read<SettingsCubit>().loadSettings();
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        if (state is SettingsLoaded) {
          // Reset pending values when state updates
          if (!_hasChanges) {
            _pendingDirectory = state.settings.contributionsDirectory;
            _pendingThemeMode = state.settings.themeMode;
          }

          return Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Text(
                      'Settings',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Configure your Cola Records preferences',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 32),

                    Expanded(
                      child: SingleChildScrollView(
                        child: Column(
                          children: [
                            // Contributions Directory Section
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.folder_outlined,
                                          color: Theme.of(context).colorScheme.primary,
                                        ),
                                        const SizedBox(width: 12),
                                        Text(
                                          'Contributions Directory',
                                          style: Theme.of(context).textTheme.titleMedium,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'Location where forked repositories will be cloned',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                                          ),
                                    ),
                                    const SizedBox(height: 16),
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.folder,
                                            size: 20,
                                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              _pendingDirectory?.isNotEmpty == true
                                                  ? _pendingDirectory!
                                                  : 'No directory selected',
                                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                                    fontFamily: 'monospace',
                                                  ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    ElevatedButton.icon(
                                      onPressed: () async {
                                        final result = await FilePicker.platform.getDirectoryPath(
                                          dialogTitle: 'Select Contributions Directory',
                                          initialDirectory: _pendingDirectory,
                                        );

                                        if (result != null && mounted) {
                                          setState(() {
                                            _pendingDirectory = result;
                                            _hasChanges = _pendingDirectory != state.settings.contributionsDirectory ||
                                                _pendingThemeMode != state.settings.themeMode;
                                          });
                                        }
                                      },
                                      icon: const Icon(Icons.folder_open),
                                      label: const Text('Change Directory'),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            const SizedBox(height: 16),

                            // Theme Section
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.palette_outlined,
                                          color: Theme.of(context).colorScheme.primary,
                                        ),
                                        const SizedBox(width: 12),
                                        Text(
                                          'Theme',
                                          style: Theme.of(context).textTheme.titleMedium,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'Choose your preferred theme',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                                          ),
                                    ),
                                    const SizedBox(height: 16),
                                    SegmentedButton<String>(
                                      segments: const [
                                        ButtonSegment(
                                          value: 'system',
                                          label: Text('System'),
                                          icon: Icon(Icons.brightness_auto),
                                        ),
                                        ButtonSegment(
                                          value: 'light',
                                          label: Text('Light'),
                                          icon: Icon(Icons.light_mode),
                                        ),
                                        ButtonSegment(
                                          value: 'dark',
                                          label: Text('Dark'),
                                          icon: Icon(Icons.dark_mode),
                                        ),
                                      ],
                                      selected: {_pendingThemeMode ?? 'system'},
                                      onSelectionChanged: (Set<String> selection) {
                                        setState(() {
                                          _pendingThemeMode = selection.first;
                                          _hasChanges = _pendingDirectory != state.settings.contributionsDirectory ||
                                              _pendingThemeMode != state.settings.themeMode;
                                        });
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            const SizedBox(height: 80), // Space for save button
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Save button (appears when there are changes)
              if (_hasChanges)
                Positioned(
                  bottom: 24,
                  right: 24,
                  child: FloatingActionButton.extended(
                    onPressed: () async {
                      final cubit = context.read<SettingsCubit>();
                      final messenger = ScaffoldMessenger.of(context);

                      // Update directory if changed
                      if (_pendingDirectory != state.settings.contributionsDirectory) {
                        await cubit.updateContributionsDirectory(_pendingDirectory!);
                      }

                      // Update theme if changed
                      if (_pendingThemeMode != state.settings.themeMode) {
                        await cubit.updateThemeMode(_pendingThemeMode!);
                      }

                      setState(() {
                        _hasChanges = false;
                      });

                      if (mounted) {
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text('Settings saved successfully'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.save),
                    label: const Text('Save Changes'),
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  ),
                ),
            ],
          );
        }

        return const SizedBox.shrink();
      },
    );
  }
}
