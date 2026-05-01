import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class MLKitCameraHelper {
  CameraController? controller;
  bool _isProcessing =
      false; // Cờ chống tràn RAM (Chỉ xử lý frame mới khi frame cũ đã xong)

  // 1. Khởi tạo Camera (Ưu tiên Camera trước)
  Future<void> initializeCamera() async {
    final cameras = await availableCameras();
    // Tìm camera trước (front-facing)
    final frontCamera = cameras.firstWhere(
      (camera) => camera.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    controller = CameraController(
      frontCamera,
      ResolutionPreset
          .medium, // Medium (thường là 480p hoặc 720p) là đủ nét cho AI và cực nhẹ
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.yuv420
          : ImageFormatGroup.bgra8888,
    );

    await controller!.initialize();
  }

  // 2. Bắt đầu luồng Video và ném cho callback xử lý
  Future<void> startImageStream(Function(InputImage inputImage) onImage) async {
    if (controller == null || !controller!.value.isInitialized) return;
    if (controller!.value.isStreamingImages) return;

    await controller!.startImageStream((CameraImage image) async {
      // NẾU AI ĐANG BẬN XỬ LÝ FRAME TRƯỚC -> BỎ QUA FRAME NÀY (Chống giật lag)
      if (_isProcessing) return;
      _isProcessing = true;

      try {
        final inputImage = _convertCameraImageToInputImage(image);
        if (inputImage != null) {
          await onImage(inputImage);
        }
      } finally {
        _isProcessing = false; // Mở khóa để nhận frame tiếp theo
      }
    });
  }

  // 3. Hàm chụp ảnh tĩnh (Dùng khi đã bắt được 3 lần nháy mắt)
  Future<XFile?> takePicture() async {
    if (controller == null || !controller!.value.isInitialized) return null;
    try {
      // Phải dừng stream trước khi chụp ảnh tĩnh để tránh crash trên một số dòng Android
      if (controller!.value.isStreamingImages) {
        await controller!.stopImageStream();
      }
      return await controller!.takePicture();
    } catch (e) {
      print("❌ [Camera] Lỗi chụp ảnh: $e");
      return null;
    }
  }

  // 4. Hàm Dịch mã (Convert) - Lấy chuẩn từ Document của Google ML Kit Flutter
  InputImage? _convertCameraImageToInputImage(CameraImage image) {
    if (controller == null) return null;

    final camera = controller!.description;
    final sensorOrientation = camera.sensorOrientation;
    InputImageRotation? rotation;

    if (Platform.isIOS) {
      rotation = InputImageRotationValue.fromRawValue(sensorOrientation);
    } else if (Platform.isAndroid) {
      var rotationCompensation =
          _orientations[controller!.value.deviceOrientation];
      if (rotationCompensation == null) return null;
      if (camera.lensDirection == CameraLensDirection.front) {
        rotationCompensation = (sensorOrientation + rotationCompensation) % 360;
      } else {
        rotationCompensation =
            (sensorOrientation - rotationCompensation + 360) % 360;
      }
      rotation = InputImageRotationValue.fromRawValue(rotationCompensation);
    }

    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null ||
        (Platform.isAndroid && format != InputImageFormat.yuv420) ||
        (Platform.isIOS && format != InputImageFormat.bgra8888)) {
      return null;
    }

    if (image.planes.isEmpty) return null;

    return InputImage.fromBytes(
      bytes: image
          .planes[0]
          .bytes, // Trong yuv420, plane 0 chứa dữ liệu quan trọng nhất
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
  }

  // Helper cho xoay màn hình Android
  final _orientations = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  void dispose() {
    controller?.dispose();
    controller = null;
  }
}
