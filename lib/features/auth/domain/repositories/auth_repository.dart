/// Authentication repository interface
library;

import 'package:cola_records/core/result/result.dart';

/// Repository for handling authentication operations
abstract class AuthRepository {
  /// Authenticate using GitHub device flow
  Future<Result<String>> authenticateDeviceFlow();

  /// Logout and clear stored credentials
  Future<Result<void>> logout();

  /// Check if user is authenticated
  Future<bool> isAuthenticated();

  /// Get current authenticated username
  Future<String?> getUsername();
}
