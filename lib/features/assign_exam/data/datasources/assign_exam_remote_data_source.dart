import '../../../../core/network/dio_client.dart';
import '../models/question_preview_model.dart';
import '../models/assign_exam_result_model.dart';
import '../../domain/entities/assign_exam_result_entity.dart';
import 'package:dio/dio.dart';

abstract class AssignExamRemoteDataSource {
  Future<String> commitExam({
    required AssignExamResultEntity data,
    required String title,
    required int duration,
  });
}

class AssignExamRemoteDataSourceImpl implements AssignExamRemoteDataSource {
  final DioClient dioClient;

  AssignExamRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<String> commitExam({
    required AssignExamResultEntity data,
    required String title,
    required int duration,
  }) async {
    try {
      // Ép kiểu Entity sang Model để dùng hàm toJson()
      final previewList = data.preview
          .map(
            (e) => QuestionPreviewModel(
              row: e.row,
              type: e.type,
              questionText: e.questionText,
              originalQuestionText: e.originalQuestionText,
              points: e.points,
              options: e.options,
              correctOption: e.correctOption,
              modelAnswer: e.modelAnswer,
              errors: e.errors,
            ).toJson(),
          )
          .toList();

      final summary = ExamSummaryModel(
        total: data.summary.total,
        mcq: data.summary.mcq,
        essay: data.summary.essay,
        errors: data.summary.errors,
      ).toJson();

      final payload = {
        "preview": previewList,
        "summary": summary,
        "exam_title": title,
        "duration": duration,
      };

      final response = await dioClient.dio.post(
        '/exam-bank/import-commit',
        data: payload,
      );

      // Backend React của bạn trả về: { status: "success", exam_id: "..." }
      if (response.data['status'] == 'success') {
        return response.data['exam_id']?.toString() ?? 'unknown_id';
      } else {
        throw Exception("Backend không trả về trạng thái success.");
      }
    } on DioException catch (e) {
      // 👉 MÓC RUỘT THÔNG BÁO LỖI TỪ BACKEND ĐỂ UI HIỂN THỊ RÕ RÀNG
      final serverMessage =
          e.response?.data['message'] ??
          e.response?.data?.toString() ??
          e.message;
      throw Exception("Từ chối từ máy chủ: $serverMessage");
    } catch (e) {
      throw Exception('Lỗi hệ thống: $e');
    }
  }
}
