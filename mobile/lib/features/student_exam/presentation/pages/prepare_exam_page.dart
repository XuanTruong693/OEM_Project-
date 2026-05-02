import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

// Import BLoC 1: Dùng để Auto-Join
import '../bloc/prepare_exam_bloc.dart';
import '../bloc/prepare_exam_event.dart';
import '../bloc/prepare_exam_state.dart';

// Import BLoC 2: Dùng để Xác minh 3 bước
import '../bloc/verify_exam_bloc.dart';
import '../bloc/verify_exam_event.dart';
import '../bloc/verify_exam_state.dart';

import '../widgets/exam_header_widget.dart';
import '../widgets/step_card_verify_widget.dart';
import '../widgets/step_face_verify_widget.dart';
import '../widgets/step_monitor_widget.dart';

class PrepareExamPage extends StatefulWidget {
  final int examId;
  final String roomToken;

  const PrepareExamPage({
    super.key,
    required this.examId,
    required this.roomToken,
  });

  @override
  State<PrepareExamPage> createState() => _PrepareExamPageState();
}

class _PrepareExamPageState extends State<PrepareExamPage> {
  String? _submissionId;

  @override
  void initState() {
    super.initState();
    // 1. Kích hoạt BLoC 1: Gọi Auto-Join ngay khi vào trang bằng Event thật của bạn
    context.read<PrepareExamBloc>().add(
      AutoJoinExamEvent(roomToken: widget.roomToken),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Chuẩn bị vào thi',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),

      // Dùng BlocConsumer của PrepareExamBloc để đợi kết quả Join
      body: BlocConsumer<PrepareExamBloc, PrepareExamState>(
        listener: (context, joinState) {
          if (joinState is PrepareExamJoinSuccess) {
            // Lấy submissionId từ class PrepareExamJoinSuccess của bạn
            _submissionId = joinState.submissionId;

            // 2. Kích hoạt BLoC 2: Ngay khi Join xong, gọi VerifyExamBloc để tải thông tin 3 bước
            context.read<VerifyExamBloc>().add(
              LoadVerifyExamDataEvent(
                examId: widget.examId,
                submissionId: _submissionId!,
              ),
            );
          } else if (joinState is PrepareExamJoinFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(joinState.message),
                backgroundColor: Colors.red,
              ),
            );
          }
        },
        builder: (context, joinState) {
          // Đang join phòng
          if (joinState is PrepareExamLoading ||
              joinState is PrepareExamInitial) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(
                    strokeWidth: 3,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      Color(0xFF2563EB),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Đang kết nối phòng thi...',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
            );
          }

          // Join lỗi
          if (joinState is PrepareExamJoinFailure) {
            return Center(
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.red.shade100),
                ),
                margin: const EdgeInsets.all(24),
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        color: Colors.red,
                        size: 48,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Không thể vào phòng thi',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Colors.grey.shade800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        joinState.message,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Quay lại',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          // Join thành công -> Render giao diện Verify 3 bước
          if (_submissionId != null) {
            return _buildVerifyUI();
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  // Tách phần giao diện 3 bước ra một hàm riêng cho sạch
  Widget _buildVerifyUI() {
    return BlocConsumer<VerifyExamBloc, VerifyExamState>(
      listener: (context, verifyState) {
        if (verifyState.isKicked) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                verifyState.errorMessage ?? 'Bạn bị mời ra khỏi phòng!',
              ),
              backgroundColor: Colors.red,
            ),
          );
          Navigator.of(context).pop();
        }
      },
      builder: (context, verifyState) {
        if (verifyState.isLoading && verifyState.examInfo == null) {
          return const Center(
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
            ),
          );
        }

        if (verifyState.errorMessage != null && verifyState.examInfo == null) {
          return Center(
            child: Text(
              verifyState.errorMessage!,
              style: const TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }

        return SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // HEADER
              ExamHeaderWidget(examInfo: verifyState.examInfo),
              const SizedBox(height: 24),

              // BƯỚC 1: XÁC MINH THẺ (Giai đoạn 3)
              if (verifyState.examInfo?.requireStudentCard == true)
                StepCardVerifyWidget(
                  state: verifyState,
                  submissionId: _submissionId!,
                ),
              if (verifyState.examInfo?.requireStudentCard == true)
                const SizedBox(height: 24),

              // BƯỚC 2: XÁC MINH KHUÔN MẶT (Giai đoạn 4 + 5)
              if (verifyState.examInfo?.requireFaceCheck == true)
                StepFaceVerifyWidget(
                  state: verifyState,
                  submissionId: _submissionId!,
                ),
              if (verifyState.examInfo?.requireFaceCheck == true)
                const SizedBox(height: 24),

              // BƯỚC 3: GIÁM SÁT & NÚT VÀO THI (Giai đoạn 6)
              StepMonitorWidget(
                state: verifyState,
                examId: widget.examId,
                submissionId: _submissionId!,
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}
