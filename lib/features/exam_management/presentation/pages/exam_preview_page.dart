import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

// --- Imports từ các giai đoạn trước ---
import '../../../../core/utils/exam_parser_helper.dart';
import '../bloc/exam_preview_bloc.dart';
import '../bloc/exam_preview_event.dart';
import '../bloc/exam_preview_state.dart';
import '../widgets/preview/preview_header_stats.dart';
import '../widgets/preview/question_preview_card.dart';
import '../widgets/preview/data_warning_modal.dart';

class ExamPreviewPage extends StatefulWidget {
  final String examId;

  const ExamPreviewPage({super.key, required this.examId});

  @override
  State<ExamPreviewPage> createState() => _ExamPreviewPageState();
}

class _ExamPreviewPageState extends State<ExamPreviewPage> {
  @override
  void initState() {
    super.initState();
    // 👉 Ngay khi vào trang, ra lệnh cho BLoC gọi 2 API (Preview & Summary)
    context.read<ExamPreviewBloc>().add(
      LoadExamPreviewDataEvent(widget.examId),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text("Chi tiết đề thi", style: TextStyle(fontSize: 16)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
      ),
      // 👉 Sử dụng BlocConsumer: Vừa lắng nghe State để chuyển trang, vừa Build UI
      body: BlocConsumer<ExamPreviewBloc, ExamPreviewState>(
        listener: (context, state) {
          if (state is ExamPreviewLoaded) {
            // 1. Cờ điều hướng sang trang Settings bật lên
            if (state.navigateToSettings) {
              // Tương lai: Chuyển sang trang Settings (bạn có thể đổi route sau)
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Chuyển sang trang Cài đặt phòng thi..."),
                ),
              );
              context.push('/exam-settings/${widget.examId}');
            }
            // 2. Cờ điều hướng sang trang Edit (bản sao mới) bật lên
            if (state.cloneNewExamId != null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Đã tạo bản sao! Chuyển sang chế độ Edit..."),
                ),
              );
              // Chuyển tới trang Edit của cái ID mới
              context.pushReplacement(
                '/instructor-dashboard/exams/${state.cloneNewExamId}/edit',
              );
            }
          }
        },
        builder: (context, state) {
          if (state is ExamPreviewInitial || state is ExamPreviewLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ExamPreviewError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  state.message,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            );
          }

          if (state is ExamPreviewLoaded) {
            final exam = state.exam;
            final questions = exam.questions;

            // Tính toán thống kê
            final total = questions.length;
            final mcq = questions
                .where((q) => q.type.toUpperCase() == 'MCQ')
                .length;
            final essay = total - mcq;

            // Kiểm tra trạng thái đề thi
            final isInProgress = ExamParserHelper.isInProgress(
              exam.status,
              exam.timeOpen,
              exam.timeClose,
            );

            // Stack giúp chúng ta dễ dàng đè cái Modal Cảnh Báo lên trên toàn bộ UI
            return Stack(
              children: [
                // === LỚP DƯỚI CÙNG: GIAO DIỆN CHÍNH ===
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 1. Header Thống kê
                        PreviewHeaderStats(
                          total: total,
                          mcq: mcq,
                          essay: essay,
                        ),
                        const SizedBox(height: 16),

                        // 2. Danh sách câu hỏi (Cuộn được)
                        Expanded(
                          child: questions.isEmpty
                              ? const Center(
                                  child: Text(
                                    "Chưa có câu hỏi nào trong đề thi này.",
                                  ),
                                )
                              : ListView.builder(
                                  itemCount: questions.length,
                                  itemBuilder: (context, index) {
                                    return QuestionPreviewCard(
                                      question: questions[index],
                                      index: index,
                                    );
                                  },
                                ),
                        ),

                        const SizedBox(height: 16),

                        // 3. Footer: Nút bấm
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            TextButton.icon(
                              onPressed: () => context.pop(),
                              icon: const Icon(Icons.arrow_back, size: 18),
                              label: const Text("Quay lại"),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.blue.shade700,
                              ),
                            ),

                            // Nút Action phụ thuộc vào trạng thái
                            if (!isInProgress)
                              ElevatedButton(
                                onPressed: () {
                                  // Phát tín hiệu kiểm tra an toàn (CheckAndOpenRoomEvent)
                                  context.read<ExamPreviewBloc>().add(
                                    CheckAndOpenRoomEvent(),
                                  );
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.green.shade600,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 12,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: Text(
                                  (exam.status == 'published' &&
                                          exam.timeClose != null &&
                                          DateTime.now().isAfter(
                                            DateTime.parse(exam.timeClose!),
                                          ))
                                      ? "Mở phòng lại"
                                      : "Bắt đầu mở phòng",
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              )
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.orange.shade50,
                                  border: Border.all(
                                    color: Colors.orange.shade200,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.lock_outline,
                                      size: 16,
                                      color: Colors.orange,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      "Đang diễn ra",
                                      style: TextStyle(
                                        color: Colors.orange.shade800,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // === LỚP ĐÈ LÊN TRÊN: MODAL CẢNH BÁO ===
                if (state.showWarningModal)
                  DataWarningModal(
                    examId: widget.examId,
                    totalSubmissions: state.totalSubmissions,
                    isBusy: state.modalBusy,
                    error: state.modalError,
                    onCancel: () => context.read<ExamPreviewBloc>().add(
                      CloseWarningModalEvent(),
                    ),
                    onPurgeAndOpen: () => context.read<ExamPreviewBloc>().add(
                      PurgeAndOpenEvent(widget.examId),
                    ),
                    cloneAndEdit: () => context.read<ExamPreviewBloc>().add(
                      CloneAndEditEvent(widget.examId),
                    ),
                  ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
