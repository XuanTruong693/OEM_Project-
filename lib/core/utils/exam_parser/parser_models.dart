// Các class này đóng vai trò là "Vỏ bọc dữ liệu" (DTO) để truyền từ Core ra Feature
class ParsedQuestion {
  int row;
  String type; // 'MCQ' hoặc 'Essay'
  String questionText;
  String originalQuestionText;
  double? points;
  List<String>? options;
  int? correctOption;
  String? modelAnswer;
  List<String> errors;

  ParsedQuestion({
    required this.row,
    required this.type,
    required this.questionText,
    required this.originalQuestionText,
    this.points,
    this.options,
    this.correctOption,
    this.modelAnswer,
    List<String>? errors,
  }) : errors = errors ?? [];
}

class ExamParseResult {
  final List<ParsedQuestion> questions;
  final int total;
  final int mcqCount;
  final int essayCount;
  final int errorCount;
  final List<String> validationErrors;

  ExamParseResult({
    required this.questions,
    required this.total,
    required this.mcqCount,
    required this.essayCount,
    required this.errorCount,
    required this.validationErrors,
  });
}
