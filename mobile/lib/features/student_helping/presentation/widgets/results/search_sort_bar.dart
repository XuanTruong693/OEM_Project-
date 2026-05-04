import 'package:flutter/material.dart';

class SearchSortBar extends StatelessWidget {
  final String searchQuery;
  final String sortType;
  final Function(String) onSearchChanged;
  final Function(String) onSortChanged;

  const SearchSortBar({
    super.key,
    required this.searchQuery,
    required this.sortType,
    required this.onSearchChanged,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // 1. Ô tìm kiếm
          TextField(
            onChanged: onSearchChanged,
            controller: TextEditingController(text: searchQuery)
              ..selection = TextSelection.collapsed(offset: searchQuery.length),
            decoration: InputDecoration(
              hintText: 'Tìm kiếm bài thi...',
              hintStyle: TextStyle(color: Colors.grey.shade400),
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.blue),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 2. Nút sắp xếp
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _buildSortButton(
                  'Mới nhất',
                  'date_desc',
                  sortType == 'date_desc',
                ),
                _buildSortButton(
                  'Điểm cao',
                  'score_desc',
                  sortType == 'score_desc',
                ),
                _buildSortButton(
                  'Điểm thấp',
                  'score_asc',
                  sortType == 'score_asc',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSortButton(String text, String type, bool isSelected) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onSortChanged(type),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : [],
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              color: isSelected
                  ? const Color(0xFF1E293B)
                  : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }
}
