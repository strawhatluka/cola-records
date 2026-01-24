/// Line number column widget for code editor
library;

import 'package:flutter/material.dart';

/// Widget that displays line numbers for a code editor
class LineNumberColumn extends StatelessWidget {
  final int lineCount;
  final ScrollController scrollController;
  final double lineHeight;
  final TextStyle? textStyle;

  const LineNumberColumn({
    required this.lineCount,
    required this.scrollController,
    this.lineHeight = 21.0, // 14px font * 1.5 line height
    this.textStyle,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final defaultStyle = TextStyle(
      fontFamily: 'monospace',
      fontSize: 14,
      height: 1.5,
      color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
    );

    return Container(
      width: 48,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: ListView.builder(
        controller: scrollController,
        itemCount: lineCount,
        itemExtent: lineHeight,
        physics: const NeverScrollableScrollPhysics(),
        itemBuilder: (context, index) {
          return Container(
            height: lineHeight,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 8),
            child: Text(
              '${index + 1}',
              style: textStyle ?? defaultStyle,
            ),
          );
        },
      ),
    );
  }
}
