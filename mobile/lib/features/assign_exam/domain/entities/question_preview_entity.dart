class QuestionPreviewEntity {
  final int row;
  final String type; // 'MCQ' hoặc 'Essay'
  final String questionText;
  final String originalQuestionText;
  final double? points;
  final List<String>? options;
  final int? correctOption;
  final String? modelAnswer;
  final List<String> errors;

  const QuestionPreviewEntity({
    required this.row,
    required this.type,
    required this.questionText,
    required this.originalQuestionText,
    this.points,
    this.options,
    this.correctOption,
    this.modelAnswer,
    required this.errors,
  });
}
