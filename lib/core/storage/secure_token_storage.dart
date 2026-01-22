/// Secure token storage using flutter_secure_storage
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../error/exceptions.dart';

/// Parameters for saving a token
class TokenParams {
  final String token;
  final DateTime expiresAt;
  final List<String> scopes;

  const TokenParams({
    required this.token,
    required this.expiresAt,
    required this.scopes,
  });

  @override
  String toString() =>
      'TokenParams(token: [REDACTED], expiresAt: $expiresAt, scopes: $scopes)';
}

/// Secure storage for GitHub authentication tokens
class SecureTokenStorage {
  final FlutterSecureStorage _storage;

  SecureTokenStorage(this._storage);

  /// Save a GitHub token securely
  Future<void> saveToken(TokenParams params) async {
    try {
      await _storage.write(
        key: 'github_token',
        value: params.token,
      );
      await _storage.write(
        key: 'github_token_expiry',
        value: params.expiresAt.toIso8601String(),
      );
      await _storage.write(
        key: 'github_token_scopes',
        value: params.scopes.join(','),
      );
    } catch (e) {
      throw StorageException('Failed to save token: $e');
    }
  }

  /// Get the stored GitHub token
  /// Returns null if token doesn't exist or has expired
  Future<String?> getToken() async {
    try {
      final token = await _storage.read(key: 'github_token');
      final expiryStr = await _storage.read(key: 'github_token_expiry');

      if (token == null || expiryStr == null) {
        return null;
      }

      final expiry = DateTime.parse(expiryStr);
      if (DateTime.now().isAfter(expiry)) {
        await clearToken();
        return null;
      }

      return token;
    } catch (e) {
      throw StorageException('Failed to retrieve token: $e');
    }
  }

  /// Get token scopes
  Future<List<String>?> getTokenScopes() async {
    try {
      final scopesStr = await _storage.read(key: 'github_token_scopes');
      if (scopesStr == null || scopesStr.isEmpty) {
        return null;
      }
      return scopesStr.split(',');
    } catch (e) {
      throw StorageException('Failed to retrieve token scopes: $e');
    }
  }

  /// Clear the stored token
  Future<void> clearToken() async {
    try {
      await _storage.delete(key: 'github_token');
      await _storage.delete(key: 'github_token_expiry');
      await _storage.delete(key: 'github_token_scopes');
    } catch (e) {
      throw StorageException('Failed to clear token: $e');
    }
  }

  /// Check if a valid token exists
  Future<bool> hasValidToken() async {
    final token = await getToken();
    return token != null;
  }
}
