import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/open_exam_bloc.dart';
import '../bloc/open_exam_event.dart';
import '../bloc/open_exam_state.dart';
import '../widgets/open_exam_card.dart';

class OpenExamPage extends StatefulWidget {
  const OpenExamPage({super.key});

  @override
  State<OpenExamPage> createState() => _OpenExamPageState();
}

class _OpenExamPageState extends State<OpenExamPage> {
  final TextEditingController _searchController = TextEditingController();
  String _currentFilter = 'all';

  @override
  void initState() {
    super.initState();
    // Vừa vào trang là kích hoạt gọi API
    context.read<OpenExamBloc>().add(LoadOpenExamsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA), // bg-gray-50
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/instructor-dashboard'),
        ),
        title: const Text(
          "Mở phòng thi",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: Colors.grey.shade200, height: 1),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Khu vực công cụ (Toolbar)
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Đề thi của tôi",
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(height: 12),

                // Ô tìm kiếm
                TextField(
                  controller: _searchController,
                  onChanged: (val) => context.read<OpenExamBloc>().add(
                    SearchExamChangedEvent(val),
                  ),
                  decoration: InputDecoration(
                    hintText: "Tìm tên đề thi...",
                    prefixIcon: const Icon(Icons.search, color: Colors.grey),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Colors.blue,
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Nhóm nút lọc (Filter Segmented Control)
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildFilterButton("Tất cả", "all", isFirst: true),
                      Container(
                        width: 1,
                        height: 36,
                        color: Colors.grey.shade300,
                      ),
                      _buildFilterButton("Draft", "draft"),
                      Container(
                        width: 1,
                        height: 36,
                        color: Colors.grey.shade300,
                      ),
                      _buildFilterButton(
                        "Published",
                        "published",
                        isLast: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Danh sách đề thi
          Expanded(
            child: BlocBuilder<OpenExamBloc, OpenExamState>(
              builder: (context, state) {
                if (state is OpenExamLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is OpenExamError) {
                  return Center(
                    child: Text(
                      state.message,
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }

                if (state is OpenExamLoaded) {
                  final exams = state.filteredExams;

                  if (exams.isEmpty) {
                    return Center(
                      child: Text(
                        "Chưa có đề thi.",
                        style: TextStyle(color: Colors.grey.shade500),
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: exams.length,
                    itemBuilder: (context, index) {
                      final exam = exams[index];
                      return OpenExamCard(
                        exam: exam,
                        onTap: () {
                          // 👉 Chuyển hướng sang trang Preview như thiết kế cũ
                          context.push(
                            '/instructor-dashboard/exams/${exam.id}/preview',
                          );
                        },
                      );
                    },
                  );
                }

                return const SizedBox.shrink();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterButton(
    String label,
    String value, {
    bool isFirst = false,
    bool isLast = false,
  }) {
    final isSelected = _currentFilter == value;

    return InkWell(
      onTap: () {
        setState(() => _currentFilter = value);
        context.read<OpenExamBloc>().add(FilterStatusChangedEvent(value));
      },
      borderRadius: BorderRadius.horizontal(
        left: isFirst ? const Radius.circular(11) : Radius.zero,
        right: isLast ? const Radius.circular(11) : Radius.zero,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue.shade600 : Colors.white,
          borderRadius: BorderRadius.horizontal(
            left: isFirst ? const Radius.circular(11) : Radius.zero,
            right: isLast ? const Radius.circular(11) : Radius.zero,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: isSelected ? Colors.white : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }
}
