class ExamAnswerEntity {
  final String? questionId;
  final String? type;
  final String? text;
  final num? points;
  final dynamic options;
  final AnswerDetailEntity? answer;
  final String? modelAnswer;

  const ExamAnswerEntity({
    this.questionId,
    this.type,
    this.text,
    this.points,
    this.options,
    this.answer,
    this.modelAnswer,
  });

  factory ExamAnswerEntity.fromJson(Map<String, dynamic> json) {
    return ExamAnswerEntity(
      questionId: json['id']?.toString() ?? json['question_id']?.toString(),
      type: json['type']?.toString(),
      text: json['question_text']?.toString() ?? json['text']?.toString(),
      points: json['points'] as num?,
      options: json['options'],
      answer: json['answer'] != null ? AnswerDetailEntity.fromJson(json['answer'], options: json['options'] as List?) : null,
      modelAnswer: json['model_answer']?.toString(),
    );
  }
  ExamAnswerEntity copyWith({
    String? questionId,
    String? type,
    String? text,
    num? points,
    dynamic options,
    AnswerDetailEntity? answer,
    String? modelAnswer,
  }) {
    return ExamAnswerEntity(
      questionId: questionId ?? this.questionId,
      type: type ?? this.type,
      text: text ?? this.text,
      points: points ?? this.points,
      options: options ?? this.options,
      answer: answer ?? this.answer,
      modelAnswer: modelAnswer ?? this.modelAnswer,
    );
  }
}

class AnswerDetailEntity {
  final String? id;
  final String? studentAnswer;
  final num? score;
  final String? aiFeedback;
  final bool isCorrect;
  final String? feedback;
  final String? selectedOptionId;

  const AnswerDetailEntity({
    this.id,
    this.studentAnswer,
    this.score,
    this.aiFeedback,
    this.isCorrect = false,
    this.feedback,
    this.selectedOptionId,
  });

  AnswerDetailEntity copyWith({
    String? id,
    String? studentAnswer,
    num? score,
    String? aiFeedback,
    bool? isCorrect,
    String? feedback,
    String? selectedOptionId,
  }) {
    return AnswerDetailEntity(
      id: id ?? this.id,
      studentAnswer: studentAnswer ?? this.studentAnswer,
      score: score ?? this.score,
      aiFeedback: aiFeedback ?? this.aiFeedback,
      isCorrect: isCorrect ?? this.isCorrect,
      feedback: feedback ?? this.feedback,
      selectedOptionId: selectedOptionId ?? this.selectedOptionId,
    );
  }

  factory AnswerDetailEntity.fromJson(Map<String, dynamic> json, {List<dynamic>? options}) {
    String? studentAnswer = json['answer_text']?.toString() ?? json['student_answer']?.toString();
    String? selectedId = json['selected_option_id']?.toString();
    
    // If it's an MCQ and we have a selected_option_id but no answer_text
    if (studentAnswer == null && selectedId != null && options != null) {
      final option = options.firstWhere(
        (o) => o['option_id']?.toString() == selectedId || o['id']?.toString() == selectedId,
        orElse: () => null,
      );
      if (option != null) {
        studentAnswer = option['option_text']?.toString();
      }
    }

    return AnswerDetailEntity(
      id: json['id']?.toString(),
      studentAnswer: studentAnswer ?? json['selected_options']?.toString(),
      score: json['score'] as num?,
      aiFeedback: json['ai_explanation']?.toString() ?? json['ai_feedback']?.toString(),
      isCorrect: json['is_correct'] == 1 || json['is_correct'] == true,
      feedback: json['instructor_feedback']?.toString() ?? json['feedback']?.toString(),
      selectedOptionId: selectedId,
    );
  }
}
