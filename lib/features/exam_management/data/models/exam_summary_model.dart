import '../../domain/entities/exam_summary_entity.dart';

class ExamSummaryModel extends ExamSummaryEntity {
  const ExamSummaryModel({required super.totalSubmissions});

  factory ExamSummaryModel.fromJson(Map<String, dynamic> json) {
    return ExamSummaryModel(totalSubmissions: json['total_submissions'] ?? 0);
  }
}
