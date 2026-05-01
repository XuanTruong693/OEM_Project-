import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/instructor_exams_bloc.dart';
import '../bloc/instructor_exams_event.dart';
import '../bloc/instructor_exams_state.dart';
import '../widgets/instructor_exam_card.dart'; // 👉 Import Widget vừa tạo

class InstructorExamsListPage extends StatefulWidget {
  const InstructorExamsListPage({super.key});

  @override
  State<InstructorExamsListPage> createState() =>
      _InstructorExamsListPageState();
}

class _InstructorExamsListPageState extends State<InstructorExamsListPage> {
  String q = "";

  @override
  void initState() {
    super.initState();
    context.read<InstructorExamsBloc>().add(LoadMyExamsEvent());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          "Danh sách đề đã tạo",
          style: TextStyle(
            color: Colors.black87,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // --- Ô Tìm Kiếm ---
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                onChanged: (value) => setState(() => q = value),
                decoration: const InputDecoration(
                  icon: Icon(Icons.search, color: Colors.grey),
                  hintText: "Tìm đề theo tên hoặc mã phòng...",
                  border: InputBorder.none,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // --- NỘI DUNG TỪ BLoC ---
            Expanded(
              child: BlocBuilder<InstructorExamsBloc, InstructorExamsState>(
                builder: (context, state) {
                  if (state is InstructorExamsLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (state is InstructorExamsError) {
                    return Center(
                      child: Text(
                        state.message,
                        style: const TextStyle(color: Colors.red),
                      ),
                    );
                  }

                  if (state is InstructorExamsLoaded) {
                    // Xử lý bộ lọc
                    final filteredRows = state.exams.where((r) {
                      final title = r.title.toLowerCase();
                      final id = r.id.toString().toLowerCase();
                      final query = q.toLowerCase();
                      return title.contains(query) || id.contains(query);
                    }).toList();

                    if (filteredRows.isEmpty) {
                      return Center(
                        child: Text(
                          "Không có đề nào.",
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: () async {
                        context.read<InstructorExamsBloc>().add(
                          LoadMyExamsEvent(),
                        );
                      },
                      child: ListView.separated(
                        itemCount: filteredRows.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final exam = filteredRows[index];

                          // 👉 GỌI WIDGET ĐÃ TÁCH Ở ĐÂY
                          return InstructorExamCard(
                            exam: exam,
                            onEdit: () {
                              context.push(
                                '/instructor-dashboard/exams/${exam.id}/edit',
                              );
                              print("Chỉnh sửa đề ${exam.id}");
                            },
                            onPreview: () {
                              context.push(
                                '/instructor-dashboard/exams/${exam.id}/preview',
                              );
                              print("Xem trước đề ${exam.id}");
                            },
                          );
                        },
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
