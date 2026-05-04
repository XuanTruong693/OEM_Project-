class ResultItemEntity {
  final String submissionId;
  final String examId;
  final String examTitle;
  final double? mcqScore;
  final double? essayScore;
  final double? aiScore;
  final double? totalScore;
  final double? suggestedTotalScore;
  final int instructorConfirmed;
  final String status;
  final String submittedAt;
  final bool
  allowViewAnswers; // <-- Biến cực quan trọng để bật/tắt nút Xem đáp án

  ResultItemEntity({
    required this.submissionId,
    required this.examId,
    required this.examTitle,
    this.mcqScore,
    this.essayScore,
    this.aiScore,
    this.totalScore,
    this.suggestedTotalScore,
    required this.instructorConfirmed,
    required this.status,
    required this.submittedAt,
    required this.allowViewAnswers,
  });

  // Tạo hàm copyWith để lát nữa BLoC dễ dàng update biến allowViewAnswers từ Socket
  ResultItemEntity copyWith({bool? allowViewAnswers}) {
    return ResultItemEntity(
      submissionId: submissionId,
      examId: examId,
      examTitle: examTitle,
      mcqScore: mcqScore,
      essayScore: essayScore,
      aiScore: aiScore,
      totalScore: totalScore,
      suggestedTotalScore: suggestedTotalScore,
      instructorConfirmed: instructorConfirmed,
      status: status,
      submittedAt: submittedAt,
      allowViewAnswers: allowViewAnswers ?? this.allowViewAnswers,
    );
  }
}
