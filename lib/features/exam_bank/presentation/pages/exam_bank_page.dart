import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/exam_bank_bloc.dart';
import '../bloc/exam_bank_event.dart';
import '../bloc/exam_bank_state.dart';
import '../widgets/exam_bank_card.dart';

class ExamBankPage extends StatefulWidget {
  const ExamBankPage({super.key});

  @override
  State<ExamBankPage> createState() => _ExamBankPageState();
}

class _ExamBankPageState extends State<ExamBankPage> {
  final TextEditingController _searchController = TextEditingController();
  String _currentFilter = 'all';

  @override
  void initState() {
    super.initState();
    context.read<ExamBankBloc>().add(LoadExamsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showDeleteDialog(String examId) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("Xác nhận xóa"),
        content: const Text(
          "Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text("Hủy"),
          ),
          TextButton(
            onPressed: () {
              context.read<ExamBankBloc>().add(DeleteExamEvent(examId));
              Navigator.pop(dialogContext);
            },
            child: const Text("Xóa", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text(
          "Ngân hàng đề thi",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: BlocConsumer<ExamBankBloc, ExamBankState>(
        listener: (context, state) {
          if (state is ExamBankLoaded && state.toastMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.toastMessage!),
                backgroundColor: state.toastType == 'success'
                    ? Colors.green
                    : Colors.red,
              ),
            );
            context.read<ExamBankBloc>().add(ClearToastEvent());
          }
        },
        builder: (context, state) {
          return Column(
            children: [
              // Toolbar: Search & Filter
              _buildToolbar(),

              Expanded(child: _buildMainContent(state)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildToolbar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Search Field
          TextField(
            controller: _searchController,
            onChanged: (val) =>
                context.read<ExamBankBloc>().add(SearchExamEvent(val)),
            decoration: InputDecoration(
              hintText: "Tìm kiếm đề thi...",
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              filled: true,
              fillColor: const Color(0xFFF1F3F5),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
          const SizedBox(height: 12),
          // Filter Chips
          Row(
            children: [
              _buildFilterChip("Tất cả", 'all'),
              const SizedBox(width: 8),
              _buildFilterChip("Nháp", 'draft'),
              const SizedBox(width: 8),
              _buildFilterChip("Đã mở", 'published'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _currentFilter == value;
    return GestureDetector(
      onTap: () {
        setState(() => _currentFilter = value);
        context.read<ExamBankBloc>().add(FilterStatusChangedEvent(value));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0080FF) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFF0080FF) : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }

  Widget _buildMainContent(ExamBankState state) {
    if (state is ExamBankLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state is ExamBankError) {
      return Center(
        child: Text(state.message, style: const TextStyle(color: Colors.red)),
      );
    }

    if (state is ExamBankLoaded) {
      final exams = state.filteredExams;
      if (exams.isEmpty) {
        return const Center(child: Text("Không tìm thấy đề thi nào."));
      }

      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: exams.length,
        itemBuilder: (context, index) {
          final exam = exams[index];
          return ExamBankCard(
            exam: exam,
            onEdit: () =>
                context.push('/instructor-dashboard/exams/${exam.id}/edit'),
            onDelete: () => _showDeleteDialog(exam.id),
            onPreview: () =>
                context.push('/instructor-dashboard/exams/${exam.id}/preview'),
          );
        },
      );
    }

    return const SizedBox.shrink();
  }
}
