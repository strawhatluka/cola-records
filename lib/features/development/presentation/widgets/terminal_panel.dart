/// Terminal panel widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:xterm/xterm.dart' as xterm;

import '../bloc/terminal/terminal_bloc.dart';
import '../bloc/terminal/terminal_event.dart';
import '../bloc/terminal/terminal_state.dart';

/// Terminal panel widget with xterm interface
class TerminalPanel extends StatefulWidget {
  const TerminalPanel({super.key});

  @override
  State<TerminalPanel> createState() => _TerminalPanelState();
}

class _TerminalPanelState extends State<TerminalPanel> {
  late final xterm.Terminal _terminal;
  late final xterm.TerminalController _controller;
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _terminal = xterm.Terminal(
      maxLines: 10000,
    );
    _controller = xterm.TerminalController();

    // Listen to terminal input
    _terminal.onOutput = (data) {
      context.read<TerminalBloc>().add(SendCommandEvent(data));
    };

    // Delay focus to avoid text input client conflicts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _focusNode.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TerminalBloc, TerminalState>(
      listener: (context, state) {
        if (state is TerminalReady) {
          // Write output to terminal
          final output = state.session.outputBuffer.join('\n');
          if (output.isNotEmpty) {
            _terminal.write(output);
          }
        } else if (state is TerminalError) {
          _terminal.write('\x1b[31m${state.message}\x1b[0m\n');
        }
      },
      builder: (context, state) {
        return Container(
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Terminal header
              _buildHeader(context, state),
              const Divider(height: 1),
              // Terminal view
              Expanded(
                child: _buildTerminalView(context, state),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Build terminal header
  Widget _buildHeader(BuildContext context, TerminalState state) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
      ),
      child: Row(
        children: [
          Icon(
            Icons.terminal,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Text(
            'Terminal',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 16),
          // Status indicator
          if (state is TerminalReady) ...[
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: Colors.green,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              state.session.workingDirectory,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontFamily: 'monospace',
                  ),
              overflow: TextOverflow.ellipsis,
            ),
          ] else if (state is TerminalInitializing) ...[
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(
                  Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Initializing...',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ] else if (state is TerminalError) ...[
            Icon(
              Icons.error_outline,
              size: 16,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Error',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          const Spacer(),
          // Actions
          if (state is TerminalReady) ...[
            Tooltip(
              message: 'Clear terminal',
              child: IconButton(
                onPressed: () {
                  context.read<TerminalBloc>().add(const ClearTerminalEvent());
                },
                icon: const Icon(Icons.clear_all, size: 18),
                iconSize: 18,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ),
            const SizedBox(width: 12),
            Tooltip(
              message: 'Restart terminal',
              child: IconButton(
                onPressed: () {
                  context.read<TerminalBloc>().add(const RestartTerminalEvent());
                },
                icon: const Icon(Icons.refresh, size: 18),
                iconSize: 18,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Build terminal view based on state
  Widget _buildTerminalView(BuildContext context, TerminalState state) {
    if (state is TerminalInitializing) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (state is TerminalError) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 48,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Terminal Error',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48),
              child: Text(
                state.message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: () {
                context.read<TerminalBloc>().add(const RestartTerminalEvent());
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (state is! TerminalReady) {
      return Center(
        child: Text(
          'Terminal not initialized',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      );
    }

    // Terminal is ready - show xterm view
    return GestureDetector(
      onTap: () => _focusNode.requestFocus(),
      child: Container(
        color: Colors.black,
        padding: const EdgeInsets.all(8),
        child: xterm.TerminalView(
          _terminal,
          controller: _controller,
          autofocus: false,
          backgroundOpacity: 1.0,
          padding: const EdgeInsets.all(4),
          theme: xterm.TerminalTheme(
            cursor: Colors.white,
            selection: Colors.white.withValues(alpha: 0.3),
            foreground: Colors.white,
            background: Colors.black,
            black: Colors.black,
            red: const Color(0xFFFF5555),
            green: const Color(0xFF50FA7B),
            yellow: const Color(0xFFF1FA8C),
            blue: const Color(0xFFBD93F9),
            magenta: const Color(0xFFFF79C6),
            cyan: const Color(0xFF8BE9FD),
            white: Colors.white,
            brightBlack: const Color(0xFF6272A4),
            brightRed: const Color(0xFFFF6E6E),
            brightGreen: const Color(0xFF69FF94),
            brightYellow: const Color(0xFFFFFFA5),
            brightBlue: const Color(0xFFD6ACFF),
            brightMagenta: const Color(0xFFFF92DF),
            brightCyan: const Color(0xFFA4FFFF),
            brightWhite: Colors.white,
            searchHitBackground: const Color(0xFFF1FA8C),
            searchHitBackgroundCurrent: const Color(0xFFFF5555),
            searchHitForeground: Colors.black,
          ),
        ),
      ),
    );
  }
}
