/// Collapsible sidebar navigation
library;

import 'package:flutter/material.dart';

/// Navigation item for sidebar
class NavItem {
  final String label;
  final IconData icon;
  final int index;

  const NavItem({
    required this.label,
    required this.icon,
    required this.index,
  });
}

/// Collapsible sidebar navigation widget
class SidebarNavigation extends StatefulWidget {
  final int selectedIndex;
  final Function(int) onDestinationSelected;
  final List<NavItem> items;

  const SidebarNavigation({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.items,
    super.key,
  });

  @override
  State<SidebarNavigation> createState() => _SidebarNavigationState();
}

class _SidebarNavigationState extends State<SidebarNavigation> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: _isExpanded ? 250 : 70,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).dividerColor,
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // Toggle button
          Container(
            height: 60,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: IconButton(
              icon: Icon(_isExpanded ? Icons.chevron_left : Icons.menu),
              onPressed: () {
                setState(() {
                  _isExpanded = !_isExpanded;
                });
              },
              tooltip: _isExpanded ? 'Collapse sidebar' : 'Expand sidebar',
            ),
          ),
          const Divider(height: 1),
          // Navigation items
          Expanded(
            child: ListView.builder(
              itemCount: widget.items.length,
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemBuilder: (context, index) {
                final item = widget.items[index];
                final isSelected = widget.selectedIndex == item.index;

                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  child: Material(
                    color: isSelected
                        ? Theme.of(context).colorScheme.secondaryContainer
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      onTap: () => widget.onDestinationSelected(item.index),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        height: 56,
                        padding: EdgeInsets.symmetric(horizontal: _isExpanded ? 12 : 0),
                        child: _isExpanded
                            ? Row(
                                children: [
                                  Icon(
                                    item.icon,
                                    color: isSelected
                                        ? Theme.of(context)
                                            .colorScheme
                                            .onSecondaryContainer
                                        : Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      item.label,
                                      style: TextStyle(
                                        color: isSelected
                                            ? Theme.of(context)
                                                .colorScheme
                                                .onSecondaryContainer
                                            : Theme.of(context)
                                                .colorScheme
                                                .onSurfaceVariant,
                                        fontWeight: isSelected
                                            ? FontWeight.w600
                                            : FontWeight.normal,
                                      ),
                                    ),
                                  ),
                                ],
                              )
                            : Center(
                                child: Icon(
                                  item.icon,
                                  color: isSelected
                                      ? Theme.of(context)
                                          .colorScheme
                                          .onSecondaryContainer
                                      : Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                ),
                              ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
