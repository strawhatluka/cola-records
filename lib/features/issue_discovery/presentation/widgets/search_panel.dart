/// Search panel widget for filtering issues
library;

import 'package:flutter/material.dart';
import 'package:cola_records/core/constants/api_constants.dart';
import '../../domain/value_objects/search_params.dart';

/// Widget for searching good first issues
class SearchPanel extends StatefulWidget {
  final Function(SearchParams) onSearch;
  final Function(String)? onTitleFilterChanged;

  const SearchPanel({
    required this.onSearch,
    this.onTitleFilterChanged,
    super.key,
  });

  @override
  State<SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<SearchPanel> {
  String? _selectedLanguage;
  int _minStars = 0;
  final _minStarsController = TextEditingController();
  final _titleFilterController = TextEditingController();

  @override
  void dispose() {
    _minStarsController.dispose();
    _titleFilterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Search Good First Issues',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: _titleFilterController,
                    decoration: const InputDecoration(
                      labelText: 'Filter by Title',
                      hintText: 'Type to filter results...',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.filter_alt),
                    ),
                    onChanged: (value) {
                      widget.onTitleFilterChanged?.call(value);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Language',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Any Language'),
                      ),
                      ...ApiConstants.supportedLanguages.map((lang) {
                        return DropdownMenuItem(
                          value: lang,
                          child: Text(lang),
                        );
                      }),
                    ],
                    onChanged: (value) {
                      setState(() => _selectedLanguage = value);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: _minStarsController,
                    decoration: const InputDecoration(
                      labelText: 'Min Stars',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      _minStars = int.tryParse(value) ?? 0;
                    },
                  ),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  onPressed: _onSearchPressed,
                  icon: const Icon(Icons.search),
                  label: const Text('Search'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _onSearchPressed() {
    widget.onSearch(SearchParams(
      language: _selectedLanguage,
      minStars: _minStars,
    ));
  }
}
