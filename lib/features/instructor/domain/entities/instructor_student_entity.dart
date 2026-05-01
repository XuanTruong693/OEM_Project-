class InstructorStudentEntity {
  final String studentId;
  final String? studentName;
  final String? email;
  final int submissionsCount;
  final double? avgScore;
  final String? lastSubmittedAt;

  const InstructorStudentEntity({
    required this.studentId,
    this.studentName,
    this.email,
    required this.submissionsCount,
    this.avgScore,
    this.lastSubmittedAt,
  });
}
