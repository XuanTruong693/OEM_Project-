import '../../../../core/network/dio_client.dart';
import '../models/exam_detail_model.dart';
import '../models/exam_setting_request.dart.dart';
import '../models/exam_summary_model.dart';

abstract class ExamManagementRemoteDataSource {
  Future<ExamDetailModel> getExamDetail(String examId);
  Future<void> updateExam(String examId, Map<String, dynamic> payload);
  Future<ExamDetailModel> getExamPreview(String examId);
  Future<ExamSummaryModel> getExamSummary(String examId);
  Future<void> purgeExamData(String examId);
  Future<String> cloneExam(String examId);
  Future<String> submitExamSetting(int examId, ExamSettingRequest request);
}

class ExamManagementRemoteDataSourceImpl
    implements ExamManagementRemoteDataSource {
  final DioClient dioClient;

  ExamManagementRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<ExamDetailModel> getExamDetail(String examId) async {
    final response = await dioClient.dio.get('/edit-exam/exams/$examId/edit');
    return ExamDetailModel.fromJson(response.data);
  }

  @override
  Future<void> updateExam(String examId, Map<String, dynamic> payload) async {
    await dioClient.dio.put('/edit-exam/exams/$examId', data: payload);
  }

  @override
  Future<ExamDetailModel> getExamPreview(String examId) async {
    try {
      final response = await dioClient.dio.get(
        '/instructor/exams/$examId/preview',
      );
      // Tận dụng lại ExamDetailModel hiện có vì cấu trúc trả về tương tự nhau
      return ExamDetailModel.fromJson(response.data);
    } catch (e) {
      throw Exception('Failed to load exam preview: $e');
    }
  }

  @override
  Future<ExamSummaryModel> getExamSummary(String examId) async {
    try {
      final response = await dioClient.dio.get(
        '/instructor/exams/$examId/summary',
      );
      return ExamSummaryModel.fromJson(response.data);
    } catch (e) {
      throw Exception('Failed to get exam summary: $e');
    }
  }

  @override
  Future<void> purgeExamData(String examId) async {
    try {
      await dioClient.dio.post('/instructor/exams/$examId/purge');
    } catch (e) {
      throw Exception('Failed to purge exam data: $e');
    }
  }

  @override
  Future<String> cloneExam(String examId) async {
    try {
      final response = await dioClient.dio.post(
        '/instructor/exams/$examId/clone',
      );
      // Trả về ID của đề thi mới được nhân bản
      return response.data['exam_id'].toString();
    } catch (e) {
      throw Exception('Failed to clone exam: $e');
    }
  }

  @override
  Future<String> submitExamSetting(
    int examId,
    ExamSettingRequest request,
  ) async {
    try {
      final response = await dioClient.dio.post(
        '/instructor/exams/$examId/open',
        data: request.toJson(),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Trả về mã phòng thi (exam_room_code)
        return response.data['exam_room_code'] ?? '';
      } else {
        throw Exception(
          response.data['message'] ?? 'Lỗi không xác định khi mở phòng',
        );
      }
    } catch (e) {
      rethrow; // Đẩy lỗi lên để Repository xử lý
    }
  }
}
