class ResultDetailEntity {
  final String examTitle;
  final List<QuestionEntity> questions;
  final List<OptionEntity> options;
  final List<AnswerEntity> answers;

  ResultDetailEntity({
    required this.examTitle,
    required this.questions,
    required this.options,
    required this.answers,
  });
}

class QuestionEntity {
  final String questionId;
  final String type; // 'MCQ' hoặc 'Essay'
  final double points;
  final String questionText;
  final String modelAnswer;

  QuestionEntity({
    required this.questionId,
    required this.type,
    required this.points,
    required this.questionText,
    required this.modelAnswer,
  });
}

class OptionEntity {
  final String optionId;
  final String questionId;
  final String optionText;
  final bool
  isCorrect; // Chuyển đổi từ 1/0 của database sang boolean cho dễ dùng

  OptionEntity({
    required this.optionId,
    required this.questionId,
    required this.optionText,
    required this.isCorrect,
  });
}

class AnswerEntity {
  final String questionId;
  final String? selectedOptionId; // Dành cho MCQ
  final String? answerText; // Dành cho Essay
  final double score;
  final String? instructorFeedback;

  AnswerEntity({
    required this.questionId,
    this.selectedOptionId,
    this.answerText,
    required this.score,
    this.instructorFeedback,
  });
}
