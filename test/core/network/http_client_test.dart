import 'package:cola_records/core/error/exceptions.dart';
import 'package:cola_records/core/network/http_client.dart';
import 'package:cola_records/core/network/request_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio mockDio;
  late HttpClient httpClient;

  setUp(() {
    mockDio = MockDio();
    httpClient = HttpClient(mockDio);
  });

  setUpAll(() {
    registerFallbackValue(Options());
  });

  group('HttpClient', () {
    group('get', () {
      test('should return success with data when request succeeds', () async {
        // Arrange
        const config = RequestConfig(url: 'https://api.example.com/data');
        final responseData = {'key': 'value'};
        final response = Response(
          requestOptions: RequestOptions(path: config.url),
          data: responseData,
          statusCode: 200,
        );

        when(() => mockDio.get(
              any(),
              options: any(named: 'options'),
            )).thenAnswer((_) async => response);

        // Act
        final result = await httpClient.get(config);

        // Assert
        expect(result.isSuccess, true);
        expect(result.data?.data, responseData);
        expect(result.data?.statusCode, 200);
      });

      test('should return NetworkException on connection timeout', () async {
        // Arrange
        const config = RequestConfig(url: 'https://api.example.com/data');

        when(() => mockDio.get(
              any(),
              options: any(named: 'options'),
            )).thenThrow(
          DioException(
            requestOptions: RequestOptions(path: config.url),
            type: DioExceptionType.connectionTimeout,
          ),
        );

        // Act
        final result = await httpClient.get(config);

        // Assert
        expect(result.isFailure, true);
        expect(result.error, isA<NetworkException>());
      });

      test('should return RateLimitException when rate limit exceeded',
          () async {
        // Arrange
        const config = RequestConfig(url: 'https://api.example.com/data');
        final resetTime =
            DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch ~/
                1000;

        when(() => mockDio.get(
              any(),
              options: any(named: 'options'),
            )).thenThrow(
          DioException(
            requestOptions: RequestOptions(path: config.url),
            response: Response(
              requestOptions: RequestOptions(path: config.url),
              statusCode: 403,
              headers: Headers.fromMap({
                'x-ratelimit-remaining': ['0'],
                'x-ratelimit-reset': [resetTime.toString()],
              }),
            ),
            type: DioExceptionType.badResponse,
          ),
        );

        // Act
        final result = await httpClient.get(config);

        // Assert
        expect(result.isFailure, true);
        expect(result.error, isA<RateLimitException>());
      });

      test('should return AuthException on 401 status', () async {
        // Arrange
        const config = RequestConfig(url: 'https://api.example.com/data');

        when(() => mockDio.get(
              any(),
              options: any(named: 'options'),
            )).thenThrow(
          DioException(
            requestOptions: RequestOptions(path: config.url),
            response: Response(
              requestOptions: RequestOptions(path: config.url),
              statusCode: 401,
            ),
            type: DioExceptionType.badResponse,
          ),
        );

        // Act
        final result = await httpClient.get(config);

        // Assert
        expect(result.isFailure, true);
        expect(result.error, isA<AuthException>());
      });
    });

    group('post', () {
      test('should return success with data when POST succeeds', () async {
        // Arrange
        const config = RequestConfig(url: 'https://api.example.com/data');
        final requestBody = {'input': 'value'};
        final responseData = {'result': 'success'};
        final response = Response(
          requestOptions: RequestOptions(path: config.url),
          data: responseData,
          statusCode: 201,
        );

        when(() => mockDio.post(
              any(),
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => response);

        // Act
        final result = await httpClient.post(config, body: requestBody);

        // Assert
        expect(result.isSuccess, true);
        expect(result.data?.data, responseData);
        expect(result.data?.statusCode, 201);
      });

      test('should include custom headers in request', () async {
        // Arrange
        const config = RequestConfig(
          url: 'https://api.example.com/data',
          headers: {'Authorization': 'Bearer token123'},
        );
        final requestBody = {'data': 'test'};

        when(() => mockDio.post(
              any(),
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => Response(
              requestOptions: RequestOptions(path: config.url),
              data: {},
              statusCode: 200,
            ));

        // Act
        await httpClient.post(config, body: requestBody);

        // Assert
        verify(() => mockDio.post(
              config.url,
              data: requestBody,
              options: any(
                named: 'options',
                that: predicate<Options>((opts) =>
                    opts.headers?['Authorization'] == 'Bearer token123'),
              ),
            )).called(1);
      });
    });
  });
}
