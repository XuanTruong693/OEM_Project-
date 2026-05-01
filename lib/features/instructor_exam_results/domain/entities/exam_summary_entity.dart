class ExamSummaryEntity {
  final num totalStudents;
  final num submittedCount;
  final num inProgressCount;
  final num missingCount;
  final num avgScore;
  final num passingRate;
  final num totalViolations;

  const ExamSummaryEntity({
    this.totalStudents = 0,
    this.submittedCount = 0,
    this.inProgressCount = 0,
    this.missingCount = 0,
    this.avgScore = 0,
    this.passingRate = 0,
    this.totalViolations = 0,
  });

  factory ExamSummaryEntity.fromJson(Map<String, dynamic> json) {
    return ExamSummaryEntity(
      totalStudents: json['total_students'] ?? 0,
      submittedCount: json['submitted_count'] ?? 0,
      inProgressCount: json['in_progress_count'] ?? 0,
      missingCount: json['missing_count'] ?? 0,
      avgScore: json['avg_score'] ?? 0,
      passingRate: json['passing_rate'] ?? 0,
      totalViolations: json['total_violations'] ?? 0,
    );
  }
  ExamSummaryEntity copyWith({
    num? totalStudents,
    num? submittedCount,
    num? inProgressCount,
    num? missingCount,
    num? avgScore,
    num? passingRate,
    num? totalViolations,
  }) {
    return ExamSummaryEntity(
      totalStudents: totalStudents ?? this.totalStudents,
      submittedCount: submittedCount ?? this.submittedCount,
      inProgressCount: inProgressCount ?? this.inProgressCount,
      missingCount: missingCount ?? this.missingCount,
      avgScore: avgScore ?? this.avgScore,
      passingRate: passingRate ?? this.passingRate,
      totalViolations: totalViolations ?? this.totalViolations,
    );
  }
}
