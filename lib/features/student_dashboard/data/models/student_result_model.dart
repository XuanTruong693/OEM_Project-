import '../../domain/entities/student_result_entity.dart';

class StudentResultModel extends StudentResultEntity {
  StudentResultModel({
    super.submissionId,
    super.examId,
    super.examTitle,
    super.mcqScore,
    super.essayScore,
    super.aiScore,
    super.totalScore,
    super.suggestedTotalScore,
    super.instructorConfirmed,
    super.status,
    super.submittedAt,
  });

  factory StudentResultModel.fromJson(Map<String, dynamic> json) {
    return StudentResultModel(
      submissionId: json['submission_id']?.toString(),
      examId: json['exam_id']?.toString(),
      examTitle: json['exam_title']?.toString(),
      mcqScore: double.tryParse(json['mcq_score']?.toString() ?? ''),
      essayScore: double.tryParse(json['essay_score']?.toString() ?? ''),
      aiScore: double.tryParse(json['ai_score']?.toString() ?? ''),
      totalScore: double.tryParse(json['total_score']?.toString() ?? ''),
      suggestedTotalScore: double.tryParse(
        json['suggested_total_score']?.toString() ?? '',
      ),
      instructorConfirmed: int.tryParse(
        json['instructor_confirmed']?.toString() ?? '0',
      ),
      status: json['status']?.toString(),
      submittedAt: json['submitted_at']?.toString(),
    );
  }
}
