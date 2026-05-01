class OptionEntity {
  final String
  id; // Dùng String để an toàn hứng cả ID thật (int) lẫn tempId (String)
  final String content;
  final bool isCorrect;

  OptionEntity({
    required this.id,
    required this.content,
    required this.isCorrect,
  });
}
