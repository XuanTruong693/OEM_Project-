import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/student_exam/data/datasources/prepare_exam_remote_data_source.dart';
import 'package:mobile/core/utils/device_info_helper.dart';

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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () {
            context.go('/student-dashboard');
          },
        ),
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
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              if (_submissionId != null) {
                await _checkDeviceVerification(_submissionId!);
              }
            },
          ),
        ],
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

            // Kiểm tra đổi thiết bị (Device Change) trước khi cho vào 3 bước
            _checkDeviceVerification(_submissionId!);
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
        if (verifyState.examInfo == null && verifyState.errorMessage == null) {
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

        return RefreshIndicator(
          onRefresh: () async {
            if (_submissionId != null) {
              await _checkDeviceVerification(_submissionId!);
            }
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
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
          ),
        );
      },
    );
  }

  Future<void> _checkDeviceVerification(String subId) async {
    try {
      const storage = FlutterSecureStorage();
      String? fingerprint = await storage.read(key: 'student_device_fingerprint');
      if (fingerprint == null) {
        fingerprint = 'dev_mobile_${DateTime.now().millisecondsSinceEpoch}';
        await storage.write(key: 'student_device_fingerprint', value: fingerprint);
      }

      final deviceName = await DeviceInfoHelper.getDeviceModelName();
      final ds = PrepareExamRemoteDataSourceImpl(dioClient: DioClient(onLogout: () {}));
      final verifyRes = await ds.verifyDevice(subId, fingerprint, deviceName);
      final canEnter = verifyRes['can_enter'] == true;
      final status = (verifyRes['status'] ?? verifyRes['device_change_status'])?.toString();

      if (canEnter) {
        if (mounted) {
          context.read<VerifyExamBloc>().add(
            LoadVerifyExamDataEvent(
              examId: widget.examId,
              submissionId: subId,
            ),
          );
        }
      } else if (status == 'rejected') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Yêu cầu đổi thiết bị đã bị từ chối.'), backgroundColor: Colors.red),
          );
          Navigator.of(context).pop();
        }
      } else {
        if (mounted) {
          _showRequestDeviceChangeDialog(subId, fingerprint);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi xác minh thiết bị: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showRequestDeviceChangeDialog(String subId, String fingerprintId) {
    final reasonCtrl = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          "Xin đổi thiết bị",
          style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Bạn đang truy cập bài thi từ thiết bị mới. Vui lòng nhập lý do để Giảng viên phê duyệt.",
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonCtrl,
              decoration: InputDecoration(
                labelText: "Lý do đổi máy",
                hintText: "VD: Máy cũ bị hỏng, đổi máy mới",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text("Hủy", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonCtrl.text.trim();
              if (reason.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Vui lòng nhập lý do.'), backgroundColor: Colors.orange),
                );
                return;
              }
              try {
                final deviceName = await DeviceInfoHelper.getDeviceModelName();
                final ds = PrepareExamRemoteDataSourceImpl(dioClient: DioClient(onLogout: () {}));
                await ds.requestDeviceChange(subId, fingerprintId, deviceName, reason);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã gửi yêu cầu đổi máy. Vui lòng đợi GV phê duyệt.'), backgroundColor: Colors.green),
                  );
                }
                Navigator.of(ctx).pop();
                _startDeviceApprovalPolling(subId, fingerprintId);
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Gửi yêu cầu thất bại: $e'), backgroundColor: Colors.red),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            child: const Text("Gửi yêu cầu", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _startDeviceApprovalPolling(String subId, String fingerprintId) {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 4));
      if (!mounted) return false;
      try {
        final deviceName = await DeviceInfoHelper.getDeviceModelName();
        final ds = PrepareExamRemoteDataSourceImpl(dioClient: DioClient(onLogout: () {}));
        final verifyRes = await ds.verifyDevice(subId, fingerprintId, deviceName);
        final canEnter = verifyRes['can_enter'] == true;
        final status = (verifyRes['status'] ?? verifyRes['device_change_status'])?.toString();
        if (canEnter || status == 'approved') {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Yêu cầu đổi máy đã được phê duyệt!'), backgroundColor: Colors.green),
            );
            context.read<VerifyExamBloc>().add(
              LoadVerifyExamDataEvent(
                examId: widget.examId,
                submissionId: subId,
              ),
            );
          }
          return false;
        } else if (status == 'rejected') {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Yêu cầu đổi máy đã bị từ chối.'), backgroundColor: Colors.red),
            );
            Navigator.of(context).pop();
          }
          return false;
        }
      } catch (_) {}
      return true;
    });
  }
}
