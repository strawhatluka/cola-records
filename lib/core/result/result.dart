/// Result type for handling success/failure responses
library;

/// Sealed class representing either success or failure
sealed class Result<T> {
  const Result();

  /// Creates a successful result
  factory Result.success(T data) = Success<T>;

  /// Creates a failed result
  factory Result.failure(Exception error) = Failure<T>;

  /// Returns true if this is a successful result
  bool get isSuccess => this is Success<T>;

  /// Returns true if this is a failed result
  bool get isFailure => this is Failure<T>;

  /// Returns the data if successful, null otherwise
  T? get data => isSuccess ? (this as Success<T>).data : null;

  /// Returns the error if failed, null otherwise
  Exception? get error => isFailure ? (this as Failure<T>).error : null;

  /// Execute a function based on success or failure
  R when<R>({
    required R Function(T data) success,
    required R Function(Exception error) failure,
  }) {
    if (this is Success<T>) {
      return success((this as Success<T>).data);
    } else {
      return failure((this as Failure<T>).error);
    }
  }

  /// Map the data if successful
  Result<R> map<R>(R Function(T data) transform) {
    if (this is Success<T>) {
      return Result.success(transform((this as Success<T>).data));
    } else {
      return Result.failure((this as Failure<T>).error);
    }
  }
}

/// Represents a successful result
class Success<T> extends Result<T> {
  @override
  final T data;

  const Success(this.data);

  @override
  String toString() => 'Success(data: $data)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Success<T> &&
          runtimeType == other.runtimeType &&
          data == other.data;

  @override
  int get hashCode => data.hashCode;
}

/// Represents a failed result
class Failure<T> extends Result<T> {
  @override
  final Exception error;

  const Failure(this.error);

  @override
  String toString() => 'Failure(error: $error)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Failure<T> &&
          runtimeType == other.runtimeType &&
          error == other.error;

  @override
  int get hashCode => error.hashCode;
}
