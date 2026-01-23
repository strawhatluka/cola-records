/// Application settings entity
library;

import 'package:equatable/equatable.dart';

/// Application settings domain entity
class AppSettings extends Equatable {
  /// Directory where contributions are cloned
  final String contributionsDirectory;

  /// Theme mode preference
  final String themeMode;

  /// Last updated timestamp
  final DateTime lastUpdated;

  const AppSettings({
    required this.contributionsDirectory,
    this.themeMode = 'system',
    required this.lastUpdated,
  });

  /// Default settings with user's Documents/Contributions directory
  factory AppSettings.defaultSettings() {
    return AppSettings(
      contributionsDirectory: '', // Will be set to Documents/Contributions on first load
      themeMode: 'system',
      lastUpdated: DateTime.now(),
    );
  }

  /// Copy with method for immutability
  AppSettings copyWith({
    String? contributionsDirectory,
    String? themeMode,
    DateTime? lastUpdated,
  }) {
    return AppSettings(
      contributionsDirectory: contributionsDirectory ?? this.contributionsDirectory,
      themeMode: themeMode ?? this.themeMode,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  @override
  List<Object?> get props => [contributionsDirectory, themeMode, lastUpdated];
}
