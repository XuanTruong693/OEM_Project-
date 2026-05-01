class ExamEntity {
  final int id;
  final String title;
  final String? examRoomCode;
  final String? status;
  final int duration;
  final String? timeOpen;
  final String? timeClose;

  ExamEntity({
    required this.id,
    required this.title,
    this.examRoomCode,
    this.status,
    required this.duration,
    this.timeOpen,
    this.timeClose,
  });
}
