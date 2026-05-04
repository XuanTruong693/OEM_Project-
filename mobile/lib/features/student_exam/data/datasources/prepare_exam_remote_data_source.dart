import 'package:dio/dio.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/network/dio_client.dart';
import '../models/exam_info_model.dart';
import '../models/join_exam_model.dart';

abstract class PrepareExamRemoteDataSource {
  Future<JoinExamModel> joinExam(String roomToken);

  // 👉 5 API MỚI CHO PREPARE EXAM
  Future<ExamInfoModel> getExamPublicInfo(int examId);

  Future<Map<String, dynamic>> verifyStudentCode(
    String submissionId,
    String studentCode,
  );
  Future<Map<String, dynamic>> verifyFace(
    String submissionId,
    String faceImagePath,
  );
  Future<Map<String, dynamic>> compareFaces(String submissionId);
  Future<Map<String, dynamic>> uploadVerifiedImages(
    String submissionId,
    String? facePath,
    String? cardPath,
  );
  Future<Map<String, dynamic>> getSubmissionStatus(String submissionId);
  Future<Map<String, dynamic>> verifyDevice(String submissionId, String fingerprintId, String deviceName);
  Future<Map<String, dynamic>> requestDeviceChange(String submissionId, String fingerprintId, String deviceName, String reason);
}

class PrepareExamRemoteDataSourceImpl implements PrepareExamRemoteDataSource {
  final DioClient dioClient;

  PrepareExamRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<JoinExamModel> joinExam(String roomToken) async {
    try {
      print('🚀 [AUTO-JOIN] Đang gửi token lên server: $roomToken');

      final response = await dioClient.dio.post(
        '/exams/join',
        data: {'room_token': roomToken},
      );

      print('✅ [AUTO-JOIN] Server trả về cục data: ${response.data}');

      return JoinExamModel.fromJson(response.data);
    } on DioException catch (e) {
      print('❌ [AUTO-JOIN DIO ERROR] ${e.response?.data}');
      if (e.response != null) {
        throw ServerException(
          e.response?.data['message'] ?? 'Không thể vào phòng thi',
        );
      }
      throw ServerException('Lỗi mạng hoặc không thể kết nối tới máy chủ');
    } catch (e) {
      // IN RA LỖI THỰC SỰ ĐỂ CHÚNG TA BIẾT
      print('💀 [AUTO-JOIN FATAL ERROR] Lỗi code/parse JSON: $e');
      throw ServerException('Lỗi parse dữ liệu: ${e.toString()}');
    }
  }

  @override
  Future<ExamInfoModel> getExamPublicInfo(int examId) async {
    try {
      final response = await dioClient.dio.get('/exams/$examId/public-info');
      return ExamInfoModel.fromJson(response.data); // Ép kiểu JSON sang Model
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi lấy thông tin bài thi',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> verifyStudentCode(
    String submissionId,
    String studentCode,
  ) async {
    try {
      final response = await dioClient.dio.post(
        '/submissions/$submissionId/verify-student-code',
        data: {'student_code': studentCode},
      );
      return response.data;
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi xác minh thẻ sinh viên',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> verifyFace(
    String submissionId,
    String faceImagePath,
  ) async {
    try {
      // 1. Upload ảnh tạm để verify (như logic React)
      final form = FormData.fromMap({
        'face_image': await MultipartFile.fromFile(
          faceImagePath,
          filename: 'face.jpg',
        ),
      });
      final uploadRes = await dioClient.dio.post(
        '/submissions/$submissionId/upload-images',
        data: form,
      );

      if (uploadRes.data['ok'] != true) {
        throw ServerException('Không thể tải ảnh khuôn mặt lên máy chủ');
      }

      // 2. Gọi verify-face
      final verifyRes = await dioClient.dio.post(
        '/submissions/$submissionId/verify-face',
      );
      return verifyRes.data;
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi xác minh khuôn mặt',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> compareFaces(String submissionId) async {
    try {
      final response = await dioClient.dio.post(
        '/submissions/$submissionId/compare-faces',
        data: {'tolerance': 0.35},
      );
      return response.data;
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi so sánh khuôn mặt',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> uploadVerifiedImages(
    String submissionId,
    String? facePath,
    String? cardPath,
  ) async {
    try {
      final mapData = <String, dynamic>{};

      if (facePath != null) {
        mapData['verified_face'] = await MultipartFile.fromFile(
          facePath,
          filename: 'verified_face.jpg',
        );
      }
      if (cardPath != null) {
        mapData['verified_card'] = await MultipartFile.fromFile(
          cardPath,
          filename: 'verified_card.jpg',
        );
      }

      final form = FormData.fromMap(mapData);
      final response = await dioClient.dio.post(
        '/submissions/$submissionId/upload-verified-images',
        data: form,
      );
      return response.data;
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi tải lên ảnh xác minh cuối cùng',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> getSubmissionStatus(String submissionId) async {
    try {
      final response = await dioClient.dio.get(
        '/submissions/$submissionId/status',
      );
      return response.data;
    } on DioException catch (e) {
      throw ServerException(
        e.response?.data['message'] ?? 'Lỗi lấy trạng thái bài thi',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> verifyDevice(
    String submissionId,
    String fingerprintId,
    String deviceName,
  ) async {
    try {
      final response = await dioClient.dio.post(
        '/submissions/$submissionId/verify-device',
        data: {
          'submissionId': submissionId,
          'fingerprintId': fingerprintId,
          'fingerprint_id': fingerprintId,
          'deviceName': deviceName,
          'device_name': deviceName,
        },
      );
      return response.data;
    } on DioException catch (e) {
      String msg = 'Lỗi xác minh thiết bị';
      if (e.response?.data is Map) {
        msg = e.response?.data['message']?.toString() ?? msg;
      } else if (e.response?.data != null) {
        msg = e.response?.data.toString() ?? msg;
      }
      throw ServerException(msg);
    }
  }

  @override
  Future<Map<String, dynamic>> requestDeviceChange(
    String submissionId,
    String fingerprintId,
    String deviceName,
    String reason,
  ) async {
    try {
      final response = await dioClient.dio.post(
        '/submissions/$submissionId/request-device-change',
        data: {
          'submissionId': submissionId,
          'fingerprintId': fingerprintId,
          'fingerprint_id': fingerprintId,
          'deviceName': deviceName,
          'device_name': deviceName,
          'reason': reason,
        },
      );
      return response.data;
    } on DioException catch (e) {
      String msg = 'Lỗi yêu cầu đổi thiết bị';
      if (e.response?.data is Map) {
        msg = e.response?.data['message']?.toString() ?? msg;
      } else if (e.response?.data != null) {
        msg = e.response?.data.toString() ?? msg;
      }
      throw ServerException(msg);
    }
  }
}
