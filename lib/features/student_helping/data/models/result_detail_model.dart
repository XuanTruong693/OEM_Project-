import '../../domain/entities/result_detail_entity.dart';

class ResultDetailModel extends ResultDetailEntity {
  ResultDetailModel({
    required super.examTitle,
    required super.questions,
    required super.options,
    required super.answers,
  });

  factory ResultDetailModel.fromJson(Map<String, dynamic> json) {
    return ResultDetailModel(
      examTitle: json['exam_title']?.toString() ?? 'Chi tiết bài thi',
      questions:
          (json['questions'] as List<dynamic>?)
              ?.map((e) => QuestionModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      options:
          (json['options'] as List<dynamic>?)
              ?.map((e) => OptionModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      answers:
          (json['answers'] as List<dynamic>?)
              ?.map((e) => AnswerModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class QuestionModel extends QuestionEntity {
  QuestionModel({
    required super.questionId,
    required super.type,
    required super.points,
    required super.questionText,
    required super.modelAnswer,
  });

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    return QuestionModel(
      questionId: json['question_id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'MCQ',
      points: double.tryParse(json['points']?.toString() ?? '0') ?? 0.0,
      questionText: json['question_text']?.toString() ?? '',
      modelAnswer: json['model_answer']?.toString() ?? '',
    );
  }
}

class OptionModel extends OptionEntity {
  OptionModel({
    required super.optionId,
    required super.questionId,
    required super.optionText,
    required super.isCorrect,
  });

  factory OptionModel.fromJson(Map<String, dynamic> json) {
    return OptionModel(
      optionId: json['option_id']?.toString() ?? '',
      questionId: json['question_id']?.toString() ?? '',
      optionText: json['option_text']?.toString() ?? '',
      // Database trả is_correct = 1 hoặc true
      isCorrect: json['is_correct'] == 1 || json['is_correct'] == true,
    );
  }
}

class AnswerModel extends AnswerEntity {
  AnswerModel({
    required super.questionId,
    super.selectedOptionId,
    super.answerText,
    required super.score,
    super.instructorFeedback,
  });

  factory AnswerModel.fromJson(Map<String, dynamic> json) {
    return AnswerModel(
      questionId: json['question_id']?.toString() ?? '',
      selectedOptionId: json['selected_option_id']?.toString(),
      answerText: json['answer_text']?.toString(),
      score: double.tryParse(json['score']?.toString() ?? '0') ?? 0.0,
      instructorFeedback: json['instructor_feedback']?.toString(),
    );
  }
}
