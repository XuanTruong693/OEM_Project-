import '../../domain/entities/exam_summary_entity.dart';

// Helper Model cho ExamSummary
class ExamSummaryModel extends ExamSummaryEntity {
  const ExamSummaryModel({
    required super.total,
    required super.mcq,
    required super.essay,
    required super.errors,
  });

  Map<String, dynamic> toJson() {
    return {'total': total, 'mcq': mcq, 'essay': essay, 'errors': errors};
  }
}
