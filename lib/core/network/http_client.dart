/// HTTP client wrapper for API requests
library;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../error/exceptions.dart';
import '../result/result.dart';
import 'request_config.dart';

/// HTTP response wrapper
class HttpResponse<T> {
  final T data;
  final int statusCode;
  final Map<String, dynamic> headers;

  const HttpResponse({
    required this.data,
    required this.statusCode,
    required this.headers,
  });
}

/// HTTP client for making API requests
class HttpClient {
  final Dio _dio;

  HttpClient(this._dio);

  /// Performs a GET request
  Future<Result<HttpResponse>> get(RequestConfig config) async {
    try {
      final response = await _dio.get(
        config.url,
        options: Options(
          headers: config.headers,
          sendTimeout: config.timeout,
          receiveTimeout: config.timeout,
        ),
      );

      return Result.success(HttpResponse(
        data: response.data,
        statusCode: response.statusCode ?? 200,
        headers: _convertHeaders(response.headers),
      ));
    } on DioException catch (e) {
      return Result.failure(_mapDioError(e));
    } catch (e) {
      return Result.failure(NetworkException('Unexpected error: $e'));
    }
  }

  /// Performs a POST request
  Future<Result<HttpResponse>> post(
    RequestConfig config, {
    required Map<String, dynamic> body,
  }) async {
    try {
      debugPrint('🌐 POST ${config.url}');
      debugPrint('📤 Body: $body');

      final response = await _dio.post(
        config.url,
        data: body,
        options: Options(
          headers: config.headers,
          sendTimeout: config.timeout,
          receiveTimeout: config.timeout,
        ),
      );

      debugPrint('✓ Response ${response.statusCode}: ${response.data?.toString().substring(0, 100)}...');

      return Result.success(HttpResponse(
        data: response.data,
        statusCode: response.statusCode ?? 200,
        headers: _convertHeaders(response.headers),
      ));
    } on DioException catch (e) {
      debugPrint('✗ DioException: ${e.type} - ${e.message}');
      debugPrint('  Response: ${e.response?.data}');
      return Result.failure(_mapDioError(e));
    } catch (e) {
      debugPrint('✗ Unexpected error: $e');
      return Result.failure(NetworkException('Unexpected error: $e'));
    }
  }

  /// Maps Dio errors to custom exceptions
  Exception _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return NetworkException('Connection timeout');

      case DioExceptionType.connectionError:
        return NetworkException('Connection error: ${e.message}');

      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        if (statusCode == 403) {
          // Check if it's a rate limit error
          final rateLimitRemaining =
              e.response?.headers['x-ratelimit-remaining']?.first;
          if (rateLimitRemaining == '0') {
            final resetTime = e.response?.headers['x-ratelimit-reset']?.first;
            final resetAt = resetTime != null
                ? DateTime.fromMillisecondsSinceEpoch(
                    int.parse(resetTime) * 1000,
                  )
                : DateTime.now().add(const Duration(hours: 1));
            return RateLimitException(resetAt);
          }
        }

        if (statusCode == 401 || statusCode == 403) {
          return AuthException('Authentication failed');
        }

        if (statusCode == 404) {
          return NetworkException('Resource not found');
        }

        return NetworkException(
          'HTTP $statusCode: ${e.response?.statusMessage ?? "Unknown error"}',
        );

      default:
        return NetworkException(e.message ?? 'Unknown network error');
    }
  }

  /// Converts Dio headers to Map
  Map<String, dynamic> _convertHeaders(Headers headers) {
    final map = <String, dynamic>{};
    headers.forEach((key, values) {
      if (values.isNotEmpty) {
        map[key] = values.length == 1 ? values.first : values;
      }
    });
    return map;
  }
}
