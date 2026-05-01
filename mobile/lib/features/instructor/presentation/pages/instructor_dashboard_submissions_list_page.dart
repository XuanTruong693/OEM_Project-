import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/instructor_submission_entity.dart';
import '../bloc/instructor_submissions_bloc.dart';
import '../bloc/instructor_submissions_event.dart';
import '../bloc/instructor_submissions_state.dart';

class InstructorSubmissionsListPage extends StatefulWidget {
  const InstructorSubmissionsListPage({super.key});

  @override
  State<InstructorSubmissionsListPage> createState() =>
      _InstructorSubmissionsListPageState();
}

class _InstructorSubmissionsListPageState
    extends State<InstructorSubmissionsListPage> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Vừa vào trang là ra lệnh gọi API lấy danh sách bài nộp ngay
    context.read<InstructorSubmissionsBloc>().add(LoadSubmissionsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose(); // Dọn dẹp bộ nhớ khi thoát trang
    super.dispose();
  }

  // --- HELPER LOGIC ---
  // Chuyển thể hàm statusStyle của React thành Dart Record trả về màu chữ & nền
  ({Color text, Color bg}) _getStatusStyle(String status) {
    if (status == 'submitted' || status == 'confirmed') {
      return (text: Colors.green.shade700, bg: Colors.green.shade50);
    }
    if (status == 'in_progress') {
      return (text: Colors.amber.shade700, bg: Colors.amber.shade50);
    }
    return (text: Colors.grey.shade700, bg: Colors.grey.shade100); // Mặc định
  }

  // Helper format ngày tháng đẹp mắt
  String _formatDate(String? dateString) {
    if (dateString == null || dateString.isEmpty) return "Chưa nộp";
    try {
      final date = DateTime.parse(dateString).toLocal();
      return "${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')} ${date.day}/${date.month}/${date.year}";
    } catch (e) {
      return dateString;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50, // min-h-screen bg-gray-50
      // HEADER (AppBar)
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor:
            Colors.transparent, // Bỏ hiệu ứng đổi màu khi cuộn của Material 3
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: Colors.grey.shade200, height: 1), // border-b
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(), // Nút "Quay lại Dashboard"
        ),
        title: const Text(
          "Danh sách bài kiểm tra",
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        actions: [
          // Hiển thị tổng số bài lấy từ State
          BlocBuilder<InstructorSubmissionsBloc, InstructorSubmissionsState>(
            builder: (context, state) {
              if (state is InstructorSubmissionsLoaded) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 16.0),
                    child: Text(
                      "Tổng: ${state.allSubmissions.length}",
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),

      // BODY
      body: Column(
        children: [
          // THANH TÌM KIẾM (Search Bar) - Đặt ngoài BlocBuilder để không bị giật bàn phím khi gõ
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) {
                  // Phát tín hiệu khi gõ phím -> BLoC lọc danh sách
                  context.read<InstructorSubmissionsBloc>().add(
                    SearchQueryChangedEvent(value),
                  );
                },
                decoration: InputDecoration(
                  hintText: "Tìm theo bài thi hoặc thí sinh...",
                  hintStyle: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),

          // DANH SÁCH BÀI NỘP (Được quản lý bởi BLoC)
          Expanded(
            child:
                BlocBuilder<
                  InstructorSubmissionsBloc,
                  InstructorSubmissionsState
                >(
                  builder: (context, state) {
                    if (state is InstructorSubmissionsInitial ||
                        state is InstructorSubmissionsLoading) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    if (state is InstructorSubmissionsError) {
                      return Center(
                        child: Text(
                          state.message,
                          style: const TextStyle(color: Colors.red),
                        ),
                      );
                    }

                    if (state is InstructorSubmissionsLoaded) {
                      final filtered = state.filteredSubmissions;

                      if (filtered.isEmpty) {
                        return Center(
                          child: Text(
                            "Không có bài kiểm tra nào.",
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          return _buildSubmissionCard(filtered[index]);
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

  // --- WIDGET VẼ TỪNG THẺ (CARD) ---
  Widget _buildSubmissionCard(InstructorSubmissionEntity s) {
    final statusStyle = _getStatusStyle(s.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Cột trái: Thông tin
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    children: [
                      const TextSpan(text: "Bài thi: "),
                      TextSpan(
                        text: s.examTitle ?? "Exam #${s.examId}",
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    children: [
                      const TextSpan(text: "Thí sinh: "),
                      TextSpan(
                        text: s.studentName ?? "User #${s.studentId}",
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.access_time,
                      size: 14,
                      color: Colors.grey.shade500,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _formatDate(s.submittedAt),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Cột phải: Trạng thái và Điểm
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusStyle.bg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  s.status,
                  style: TextStyle(
                    color: statusStyle.text,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                s.totalScore != null ? s.totalScore.toString() : "—",
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
