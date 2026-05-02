import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:screen_protector/screen_protector.dart';

import '../bloc/verify_exam_bloc.dart';
import '../bloc/verify_exam_event.dart';
import '../bloc/verify_exam_state.dart';

class StepMonitorWidget extends StatefulWidget {
  final VerifyExamState state;
  final int examId;
  final String submissionId;

  const StepMonitorWidget({
    super.key,
    required this.state,
    required this.examId,
    required this.submissionId,
  });

  @override
  State<StepMonitorWidget> createState() => _StepMonitorWidgetState();
}

class _StepMonitorWidgetState extends State<StepMonitorWidget>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (widget.state.monitorOk) {
      if (state == AppLifecycleState.paused ||
          state == AppLifecycleState.inactive) {
        print("⚠️ [GIÁM SÁT]: Sinh viên đã ẩn ứng dụng!");
      }
    }
  }

  Future<void> _enableMonitor() async {
    try {
      await ScreenProtector.preventScreenshotOn();
      if (Theme.of(context).platform == TargetPlatform.iOS) {
        await ScreenProtector.protectDataLeakageWithColor(Colors.black);
      }
      if (mounted) {
        context.read<VerifyExamBloc>().add(EnableMonitorEvent());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể bật tính năng giám sát!'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;

    // Logic mở khóa: Cần hoàn thành các bước trước đó
    final bool faceDone = !state.examInfo!.requireFaceCheck || state.faceOk;
    final bool cardDone = !state.examInfo!.requireStudentCard || state.cardOk;
    final bool allowMonitor = state.isBypassed || (faceDone && cardDone);

    // Có được phép vào thi không? (Đã thỏa mãn tất cả)
    final bool canStartExam =
        allowMonitor && (!state.examInfo!.monitorScreen || state.monitorOk);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (state.examInfo!.monitorScreen)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFF2563EB),
                                    Color(0xFF1D4ED8),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Center(
                                child: Text(
                                  '3',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Bật giám sát',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                        _buildMonitorStatus(state),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Hệ thống sẽ khóa tính năng chụp/quay màn hình và ghi nhận cảnh báo nếu bạn thoát ứng dụng.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 16),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: (allowMonitor && !state.monitorOk)
                            ? _enableMonitor
                            : null,
                        icon: const Icon(Icons.security, size: 18),
                        label: Text(
                          state.monitorOk
                              ? '✔️ Chế độ giám sát đang hoạt động'
                              : 'Bật chế độ giám sát',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: state.monitorOk
                              ? const Color(0xFF16A34A)
                              : const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.grey.shade100,
                          disabledForegroundColor: Colors.grey.shade400,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // Lớp phủ khóa nếu chưa xong bước 1 & 2
                if (!allowMonitor)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.92),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.lock_outline,
                              color: Colors.grey.shade600,
                              size: 36,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Hoàn tất các bước trên để mở khóa',
                              style: TextStyle(
                                color: Colors.grey.shade800,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),

        const SizedBox(height: 24),
        const Divider(height: 1, color: Color(0xFFE2E8F0)),
        const SizedBox(height: 20),

        // Cảnh báo trạng thái sẵn sàng
        if (canStartExam)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFDCFCE7)),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Bạn đã hoàn thành xác minh. Vui lòng nhấn bắt đầu để vào phòng thi.',
                    style: TextStyle(
                      color: Color(0xFF15803D),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFEF3C7)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFFD97706), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Vui lòng hoàn tất các bước yêu cầu để bắt đầu làm bài.',
                    style: TextStyle(
                      color: Color(0xFFB45309),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),

        const SizedBox(height: 20),

        // Nút BẮT ĐẦU VÀO THI
        ElevatedButton(
          onPressed: canStartExam
              ? () {
                  context.go(
                    '/exam/${widget.examId}/take?submission_id=${widget.submissionId}',
                  );
                }
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF16A34A),
            disabledBackgroundColor: const Color(0xFFCBD5E1),
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: const Text(
            'BẮT ĐẦU VÀO THI',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMonitorStatus(VerifyExamState state) {
    if (state.monitorOk) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '✅ Đã bật',
          style: TextStyle(
            color: Color(0xFF15803D),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        '⏳ Chưa bật',
        style: TextStyle(
          color: Color(0xFF64748B),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
