import '../../domain/entities/result_item_entity.dart';

class ResultItemModel extends ResultItemEntity {
  ResultItemModel({
    required super.submissionId,
    required super.examId,
    required super.examTitle,
    super.mcqScore,
    super.essayScore,
    super.aiScore,
    super.totalScore,
    super.suggestedTotalScore,
    required super.instructorConfirmed,
    required super.status,
    required super.submittedAt,
    required super.allowViewAnswers,
  });

  factory ResultItemModel.fromJson(Map<String, dynamic> json) {
    return ResultItemModel(
      submissionId: json['submission_id']?.toString() ?? '',
      examId: json['exam_id']?.toString() ?? '',
      examTitle: json['exam_title']?.toString() ?? '',
      mcqScore: double.tryParse(json['mcq_score']?.toString() ?? ''),
      essayScore: double.tryParse(json['essay_score']?.toString() ?? ''),
      aiScore: double.tryParse(json['ai_score']?.toString() ?? ''),
      totalScore: double.tryParse(json['total_score']?.toString() ?? ''),
      suggestedTotalScore: double.tryParse(
        json['suggested_total_score']?.toString() ?? '',
      ),
      instructorConfirmed:
          int.tryParse(json['instructor_confirmed']?.toString() ?? '0') ?? 0,
      status: json['status']?.toString() ?? '',
      submittedAt: json['submitted_at']?.toString() ?? '',
      // Backend thường trả về 1/0 hoặc true/false
      allowViewAnswers:
          json['allow_view_answers'] == 1 || json['allow_view_answers'] == true,
    );
  }
}
