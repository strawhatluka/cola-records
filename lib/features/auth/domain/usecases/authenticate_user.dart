/// Use case for authenticating a user
library;

import 'package:cola_records/core/result/result.dart';
import '../repositories/auth_repository.dart';

/// Use case for authenticating user with GitHub
class AuthenticateUser {
  final AuthRepository _repository;

  AuthenticateUser(this._repository);

  /// Execute authentication flow
  Future<Result<String>> execute() async {
    try {
      return await _repository.authenticateDeviceFlow();
    } catch (e) {
      return Result.failure(Exception('Authentication failed: $e'));
    }
  }
}
