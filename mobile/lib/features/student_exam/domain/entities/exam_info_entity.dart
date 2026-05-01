class ExamInfoEntity {
  final String title;
  final String instructorName;
  final bool requireFaceCheck;
  final bool requireStudentCard;
  final bool monitorScreen;

  ExamInfoEntity({
    required this.title,
    required this.instructorName,
    required this.requireFaceCheck,
    required this.requireStudentCard,
    required this.monitorScreen,
  });
}
