import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/result/result.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Result', () {
    group('Success', () {
      test('should create a successful result with data', () {
        // Arrange
        const testData = 'test data';

        // Act
        final result = Result.success(testData);

        // Assert
        expect(result.isSuccess, true);
        expect(result.isFailure, false);
        expect(result.data, testData);
        expect(result.error, null);
      });

      test('should execute success callback in when method', () {
        // Arrange
        const testData = 42;
        final result = Result.success(testData);

        // Act
        final output = result.when(
          success: (data) => 'Success: $data',
          failure: (error) => 'Failure: $error',
        );

        // Assert
        expect(output, 'Success: 42');
      });

      test('should map data correctly', () {
        // Arrange
        final result = Result.success(5);

        // Act
        final mapped = result.map((data) => data * 2);

        // Assert
        expect(mapped.isSuccess, true);
        expect(mapped.data, 10);
      });

      test('should be equal to another Success with same data', () {
        // Arrange
        final result1 = Result.success(100);
        final result2 = Result.success(100);

        // Assert
        expect(result1, result2);
        expect(result1.hashCode, result2.hashCode);
      });

      test('should not be equal to Success with different data', () {
        // Arrange
        final result1 = Result.success(100);
        final result2 = Result.success(200);

        // Assert
        expect(result1, isNot(result2));
      });
    });

    group('Failure', () {
      test('should create a failed result with error', () {
        // Arrange
        final testError = NetworkException('Test error');

        // Act
        final result = Result<String>.failure(testError);

        // Assert
        expect(result.isSuccess, false);
        expect(result.isFailure, true);
        expect(result.data, null);
        expect(result.error, testError);
      });

      test('should execute failure callback in when method', () {
        // Arrange
        final testError = NetworkException('Network error');
        final result = Result<int>.failure(testError);

        // Act
        final output = result.when(
          success: (data) => 'Success: $data',
          failure: (error) => 'Failure: ${error.toString()}',
        );

        // Assert
        expect(output, contains('Failure'));
        expect(output, contains('Network error'));
      });

      test('should preserve error when mapping', () {
        // Arrange
        final testError = AuthException('Auth failed');
        final result = Result<int>.failure(testError);

        // Act
        final mapped = result.map((data) => data * 2);

        // Assert
        expect(mapped.isFailure, true);
        expect(mapped.error, testError);
      });

      test('should be equal to another Failure with same error', () {
        // Arrange
        final error = NetworkException('Same error');
        final result1 = Result<String>.failure(error);
        final result2 = Result<String>.failure(error);

        // Assert
        expect(result1, result2);
        expect(result1.hashCode, result2.hashCode);
      });
    });

    group('Type safety', () {
      test('should work with different data types', () {
        // Arrange & Act
        final stringResult = Result.success('text');
        final intResult = Result.success(123);
        final listResult = Result.success([1, 2, 3]);

        // Assert
        expect(stringResult.data, isA<String>());
        expect(intResult.data, isA<int>());
        expect(listResult.data, isA<List<int>>());
      });

      test('should handle complex objects', () {
        // Arrange
        final testMap = {'key': 'value', 'number': 42};

        // Act
        final result = Result.success(testMap);

        // Assert
        expect(result.isSuccess, true);
        expect(result.data?['key'], 'value');
        expect(result.data?['number'], 42);
      });
    });

    group('toString', () {
      test('Success should have readable toString', () {
        // Arrange
        final result = Result.success('test');

        // Assert
        expect(result.toString(), contains('Success'));
        expect(result.toString(), contains('test'));
      });

      test('Failure should have readable toString', () {
        // Arrange
        final result = Result<int>.failure(NetworkException('error'));

        // Assert
        expect(result.toString(), contains('Failure'));
        expect(result.toString(), contains('error'));
      });
    });
  });
}
