/// Configuration for HTTP requests
library;

/// Value object for HTTP request configuration
class RequestConfig {
  final String url;
  final Map<String, String> headers;
  final Duration timeout;

  const RequestConfig({
    required this.url,
    this.headers = const {},
    this.timeout = const Duration(seconds: 30),
  });

  @override
  String toString() =>
      'RequestConfig(url: $url, headers: $headers, timeout: $timeout)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RequestConfig &&
          runtimeType == other.runtimeType &&
          url == other.url &&
          _mapsEqual(headers, other.headers) &&
          timeout == other.timeout;

  @override
  int get hashCode => Object.hash(url, headers, timeout);

  bool _mapsEqual(Map<String, String> a, Map<String, String> b) {
    if (a.length != b.length) return false;
    for (final key in a.keys) {
      if (a[key] != b[key]) return false;
    }
    return true;
  }
}
