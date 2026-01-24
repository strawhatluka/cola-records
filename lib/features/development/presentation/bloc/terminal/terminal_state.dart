/// Terminal states
library;

import 'package:equatable/equatable.dart';

import '../../../domain/entities/terminal_session.dart';

/// Base state for terminal
abstract class TerminalState extends Equatable {
  const TerminalState();

  @override
  List<Object?> get props => [];
}

/// Initial state - no terminal session
class TerminalInitial extends TerminalState {
  const TerminalInitial();
}

/// Terminal is initializing
class TerminalInitializing extends TerminalState {
  const TerminalInitializing();
}

/// Terminal is ready and running
class TerminalReady extends TerminalState {
  final TerminalSession session;

  const TerminalReady(this.session);

  @override
  List<Object?> get props => [session];

  /// Create a copy with modified session
  TerminalReady copyWith({TerminalSession? session}) {
    return TerminalReady(session ?? this.session);
  }
}

/// Terminal error occurred
class TerminalError extends TerminalState {
  final String message;

  const TerminalError(this.message);

  @override
  List<Object?> get props => [message];
}

/// Terminal session disposed
class TerminalDisposed extends TerminalState {
  const TerminalDisposed();
}
