/// Settings data model for persistence
library;

import '../../domain/entities/app_settings.dart';

/// Data model for AppSettings entity
class SettingsModel extends AppSettings {
  const SettingsModel({
    required super.contributionsDirectory,
    required super.themeMode,
    required super.lastUpdated,
  });

  /// Convert from JSON
  factory SettingsModel.fromJson(Map<String, dynamic> json) {
    return SettingsModel(
      contributionsDirectory: json['contributionsDirectory'] as String? ?? '',
      themeMode: json['themeMode'] as String? ?? 'system',
      lastUpdated: json['lastUpdated'] != null
          ? DateTime.parse(json['lastUpdated'] as String)
          : DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'contributionsDirectory': contributionsDirectory,
      'themeMode': themeMode,
      'lastUpdated': lastUpdated.toIso8601String(),
    };
  }

  /// Convert from entity
  factory SettingsModel.fromEntity(AppSettings settings) {
    return SettingsModel(
      contributionsDirectory: settings.contributionsDirectory,
      themeMode: settings.themeMode,
      lastUpdated: settings.lastUpdated,
    );
  }

  /// Convert to entity
  AppSettings toEntity() {
    return AppSettings(
      contributionsDirectory: contributionsDirectory,
      themeMode: themeMode,
      lastUpdated: lastUpdated,
    );
  }
}
