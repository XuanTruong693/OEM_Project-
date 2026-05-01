import 'exam_summary_entity.dart';
import 'question_preview_entity.dart';

class AssignExamResultEntity {
  final List<QuestionPreviewEntity> preview;
  final ExamSummaryEntity summary;
  final List<String> validationErrors;
  final bool isMultipleSheets; // Cờ báo hiệu file Excel có nhiều sheet
  final List<String> availableSheets; // Danh sách tên sheet (nếu có)

  const AssignExamResultEntity({
    required this.preview,
    required this.summary,
    required this.validationErrors,
    this.isMultipleSheets = false,
    this.availableSheets = const [],
  });
}
