class ExamSettingEntity {
  final int duration;
  final int durationMinutes;
  final DateTime timeOpen;
  final DateTime timeClose;
  final int maxAttempts;
  final bool requireFaceCheck;
  final bool requireStudentCard;
  final bool monitorScreen;
  final bool intentShuffle;
  final String gradingMode;
  final int maxPoints;

  const ExamSettingEntity({
    required this.duration,
    required this.durationMinutes,
    required this.timeOpen,
    required this.timeClose,
    required this.maxAttempts,
    required this.requireFaceCheck,
    required this.requireStudentCard,
    required this.monitorScreen,
    required this.intentShuffle,
    this.gradingMode = 'general',
    this.maxPoints = 10,
  });
}
