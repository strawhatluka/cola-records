/// Settings repository for persistence
library;

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';

import '../../domain/entities/app_settings.dart';
import '../models/settings_model.dart';

/// Repository for managing application settings persistence
class SettingsRepository {
  static const String _settingsKey = 'app_settings';

  final SharedPreferences _prefs;

  SettingsRepository(this._prefs);

  /// Load settings from shared preferences
  Future<AppSettings> loadSettings() async {
    try {
      final jsonString = _prefs.getString(_settingsKey);

      if (jsonString != null) {
        final json = jsonDecode(jsonString) as Map<String, dynamic>;
        return SettingsModel.fromJson(json).toEntity();
      }

      // First time - create default settings with proper contributions directory
      final defaultDir = await _getDefaultContributionsDirectory();
      final defaultSettings = AppSettings(
        contributionsDirectory: defaultDir,
        themeMode: 'system',
        lastUpdated: DateTime.now(),
      );

      // Save default settings
      await saveSettings(defaultSettings);

      return defaultSettings;
    } catch (e) {
      // On error, return default settings
      final defaultDir = await _getDefaultContributionsDirectory();
      return AppSettings(
        contributionsDirectory: defaultDir,
        themeMode: 'system',
        lastUpdated: DateTime.now(),
      );
    }
  }

  /// Save settings to shared preferences
  Future<void> saveSettings(AppSettings settings) async {
    try {
      final model = SettingsModel.fromEntity(settings);
      final jsonString = jsonEncode(model.toJson());
      await _prefs.setString(_settingsKey, jsonString);
    } catch (e) {
      throw Exception('Failed to save settings: $e');
    }
  }

  /// Update contributions directory
  Future<AppSettings> updateContributionsDirectory(String directory) async {
    final currentSettings = await loadSettings();
    final updatedSettings = currentSettings.copyWith(
      contributionsDirectory: directory,
      lastUpdated: DateTime.now(),
    );
    await saveSettings(updatedSettings);
    return updatedSettings;
  }

  /// Get default contributions directory (Documents/Contributions)
  Future<String> _getDefaultContributionsDirectory() async {
    try {
      final documentsDir = await getApplicationDocumentsDirectory();
      final contributionsDir = path.join(documentsDir.path, 'Contributions');

      // Create directory if it doesn't exist
      final dir = Directory(contributionsDir);
      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }

      return contributionsDir;
    } catch (e) {
      // Fallback to current directory
      return Directory.current.path;
    }
  }

  /// Validate and ensure directory exists
  Future<bool> validateDirectory(String directory) async {
    try {
      final dir = Directory(directory);

      // Check if directory exists
      if (!await dir.exists()) {
        // Try to create it
        await dir.create(recursive: true);
      }

      // Verify it's writable
      final testFile = File(path.join(directory, '.cola_test'));
      await testFile.writeAsString('test');
      await testFile.delete();

      return true;
    } catch (e) {
      return false;
    }
  }
}
