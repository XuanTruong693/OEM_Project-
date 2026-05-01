class ExamBankEntity {
  final String id;
  final String title;
  final String status; // 'draft' hoặc 'published'
  final String? timeOpen;
  final String? timeClose;
  final String? examRoomCode;
  final String? createdAt;

  const ExamBankEntity({
    required this.id,
    required this.title,
    required this.status,
    this.timeOpen,
    this.timeClose,
    this.examRoomCode,
    this.createdAt,
  });
}
