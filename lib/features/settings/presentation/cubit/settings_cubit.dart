/// Settings state management
library;

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../domain/entities/app_settings.dart';
import '../../data/repositories/settings_repository.dart';

/// Settings Cubit for managing application settings
class SettingsCubit extends Cubit<SettingsState> {
  final SettingsRepository _repository;

  SettingsCubit(this._repository) : super(SettingsInitial());

  /// Load settings from repository
  Future<void> loadSettings() async {
    try {
      emit(SettingsLoading());
      final settings = await _repository.loadSettings();
      emit(SettingsLoaded(settings));
    } catch (e) {
      emit(SettingsError('Failed to load settings: $e'));
    }
  }

  /// Update contributions directory
  Future<void> updateContributionsDirectory(String directory) async {
    try {
      final currentState = state;
      if (currentState is! SettingsLoaded) {
        emit(SettingsError('Settings not loaded'));
        return;
      }

      emit(SettingsLoading());

      // Validate directory
      final isValid = await _repository.validateDirectory(directory);
      if (!isValid) {
        emit(SettingsError('Invalid directory or insufficient permissions'));
        emit(SettingsLoaded(currentState.settings));
        return;
      }

      // Update settings
      final updatedSettings = await _repository.updateContributionsDirectory(directory);
      emit(SettingsLoaded(updatedSettings));
    } catch (e) {
      emit(SettingsError('Failed to update directory: $e'));
    }
  }

  /// Update theme mode
  Future<void> updateThemeMode(String themeMode) async {
    try {
      final currentState = state;
      if (currentState is! SettingsLoaded) {
        emit(SettingsError('Settings not loaded'));
        return;
      }

      final updatedSettings = currentState.settings.copyWith(
        themeMode: themeMode,
        lastUpdated: DateTime.now(),
      );

      await _repository.saveSettings(updatedSettings);
      emit(SettingsLoaded(updatedSettings));
    } catch (e) {
      emit(SettingsError('Failed to update theme: $e'));
    }
  }
}

/// Settings state
abstract class SettingsState extends Equatable {
  const SettingsState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class SettingsInitial extends SettingsState {}

/// Loading state
class SettingsLoading extends SettingsState {}

/// Loaded state with settings
class SettingsLoaded extends SettingsState {
  final AppSettings settings;

  const SettingsLoaded(this.settings);

  @override
  List<Object?> get props => [settings];
}

/// Error state
class SettingsError extends SettingsState {
  final String message;

  const SettingsError(this.message);

  @override
  List<Object?> get props => [message];
}
