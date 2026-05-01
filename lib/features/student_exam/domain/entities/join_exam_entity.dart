class JoinExamEntity {
  final String submissionId;
  final String examId;
  final Map<String, dynamic> flags;

  JoinExamEntity({
    required this.submissionId,
    required this.examId,
    required this.flags,
  });
}
