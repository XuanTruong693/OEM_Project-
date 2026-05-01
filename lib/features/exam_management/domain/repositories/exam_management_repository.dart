import '../../../../core/error/failures.dart';
import '../entities/exam_detail_entity.dart';
import '../entities/exam_setting_entity.dart';
import '../entities/exam_summary_entity.dart';
import 'package:dartz/dartz.dart';

abstract class ExamManagementRepository {
  // Lấy chi tiết đề thi
  Future<ExamDetailEntity> getExamDetail(String examId);

  // Cập nhật đề thi (Truyền vào Model để tận dụng hàm toJson)
  Future<void> updateExam(String examId, Map<String, dynamic> payload);

  Future<Either<Failure, ExamDetailEntity>> getExamPreview(String examId);
  Future<Either<Failure, ExamSummaryEntity>> getExamSummary(String examId);
  Future<Either<Failure, void>> purgeExamData(String examId);
  Future<Either<Failure, String>> cloneExam(String examId);
  Future<Either<Failure, String>> submitExamSetting(
    int examId,
    ExamSettingEntity entity,
  );
}
