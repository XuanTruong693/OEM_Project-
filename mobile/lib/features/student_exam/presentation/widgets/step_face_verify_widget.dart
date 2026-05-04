import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../../core/utils/ml_kit_camera_helper.dart';
import '../../../../core/utils/face_detector_helper.dart';
import '../bloc/verify_exam_bloc.dart';
import '../bloc/verify_exam_event.dart';
import '../bloc/verify_exam_state.dart';

class StepFaceVerifyWidget extends StatefulWidget {
  final VerifyExamState state;
  final String submissionId;

  const StepFaceVerifyWidget({
    super.key,
    required this.state,
    required this.submissionId,
  });

  @override
  State<StepFaceVerifyWidget> createState() => _StepFaceVerifyWidgetState();
}

class _StepFaceVerifyWidgetState extends State<StepFaceVerifyWidget> {
  final MLKitCameraHelper _cameraHelper = MLKitCameraHelper();
  bool _isCameraInitialized = false;

  // Biến dùng để detect nháy mắt
  bool _wasEyesClosed = false;
  int _consecutiveStaticFrames = 0; // Đếm số frame khuôn mặt tĩnh

  @override
  void dispose() {
    _cameraHelper.dispose();
    super.dispose();
  }

  Future<void> _startCamera() async {
    await _cameraHelper.initializeCamera();
    setState(() => _isCameraInitialized = true);

    // Thay đổi trạng thái sang "Đang lấy frame nháy mắt"
    context.read<VerifyExamBloc>().add(
      const UpdateBlinkPhaseEvent('detecting', 0, 0, 0, false),
    );

    // Bắt đầu đọc luồng ảnh
    await _cameraHelper.startImageStream((inputImage) async {
      final faces = await faceDetectorHelper.processImage(inputImage);
      _processFaces(faces);
    });
  }

  void _processFaces(List<Face> faces) {
    final bloc = context.read<VerifyExamBloc>();
    final state = bloc.state;

    // Nếu đã chụp xong thì ngừng xử lý AI
    if (state.facePreviewPath != null) return;

    if (faces.isEmpty) {
      if (state.blinkPhase == 'detecting') {
        bloc.add(
          UpdateBlinkPhaseEvent('detecting', state.blinkCount, 0, 0, false),
        );
      } else {
        bloc.add(const UpdateFaceGuideEvent(false, "Không tìm thấy khuôn mặt"));
        _consecutiveStaticFrames = 0;
      }
      return;
    }

    final face = faces.first;

    // GIAI ĐOẠN 1: NHÁY MẮT (Blink Detection)
    if (state.blinkPhase == 'detecting') {
      final leftEye = (face.leftEyeOpenProbability ?? 1.0) * 100;
      final rightEye = (face.rightEyeOpenProbability ?? 1.0) * 100;

      // Kiểm tra góc mặt xem có nhìn thẳng khung hình không (Y và Z dao động nhẹ quanh 0)
      // Nới lỏng góc lên 45 độ và fallback true nếu null để đảm bảo nhận diện tốt trên Android
      final isCentered =
          (face.headEulerAngleY == null ||
              (face.headEulerAngleY! > -45 && face.headEulerAngleY! < 45)) &&
          (face.headEulerAngleZ == null ||
              (face.headEulerAngleZ! > -45 && face.headEulerAngleZ! < 45));

      // Logic đếm nháy mắt: 1 hoặc cả 2 mắt nhắm tịt (< 40%), sau đó mở to (> 55%)
      if (leftEye < 40 || rightEye < 40) {
        _wasEyesClosed = true;
      } else if (_wasEyesClosed && (leftEye > 55 || rightEye > 55)) {
        _wasEyesClosed = false;
        final newCount = state.blinkCount + 1;

        if (newCount >= 3) {
          // Đủ 3 lần nháy -> Chuyển sang giai đoạn chụp tĩnh
          bloc.add(
            UpdateBlinkPhaseEvent(
              'done',
              newCount,
              leftEye.toInt(),
              rightEye.toInt(),
              true,
            ),
          );
          bloc.add(
            const UpdateFaceGuideEvent(true, "Tuyệt vời! Giữ im đầu..."),
          );
          return;
        } else {
          bloc.add(
            UpdateBlinkPhaseEvent(
              'detecting',
              newCount,
              leftEye.toInt(),
              rightEye.toInt(),
              isCentered,
            ),
          );
          return;
        }
      }

      bloc.add(
        UpdateBlinkPhaseEvent(
          'detecting',
          state.blinkCount,
          leftEye.toInt(),
          rightEye.toInt(),
          isCentered,
        ),
      );
    }
    // GIAI ĐOẠN 2: CHỤP TĨNH (Static Capture)
    else if (state.blinkPhase == 'done') {
      final leftEye = face.leftEyeOpenProbability ?? 0.0;
      final rightEye = face.rightEyeOpenProbability ?? 0.0;

      final isCentered =
          (face.headEulerAngleY == null ||
          (face.headEulerAngleY! > -45 && face.headEulerAngleY! < 45));
      final isStraight =
          (face.headEulerAngleZ == null ||
          (face.headEulerAngleZ! > -45 && face.headEulerAngleZ! < 45));
      final eyesOpen = (leftEye > 0.4 && rightEye > 0.4);

      if (isCentered && isStraight && eyesOpen) {
        _consecutiveStaticFrames++;
        bloc.add(
          UpdateFaceGuideEvent(
            true,
            "Giữ nguyên... $_consecutiveStaticFrames/10",
          ),
        );

        // Nếu giữ im được ~10 frames (khoảng 1-2 giây) -> CHỤP ẢNH
        if (_consecutiveStaticFrames >= 10) {
          _takePictureAndStop();
        }
      } else {
        _consecutiveStaticFrames = 0;
        bloc.add(
          const UpdateFaceGuideEvent(false, "Vui lòng nhìn thẳng và mở mắt"),
        );
      }
    }
  }

