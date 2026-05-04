class StudentResultEntity {
  final String? submissionId;
  final String? examId;
  final String? examTitle;
  final double? mcqScore;
  final double? essayScore;
  final double? aiScore;
  final double? totalScore;
  final double? suggestedTotalScore;
  final int? instructorConfirmed;
  final String? status;
  final String? submittedAt;

  StudentResultEntity({
    this.submissionId,
    this.examId,
    this.examTitle,
    this.mcqScore,
    this.essayScore,
    this.aiScore,
    this.totalScore,
    this.suggestedTotalScore,
    this.instructorConfirmed,
    this.status,
    this.submittedAt,
  });
}
