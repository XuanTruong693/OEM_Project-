import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/instructor_student_entity.dart';
import '../bloc/instructor_students_bloc.dart';
import '../bloc/instructor_students_event.dart';
import '../bloc/instructor_students_state.dart';

class InstructorStudentsListPage extends StatefulWidget {
  const InstructorStudentsListPage({super.key});

  @override
  State<InstructorStudentsListPage> createState() =>
      _InstructorStudentsListPageState();
}

class _InstructorStudentsListPageState
    extends State<InstructorStudentsListPage> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Vừa vào trang là kích hoạt BLoC gọi API lấy danh sách học viên
    context.read<InstructorStudentsBloc>().add(LoadStudentsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Helper format ngày tháng đẹp mắt
  String _formatDate(String? dateString) {
    if (dateString == null || dateString.isEmpty) return "—";
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
      backgroundColor: Colors.grey.shade50, // bg-gray-50
      // HEADER (AppBar)
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: Colors.grey.shade200, height: 1), // border-b
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(), // Nút quay lại Dashboard
        ),
        title: const Text(
          "Danh sách thí sinh đã thi",
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        actions: [
          // Hiển thị tổng số sinh viên (chỉ lắng nghe độ dài danh sách gốc)
          BlocBuilder<InstructorStudentsBloc, InstructorStudentsState>(
            builder: (context, state) {
              if (state is InstructorStudentsLoaded) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 16.0),
                    child: Text(
                      "Tổng: ${state.allStudents.length}",
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
          // THANH TÌM KIẾM (Search Bar) - Cố định ở trên cùng
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
                  // Gửi sự kiện để BLoC tự động lọc lại danh sách
                  context.read<InstructorStudentsBloc>().add(
                    SearchStudentQueryChangedEvent(value),
                  );
                },
                decoration: InputDecoration(
                  hintText: "Tìm theo tên hoặc email thí sinh...",
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

          // DANH SÁCH HỌC VIÊN
          Expanded(
            child: BlocBuilder<InstructorStudentsBloc, InstructorStudentsState>(
              builder: (context, state) {
                if (state is InstructorStudentsInitial ||
                    state is InstructorStudentsLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is InstructorStudentsError) {
                  return Center(
                    child: Text(
                      state.message,
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }

                if (state is InstructorStudentsLoaded) {
                  final filtered = state.filteredStudents;

                  if (filtered.isEmpty) {
                    return Center(
                      child: Text(
                        "Chưa có thí sinh nào.",
                        style: TextStyle(color: Colors.grey.shade500),
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      return _buildStudentCard(filtered[index]);
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

  // --- WIDGET VẼ TỪNG THẺ HỌC VIÊN ---
  Widget _buildStudentCard(InstructorStudentEntity s) {
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
          // Avatar màu Tím (Tái tạo class Tailwind: bg-violet-100 text-violet-700)
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.purple.shade50,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person_outline,
              color: Colors.purple.shade700,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),

          // Cột giữa: Thông tin học viên
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
                    children: [
                      const TextSpan(text: "Tên: "),
                      TextSpan(
                        text: s.studentName ?? "User #${s.studentId}",
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis, // Cắt chữ nếu tên quá dài
                ),
                const SizedBox(height: 4),
                Text(
                  "Email: ${s.email ?? '—'}",
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          const SizedBox(width: 12),

          // Cột phải: Thống kê số liệu (Bài đã thi, Điểm TB, Lần cuối)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              RichText(
                text: TextSpan(
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  children: [
                    const TextSpan(text: "Bài đã thi: "),
                    TextSpan(
                      text: s.submissionsCount.toString(),
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
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  children: [
                    const TextSpan(text: "Điểm TB: "),
                    TextSpan(
                      // Format điểm về 1 chữ số thập phân (vd: 8.5)
                      text: s.avgScore != null
                          ? s.avgScore!.toStringAsFixed(1)
                          : "—",
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "Lần cuối: ${_formatDate(s.lastSubmittedAt)}",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