  Future<void> _takePictureAndStop() async {
    final image = await _cameraHelper.takePicture();
    if (image != null) {
      context.read<VerifyExamBloc>().add(FaceCapturedEvent(image.path));
      setState(
        () => _isCameraInitialized = false,
      ); // Ẩn luồng camera, hiện ảnh tĩnh
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    // Khóa bước 2 nếu bước 1 (Thẻ SV) chưa xong (Trừ khi bài thi không yêu cầu thẻ)
    final allowFace =
        !widget.state.examInfo!.requireStudentCard ||
        state.cardOk ||
        state.faceUploaded;

    return Container(
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
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Text(
                              '2',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Xác minh khuôn mặt',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: Color(0xFF1E293B),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusText(state),
                ],
              ),
              const SizedBox(height: 16),

              // Camera Hoặc Ảnh Preview
              if (!state.isBypassed) ...[
                if (state.facePreviewPath == null)
                  _buildCameraPreview(state)
                else
                  _buildImagePreview(state),
                const SizedBox(height: 16),
              ],

              // Nếu được bypass (Bỏ qua)
              if (state.isBypassed)
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFDCFCE7)),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.check_circle,
                        color: Color(0xFF16A34A),
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Giảng viên đã phê duyệt quyền vào thi cho bạn.',
                          style: TextStyle(
                            color: Color(0xFF15803D),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Action Buttons
              if (state.facePreviewPath == null &&
                  !_isCameraInitialized &&
                  !state.isBypassed)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: allowFace ? _startCamera : null,
                    icon: const Icon(Icons.videocam, size: 18),
                    label: const Text(
                      'Bật Camera',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFFE2E8F0),
                      disabledForegroundColor: const Color(0xFF94A3B8),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              if (state.facePreviewPath != null && !state.faceVerified)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: state.isVerifyingFace
                        ? null
                        : () {
                            context.read<VerifyExamBloc>().add(
                              VerifyFaceApiEvent(widget.submissionId),
                            );
                          },
                    icon: state.isVerifyingFace
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.check_circle_outline, size: 18),
                    label: Text(
                      state.isVerifyingFace
                          ? 'Đang xác minh...'
                          : 'Xác minh khuôn mặt',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              // Log Liveness & Compare
              if (state.faceVerifyLog.isNotEmpty)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: (state.faceOk || state.faceVerified)
                        ? const Color(0xFFF0FDF4)
                        : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: (state.faceOk || state.faceVerified)
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFFEE2E2),
                    ),
                  ),
                  child: Text(
                    state.faceVerifyLog,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: (state.faceOk || state.faceVerified)
                          ? const Color(0xFF15803D)
                          : const Color(0xFFB91C1C),
                    ),
                  ),
                ),

              if (state.compareLog.isNotEmpty)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: state.faceOk
                        ? const Color(0xFFF0FDF4)
                        : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: state.faceOk
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFFEE2E2),
                    ),
                  ),
                  child: Text(
                    state.compareLog,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: state.faceOk
                          ? const Color(0xFF15803D)
                          : const Color(0xFFB91C1C),
                    ),
                  ),
                ),

              // Các Nút Cuối cùng (So sánh, Chụp lại, Nộp)
              if (state.faceVerified &&
                  state.cardVerified &&
                  !state.facesCompared)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(top: 12),
                  child: ElevatedButton.icon(
                    onPressed: state.isComparing
                        ? null
                        : () => context.read<VerifyExamBloc>().add(
                            CompareFacesApiEvent(widget.submissionId),
                          ),
                    icon: state.isComparing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.compare_arrows, size: 18),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    label: Text(
                      state.isComparing
                          ? 'Đang so sánh...'
                          : 'So sánh Khuôn mặt & Thẻ SV',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),

              if (!state.faceOk &&
                  state.facePreviewPath != null &&
                  !state.isComparing)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(top: 12),
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      context.read<VerifyExamBloc>().add(ResetFaceVerificationEvent());
                      _cameraHelper.dispose();
                      await _startCamera();
                    },
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text(
                      'Chụp lại ảnh khuôn mặt',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFD97706),
                      side: const BorderSide(color: Color(0xFFFCD34D)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              if (state.facesCompared &&
                  state.faceOk &&
                  state.uploadSuccessMsg == null)
                Container(
                  margin: const EdgeInsets.only(top: 16),
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: state.isLoading
                        ? null
                        : () => context.read<VerifyExamBloc>().add(
                            UploadFinalImagesEvent(widget.submissionId),
                          ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      state.isLoading
                          ? 'Đang tải lên...'
                          : '✔️ TẢI LÊN XÁC MINH CUỐI CÙNG',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),

              if (state.uploadSuccessMsg != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    state.uploadSuccessMsg!,
                    style: const TextStyle(
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),

          // Lớp Overlay Khóa nếu chưa hoàn thành Bước 1
          if (!allowFace)
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
                        'Hoàn tất Bước 1 để mở khóa',
                        style: TextStyle(
                          color: Colors.grey.shade800,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // Khung Camera Preview + Khung Oval đè lên trên
  Widget _buildCameraPreview(VerifyExamState state) {
    if (!_isCameraInitialized || _cameraHelper.controller == null) {
      return AspectRatio(
        aspectRatio: 4 / 3,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Center(
            child: Icon(
              Icons.videocam_off_outlined,
              size: 40,
              color: Colors.grey.shade400,
            ),
          ),
        ),
      );
    }

    return AspectRatio(
      aspectRatio: 4 / 3,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          fit: StackFit.expand,
          children: [
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: 100,
                height: 100 * (_cameraHelper.controller!.value.aspectRatio > 1 
                  ? _cameraHelper.controller!.value.aspectRatio 
                  : 1 / _cameraHelper.controller!.value.aspectRatio),
                child: CameraPreview(_cameraHelper.controller!),
              ),
            ),

            // Khung viền Tròn hướng dẫn
            Center(
              child: Container(
                width: MediaQuery.of(context).size.width * 0.62,
                height: MediaQuery.of(context).size.width * 0.62,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color:
                        (state.blinkPhase == 'detecting'
                            ? state.blinkFaceOk
                            : state.faceGuideOk)
                        ? const Color(0xFF16A34A)
                        : Colors.red.withOpacity(0.8),
                    width: 4,
                  ),
                ),
              ),
            ),

            // HUD Nháy mắt
            if (state.blinkPhase == 'detecting')
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '👀 Nháy mắt: ${state.blinkCount}/3',
                        style: const TextStyle(
                          color: Color(0xFF4ADE80),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.4),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Nhắm hẳn rồi mở to mắt',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // HUD Chụp tĩnh
            if (state.blinkPhase == 'done')
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      state.faceGuideMsg,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Khung ảnh tĩnh (Khi AI đã auto-capture xong)
  Widget _buildImagePreview(VerifyExamState state) {
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.file(File(state.facePreviewPath!), fit: BoxFit.cover),
      ),
    );
  }

  Widget _buildStatusText(VerifyExamState state) {
    if (state.isBypassed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '✅ Được bỏ qua',
          style: TextStyle(
            color: Color(0xFF15803D),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    if (state.faceOk) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '✅ Đã hoàn thành',
          style: TextStyle(
            color: Color(0xFF15803D),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    if (state.faceErr != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '❌ Lỗi',
          style: TextStyle(
            color: Color(0xFFB91C1C),
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
        '⏳ Chưa hoàn thành',
        style: TextStyle(
          color: Color(0xFF64748B),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
