import '../../domain/entities/join_exam_entity.dart';

class JoinExamModel extends JoinExamEntity {
  JoinExamModel({
    required super.submissionId,
    required super.examId,
    required super.flags,
  });

  factory JoinExamModel.fromJson(Map<String, dynamic> json) {
    return JoinExamModel(
      submissionId: json['submission_id']?.toString() ?? '',
      examId: json['exam_id']?.toString() ?? '',
      flags: json['flags'] ?? {},
    );
  }
}
