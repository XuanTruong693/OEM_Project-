class InstructorSubmissionEntity {
  final String submissionId;
  final String examId;
  final String? examTitle;
  final String studentId;
  final String? studentName;
  final String status;
  final double? totalScore;
  final String? submittedAt;

  const InstructorSubmissionEntity({
    required this.submissionId,
    required this.examId,
    this.examTitle,
    required this.studentId,
    this.studentName,
    required this.status,
    this.totalScore,
    this.submittedAt,
  });
}
