class OpenExamEntity {
  final String id;
  final String title;
  final String status; // 'draft' hoặc 'published'
  final String? timeOpen;
  final String? timeClose;

  const OpenExamEntity({
    required this.id,
    required this.title,
    required this.status,
    this.timeOpen,
    this.timeClose,
  });
}
