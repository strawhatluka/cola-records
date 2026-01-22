/// Implementation of authentication repository
library;

import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/network/http_client.dart';
import 'package:cola_records/core/network/request_config.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:cola_records/core/storage/secure_token_storage.dart';
import 'package:cola_records/features/auth/domain/repositories/auth_repository.dart';

/// Implementation of AuthRepository using GitHub device flow
class AuthRepositoryImpl implements AuthRepository {
  final HttpClient _httpClient;
  final SecureTokenStorage _tokenStorage;

  AuthRepositoryImpl(this._httpClient, this._tokenStorage);

  @override
  Future<Result<String>> authenticateDeviceFlow() async {
    try {
      // For MVP: Simplified authentication - user provides personal access token
      // Full device flow implementation deferred to post-MVP

      // Note: In production, this would implement full OAuth device flow:
      // 1. Request device code
      // 2. Show user code and verification URL
      // 3. Poll for token
      // 4. Store token securely

      return Result.failure(
        AuthException('Device flow not yet implemented. Use personal access token.'),
      );
    } catch (e) {
      return Result.failure(AuthException('Authentication failed: $e'));
    }
  }

  @override
  Future<Result<void>> logout() async {
    try {
      await _tokenStorage.clearToken();
      return Result.success(null);
    } catch (e) {
      return Result.failure(AuthException('Logout failed: $e'));
    }
  }

  @override
  Future<bool> isAuthenticated() async {
    return await _tokenStorage.hasValidToken();
  }

  @override
  Future<String?> getUsername() async {
    try {
      final hasToken = await isAuthenticated();
      if (!hasToken) return null;

      final config = RequestConfig(
        url: '${ApiConstants.githubRestBaseUrl}/user',
        headers: await _authHeaders(),
      );

      final result = await _httpClient.get(config);

      return result.when(
        success: (response) {
          final data = response.data as Map<String, dynamic>;
          return data['login'] as String?;
        },
        failure: (_) => null,
      );
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _tokenStorage.getToken();
    return {
      'Authorization': 'Bearer $token',
      'Accept': ApiConstants.apiVersionHeader,
    };
  }
}
