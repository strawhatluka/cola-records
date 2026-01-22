/// Cache repository for storing API responses
library;

import 'dart:convert';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:cola_records/core/constants/api_constants.dart';
import 'package:cola_records/core/error/exceptions.dart';

/// Cache key for identifying cached data
class CacheKey {
  final String key;

  const CacheKey(this.key);

  @override
  String toString() => key;
}

/// Parameters for setting cache data
class CacheParams {
  final CacheKey key;
  final dynamic value;
  final Duration ttl;

  CacheParams({
    required this.key,
    required this.value,
    Duration? ttl,
  }) : ttl = ttl ?? const Duration(hours: ApiConstants.cacheTtlHours);
}

/// Cached data with expiry
class CachedData {
  final String key;
  final String value;
  final DateTime expiresAt;

  CachedData({
    required this.key,
    required this.value,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// Repository for caching API responses using SQLite
class CacheRepository {
  Database? _database;

  /// Initialize the cache database
  Future<void> initialize() async {
    try {
      sqfliteFfiInit();
      final databaseFactory = databaseFactoryFfi;

      _database = await databaseFactory.openDatabase(
        'cola_records_cache.db',
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: (db, version) async {
            await db.execute('''
              CREATE TABLE cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL
              )
            ''');

            await db.execute('''
              CREATE INDEX idx_expires_at ON cache(expires_at)
            ''');
          },
        ),
      );

      // Clean up expired entries on initialization
      await _cleanupExpired();
    } catch (e) {
      throw CacheException('Failed to initialize cache: $e');
    }
  }

  /// Get cached data by key
  Future<CachedData?> get(CacheKey key) async {
    if (_database == null) {
      await initialize();
    }

    try {
      final results = await _database!.query(
        'cache',
        where: 'key = ?',
        whereArgs: [key.toString()],
      );

      if (results.isEmpty) {
        return null;
      }

      final data = CachedData(
        key: results.first['key'] as String,
        value: results.first['value'] as String,
        expiresAt: DateTime.fromMillisecondsSinceEpoch(
          results.first['expires_at'] as int,
        ),
      );

      // Check if expired
      if (data.isExpired) {
        await delete(key);
        return null;
      }

      return data;
    } catch (e) {
      throw CacheException('Failed to get cached data: $e');
    }
  }

  /// Set cached data
  Future<void> set(CacheParams params) async {
    if (_database == null) {
      await initialize();
    }

    try {
      final expiresAt = DateTime.now().add(params.ttl);
      final value = jsonEncode(params.value);

      await _database!.insert(
        'cache',
        {
          'key': params.key.toString(),
          'value': value,
          'expires_at': expiresAt.millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    } catch (e) {
      throw CacheException('Failed to set cached data: $e');
    }
  }

  /// Delete cached data by key
  Future<void> delete(CacheKey key) async {
    if (_database == null) return;

    try {
      await _database!.delete(
        'cache',
        where: 'key = ?',
        whereArgs: [key.toString()],
      );
    } catch (e) {
      throw CacheException('Failed to delete cached data: $e');
    }
  }

  /// Clear all cached data
  Future<void> clear() async {
    if (_database == null) return;

    try {
      await _database!.delete('cache');
    } catch (e) {
      throw CacheException('Failed to clear cache: $e');
    }
  }

  /// Clean up expired entries
  Future<void> _cleanupExpired() async {
    if (_database == null) return;

    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      await _database!.delete(
        'cache',
        where: 'expires_at < ?',
        whereArgs: [now],
      );
    } catch (e) {
      // Silently fail cleanup
    }
  }

  /// Close the database
  Future<void> close() async {
    await _database?.close();
    _database = null;
  }
}
