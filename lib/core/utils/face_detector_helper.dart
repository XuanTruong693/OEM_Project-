import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class FaceDetectorHelper {
  // Singleton pattern
  static final FaceDetectorHelper _instance = FaceDetectorHelper._internal();
  factory FaceDetectorHelper() => _instance;
  FaceDetectorHelper._internal();

  late FaceDetector _faceDetector;
  bool _isInitialized = false;

  void initialize() {
    if (_isInitialized) return;

    // Cấu hình AI: Tối ưu cho việc phát hiện chớp mắt và quay đầu
    final options = FaceDetectorOptions(
      enableClassification:
          true, // BẮT BUỘC: Để lấy tỉ lệ nhắm/mở mắt (Eye Open Probability)
      enableTracking:
          true, // BẮT BUỘC: Giúp AI nhận diện mượt hơn trên các frame liên tiếp
      enableLandmarks:
          false, // Tắt (Không cần tọa độ mắt mũi miệng chi tiết, tiết kiệm CPU)
      enableContours: false, // Tắt (Không cần vẽ đường viền mặt)
      performanceMode:
          FaceDetectorMode.fast, // Chế độ Fast để chạy realtime mượt mà
    );

    _faceDetector = FaceDetector(options: options);
    _isInitialized = true;
  }

  // Hàm xử lý ảnh (đưa InputImage vào, lấy ra danh sách khuôn mặt)
  Future<List<Face>> processImage(InputImage inputImage) async {
    if (!_isInitialized) initialize();
    try {
      return await _faceDetector.processImage(inputImage);
    } catch (e) {
      print("❌ [ML Kit] Lỗi xử lý ảnh: $e");
      return [];
    }
  }

  void dispose() {
    if (_isInitialized) {
      _faceDetector.close();
      _isInitialized = false;
    }
  }
}

// Biến toàn cục để dùng nhanh
final faceDetectorHelper = FaceDetectorHelper();
