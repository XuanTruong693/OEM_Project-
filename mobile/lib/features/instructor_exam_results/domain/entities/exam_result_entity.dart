class ExamResultEntity {
  final String? studentId;
  final String? studentName;
  final String? submissionId;
  final num? totalScore;
  final num? aiScore;
  final num? suggestedTotalScore;
  final num? mcqScore;
  final num? instructorConfirmed;
  final num? finalScore;
  final String? startedAt;
  final String? submittedAt;
  final num? durationSeconds;
  final num? durationMinutes;
  final num? cheatingCount;
  final bool hasFaceImage;
  final bool hasStudentCard;
  final String? status;

  const ExamResultEntity({
    this.studentId,
    this.studentName,
    this.submissionId,
    this.totalScore,
    this.aiScore,
    this.suggestedTotalScore,
    this.mcqScore,
    this.instructorConfirmed,
    this.finalScore,
    this.startedAt,
    this.submittedAt,
    this.durationSeconds,
    this.durationMinutes,
    this.cheatingCount,
    this.hasFaceImage = false,
    this.hasStudentCard = false,
    this.status,
  });

  factory ExamResultEntity.fromJson(Map<String, dynamic> json) {
    return ExamResultEntity(
      studentId: json['student_id']?.toString(),
      studentName: json['student_name']?.toString(),
      submissionId: json['submission_id']?.toString(),
      totalScore: json['total_score'] as num?,
      aiScore: json['ai_score'] as num?,
      suggestedTotalScore: json['suggested_total_score'] as num?,
      mcqScore: json['mcq_score'] as num?,
      instructorConfirmed: json['instructor_confirmed'] as num?,
      finalScore: json['final_score'] as num?,
      startedAt: json['started_at']?.toString(),
      submittedAt: json['submitted_at']?.toString(),
      durationSeconds: json['duration_seconds'] as num?,
      durationMinutes: json['duration_minutes'] as num?,
      cheatingCount: json['cheating_count'] as num?,
      hasFaceImage: json['has_face_image'] == 1 || json['has_face_image'] == true,
      hasStudentCard: json['has_student_card'] == 1 || json['has_student_card'] == true,
      status: json['status']?.toString(),
    );
  }
  ExamResultEntity copyWith({
    String? studentId,
    String? studentName,
    String? submissionId,
    num? totalScore,
    num? aiScore,
    num? suggestedTotalScore,
    num? mcqScore,
    num? instructorConfirmed,
    num? finalScore,
    String? startedAt,
    String? submittedAt,
    num? durationSeconds,
    num? durationMinutes,
    num? cheatingCount,
    bool? hasFaceImage,
    bool? hasStudentCard,
    String? status,
  }) {
    return ExamResultEntity(
      studentId: studentId ?? this.studentId,
      studentName: studentName ?? this.studentName,
      submissionId: submissionId ?? this.submissionId,
      totalScore: totalScore ?? this.totalScore,
      aiScore: aiScore ?? this.aiScore,
      suggestedTotalScore: suggestedTotalScore ?? this.suggestedTotalScore,
      mcqScore: mcqScore ?? this.mcqScore,
      instructorConfirmed: instructorConfirmed ?? this.instructorConfirmed,
      finalScore: finalScore ?? this.finalScore,
      startedAt: startedAt ?? this.startedAt,
      submittedAt: submittedAt ?? this.submittedAt,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      cheatingCount: cheatingCount ?? this.cheatingCount,
      hasFaceImage: hasFaceImage ?? this.hasFaceImage,
      hasStudentCard: hasStudentCard ?? this.hasStudentCard,
      status: status ?? this.status,
    );
  }
}
